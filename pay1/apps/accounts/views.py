from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import (
    registerSerializer,
    loginSerializer,
    profileserializer,
    updateProfileSerializer,
    changePasswordSerializer,
)
from rest_framework.permissions import AllowAny
from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework.permissions import (AllowAny  , IsAuthenticated,)
from django.contrib.auth import login, logout

# Create your views here.

class loginpageview(TemplateView):
    template_name = "auth/login.html"


class registerpageview(TemplateView):
    template_name = "auth/register.html"


class profilepageview(LoginRequiredMixin, TemplateView):
    """FR3: page where a user edits their profile information."""
    template_name = "auth/profile.html"
    login_url = "accounts:login"


class profileAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        serializer = profileserializer(user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = updateProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(profileserializer(request.user).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = changePasswordSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            request.user.set_password(serializer.validated_data["new_password"])
            request.user.save(update_fields=["password"])
            return Response({"success": "Password updated successfully."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    """FR9: User Logout. Blacklists the refresh token so it can no longer be used."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                pass
        logout(request)
        return Response({"success": "Logged out successfully."}, status=status.HTTP_200_OK)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = registerSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(
                {
                    "success": "User registered successfully.",
                    "user": {
                        "id": user.id,
                        "email": user.email,
                    },
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = loginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            login(request, user)
            refresh = RefreshToken.for_user(user)
            return Response(
                {
                    "success": "User logged in successfully.",
                    "user": {
                        "id": user.id,
                        "email": user.email,
                    },
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
                status=status.HTTP_200_OK,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
