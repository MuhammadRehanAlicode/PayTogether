from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tours.models import TourMember, tour as Tour

from .models import Expense, SettlementPayment
from .serializers import expenseSerializer
from .services import compute_tour_summary


def get_tour_for_member(request, tour_id):
    """Return the tour if the requester created it or has joined it, else 404/403."""
    tour_obj = get_object_or_404(Tour, pk=tour_id)
    is_member = (
        tour_obj.created_by_id == request.user.id
        or TourMember.objects.filter(tour=tour_obj, user=request.user).exists()
    )
    if not is_member:
        raise PermissionDenied("You must join this tour before you can view its expenses.")
    return tour_obj


class ExpenseListCreateAPIView(generics.ListCreateAPIView):
    """FR6: add expenses. Lists and creates expenses scoped to one tour."""
    serializer_class = expenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tour_obj = get_tour_for_member(self.request, self.kwargs['tour_id'])
        return Expense.objects.filter(tour=tour_obj).select_related('paid_by', 'tour')

    def perform_create(self, serializer):
        tour_obj = get_tour_for_member(self.request, self.kwargs['tour_id'])
        serializer.save(tour=tour_obj, paid_by=self.request.user)


class ExpenseDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """FR8: edit expense. Only the member who added an expense may edit or delete it."""
    serializer_class = expenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tour_obj = get_tour_for_member(self.request, self.kwargs['tour_id'])
        return Expense.objects.filter(tour=tour_obj).select_related('paid_by', 'tour')

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method not in ('GET', 'HEAD', 'OPTIONS') and obj.paid_by_id != request.user.id:
            raise PermissionDenied("Only the member who added this expense can edit it.")


class TourSummaryAPIView(APIView):
    """FR7: view total expenses and each member's share/balance for one tour."""
    permission_classes = [IsAuthenticated]

    def get(self, request, tour_id):
        tour_obj = get_tour_for_member(request, tour_id)
        summary = compute_tour_summary(tour_obj)
        pending_payments = tour_obj.settlement_payments.filter(
            status=SettlementPayment.Status.PENDING
        ).select_related('paid_by', 'paid_to')
        return Response({
            'tour_id': tour_obj.id,
            'total_expenses': str(summary['total_expenses']),
            'member_count': summary['member_count'],
            'share_per_member': str(summary['share_per_member']),
            'members': [
                {
                    'id': row['id'],
                    'full_name': row['full_name'],
                    'email': row['email'],
                    'is_organizer': row['is_organizer'],
                    'paid': str(row['paid']),
                    'settlement_paid': str(row['settlement_paid']),
                    'settlement_received': str(row['settlement_received']),
                    'share': str(row['share']),
                    'balance': str(row['balance']),
                    'payment_status': 'unpaid' if row['balance'] < 0 else 'paid',
                    'is_you': row['id'] == request.user.id,
                }
                for row in summary['members']
            ],
            'pending_payments': [
                {
                    'id': payment.id,
                    'paid_by_id': payment.paid_by_id,
                    'paid_by_name': payment.paid_by.full_name or payment.paid_by.email,
                    'paid_to_id': payment.paid_to_id,
                    'paid_to_name': payment.paid_to.full_name or payment.paid_to.email,
                    'amount': str(payment.amount),
                    'payment_method': payment.payment_method,
                    'transaction_reference': payment.transaction_reference,
                    'is_awaiting_your_approval': payment.paid_to_id == request.user.id,
                    'is_your_payment': payment.paid_by_id == request.user.id,
                }
                for payment in pending_payments
            ],
        }, status=status.HTTP_200_OK)


