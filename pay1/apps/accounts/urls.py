from django.urls import path

from .views import (
    profileAPIView,
    profilepageview,
    registerpageview,
    loginpageview,
    RegisterView,
    LoginView,
    LogoutView,
    ChangePasswordView,
)

app_name = "accounts"
urlpatterns = [
    path("", loginpageview.as_view(), name="login"),
    path("register/", registerpageview.as_view(), name="register"),
    path("login/", loginpageview.as_view(), name="login_page"),
    path("profile/", profilepageview.as_view(), name="profile_page"),
    path("api/register/", RegisterView.as_view(), name="api_register"),
    path("api/login/", LoginView.as_view(), name="api_login"),
    path("api/logout/", LogoutView.as_view(), name="api_logout"),
    path("api/profile/", profileAPIView.as_view(), name="api_profile"),
    path("api/profile/change-password/", ChangePasswordView.as_view(), name="api_change_password"),
]
