"""
Expense models for Django expense approval system.

This demonstrates the manual complexity of implementing state machines, business rules,
and authorization logic vs NPL's declarative protocol definition.
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError
from django_fsm import FSMField, transition
from guardian.shortcuts import assign_perm, remove_perm
from simple_history.models import HistoricalRecords
from decimal import Decimal
import uuid


class ExpenseCategory(models.TextChoices):
    """Expense categories - Manual enum vs NPL's built-in enums."""
    TRAVEL = 'TRAVEL', 'Travel'
    MEALS = 'MEALS', 'Meals'
    ACCOMMODATION = 'ACCOMMODATION', 'Accommodation'
    ENTERTAINMENT = 'ENTERTAINMENT', 'Entertainment'
    SUPPLIES = 'SUPPLIES', 'Supplies'
    CAPITAL = 'CAPITAL', 'Capital'
    OTHER = 'OTHER', 'Other'


class ExpenseState(models.TextChoices):
    """
    Expense states - Manual state definition vs NPL's automatic state machine.
    
    NPL automatically manages state transitions with compile-time guarantees.
    Here we need manual FSM implementation with runtime validation.
    """
    DRAFT = 'draft', 'Draft'
    SUBMITTED = 'submitted', 'Submitted'
    APPROVED = 'approved', 'Approved'
    COMPLIANCE_HOLD = 'compliance_hold', 'Compliance Hold'
    REJECTED = 'rejected', 'Rejected'
    PAID = 'paid', 'Paid'


