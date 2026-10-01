from django.shortcuts import render
from django.views.generic import TemplateView

# Create your views here.

from django.views import generic
from rest_framework .views import APIView
from rest_framework.response import Response
from rest_framework .permissions import IsAuthenticated
from rest_framework import status
from rest_framework .filters import SearchFilter , OrderingFilter
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q
from rest_framework.permissions import SAFE_METHODS

from .models import tour, TourMember
from .serilizers import tourserializer
from rest_framework import generics

from .pagination import tourPagination

def tour_detail_page(request, tour_id):
    return render(request, 'tours/tours-details.html', {'tour_id': tour_id})

def edit_tour_page(request, tour_id):
    return render(request, 'tours/edit-tour.html', {'tour_id': tour_id})


def payment_page(request, tour_id, recipient_id):
    return render(request, 'tours/payment.html', {
        'tour_id': tour_id,
        'recipient_id': recipient_id,
    })


def join_tour_page(request):
    return render(request, 'tours/join-tour.html')
class TourdetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = tourserializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Tour members need to read the full detail payload (including the
        # uploaded image URL), while edits and deletes remain owner-only.
        if self.request.method in SAFE_METHODS:
            return tour.objects.filter(
                Q(created_by=self.request.user)
                | Q(memberships__user=self.request.user)
            ).distinct()
        return tour.objects.filter(created_by=self.request.user)
    

class Tourlistpageview(TemplateView):
    template_name = "tours/tours list.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["tours"] = tour.objects.select_related("created_by").order_by("-created_at")
        return context

class createtourpageview(TemplateView):
    template_name = "tours/create tours.html"

class createTourapiview(generics.CreateAPIView):
    serializer_class = tourserializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class tourlistAPIView(generics.ListAPIView):
    serializer_class = tourserializer
    permission_classes = [IsAuthenticated]
    pagination_class = tourPagination
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['title', 'description', 'states', 'destination']
    ordering_fields = ['created_at', 'price', 'title']

    def get_queryset(self):
        scope = self.request.query_params.get('scope', 'created')
        if scope == 'joined':
            return tour.objects.filter(memberships__user=self.request.user).order_by('-created_at')
        return tour.objects.filter(created_by=self.request.user).order_by('-created_at')


class JoinTourAPIView(APIView):
    """Add the authenticated user to a tour identified by its share code."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        join_code = str(request.data.get('join_code', '')).strip().upper()
        if not join_code:
            return Response({'join_code': ['A join code is required.']}, status=status.HTTP_400_BAD_REQUEST)

        tour_id = request.data.get('tour_id')
        queryset = tour.objects.filter(join_code=join_code)
        if tour_id not in (None, ''):
            try:
                queryset = queryset.filter(pk=int(tour_id))
            except (TypeError, ValueError):
                return Response({'tour_id': ['A valid tour id is required.']}, status=status.HTTP_400_BAD_REQUEST)

        selected_tour = queryset.first()
        if selected_tour is None:
            return Response({'detail': 'No tour was found with this join code.'}, status=status.HTTP_404_NOT_FOUND)

        if TourMember.objects.filter(tour=selected_tour, user=request.user).exists():
            return Response({'detail': 'You have already joined this tour.'}, status=status.HTTP_409_CONFLICT)

        membership = TourMember.objects.create(tour=selected_tour, user=request.user)
        return Response({
            'detail': 'Tour joined successfully.',
            'tour': tourserializer(selected_tour, context={'request': request}).data,
            'membership_id': membership.id,
        }, status=status.HTTP_201_CREATED)
