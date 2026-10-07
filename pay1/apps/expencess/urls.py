from django.urls import path

from .views import (
    ExpenseDetailAPIView,
    ExpenseListCreateAPIView,
    SettlementPaymentAPIView,
    SettlementPaymentApprovalAPIView,
    RecipientPaymentDetailsAPIView,
    TourSummaryAPIView,
    NotificationAPIView,
    StripeCheckoutSessionAPIView,
    StripeCheckoutConfirmAPIView,
    StripeCheckoutCancelAPIView,
)

app_name = 'expenses'

urlpatterns = [
    path('expenses/', ExpenseListCreateAPIView.as_view(), name='list-create'),
    path('expenses/<int:pk>/', ExpenseDetailAPIView.as_view(), name='detail'),
    path('summary/', TourSummaryAPIView.as_view(), name='summary'),
    path('payments/', SettlementPaymentAPIView.as_view(), name='payments'),
    path('payments/card-checkout/', StripeCheckoutSessionAPIView.as_view(), name='card-checkout'),
    path('payments/card-confirm/', StripeCheckoutConfirmAPIView.as_view(), name='card-confirm'),
    path('payments/card-cancel/', StripeCheckoutCancelAPIView.as_view(), name='card-cancel'),
    path('payments/<int:payment_id>/approve/', SettlementPaymentApprovalAPIView.as_view(), name='payment-approve'),
    path('payment-details/<int:recipient_id>/', RecipientPaymentDetailsAPIView.as_view(), name='payment-details'),
]
