from decimal import Decimal
import hashlib
import hmac
import json
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
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
        ).exclude(payment_method=SettlementPayment.PaymentMethod.CARD).select_related('paid_by', 'paid_to')
        return Response({
            'tour_id': tour_obj.id,
            'tour_title': tour_obj.title,
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
                    'payer_bank_name': payment.payer_bank_name if request.user.id in (payment.paid_by_id, payment.paid_to_id) else '',
                    'payer_account_title': payment.payer_account_title if request.user.id in (payment.paid_by_id, payment.paid_to_id) else '',
                    'payer_account_number': payment.payer_account_number if request.user.id in (payment.paid_by_id, payment.paid_to_id) else '',
                }
                for payment in pending_payments
            ],
        }, status=status.HTTP_200_OK)


class RecipientPaymentDetailsAPIView(APIView):
    """Return account details only to a tour member paying that recipient."""
    permission_classes = [IsAuthenticated]

    def get(self, request, tour_id, recipient_id):
        tour_obj = get_tour_for_member(request, tour_id)
        balances = {row['id']: row['balance'] for row in compute_tour_summary(tour_obj)['members']}
        if (
            recipient_id == request.user.id
            or balances.get(request.user.id, Decimal('0')) >= 0
            or balances.get(recipient_id, Decimal('0')) <= 0
            or not (
                tour_obj.created_by_id == recipient_id
                or TourMember.objects.filter(tour=tour_obj, user_id=recipient_id).exists()
            )
        ):
            raise PermissionDenied("This member is not a payment recipient in this group.")
        from apps.accounts.models import User
        recipient = get_object_or_404(User, pk=recipient_id)
        return Response({
            'full_name': recipient.full_name,
            'phone': recipient.phone,
            'bank_name': recipient.bank_name,
            'bank_account_title': recipient.bank_account_title,
            'bank_account_number': recipient.bank_account_number,
            'raast_id': recipient.raast_id,
            'easypaisa_number': recipient.easypaisa_number,
            'jazzcash_number': recipient.jazzcash_number,
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
        payer_bank_name = str(request.data.get('payer_bank_name', '')).strip()
        payer_account_title = str(request.data.get('payer_account_title', '')).strip()
        payer_account_number = str(request.data.get('payer_account_number', '')).strip()

        if payment_method not in SettlementPayment.PaymentMethod.values:
            return Response(
                {'payment_method': ['Choose cash, bank transfer, Raast, Easypaisa, or JazzCash.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if payment_method == SettlementPayment.PaymentMethod.CARD:
            return Response({'detail': 'Use the secure card checkout button to submit a card payment.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(transaction_reference) > 100:
            return Response(
                {'transaction_reference': ['Reference must be 100 characters or fewer.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if payment_method == SettlementPayment.PaymentMethod.BANK and not all((payer_bank_name, payer_account_title, payer_account_number)):
            return Response({'detail': 'Enter the bank name, account title, and account number used for this transfer.'}, status=status.HTTP_400_BAD_REQUEST)
        if any(len(value) > limit for value, limit in ((payer_bank_name, 100), (payer_account_title, 100), (payer_account_number, 50))):
            return Response({'detail': 'Bank details are too long.'}, status=status.HTTP_400_BAD_REQUEST)

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
            payer_bank_name=payer_bank_name if payment_method == SettlementPayment.PaymentMethod.BANK else '',
            payer_account_title=payer_account_title if payment_method == SettlementPayment.PaymentMethod.BANK else '',
            payer_account_number=payer_account_number if payment_method == SettlementPayment.PaymentMethod.BANK else '',
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
        if payment.payment_method == SettlementPayment.PaymentMethod.CARD:
            raise PermissionDenied('Card payments are approved automatically after card checkout confirms payment.')

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
        ).exclude(payment_method=SettlementPayment.PaymentMethod.CARD).filter(Q(paid_by=request.user) | Q(paid_to=request.user)).select_related(
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


def stripe_api_request(path, data=None):
    request = Request(
        f'https://api.stripe.com/v1/{path}',
        data=urlencode(data).encode() if data is not None else None,
        headers={'Authorization': f'Bearer {settings.STRIPE_SECRET_KEY}'},
        method='POST' if data is not None else 'GET',
    )
    try:
        with urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode())
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError('Unable to connect to the card payment provider.') from exc


class StripeCheckoutSessionAPIView(APIView):
    """Create a Stripe-hosted card checkout; card data never passes through PayTogether."""
    permission_classes = [IsAuthenticated]

    def post(self, request, tour_id):
        if not settings.STRIPE_SECRET_KEY:
            return Response({'detail': 'Card checkout is not configured. Add STRIPE_SECRET_KEY to the server environment.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        tour_obj = get_tour_for_member(request, tour_id)
        try:
            recipient_id = int(request.data.get('paid_to'))
        except (TypeError, ValueError):
            return Response({'detail': 'Choose a valid payment recipient.'}, status=status.HTTP_400_BAD_REQUEST)
        summary = compute_tour_summary(tour_obj)
        payer = next((member for member in summary['members'] if member['id'] == request.user.id), None)
        recipient = next((member for member in summary['members'] if member['id'] == recipient_id), None)
        if payer is None or recipient is None or payer['balance'] >= 0 or recipient['balance'] <= 0:
            return Response({'detail': 'This payment is no longer required.'}, status=status.HTTP_400_BAD_REQUEST)
        amount = min(-payer['balance'], recipient['balance']).quantize(Decimal('0.01'))
        payment = SettlementPayment.objects.create(
            tour=tour_obj,
            paid_by=request.user,
            paid_to_id=recipient_id,
            amount=amount,
            payment_method=SettlementPayment.PaymentMethod.CARD,
            status=SettlementPayment.Status.PENDING,
        )
        return_url = request.build_absolute_uri(f'/tours/{tour_id}/pay/{recipient_id}/')
        try:
            session = stripe_api_request('checkout/sessions', {
                'mode': 'payment',
                'payment_method_types[0]': 'card',
                'line_items[0][price_data][currency]': 'pkr',
                'line_items[0][price_data][product_data][name]': f'PayTogether · {tour_obj.title}',
                'line_items[0][price_data][unit_amount]': str(int(amount * 100)),
                'line_items[0][quantity]': '1',
                'customer_email': request.user.email,
                'client_reference_id': str(payment.id),
                'metadata[payment_id]': str(payment.id),
                'success_url': f'{return_url}?card_session={{CHECKOUT_SESSION_ID}}',
                'cancel_url': f'{return_url}?card_cancelled=1&payment_id={payment.id}',
            })
            payment.stripe_checkout_session_id = session['id']
            payment.save(update_fields=['stripe_checkout_session_id'])
            return Response({'checkout_url': session['url']}, status=status.HTTP_201_CREATED)
        except (RuntimeError, KeyError):
            payment.status = SettlementPayment.Status.CANCELLED
            payment.save(update_fields=['status'])
            return Response({'detail': 'Unable to start card checkout. Check Stripe configuration and try again.'}, status=status.HTTP_502_BAD_GATEWAY)


class StripeCheckoutConfirmAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def get(self, request, tour_id):
        session_id = request.query_params.get('session_id', '')
        payment = get_object_or_404(
            SettlementPayment,
            stripe_checkout_session_id=session_id,
            tour_id=tour_id,
            paid_by=request.user,
            payment_method=SettlementPayment.PaymentMethod.CARD,
        )
        if payment.status == SettlementPayment.Status.APPROVED:
            return Response({'success': 'Card payment confirmed.'}, status=status.HTTP_200_OK)
        if not settings.STRIPE_SECRET_KEY:
            return Response({'detail': 'Card checkout is not configured.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        try:
            session = stripe_api_request(f'checkout/sessions/{session_id}')
        except RuntimeError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        if session.get('payment_status') != 'paid' or session.get('metadata', {}).get('payment_id') != str(payment.id):
            return Response({'detail': 'Card payment has not been confirmed yet.'}, status=status.HTTP_400_BAD_REQUEST)
        payment.status = SettlementPayment.Status.APPROVED
        payment.save(update_fields=['status'])
        return Response({'success': 'Card payment confirmed.'}, status=status.HTTP_200_OK)


class StripeCheckoutCancelAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, tour_id):
        payment = get_object_or_404(
            SettlementPayment,
            pk=request.data.get('payment_id'),
            tour_id=tour_id,
            paid_by=request.user,
            payment_method=SettlementPayment.PaymentMethod.CARD,
            status=SettlementPayment.Status.PENDING,
        )
        payment.status = SettlementPayment.Status.CANCELLED
        payment.save(update_fields=['status'])
        return Response({'success': 'Card checkout cancelled.'}, status=status.HTTP_200_OK)


@csrf_exempt
def stripe_webhook(request):
    if request.method != 'POST' or not settings.STRIPE_WEBHOOK_SECRET:
        return HttpResponse(status=400)
    signature = request.headers.get('Stripe-Signature', '')
    try:
        parts = dict(item.split('=', 1) for item in signature.split(',') if '=' in item)
        timestamp = int(parts.get('t', '0'))
        signed_payload = str(timestamp).encode() + b'.' + request.body
        expected = hmac.new(settings.STRIPE_WEBHOOK_SECRET.encode(), signed_payload, hashlib.sha256).hexdigest()
        if abs(int(time.time()) - timestamp) > 300 or not hmac.compare_digest(expected, parts.get('v1', '')):
            return HttpResponse(status=400)
        event = json.loads(request.body)
    except (ValueError, TypeError, json.JSONDecodeError):
        return HttpResponse(status=400)
    event_type = event.get('type')
    session = event.get('data', {}).get('object', {})
    payment = SettlementPayment.objects.filter(stripe_checkout_session_id=session.get('id')).first()
    if payment and event_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded') and session.get('payment_status') == 'paid':
        payment.status = SettlementPayment.Status.APPROVED
        payment.save(update_fields=['status'])
    elif payment and event_type == 'checkout.session.expired' and payment.status == SettlementPayment.Status.PENDING:
        payment.status = SettlementPayment.Status.CANCELLED
        payment.save(update_fields=['status'])
    return HttpResponse(status=200)
