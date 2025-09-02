"""
Django REST Framework views for expense approval system.

This demonstrates the manual API implementation complexity vs NPL's automatic API generation.
NPL automatically generates secure, permission-aware APIs from protocol definitions.
"""

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Sum, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.core.exceptions import ValidationError as DjangoValidationError

from .models import Expense, Receipt, ExpenseState, ExpenseCategory
from .serializers import (
    ExpenseListSerializer, ExpenseDetailSerializer, ExpenseCreateSerializer,
    ExpenseActionSerializer, ExpenseStatsSerializer, ReceiptSerializer
)


class ExpenseViewSet(ModelViewSet):
    """
    ViewSet for expense CRUD operations and state transitions.
    
    Manual implementation vs NPL's automatic CRUD + permission generation.
    """
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Dynamic serializer selection - Manual vs NPL's automatic serialization."""
        if self.action == 'list':
            return ExpenseListSerializer
        elif self.action == 'create':
            return ExpenseCreateSerializer
        elif self.action in ['submit', 'approve', 'reject', 'withdraw', 
                           'process_payment', 'flag_suspicious', 'executive_override']:
            return ExpenseActionSerializer
        return ExpenseDetailSerializer
    
    def get_queryset(self):
        """
        Manual permission-based queryset filtering.
        
        vs NPL's automatic permission-based data access.
        """
        user = self.request.user
        
        if user.role == 'compliance':
            return Expense.objects.all()
        elif user.role in ['vp', 'cfo']:
            return Expense.objects.all()
        elif user.role == 'finance':
            return Expense.objects.filter(
                Q(employee=user) | Q(state__in=[ExpenseState.APPROVED, ExpenseState.PAID])
            )
        elif user.role == 'manager':
            return Expense.objects.filter(
                Q(employee=user) | 
                Q(employee__manager=user) |
                Q(manager=user)
            )
        else:
            return Expense.objects.filter(employee=user)
    
    def perform_create(self, serializer):
        """Set the expense owner to the current user."""
        serializer.save(employee=self.request.user)
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """
        Submit expense for approval.
        
        Manual state transition vs NPL's automatic permission[employee] submit().
        """
        expense = self.get_object()
        
        try:
            expense.submit(request.user)
            expense.save()
            
            serializer = ExpenseDetailSerializer(expense, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except DjangoValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve expense."""
        expense = self.get_object()
        
        try:
            expense.approve(request.user)
            expense.save()
            
            serializer = ExpenseDetailSerializer(expense, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except DjangoValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject expense."""
        expense = self.get_object()
        serializer = ExpenseActionSerializer(data=request.data, context={'action': 'reject'})
        
        if serializer.is_valid():
            try:
                expense.reject(request.user, serializer.validated_data.get('reason', ''))
                expense.save()
                
                response_serializer = ExpenseDetailSerializer(expense, context={'request': request})
                return Response(response_serializer.data, status=status.HTTP_200_OK)
                
            except DjangoValidationError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        """Withdraw submitted expense."""
        expense = self.get_object()
        
        try:
            expense.withdraw(request.user)
            expense.save()
            
            serializer = ExpenseDetailSerializer(expense, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except DjangoValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def process_payment(self, request, pk=None):
        """Process expense payment."""
        expense = self.get_object()
        
        try:
            expense.process_payment(request.user)
            expense.save()
            
            serializer = ExpenseDetailSerializer(expense, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except DjangoValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def flag_suspicious(self, request, pk=None):
        """Flag expense for compliance review."""
        expense = self.get_object()
        serializer = ExpenseActionSerializer(data=request.data, context={'action': 'flag_suspicious'})
        
        if serializer.is_valid():
            try:
                expense.flag_suspicious(request.user, serializer.validated_data.get('reason', ''))
                expense.save()
                
                response_serializer = ExpenseDetailSerializer(expense, context={'request': request})
                return Response(response_serializer.data, status=status.HTTP_200_OK)
                
            except DjangoValidationError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def executive_override(self, request, pk=None):
        """Executive override approval."""
        expense = self.get_object()
        
        if not request.user.can_executive_override():
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = ExpenseActionSerializer(data=request.data, context={'action': 'executive_override'})
        
        if serializer.is_valid():
            try:
                expense.executive_override(request.user, serializer.validated_data.get('reason', ''))
                expense.save()
                
                response_serializer = ExpenseDetailSerializer(expense, context={'request': request})
                return Response(response_serializer.data, status=status.HTTP_200_OK)
                
            except DjangoValidationError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get expense statistics for current user."""
        user = request.user
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        user_expenses = Expense.objects.filter(employee=user)
        
        stats = {
            'total_expenses': user_expenses.count(),
            'total_amount': user_expenses.aggregate(total=Sum('amount'))['total'] or 0,
            'pending_approval': user_expenses.filter(state=ExpenseState.SUBMITTED).count(),
            'approved_this_month': user_expenses.filter(
                state=ExpenseState.APPROVED, approved_at__gte=month_start
            ).count(),
            'monthly_limit': user.get_monthly_expense_limit(),
            'monthly_submitted': user.get_monthly_submitted_amount(),
            'approval_limit': user.get_approval_limit(),
        }
        
        stats['remaining_limit'] = stats['monthly_limit'] - stats['monthly_submitted']
        
        category_stats = user_expenses.values('expense_category').annotate(total=Sum('amount'))
        stats['by_category'] = {item['expense_category']: item['total'] for item in category_stats}
        
        state_stats = user_expenses.values('state').annotate(count=Count('id'))
        stats['by_state'] = {item['state']: item['count'] for item in state_stats}
        
        serializer = ExpenseStatsSerializer(stats)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def pending_approval(self, request):
        """Get expenses pending approval for current user."""
        user = request.user
        
        if user.role == 'manager':
            pending = Expense.objects.filter(manager=user, state=ExpenseState.SUBMITTED)
        elif user.role in ['vp', 'cfo']:
            pending = Expense.objects.filter(state=ExpenseState.SUBMITTED).filter(
                Q(amount__gt=10000) | 
                (Q(expense_category=ExpenseCategory.ENTERTAINMENT) & Q(amount__gt=200))
            )
        elif user.role == 'finance':
            pending = Expense.objects.filter(state=ExpenseState.APPROVED)
        elif user.role == 'compliance':
            pending = Expense.objects.filter(state=ExpenseState.COMPLIANCE_HOLD)
        else:
            pending = Expense.objects.none()
        
        page = self.paginate_queryset(pending)
        if page is not None:
            serializer = ExpenseListSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        
        serializer = ExpenseListSerializer(pending, many=True, context={'request': request})
        return Response(serializer.data)


class ReceiptViewSet(ModelViewSet):
    """ViewSet for receipt file uploads."""
    serializer_class = ReceiptSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Users can only access receipts for expenses they can view."""
        user = self.request.user
        
        if user.role == 'compliance':
            expense_ids = list(Expense.objects.values_list('id', flat=True))
        elif user.role in ['vp', 'cfo']:
            expense_ids = list(Expense.objects.values_list('id', flat=True))
        elif user.role == 'finance':
            expense_ids = list(Expense.objects.filter(
                Q(employee=user) | Q(state__in=[ExpenseState.APPROVED, ExpenseState.PAID])
            ).values_list('id', flat=True))
        elif user.role == 'manager':
            expense_ids = list(Expense.objects.filter(
                Q(employee=user) | Q(employee__manager=user) | Q(manager=user)
            ).values_list('id', flat=True))
        else:
            expense_ids = list(Expense.objects.filter(employee=user).values_list('id', flat=True))
        
        return Receipt.objects.filter(expense_id__in=expense_ids)
    
    def perform_create(self, serializer):
        """Validate expense ownership before creating receipt."""
        expense_id = self.request.data.get('expense')
        expense = get_object_or_404(Expense, id=expense_id)
        
        if expense.employee != self.request.user:
            raise PermissionError("Can only add receipts to your own expenses")
        
        if expense.state != ExpenseState.DRAFT:
            raise PermissionError("Can only add receipts to draft expenses")
        
        serializer.save(expense=expense)