from django.urls import path
from .views import edit_tour_page, join_tour_page, payment_page, tour_detail_page

app_name = 'tours_page'

urlpatterns = [
   path('tours/<int:tour_id>/', tour_detail_page, name='tour_detail'),
   path('tours/<int:tour_id>/pay/<int:recipient_id>/', payment_page, name='payment'),
   path('tours/edit/<int:tour_id>/', edit_tour_page, name='edit_tour'),
   path('tours/join/', join_tour_page, name='join_tour'),
]
