from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.expencess.services import compute_user_totals
from apps.tours.models import tour


class DashboardView(LoginRequiredMixin, TemplateView):
    template_name = "dashboard/dashboard.html"
    login_url = "accounts:login"


class ToursView(LoginRequiredMixin, TemplateView):
    template_name = "tours/tours list.html"
    login_url = "accounts:login"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["tours"] = tour.objects.select_related("created_by").order_by("-created_at")
        return context


class DashboardSummaryAPIView(APIView):
    """Aggregated numbers for the dashboard cards: tours, members, expenses, balance."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        totals = compute_user_totals(request.user)
        return Response({
            "total_tours": totals["total_tours"],
            "total_members": totals["total_members"],
            "total_expenses": str(totals["total_expenses"]),
            "total_paid": str(totals["total_paid"]),
            "total_share": str(totals["total_share"]),
            "balance": str(totals["balance"]),
        })
