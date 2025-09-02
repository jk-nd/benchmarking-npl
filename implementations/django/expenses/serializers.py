"""
DRF serializers for expense approval system.

This demonstrates the manual serialization complexity vs NPL's automatic API generation.
NPL automatically generates type-safe serializers from protocol definitions.
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Expense, Receipt, ExpenseCategory, ExpenseState

User = get_user_model()


class UserSummarySerializer(serializers.ModelSerializer):
    """User summary for nested serialization - Manual vs NPL's automatic."""
    
    class Meta:
        model = User
        fields = ['id', 'username', 'employee_id', 'role', 'department']
        read_only_fields = ['id', 'username', 'employee_id', 'role', 'department']


class ReceiptSerializer(serializers.ModelSerializer):
    """Receipt serializer with file upload handling."""
    
    class Meta:
        model = Receipt
        fields = ['id', 'file_name', 'upload_date', 'file_size', 'mime_type']
        read_only_fields = ['id', 'upload_date']


class ExpenseListSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for expense lists.
    
    Manual field selection vs NPL's automatic view optimization.
    """
    employee = UserSummarySerializer(read_only=True)
    manager = UserSummarySerializer(read_only=True)
    
    class Meta:
        model = Expense
        fields = [
            'id', 'amount', 'currency', 'expense_category', 'state',
            'expense_date', 'department', 'description', 'employee',
            'manager', 'created_at', 'submitted_at', 'approved_at'
        ]
        read_only_fields = [
            'id', 'state', 'employee', 'manager', 'created_at',
            'submitted_at', 'approved_at'
        ]


class ExpenseDetailSerializer(serializers.ModelSerializer):
    """
    Complete expense serializer with all fields.
    
    Manual serialization vs NPL's automatic complete object serialization.
    """
    employee = UserSummarySerializer(read_only=True)
    manager = UserSummarySerializer(read_only=True)
    finance_user = UserSummarySerializer(read_only=True)
    compliance_user = UserSummarySerializer(read_only=True)
    approved_by = UserSummarySerializer(read_only=True)
    processed_by = UserSummarySerializer(read_only=True)
    flagged_by = UserSummarySerializer(read_only=True)
    receipts = ReceiptSerializer(many=True, read_only=True)
    
    # State-dependent field visibility - Manual vs NPL's automatic state-based serialization
    can_submit = serializers.SerializerMethodField()
    can_approve = serializers.SerializerMethodField()
    can_reject = serializers.SerializerMethodField()
    can_withdraw = serializers.SerializerMethodField()
    can_process_payment = serializers.SerializerMethodField()
    can_flag = serializers.SerializerMethodField()
    can_override = serializers.SerializerMethodField()
    
    class Meta:
        model = Expense
        fields = '__all__'
        read_only_fields = [
            'id', 'employee', 'state', 'manager', 'finance_user', 'compliance_user',
            'submitted_at', 'approved_at', 'approved_by', 'processed_at', 'processed_by',
            'rejected_at', 'flagged_at', 'flagged_by', 'payment_details', 'created_at',
            'updated_at', 'can_submit', 'can_approve', 'can_reject', 'can_withdraw',
            'can_process_payment', 'can_flag', 'can_override'
        ]
    
    def get_can_submit(self, obj):
        """Manual permission checking vs NPL's automatic permission serialization."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return (obj.is_draft() and 
                obj.employee.id == request.user.id)
    
    def get_can_approve(self, obj):
        """Manual approval permission checking."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        user = request.user
        return (obj.is_submitted() and 
                user.can_approve_expenses() and
                (user.is_manager() and obj.manager and obj.manager.id == user.id or
                 user.is_vp() or user.is_cfo()) and
                user.can_approve_amount(obj.amount))
    
    def get_can_reject(self, obj):
        """Manual rejection permission checking."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        user = request.user
        return ((obj.is_submitted() or obj.is_on_compliance_hold()) and
                user.can_approve_expenses())
    
    def get_can_withdraw(self, obj):
        """Manual withdrawal permission checking."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return (obj.is_submitted() and 
                obj.employee.id == request.user.id)
    
    def get_can_process_payment(self, obj):
        """Manual payment processing permission checking."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return (obj.is_approved() and 
                request.user.can_process_payments())
    
    def get_can_flag(self, obj):
        """Manual flagging permission checking."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return request.user.can_audit_expenses()
    
    def get_can_override(self, obj):
        """Manual override permission checking."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return request.user.can_executive_override()


class ExpenseCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for expense creation.
    
    Manual validation vs NPL's compile-time validation.
    """
    
    class Meta:
        model = Expense
        fields = [
            'amount', 'expense_category', 'currency', 'expense_date',
            'vendor_id', 'department', 'description'
        ]
    
    def validate_amount(self, value):
        """Manual amount validation - vs NPL's require() statements."""
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive")
        return value
    
    def validate_description(self, value):
        """Manual description validation."""
        if not value or len(value.strip()) < 10:
            raise serializers.ValidationError("Description must be at least 10 characters")
        return value.strip()
    
    def validate_expense_date(self, value):
        """Manual date validation vs NPL's built-in date validation."""
        from django.utils import timezone
        from django.conf import settings
        
        max_age = timezone.now().date() - timezone.timedelta(
            days=settings.EXPENSE_RULES['MAX_EXPENSE_AGE_DAYS']
        )
        if value < max_age:
            raise serializers.ValidationError(
                f"Expense date cannot be older than {settings.EXPENSE_RULES['MAX_EXPENSE_AGE_DAYS']} days"
            )
        if value > timezone.now().date():
            raise serializers.ValidationError("Expense date cannot be in the future")
        return value
    
    def create(self, validated_data):
        """Manual expense creation with employee assignment."""
        request = self.context['request']
        validated_data['employee'] = request.user
        
        # Set department from employee if not provided
        if not validated_data.get('department'):
            validated_data['department'] = request.user.department
        
        return super().create(validated_data)


class ExpenseActionSerializer(serializers.Serializer):
    """
    Serializer for expense state transitions.
    
    Manual action handling vs NPL's automatic permission methods.
    """
    reason = serializers.CharField(
        required=False, 
        allow_blank=True, 
        max_length=500,
        help_text="Reason for rejection, flagging, or override"
    )
    
    def validate_reason(self, value):
        """Validation for reason field based on action."""
        action = self.context.get('action')
        if action in ['reject', 'flag_suspicious', 'executive_override'] and not value:
            raise serializers.ValidationError(f"Reason is required for {action} action")
        return value


class ExpenseStatsSerializer(serializers.Serializer):
    """
    Serializer for expense statistics.
    
    Manual stats calculation vs NPL's automatic analytics generation.
    """
    total_expenses = serializers.IntegerField()
    total_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    pending_approval = serializers.IntegerField()
    approved_this_month = serializers.IntegerField()
    monthly_limit = serializers.DecimalField(max_digits=12, decimal_places=2)
    monthly_submitted = serializers.DecimalField(max_digits=12, decimal_places=2)
    remaining_limit = serializers.DecimalField(max_digits=12, decimal_places=2)
    approval_limit = serializers.DecimalField(max_digits=12, decimal_places=2)
    
    by_category = serializers.DictField(
        child=serializers.DecimalField(max_digits=12, decimal_places=2)
    )
    by_state = serializers.DictField(
        child=serializers.IntegerField()
    )