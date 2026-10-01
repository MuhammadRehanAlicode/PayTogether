from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.tours.models import TourMember, tour

from .models import Expense, SettlementPayment


class SettlementPaymentTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='payer@example.com', full_name='Payer', password='password123'
        )
        self.member = User.objects.create_user(
            email='member@example.com', full_name='Member', password='password123'
        )
        self.tour = tour.objects.create(
            title='Trip', destination='Hunza', price='100.00', created_by=self.owner
        )
        TourMember.objects.create(tour=self.tour, user=self.member)
        Expense.objects.create(tour=self.tour, paid_by=self.owner, title='Hotel', amount='100.00')
        self.client = APIClient()
        self.client.force_authenticate(self.member)

    def test_member_can_record_payment_and_becomes_paid(self):
        response = self.client.post(
            f'/api/tours/{self.tour.pk}/payments/',
            {'paid_to': self.owner.id, 'amount': '50.00', 'payment_method': 'cash'},
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.content)
        payment = SettlementPayment.objects.get(tour=self.tour)
        self.assertEqual(payment.status, SettlementPayment.Status.PENDING)

        # The member is still unpaid until the recipient approves the payment.
        summary = self.client.get(f'/api/tours/{self.tour.pk}/summary/').data
        member_row = next(row for row in summary['members'] if row['id'] == self.member.id)
        self.assertEqual(member_row['payment_status'], 'unpaid')

        self.client.force_authenticate(self.owner)
        approval = self.client.post(f'/api/tours/{self.tour.pk}/payments/{payment.pk}/approve/')
        self.assertEqual(approval.status_code, 200, approval.content)

        summary = self.client.get(f'/api/tours/{self.tour.pk}/summary/').data
        member_row = next(row for row in summary['members'] if row['id'] == self.member.id)
        self.assertEqual(member_row['payment_status'], 'paid', member_row)
        self.assertEqual(member_row['balance'], '0.00')

    def test_raast_transfer_waits_for_recipient_confirmation(self):
        response = self.client.post(
            f'/api/tours/{self.tour.pk}/payments/',
            {'paid_to': self.owner.id, 'amount': '50.00', 'payment_method': 'raast'},
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.content)
        payment = SettlementPayment.objects.get(tour=self.tour)
        self.assertEqual(payment.payment_method, SettlementPayment.PaymentMethod.RAAST)
        self.assertEqual(payment.status, SettlementPayment.Status.PENDING)
