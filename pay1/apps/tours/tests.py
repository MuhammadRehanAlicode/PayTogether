from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.tours.models import TourMember, tour


class JoinTourAPITests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='owner@example.com', full_name='Owner', phone='111', password='password123'
        )
        self.member = User.objects.create_user(
            email='member@example.com', full_name='Member', phone='222', password='password123'
        )
        self.tour = tour.objects.create(
            title='Northern Escape', description='', price='1000.00',
            destination='Hunza', created_by=self.owner,
        )
        self.client = APIClient()

    def test_join_code_is_generated_and_in_tour_api_response(self):
        self.assertEqual(len(self.tour.join_code), 8)
        self.client.force_authenticate(self.owner)
        response = self.client.get(f'/api/tours/{self.tour.pk}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['join_code'], self.tour.join_code)

    def test_join_requires_authentication(self):
        response = self.client.post('/api/tours/join/', {'join_code': self.tour.join_code}, format='json')
        self.assertEqual(response.status_code, 401)

    def test_empty_and_invalid_codes_are_rejected(self):
        self.client.force_authenticate(self.member)
        empty = self.client.post('/api/tours/join/', {}, format='json')
        invalid = self.client.post('/api/tours/join/', {'join_code': 'NOTREAL1'}, format='json')
        self.assertEqual(empty.status_code, 400)
        self.assertEqual(invalid.status_code, 404)

    def test_user_can_join_only_once(self):
        self.client.force_authenticate(self.member)
        joined = self.client.post('/api/tours/join/', {'join_code': self.tour.join_code}, format='json')
        duplicate = self.client.post('/api/tours/join/', {'join_code': self.tour.join_code}, format='json')
        self.assertEqual(joined.status_code, 201)
        self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(TourMember.objects.filter(tour=self.tour, user=self.member).count(), 1)

    def test_joined_member_can_load_tour_details_and_image(self):
        self.client.force_authenticate(self.member)
        joined = self.client.post('/api/tours/join/', {'join_code': self.tour.join_code}, format='json')
        self.assertEqual(joined.status_code, 201)

        response = self.client.get(f'/api/tours/{self.tour.pk}/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['title'], self.tour.title)
        self.assertEqual(response.data['destination'], self.tour.destination)

    def test_joined_member_cannot_edit_tour(self):
        self.client.force_authenticate(self.member)
        self.client.post('/api/tours/join/', {'join_code': self.tour.join_code}, format='json')

        response = self.client.patch(
            f'/api/tours/{self.tour.pk}/', {'title': 'Changed by member'}, format='json'
        )

        self.assertEqual(response.status_code, 404)
        self.tour.refresh_from_db()
        self.assertEqual(self.tour.title, 'Northern Escape')
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.tours.models import tour


class TourApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="tour-owner@example.com", password="secure-password-123"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_authenticated_user_can_create_a_tour(self):
        response = self.client.post(
            "/api/tours/create/",
            {
                "title": "Northern Adventure",
                "destination": "Hunza",
                "price": "25000.00",
                "states": "Gilgit-Baltistan",
                "description": "A five-day tour.",
            },
        )

        self.assertEqual(response.status_code, 201, response.content)
        created_tour = tour.objects.get()
        self.assertEqual(created_tour.created_by, self.user)
        self.assertEqual(created_tour.price, 25000)

    def test_tour_list_uses_the_expected_api_route(self):
        response = self.client.get("/api/tours/")
        self.assertEqual(response.status_code, 200, response.content)

    def test_tour_list_paginates_in_groups_of_five(self):
        tour.objects.bulk_create([
            tour(
                title=f"Tour {number}", destination="Hunza", price=1000,
                created_by=self.user,
            )
            for number in range(6)
        ])

        response = self.client.get("/api/tours/?page=1")

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data["count"], 6)
        self.assertEqual(len(response.data["results"]), 5)
        self.assertIsNotNone(response.data["next"])
