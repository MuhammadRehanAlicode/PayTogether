from pathlib import Path

from django.test import TestCase
from django.urls import reverse

from config.settings import BASE_DIR
from .models import User


class AuthenticationFlowTests(TestCase):
    def test_registration_api_creates_a_user(self):
        response = self.client.post(
            reverse("accounts:api_register"),
            {
                "email": "new.user@example.com",
                "full_name": "New User",
                "password": "SecurePass123!",
                "confirm_password": "SecurePass123!",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(email="new.user@example.com").exists())

    def test_login_creates_session_and_dashboard_loads(self):
        user = User.objects.create_user(
            email="member@example.com",
            full_name="Member",
            password="SecurePass123!",
        )

        response = self.client.post(
            reverse("accounts:api_login"),
            {"email": user.email, "password": "SecurePass123!"},
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertIn("access", response.json())
        dashboard_response = self.client.get(reverse("core:dashboard"))
        self.assertEqual(dashboard_response.status_code, 200)

    def test_login_frontend_sends_csrf_token(self):
        login_js = Path(BASE_DIR / "static" / "js" / "login.js").read_text(encoding="utf-8")

        self.assertIn("csrftoken", login_js)
        self.assertIn("X-CSRFToken", login_js)
