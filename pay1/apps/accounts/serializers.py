from rest_framework import serializers
from .models import User

class registerSerializer(serializers.ModelSerializer):
    confirm_password = serializers.CharField(write_only=True)
    class Meta:
        model = User
        fields = ['email', 'full_name', 'phone', 'profile_image', 'password', 'confirm_password']
        extra_kwargs = {
            'password': {'write_only': True},
            'phone': {'required': False},
            'profile_image': {'required': False},
        }

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email is already in use.")
        return value
    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError("Passwords do not match.")
        return attrs
    def create(self, validated_data):
        validated_data.pop('confirm_password', None)
        return User.objects.create_user(**validated_data)


class loginSerializer(serializers.ModelSerializer):
    # Declaring the field explicitly avoids ModelSerializer's unique-email
    # validator, because an existing email is required for sign-in.
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    class Meta:
        model = User
        fields = ['email', 'password']

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        user = User.objects.filter(email=email).first()
        if user is None or not user.is_active or not user.check_password(password):
            raise serializers.ValidationError("Invalid email or password.")
        attrs['user'] = user
        return attrs


class profileserializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'phone', 'profile_image', 'bank_name', 'bank_account_title', 'bank_account_number', 'raast_id', 'easypaisa_number', 'jazzcash_number']


class updateProfileSerializer(serializers.ModelSerializer):
    """FR3: Edit User Profile."""

    class Meta:
        model = User
        fields = ['full_name', 'phone', 'profile_image', 'bank_name', 'bank_account_title', 'bank_account_number', 'raast_id', 'easypaisa_number', 'jazzcash_number']
        extra_kwargs = {
            'full_name': {'required': False},
            'phone': {'required': False},
            'profile_image': {'required': False},
        }

    def validate_full_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name cannot be empty.")
        return value


class changePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value
