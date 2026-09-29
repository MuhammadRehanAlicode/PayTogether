"""Helpers for turning raw Expense rows into a per-member balance sheet.

Split logic (matches FR7 in the SRS): every tour expense is divided
equally between the tour creator and every member who has joined the
tour. Each member's balance is what they paid minus their equal share -
a positive balance means the group owes them money, a negative balance
means they still owe the group.
"""
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Sum

from .models import Expense, SettlementPayment


def get_tour_members(tour):
    """Return the tour creator plus every joined member, without duplicates."""
    members = list(tour.memberships.select_related('user').all())
    member_users = [membership.user for membership in members]
    if tour.created_by not in member_users:
        member_users.insert(0, tour.created_by)
    return member_users


def compute_tour_summary(tour):
    members = get_tour_members(tour)
    member_count = len(members) or 1

    total = tour.expenses.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    share = (total / member_count).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    paid_by_user = {
        row['paid_by']: row['paid']
        for row in tour.expenses.values('paid_by').annotate(paid=Sum('amount'))
    }
    approved_settlements = tour.settlement_payments.filter(
        status=SettlementPayment.Status.APPROVED
    )
    settlements_made = {
        row['paid_by']: row['amount']
        for row in approved_settlements.values('paid_by').annotate(amount=Sum('amount'))
    }
    settlements_received = {
        row['paid_to']: row['amount']
        for row in approved_settlements.values('paid_to').annotate(amount=Sum('amount'))
    }

    member_rows = []
    for user in members:
        paid = paid_by_user.get(user.id, Decimal('0.00'))
        settlement_paid = settlements_made.get(user.id, Decimal('0.00'))
        settlement_received = settlements_received.get(user.id, Decimal('0.00'))
        # A repayment improves the payer's negative balance and reduces the
        # recipient's positive balance.
        balance = (paid - share + settlement_paid - settlement_received).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        member_rows.append({
            'id': user.id,
            'full_name': user.full_name,
            'email': user.email,
            'is_organizer': user.id == tour.created_by_id,
            'paid': paid,
            'settlement_paid': settlement_paid,
            'settlement_received': settlement_received,
            'share': share,
            'balance': balance,
        })

    return {
        'total_expenses': total,
        'member_count': member_count,
        'share_per_member': share,
        'members': member_rows,
    }


def compute_user_totals(user):
    """Aggregate a user's paid amount / share / balance across every tour they belong to."""
    from apps.tours.models import tour as Tour

    created = Tour.objects.filter(created_by=user)
    joined = Tour.objects.filter(memberships__user=user)
    all_tours = (created | joined).distinct()

    total_expenses = Decimal('0.00')
    total_paid = Decimal('0.00')
    total_share = Decimal('0.00')
    member_ids = set()

    for t in all_tours:
        summary = compute_tour_summary(t)
        total_expenses += summary['total_expenses']
        for row in summary['members']:
            member_ids.add(row['id'])
            if row['id'] == user.id:
                total_paid += row['paid']
                total_share += row['share']

    balance = Decimal('0.00')
    for t in all_tours:
        summary = compute_tour_summary(t)
        own_row = next((row for row in summary['members'] if row['id'] == user.id), None)
        if own_row:
            balance += own_row['balance']
    balance = balance.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    return {
        'total_tours': all_tours.count(),
        'total_members': len(member_ids),
        'total_expenses': total_expenses,
        'total_paid': total_paid,
        'total_share': total_share,
        'balance': balance,
    }
