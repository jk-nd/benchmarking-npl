"""
URL configuration for expense approval system.

Manual URL routing vs NPL's automatic API generation.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Manual API routing vs NPL's automatic endpoint generation
router = DefaultRouter()
router.register(r'expenses', views.ExpenseViewSet, basename='expense')
router.register(r'receipts', views.ReceiptViewSet, basename='receipt')

app_name = 'expenses'

urlpatterns = [
    path('api/', include(router.urls)),
]