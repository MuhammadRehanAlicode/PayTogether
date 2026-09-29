from rest_framework import serializers
from django.utils import timezone
from .models import tour

class tourserializer(serializers.ModelSerializer):
    class Meta:
        model = tour
        fields = ['id', 'title', 'description', 'price', 'image', 'states', 'destination', 'join_code', 'created_at', 'updated_at']
        read_only_fields = ['id', 'join_code', 'created_at', 'updated_at', 'created_by']

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Price must be a positive value.")
        return value
    
