"""
User model for Django expense approval system.

This demonstrates the complexity of manual user management and role-based authorization
vs NPL's built-in party system and automatic role assignment.
"""

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings
from simple_history.models import HistoricalRecords


class User(AbstractUser):
    """
    Custom User model with roles and approval limits.
    
    In NPL, user roles are automatically handled by the party system.
    Here we need manual role management with complex business logic.
    """
    
    class Role(models.TextChoices):
        EMPLOYEE = 'employee', 'Employee'
        MANAGER = 'manager', 'Manager'  
        FINANCE = 'finance', 'Finance'
        COMPLIANCE = 'compliance', 'Compliance'
        VP = 'vp', 'Vice President'
        CFO = 'cfo', 'Chief Financial Officer'
    
    # Extended fields for expense approval business logic
    employee_id = models.CharField(max_length=20, unique=True)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.EMPLOYEE
    )
    department = models.CharField(max_length=100)
    
    # Organizational hierarchy - Manual vs NPL's automatic getDirectManager()
    manager = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='direct_reports'
    )
    
    # Business rule limits - Manual configuration vs NPL's protocol-embedded rules
    approval_limit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Maximum amount this user can approve"
    )
    
    monthly_expense_limit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Maximum monthly expense submission limit"
    )
    
    # Audit trail - Manual history tracking vs NPL's automatic audit
    history = HistoricalRecords()
    
    # Additional metadata for complex authorization rules
    is_active_approver = models.BooleanField(default=True)
    last_approval_date = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'auth_user'
        
    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
    
    def save(self, *args, **kwargs):
        """Override save to set approval limits based on role."""
        # Manual business logic vs NPL's automatic rule application
        if self.role and not self.approval_limit:
            self.approval_limit = self.get_default_approval_limit()
        
        if self.role and not self.monthly_expense_limit:
            self.monthly_expense_limit = self.get_default_monthly_limit()
            
        super().save(*args, **kwargs)
    
    def get_default_approval_limit(self):
        """Get default approval limit based on role."""
        # Manual role-based logic vs NPL's declarative permissions
        limits = {
            self.Role.EMPLOYEE: 0,
            self.Role.MANAGER: settings.EXPENSE_RULES['MANAGER_APPROVAL_LIMIT'],
            self.Role.FINANCE: settings.EXPENSE_RULES['MANAGER_APPROVAL_LIMIT'],
            self.Role.COMPLIANCE: settings.EXPENSE_RULES['MANAGER_APPROVAL_LIMIT'],
            self.Role.VP: settings.EXPENSE_RULES['VP_APPROVAL_LIMIT'],
            self.Role.CFO: settings.EXPENSE_RULES['CFO_APPROVAL_LIMIT'],
        }
        return limits.get(self.role, 0)
    
    def get_default_monthly_limit(self):
        """Get default monthly expense limit based on role."""
        # Manual limit calculation vs NPL's getMonthlySubmissionLimit()
        limits = settings.EXPENSE_RULES['MONTHLY_SUBMISSION_LIMITS']
        return limits.get(self.role, limits['employee'])
    
    # Authorization helper methods - Manual implementation vs NPL's built-in permissions
    def can_approve_expenses(self):
        """Check if user can approve expenses."""
        return self.role in [
            self.Role.MANAGER,
            self.Role.VP,
            self.Role.CFO
        ] and self.is_active_approver
    
    def can_process_payments(self):
        """Check if user can process payments."""
        return self.role == self.Role.FINANCE and self.is_active_approver
    
    def can_audit_expenses(self):
        """Check if user can perform compliance audits."""
        return self.role == self.Role.COMPLIANCE and self.is_active_approver
    
    def can_executive_override(self):
        """Check if user can perform executive overrides."""
        return self.role in [self.Role.VP, self.Role.CFO] and self.is_active_approver
    
    def is_employee(self):
        """Check if user is an employee."""
        return self.role == self.Role.EMPLOYEE
    
    def is_manager(self):
        """Check if user is a manager."""
        return self.role == self.Role.MANAGER
        
    def is_vp(self):
        """Check if user is a VP."""
        return self.role == self.Role.VP
        
    def is_cfo(self):
        """Check if user is a CFO."""
        return self.role == self.Role.CFO
    
    def get_approval_limit(self):
        """Get user's approval limit."""
        return self.approval_limit or 0
    
    def get_monthly_expense_limit(self):
        """Get user's monthly expense limit."""
        return self.monthly_expense_limit or 0
    
    def get_direct_manager(self):
        """
        Get the direct manager for this user.
        
        Manual implementation vs NPL's automatic getDirectManager() function.
        """
        return self.manager
    
    def get_direct_reports(self):
        """Get all users that report to this manager."""
        return self.direct_reports.all()
    
    def can_approve_amount(self, amount):
        """Check if user can approve the given amount."""
        return self.get_approval_limit() >= amount
    
    def get_monthly_submitted_amount(self):
        """
        Calculate total amount submitted this month.
        
        Manual calculation vs NPL's getMonthToDateSubmitted() function.
        """
        from django.utils import timezone
        from expenses.models import Expense
        
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        return Expense.objects.filter(
            employee=self,
            created_at__gte=month_start
        ).aggregate(
            total=models.Sum('amount')
        )['total'] or 0
    
    def can_submit_amount(self, amount):
        """Check if user can submit the given amount within monthly limits."""
        monthly_submitted = self.get_monthly_submitted_amount()
        monthly_limit = self.get_monthly_expense_limit()
        return (monthly_submitted + amount) <= monthly_limit