from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class Expense(models.Model):
    """A single expense recorded by a member of a tour (FR6/FR7/FR8)."""

    tour = models.ForeignKey(
        'tours.tour',
        on_delete=models.CASCADE,
        related_name='expenses',
    )
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='expenses_paid',
    )
    title = models.CharField(max_length=150)
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.title} - {self.amount} ({self.tour})'


class SettlementPayment(models.Model):
    """A repayment from one tour member to another.

    Expenses record who initially paid a bill. A settlement records that a
    member has repaid somebody who covered more than their share.
    """

    class PaymentMethod(models.TextChoices):
        CASH = 'cash', 'Cash'
        BANK = 'bank', 'Bank transfer'
        CARD = 'card', 'Card'
        RAAST = 'raast', 'Raast transfer (manual confirmation)'
        EASYPAISA = 'easypaisa', 'Easypaisa (manual confirmation)'
        JAZZCASH = 'jazzcash', 'JazzCash (manual confirmation)'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending approval'
        APPROVED = 'approved', 'Approved'
        CANCELLED = 'cancelled', 'Cancelled'

    tour = models.ForeignKey(
        'tours.tour',
        on_delete=models.CASCADE,
        related_name='settlement_payments',
    )
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='settlements_made',
    )
    paid_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='settlements_received',
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
    )
    payment_method = models.CharField(max_length=32, choices=PaymentMethod.choices)
    transaction_reference = models.CharField(max_length=100, blank=True)
    payer_bank_name = models.CharField(max_length=100, blank=True)
    payer_account_title = models.CharField(max_length=100, blank=True)
    payer_account_number = models.CharField(max_length=50, blank=True)
    stripe_checkout_session_id = models.CharField(max_length=100, blank=True, null=True, unique=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.paid_by} paid {self.paid_to} {self.amount} for {self.tour}'