class SettlementPaymentAPIView(APIView):
    """Records that the logged-in member repaid another member of a tour."""

    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, tour_id):
        tour_obj = get_tour_for_member(request, tour_id)
        recipient_id = request.data.get('paid_to')
        payment_method = request.data.get('payment_method')
        transaction_reference = str(request.data.get('transaction_reference', '')).strip()

        if payment_method not in SettlementPayment.PaymentMethod.values:
            return Response(
                {'payment_method': ['Choose cash, bank transfer, Raast, Easypaisa, or JazzCash.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(transaction_reference) > 100:
            return Response(
                {'transaction_reference': ['Reference must be 100 characters or fewer.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            amount = Decimal(str(request.data.get('amount'))).quantize(Decimal('0.01'))
        except (ArithmeticError, TypeError, ValueError):
            return Response({'amount': ['Enter a valid payment amount.']}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({'amount': ['Payment amount must be greater than zero.']}, status=status.HTTP_400_BAD_REQUEST)

        summary = compute_tour_summary(tour_obj)
        payer = next((member for member in summary['members'] if member['id'] == request.user.id), None)
        recipient = next((member for member in summary['members'] if member['id'] == recipient_id), None)
        if payer is None or recipient is None:
            return Response({'paid_to': ['Choose a member of this tour.']}, status=status.HTTP_400_BAD_REQUEST)
        if payer['balance'] >= 0:
            return Response({'detail': 'You do not have an outstanding balance to pay.'}, status=status.HTTP_400_BAD_REQUEST)
        if recipient['balance'] <= 0:
            return Response({'paid_to': ['This member is not owed a payment.']}, status=status.HTTP_400_BAD_REQUEST)

        maximum_payment = min(-payer['balance'], recipient['balance'])
        if amount > maximum_payment:
            return Response(
                {'amount': [f'You can pay at most PKR {maximum_payment:,.2f} to this member.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        SettlementPayment.objects.create(
            tour=tour_obj,
            paid_by=request.user,
            paid_to_id=recipient_id,
            amount=amount,
            payment_method=payment_method,
            transaction_reference=transaction_reference,
        )
        return Response({'success': 'Payment submitted and waiting for approval.'}, status=status.HTTP_201_CREATED)


class SettlementPaymentApprovalAPIView(APIView):
    """Lets the recipient approve a cash or bank payment made to them."""

    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, tour_id, payment_id):
        tour_obj = get_tour_for_member(request, tour_id)
        payment = get_object_or_404(
            SettlementPayment,
            pk=payment_id,
            tour=tour_obj,
            status=SettlementPayment.Status.PENDING,
        )
        if payment.paid_to_id != request.user.id:
            raise PermissionDenied('Only the payment recipient can approve this payment.')

        payment.status = SettlementPayment.Status.APPROVED
        payment.save(update_fields=['status'])
        return Response({'success': 'Payment approved.'}, status=status.HTTP_200_OK)


class NotificationAPIView(APIView):
    """Return actionable, account-wide settlement alerts for the bell menu."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        tours = Tour.objects.filter(
            Q(created_by=request.user) | Q(memberships__user=request.user)
        ).distinct().order_by('-created_at')
        notifications = []

        pending = SettlementPayment.objects.filter(
            tour__in=tours,
            status=SettlementPayment.Status.PENDING,
        ).filter(Q(paid_by=request.user) | Q(paid_to=request.user)).select_related(
            'tour', 'paid_by', 'paid_to'
        )
        tours_with_payment_in_progress = set()
        for payment in pending:
            tours_with_payment_in_progress.add(payment.tour_id)
            if payment.paid_to_id == request.user.id:
                notifications.append({
                    'id': f'approval-{payment.id}',
                    'kind': 'approval',
                    'title': 'Payment needs your approval',
                    'body': f'{payment.paid_by.full_name or payment.paid_by.email} sent PKR {payment.amount:,.2f} for {payment.tour.title}.',
                    'action_url': f'/tours/{payment.tour_id}/',
                    'action_label': 'Review payment',
                })
            else:
                notifications.append({
                    'id': f'pending-{payment.id}',
                    'kind': 'pending',
                    'title': 'Payment awaiting approval',
                    'body': f'Your PKR {payment.amount:,.2f} payment for {payment.tour.title} is being reviewed.',
                    'action_url': f'/tours/{payment.tour_id}/',
                    'action_label': 'View balance',
                })

        for tour_obj in tours:
            # Avoid inviting a second payment while one is already awaiting review.
            if tour_obj.id in tours_with_payment_in_progress:
                continue
            summary = compute_tour_summary(tour_obj)
            own_row = next((row for row in summary['members'] if row['id'] == request.user.id), None)
            if not own_row or own_row['balance'] >= 0:
                continue
            recipient = next((row for row in summary['members'] if row['balance'] > 0), None)
            if recipient is None:
                continue
            amount = min(-own_row['balance'], recipient['balance'])
            notifications.append({
                'id': f'settle-{tour_obj.id}',
                'kind': 'due',
                'title': 'You have a balance to settle',
                'body': f'Pay PKR {amount:,.2f} to {recipient["full_name"] or recipient["email"]} for {tour_obj.title}.',
                'action_url': f'/tours/{tour_obj.id}/pay/{recipient["id"]}/',
                'action_label': 'Settle now',
            })

        return Response({'count': len(notifications), 'notifications': notifications[:12]})
