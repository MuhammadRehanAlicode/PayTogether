from django.urls import path

from .views import JoinTourAPIView, createTourapiview, tour_detail_page, TourdetailAPIView, tourlistAPIView

app_name = 'tours'

urlpatterns = [
    path("tour/<int:tour_id>/", tour_detail_page, name="tour-detail-page"), 
    path('join/', JoinTourAPIView.as_view(), name='join-tour'),
    path('', tourlistAPIView.as_view(), name='list-tours'),
    path('<int:pk>/', TourdetailAPIView.as_view(), name='tour-detail'), 
    path('create/', createTourapiview.as_view(), name='create-tour'),
]
