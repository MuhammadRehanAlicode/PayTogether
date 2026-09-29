from django.urls import path

from .views import DashboardSummaryAPIView, DashboardView, ToursView

app_name = "core"

urlpatterns = [
    path("", DashboardView.as_view(), name="dashboard"),
    path("tours/", ToursView.as_view(), name="tours"),
    path("api/summary/", DashboardSummaryAPIView.as_view(), name="api-summary"),
]
