from rest_framework import serializers

from .models import Expense


class expensePaidBySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    full_name = serializers.CharField()
    email = serializers.EmailField()


class expenseSerializer(serializers.ModelSerializer):
    paid_by = expensePaidBySerializer(read_only=True)
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = [
            'id', 'tour', 'paid_by', 'title', 'amount', 'notes',
            'created_at', 'updated_at', 'can_edit',
        ]
        read_only_fields = ['id', 'tour', 'paid_by', 'created_at', 'updated_at']

    def get_can_edit(self, obj):
        request = self.context.get('request')
        return bool(request and request.user.is_authenticated and obj.paid_by_id == request.user.id)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Please describe what this expense was for.")
        return value
