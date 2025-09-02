"""
Custom permission classes for Django expense approval system.

This demonstrates the manual authorization complexity vs NPL's automatic permission enforcement.
NPL prevents unauthorized operations at compile-time, while Django requires runtime checks.
"""

from rest_framework.permissions import BasePermission
from django.core.exceptions import PermissionDenied
from .models import ExpenseState


class ExpenseObjectPermission(BasePermission):
    """
    Object-level permission for expense operations.
    
    Manual implementation vs NPL's automatic permission enforcement.
    """
    
    def has_object_permission(self, request, view, obj):
        """
        Check if user has permission to access this specific expense.
        
        vs NPL's compile-time permission verification.
        """
        user = request.user
        
        # Manual permission logic vs NPL's declarative permissions
        if user.role == 'compliance':
            # Compliance can see all expenses
            return True
        elif user.role in ['vp', 'cfo']:
            # Executives can see all expenses
            return True
        elif user.role == 'finance':
            # Finance can see approved/paid expenses and their own
            return (obj.employee == user or 
                   obj.state in [ExpenseState.APPROVED, ExpenseState.PAID])
        elif user.role == 'manager':
            # Managers can see their own and their direct reports'
            return (obj.employee == user or 
                   obj.employee.manager == user or 
                   obj.manager == user)
        else:
            # Employees can only see their own
            return obj.employee == user


class CanSubmitExpense(BasePermission):
    """
    Permission check for expense submission.
    
    Manual validation vs NPL's permission[employee] submit().
    """
    
    def has_object_permission(self, request, view, obj):
        """Check if user can submit this expense."""
        # Manual business rule checks vs NPL's require() statements
        return (obj.employee == request.user and 
                obj.state == ExpenseState.DRAFT)


class CanApproveExpense(BasePermission):
    """
    Permission check for expense approval.
    
    Manual approval logic vs NPL's permission[manager] approve().
    """
    
    def has_object_permission(self, request, view, obj):
        """Check if user can approve this expense."""
        user = request.user
        
        # Manual authorization checks vs NPL's automatic permission verification
        if not user.can_approve_expenses():
            return False
        
        if obj.state != ExpenseState.SUBMITTED:
            return False
        
        # Manager can only approve direct reports
        if user.role == 'manager':
            return obj.manager and obj.manager == user
        
        # VPs and CFOs can approve high-value or entertainment expenses
        if user.role in ['vp', 'cfo']:
            return (obj.amount > 10000 or 
                   (obj.expense_category == 'ENTERTAINMENT' and obj.amount > 200))
        
        return False


class CanProcessPayment(BasePermission):
    """
    Permission check for payment processing.
    
    Manual finance permissions vs NPL's permission[finance] processPayment().
    """
    
    def has_object_permission(self, request, view, obj):
        """Check if user can process payment for this expense."""
        user = request.user
        
        return (user.can_process_payments() and 
                obj.state == ExpenseState.APPROVED)


class CanAuditExpense(BasePermission):
    """
    Permission check for compliance auditing.
    
    Manual audit permissions vs NPL's permission[compliance] audit().
    """
    
    def has_object_permission(self, request, view, obj):
        """Check if user can audit this expense."""
        return request.user.can_audit_expenses()


class CanWithdrawExpense(BasePermission):
    """
    Permission check for expense withdrawal.
    
    Manual withdrawal logic vs NPL's permission[employee] withdraw().
    """
    
    def has_object_permission(self, request, view, obj):
        """Check if user can withdraw this expense."""
        return (obj.employee == request.user and 
                obj.state == ExpenseState.SUBMITTED)


class CanExecutiveOverride(BasePermission):
    """
    Permission check for executive override.
    
    Manual override permissions vs NPL's permission[vp, cfo] executiveOverride().
    """
    
    def has_object_permission(self, request, view, obj):
        """Check if user can perform executive override."""
        return request.user.can_executive_override()


