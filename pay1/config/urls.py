"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from apps.tours.views import Tourlistpageview, createtourpageview, join_tour_page
from apps.expencess.views import NotificationAPIView, stripe_webhook

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('apps.accounts.urls', namespace='accounts')),
    path('tours/', Tourlistpageview.as_view(), name='tour-list-page'),
    path('tours/create/', createtourpageview.as_view(), name='create-tour-page'),
    path('tours/join/', join_tour_page, name='join-tour-page'),
    path('api/tours/', include('apps.tours.urls', namespace='tours')),
    path('api/tours/<int:tour_id>/', include('apps.expencess.urls', namespace='expenses')),
    path('api/notifications/', NotificationAPIView.as_view(), name='notifications'),
    path('api/stripe/webhook/', stripe_webhook, name='stripe-webhook'),
    path('dashboard/', include('apps.core.urls', namespace='core')),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('', include('apps.tours.page_urls', namespace='tours_page')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
