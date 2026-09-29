from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse


class ToursPageTests(TestCase):
    def test_dashboard_tours_page_loads_for_authenticated_user(self):
        user = get_user_model().objects.create_user(
            email='test@example.com',
            full_name='Test User',
            phone='1234567890',
            password='StrongPass123!',
        )

        self.client.force_login(user)
        response = self.client.get(reverse('core:tours'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Tours')