class ExpenseStatePermission(BasePermission):
    """
    State-based permission checking for expense operations.
    
    Manual state validation vs NPL's automatic state machine protection.
    """
    
    # Define allowed transitions - Manual vs NPL's automatic state verification
    ALLOWED_TRANSITIONS = {
        'submit': {
            'from_states': [ExpenseState.DRAFT],
            'required_roles': ['employee'],
            'owner_only': True
        },
        'approve': {
            'from_states': [ExpenseState.SUBMITTED],
            'required_roles': ['manager', 'vp', 'cfo'],
            'owner_only': False
        },
        'reject': {
            'from_states': [ExpenseState.SUBMITTED, ExpenseState.COMPLIANCE_HOLD],
            'required_roles': ['manager', 'vp', 'cfo'],
            'owner_only': False
        },
        'withdraw': {
            'from_states': [ExpenseState.SUBMITTED],
            'required_roles': ['employee'],
            'owner_only': True
        },
        'process_payment': {
            'from_states': [ExpenseState.APPROVED],
            'required_roles': ['finance'],
            'owner_only': False
        },
        'flag_suspicious': {
            'from_states': ['*'],  # Can flag from any state
            'required_roles': ['compliance'],
            'owner_only': False
        },
        'executive_override': {
            'from_states': ['*'],  # Can override from any state
            'required_roles': ['vp', 'cfo'],
            'owner_only': False
        }
    }
    
    def has_object_permission(self, request, view, obj):
        """
        Check if the requested action is allowed from current state.
        
        Manual state transition validation vs NPL's compile-time state verification.
        """
        action = view.action
        user = request.user
        
        if action not in self.ALLOWED_TRANSITIONS:
            return True  # Not a state transition action
        
        transition = self.ALLOWED_TRANSITIONS[action]
        
        # Check state transition validity
        if (transition['from_states'] != ['*'] and 
            obj.state not in transition['from_states']):
            return False
        
        # Check role requirements
        if user.role not in transition['required_roles']:
            return False
        
        # Check ownership requirements
        if transition['owner_only'] and obj.employee != user:
            return False
        
        return True


class BusinessRulePermission(BasePermission):
    """
    Business rule validation for expense operations.
    
    Manual business rule enforcement vs NPL's require() statements.
    """
    
    def has_object_permission(self, request, view, obj):
        """
        Validate business rules for the requested operation.
        
        Manual rule checking vs NPL's integrated business rule validation.
        """
        action = view.action
        user = request.user
        
        if action == 'submit':
            return self._validate_submission_rules(obj, user)
        elif action == 'approve':
            return self._validate_approval_rules(obj, user)
        elif action == 'process_payment':
            return self._validate_payment_rules(obj, user)
        
        return True
    
    def _validate_submission_rules(self, expense, user):
        """Manual submission rule validation."""
        try:
            # Use the model's validation methods
            expense._validate_submission_rules(user)
            return True
        except Exception:
            return False
    
    def _validate_approval_rules(self, expense, user):
        """Manual approval rule validation."""
        try:
            expense._validate_approval_rules(user)
            return True
        except Exception:
            return False
    
    def _validate_payment_rules(self, expense, user):
        """Manual payment rule validation."""
        try:
            expense._validate_payment_processing_rules(user)
            return True
        except Exception:
            return False


# Composite permission classes for specific operations
class ExpenseSubmissionPermission(BasePermission):
    """
    Combined permission check for expense submission.
    
    Manual permission composition vs NPL's unified permission verification.
    """
    
    def has_object_permission(self, request, view, obj):
        """Check all submission requirements."""
        permissions = [
            CanSubmitExpense(),
            ExpenseStatePermission(),
            BusinessRulePermission()
        ]
        
        # Manual permission aggregation vs NPL's automatic permission resolution
        return all(
            perm.has_object_permission(request, view, obj) 
            for perm in permissions
        )


class ExpenseApprovalPermission(BasePermission):
    """
    Combined permission check for expense approval.
    
    Manual permission composition vs NPL's unified permission verification.
    """
    
    def has_object_permission(self, request, view, obj):
        """Check all approval requirements."""
        permissions = [
            CanApproveExpense(),
            ExpenseStatePermission(),
            BusinessRulePermission()
        ]
        
        return all(
            perm.has_object_permission(request, view, obj) 
            for perm in permissions
        )


class ExpensePaymentPermission(BasePermission):
    """
    Combined permission check for payment processing.
    
    Manual permission composition vs NPL's unified permission verification.
    """
    
    def has_object_permission(self, request, view, obj):
        """Check all payment processing requirements."""
        permissions = [
            CanProcessPayment(),
            ExpenseStatePermission(),
            BusinessRulePermission()
        ]
        
        return all(
            perm.has_object_permission(request, view, obj) 
            for perm in permissions
        )