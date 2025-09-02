"""
Django management command to seed test users.

Manual test data setup vs NPL's automatic test environment generation.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from decimal import Decimal

User = get_user_model()


class Command(BaseCommand):
    help = 'Create test users for expense approval system'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing users before creating new ones'
        )
    
    def handle(self, *args, **options):
        """
        Create test users with various roles.
        
        Manual test data setup vs NPL's automatic test scenarios.
        """
        if options['clear']:
            self.stdout.write('Clearing existing users...')
            User.objects.all().delete()
        
        # Test users - Manual setup vs NPL's automatic test user generation
        users_data = [
            {
                'username': 'john_employee',
                'password': 'password123',
                'email': 'john@company.com',
                'first_name': 'John',
                'last_name': 'Smith',
                'employee_id': 'EMP001',
                'role': User.Role.EMPLOYEE,
                'department': 'Engineering',
                'manager': None  # Will be set later
            },
            {
                'username': 'jane_manager',
                'password': 'password123',
                'email': 'jane@company.com',
                'first_name': 'Jane',
                'last_name': 'Johnson',
                'employee_id': 'MGR001',
                'role': User.Role.MANAGER,
                'department': 'Engineering',
                'approval_limit': Decimal('5000.00'),
                'monthly_expense_limit': Decimal('5000.00')
            },
            {
                'username': 'mike_finance',
                'password': 'password123',
                'email': 'mike@company.com',
                'first_name': 'Mike',
                'last_name': 'Wilson',
                'employee_id': 'FIN001',
                'role': User.Role.FINANCE,
                'department': 'Finance',
                'approval_limit': Decimal('5000.00'),
                'monthly_expense_limit': Decimal('10000.00')
            },
            {
                'username': 'sarah_compliance',
                'password': 'password123',
                'email': 'sarah@company.com',
                'first_name': 'Sarah',
                'last_name': 'Davis',
                'employee_id': 'CMP001',
                'role': User.Role.COMPLIANCE,
                'department': 'Compliance',
                'approval_limit': Decimal('5000.00'),
                'monthly_expense_limit': Decimal('5000.00')
            },
            {
                'username': 'david_vp',
                'password': 'password123',
                'email': 'david@company.com',
                'first_name': 'David',
                'last_name': 'Brown',
                'employee_id': 'VP001',
                'role': User.Role.VP,
                'department': 'Executive',
                'approval_limit': Decimal('50000.00'),
                'monthly_expense_limit': Decimal('15000.00')
            },
            {
                'username': 'lisa_cfo',
                'password': 'password123',
                'email': 'lisa@company.com',
                'first_name': 'Lisa',
                'last_name': 'Anderson',
                'employee_id': 'CFO001',
                'role': User.Role.CFO,
                'department': 'Executive',
                'approval_limit': Decimal('999999.99'),
                'monthly_expense_limit': Decimal('25000.00')
            }
        ]
        
        created_users = {}
        
        # Create users
        for user_data in users_data:
            username = user_data.pop('username')
            password = user_data.pop('password')
            
            if User.objects.filter(username=username).exists():
                self.stdout.write(f'User {username} already exists, skipping...')
                created_users[username] = User.objects.get(username=username)
                continue
            
            user = User.objects.create_user(
                username=username,
                password=password,
                **user_data
            )
            created_users[username] = user
            self.stdout.write(
                self.style.SUCCESS(f'Created user: {username} ({user.get_role_display()})')
            )
        
        # Set manager relationships
        if 'john_employee' in created_users and 'jane_manager' in created_users:
            john = created_users['john_employee']
            jane = created_users['jane_manager']
            john.manager = jane
            john.save()
            self.stdout.write(f'Set {jane.username} as manager for {john.username}')
        
        # Create superuser if needed
        if not User.objects.filter(is_superuser=True).exists():
            User.objects.create_superuser(
                username='admin',
                email='admin@company.com',
                password='admin123',
                employee_id='ADMIN001',
                role=User.Role.CFO,
                department='Administration'
            )
            self.stdout.write(
                self.style.SUCCESS('Created superuser: admin')
            )
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {len(created_users)} users')
        )