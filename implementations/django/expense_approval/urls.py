"""
Main URL configuration for expense approval project.

Manual URL routing vs NPL's automatic API generation.
"""

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    # Admin interface - Manual vs NPL's automatic admin generation
    path('admin/', admin.site.urls),
    
    # API endpoints - Manual routing vs NPL's automatic API generation
    path('auth/', include('authentication.urls')),
    path('', include('expenses.urls')),
]
