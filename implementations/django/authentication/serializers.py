"""
Authentication serializers for Django expense approval system.

Manual serialization vs NPL's automatic type-safe serialization.
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """
    User serializer for profile information.
    
    Manual field selection vs NPL's automatic serialization.
    """
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'employee_id', 'role', 'department', 'approval_limit',
            'monthly_expense_limit', 'is_active_approver', 'date_joined'
        ]
        read_only_fields = [
            'id', 'username', 'employee_id', 'date_joined'
        ]


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    User registration serializer.
    
    Manual validation vs NPL's built-in type validation.
    """
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'employee_id', 'role', 'department'
        ]
    
    def validate(self, attrs):
        """Manual password confirmation validation."""
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Passwords don't match")
        return attrs
    
    def create(self, validated_data):
        """Manual user creation with password hashing."""
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        
        user = User.objects.create_user(
            password=password,
            **validated_data
        )
        return user


class UserSummarySerializer(serializers.ModelSerializer):
    """
    Lightweight user serializer for nested use.
    
    Manual optimization vs NPL's automatic view optimization.
    """
    
    class Meta:
        model = User
        fields = ['id', 'username', 'employee_id', 'role', 'department']
        read_only_fields = ['id', 'username', 'employee_id', 'role', 'department']