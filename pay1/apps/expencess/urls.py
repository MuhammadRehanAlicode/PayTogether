from django.urls import path

from .views import (
    ExpenseDetailAPIView,
    ExpenseListCreateAPIView,
    SettlementPaymentAPIView,
    SettlementPaymentApprovalAPIView,
    TourSummaryAPIView,
    NotificationAPIView,
)

app_name = 'expenses'

urlpatterns = [
    path('expenses/', ExpenseListCreateAPIView.as_view(), name='list-create'),
    path('expenses/<int:pk>/', ExpenseDetailAPIView.as_view(), name='detail'),
    path('summary/', TourSummaryAPIView.as_view(), name='summary'),
    path('payments/', SettlementPaymentAPIView.as_view(), name='payments'),
    path('payments/<int:payment_id>/approve/', SettlementPaymentApprovalAPIView.as_view(), name='payment-approve'),
]