class Expense(models.Model):
    """
    Expense model with complex business logic and authorization rules.
    
    NPL Protocol equivalent:
    ```npl
    protocol ExpenseApproval {
        // All this complexity handled automatically
    }
    ```
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Core expense fields
    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='submitted_expenses'
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    expense_category = models.CharField(
        max_length=20,
        choices=ExpenseCategory.choices
    )
    currency = models.CharField(max_length=3, default='USD')
    expense_date = models.DateField()
    vendor_id = models.CharField(max_length=100, blank=True)
    department = models.CharField(max_length=100)
    description = models.TextField()
    
    # Manual state machine - vs NPL's automatic state transitions
    state = FSMField(
        default=ExpenseState.DRAFT,
        choices=ExpenseState.choices,
        protected=True  # Prevent direct state manipulation
    )
    
    # Manual party assignment - vs NPL's automatic party resolution
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_expenses'
    )
    finance_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='finance_expenses'
    )
    compliance_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='compliance_expenses'
    )
    
    # Manual tracking fields - vs NPL's automatic audit trail
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_expenses'
    )
    processed_at = models.DateTimeField(null=True, blank=True)
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='processed_expenses'
    )
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    flagged_at = models.DateTimeField(null=True, blank=True)
    flagged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='flagged_expenses'
    )
    flag_reason = models.TextField(blank=True)
    override_reason = models.TextField(blank=True)
    
    # Payment tracking
    payment_details = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Manual audit trail - vs NPL's automatic audit generation
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-created_at']
        permissions = [
            ('approve_expense', 'Can approve expense'),
            ('process_payment', 'Can process payment'),
            ('audit_expense', 'Can audit expense'),
            ('executive_override', 'Can executive override'),
        ]
        
    def __str__(self):
        return f"Expense {self.id} - {self.employee.username} - ${self.amount}"
    
    def clean(self):
        """Manual validation - vs NPL's built-in validation."""
        super().clean()
        
        # Business rule validation - scattered vs NPL's unified rules
        if self.amount <= 0:
            raise ValidationError("Amount must be positive")
            
        if not self.description or len(self.description) < 10:
            raise ValidationError("Description must be at least 10 characters")
            
        # Check expense age
        if self.expense_date:
            max_age = timezone.now().date() - timezone.timedelta(
                days=settings.EXPENSE_RULES['MAX_EXPENSE_AGE_DAYS']
            )
            if self.expense_date < max_age:
                raise ValidationError(f"Expense date cannot be older than {settings.EXPENSE_RULES['MAX_EXPENSE_AGE_DAYS']} days")
    
    def save(self, *args, **kwargs):
        """Override save for business logic - manual vs NPL's automatic."""
        # Set department from employee if not provided
        if not self.department and self.employee:
            self.department = self.employee.department
            
        # Validate before saving
        self.clean()
        
        super().save(*args, **kwargs)
        
        # Set object-level permissions after creation
        if self._state.adding:
            self._set_initial_permissions()
    
    def _set_initial_permissions(self):
        """
        Set initial Django Guardian permissions.
        
        Complex manual permission setup vs NPL's automatic party permissions.
        """
        # Employee can view and edit their own expenses
        assign_perm('expenses.view_expense', self.employee, self)
        assign_perm('expenses.change_expense', self.employee, self)
    
    # State transition methods - Manual FSM vs NPL's automatic transitions
    
    @transition(field=state, source=ExpenseState.DRAFT, target=ExpenseState.SUBMITTED)
    def submit(self, user):
        """
        Submit expense for approval.
        
        Manual state transition with complex validation vs NPL's declarative permission:
        ```npl
        permission[employee] submit() | draft → submitted {
            require(amount > 0, "Amount must be positive");
            // All validation automatic
        }
        ```
        """
        # Manual authorization check
        if user.id != self.employee.id:
            raise ValidationError("Only the expense owner can submit")
        
        # Manual business rule validation
        self._validate_submission_rules(user)
        
        # Manual party assignment - vs NPL's automatic getDirectManager()
        self.manager = self._get_direct_manager()
        self.finance_user = self._get_finance_user()
        self.compliance_user = self._get_compliance_user()
        
        self.submitted_at = timezone.now()
        
        # Manual permission updates
        self._update_submission_permissions()
    
    @transition(field=state, source=ExpenseState.SUBMITTED, target=ExpenseState.APPROVED)
    def approve(self, user):
        """
        Approve expense.
        
        Manual approval logic vs NPL's declarative permission:
        ```npl
        permission[manager] approve() | submitted → approved {
            require(managerId == getDirectManager(employeeId));
        }
        ```
        """
        # Manual authorization checks
        if not user.can_approve_expenses():
            raise ValidationError("User cannot approve expenses")
            
        if user.role == 'manager' and self.manager.id != user.id:
            raise ValidationError("Manager can only approve direct reports")
            
        if not user.can_approve_amount(self.amount):
            raise ValidationError(f"Amount ${self.amount} exceeds approval limit")
        
        # Manual business rule validation
        self._validate_approval_rules(user)
        
        self.approved_at = timezone.now()
        self.approved_by = user
    
    @transition(field=state, source=ExpenseState.APPROVED, target=ExpenseState.PAID)
    def process_payment(self, user):
        """Process payment - Manual vs NPL's automatic processPayment permission."""
        if not user.can_process_payments():
            raise ValidationError("User cannot process payments")
            
        # Manual payment validation
        self._validate_payment_processing_rules(user)
        
        self.processed_at = timezone.now()
        self.processed_by = user
        self.payment_details = self._generate_payment_details()
    
    @transition(field=state, source=[ExpenseState.SUBMITTED, ExpenseState.COMPLIANCE_HOLD], target=ExpenseState.REJECTED)
    def reject(self, user, reason=""):
        """Reject expense - Manual rejection logic."""
        if not user.can_approve_expenses():
            raise ValidationError("User cannot reject expenses")
            
        self.rejected_at = timezone.now()
        self.rejection_reason = reason
    
    @transition(field=state, source=ExpenseState.SUBMITTED, target=ExpenseState.DRAFT)
    def withdraw(self, user):
        """Withdraw expense - Manual withdrawal logic."""
        if user.id != self.employee.id:
            raise ValidationError("Only the expense owner can withdraw")
            
        # Reset submission fields
        self.submitted_at = None
        self.manager = None
        self.finance_user = None
        self.compliance_user = None
    
    @transition(field=state, source='*', target=ExpenseState.COMPLIANCE_HOLD)
    def flag_suspicious(self, user, reason=""):
        """Flag for compliance review - Manual flagging logic."""
        if not user.can_audit_expenses():
            raise ValidationError("User cannot flag expenses")
            
        self.flagged_at = timezone.now()
        self.flagged_by = user
        self.flag_reason = reason
    
    @transition(field=state, source='*', target=ExpenseState.APPROVED)
    def executive_override(self, user, reason=""):
        """Executive override - Manual override logic."""
        if not user.can_executive_override():
            raise ValidationError("User cannot perform executive override")
            
        self.approved_at = timezone.now()
        self.approved_by = user
        self.override_reason = reason
    
    # Business rule validation methods - Manual vs NPL's integrated validation
    
    def _validate_submission_rules(self, user):
        """Manual submission validation vs NPL's require() statements."""
        # Rule 1: Receipts required for amounts over $25
        if self.amount > settings.EXPENSE_RULES['MAX_AMOUNT_WITHOUT_RECEIPT']:
            if not self.receipts.exists():
                raise ValidationError("Receipts required for amounts over $25")
        
        # Rule 2: Check monthly limits
        monthly_submitted = user.get_monthly_submitted_amount()
        if (monthly_submitted + self.amount) > user.get_monthly_expense_limit():
            raise ValidationError("Monthly submission limit exceeded")
        
        # Rule 3: Vendor validation
        if self._is_vendor_blacklisted():
            raise ValidationError("Vendor is currently under investigation")
        
        # Rule 4: Duplicate expense check
        if self._is_duplicate_expense():
            raise ValidationError("Potential duplicate expense detected")
    
    def _validate_approval_rules(self, manager):
        """Manual approval validation."""
        # Budget validation
        remaining_budget = self._get_remaining_department_budget()
        if self.amount > remaining_budget:
            raise ValidationError("Insufficient departmental budget")
        
        # Entertainment expense validation
        if (self.expense_category == ExpenseCategory.ENTERTAINMENT and 
            self.amount > settings.EXPENSE_RULES['ENTERTAINMENT_REQUIRES_VP'] and
            not manager.is_vp() and not manager.is_cfo()):
            raise ValidationError("Entertainment expenses over $200 require VP approval")
    
    def _validate_payment_processing_rules(self, user):
        """Manual payment validation."""
        # Duplicate payment check
        if self._has_payment_duplicate():
            raise ValidationError("Duplicate payment detected")
    
    # Helper methods - Manual implementation vs NPL's built-in functions
    
    def _get_direct_manager(self):
        """Manual manager lookup vs NPL's getDirectManager()."""
        return self.employee.get_direct_manager()
    
    def _get_finance_user(self):
        """Manual finance user lookup vs NPL's automatic party assignment."""
        from authentication.models import User
        return User.objects.filter(
            role=User.Role.FINANCE,
            department='Finance',
            is_active=True
        ).first()
    
    def _get_compliance_user(self):
        """Manual compliance user lookup."""
        from authentication.models import User
        return User.objects.filter(
            role=User.Role.COMPLIANCE,
            is_active=True
        ).first()
    
    def _is_vendor_blacklisted(self):
        """Manual vendor validation vs NPL's isVendorBlacklisted() - matches NPL logic."""
        blacklisted_vendors = ['VENDOR_BLACKLISTED', 'SUSPICIOUS_CORP', 'FRAUD_COMPANY']
        return (self.vendor_id in blacklisted_vendors or 
                (self.vendor_id and '_BLOCKED' in self.vendor_id))
    
    def _is_duplicate_expense(self):
        """Manual duplicate detection vs NPL's isDuplicateExpense()."""
        return Expense.objects.filter(
            employee=self.employee,
            vendor_id=self.vendor_id,
            amount=self.amount,
            expense_date=self.expense_date
        ).exclude(id=self.id).exists()
    
    def _get_remaining_department_budget(self):
        """Manual budget calculation - matches NPL getRemainingBudget logic."""
        department_budgets = {
            'Engineering': Decimal('75000.00'),
            'Marketing': Decimal('45000.00'),
            'Sales': Decimal('60000.00'),
            'Finance': Decimal('25000.00'),
            'HR': Decimal('15000.00')
        }
        return department_budgets.get(self.department, Decimal('30000.00'))
    
    def _has_payment_duplicate(self):
        """Manual duplicate payment check."""
        return False  # Simplified implementation
    
    def _generate_payment_details(self):
        """Manual payment details generation vs NPL's automatic."""
        return {
            'payment_id': str(uuid.uuid4()),
            'processed_at': timezone.now().isoformat(),
            'payment_method': 'ACH_TRANSFER',
            'vendor_id': self.vendor_id,
            'amount': float(self.amount),
            'currency': self.currency
        }
    
    def _update_submission_permissions(self):
        """Manual permission updates vs NPL's automatic party permissions."""
        # Grant manager view permission
        if self.manager:
            assign_perm('expenses.view_expense', self.manager, self)
            assign_perm('expenses.approve_expense', self.manager, self)
        
        # Grant finance view permission
        if self.finance_user:
            assign_perm('expenses.view_expense', self.finance_user, self)
    
    # Convenience methods for state checking
    def is_draft(self):
        return self.state == ExpenseState.DRAFT
    
    def is_submitted(self):
        return self.state == ExpenseState.SUBMITTED
    
    def is_approved(self):
        return self.state == ExpenseState.APPROVED
    
    def is_paid(self):
        return self.state == ExpenseState.PAID
    
    def is_rejected(self):
        return self.state == ExpenseState.REJECTED
    
    def is_on_compliance_hold(self):
        return self.state == ExpenseState.COMPLIANCE_HOLD
    
    def requires_receipts(self):
        """Check if receipts are required."""
        return self.amount > settings.EXPENSE_RULES['MAX_AMOUNT_WITHOUT_RECEIPT']


class Receipt(models.Model):
    """Receipt model for expense attachments."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    expense = models.ForeignKey(
        Expense,
        on_delete=models.CASCADE,
        related_name='receipts'
    )
    file_name = models.CharField(max_length=255)
    upload_date = models.DateTimeField(auto_now_add=True)
    file_size = models.PositiveIntegerField()
    mime_type = models.CharField(max_length=100, blank=True)
    
    # Audit trail
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-upload_date']
    
    def __str__(self):
        return f"Receipt {self.file_name} for {self.expense}"


class AuditLog(models.Model):
    """
    Manual audit log model.
    
    NPL provides automatic audit trails - this demonstrates the manual complexity
    required to track all expense operations and state changes.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    expense = models.ForeignKey(
        Expense,
        on_delete=models.CASCADE,
        related_name='audit_logs',
        null=True,
        blank=True
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    action = models.CharField(max_length=50)
    description = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"{self.action} - {self.user} - {self.timestamp}"