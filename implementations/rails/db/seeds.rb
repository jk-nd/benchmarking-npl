# Database seeds for Rails expense approval system
# This creates test users that match the NPL test data

# Create test users with different roles
puts "Creating test users..."

# Employee (Alice)
alice = User.create!(
  email: 'alice@example.com',
  password: 'password123',
  password_confirmation: 'password123',
  employee_id: 'emp_123',
  preferred_username: 'alice',
  role: 'employee',
  department: 'Engineering',
  monthly_limit: 2000
)

# Manager (Bob)  
bob = User.create!(
  email: 'bob@example.com',
  password: 'password123',
  password_confirmation: 'password123',
  employee_id: 'mgr_456',
  preferred_username: 'bob',
  role: 'manager',
  department: 'Engineering',
  approval_limit: 15000,
  seniority_level: 3
)

# Finance (Carol)
carol = User.create!(
  email: 'carol@example.com',
  password: 'password123',
  password_confirmation: 'password123',
  employee_id: 'fin_789',
  preferred_username: 'carol',
  role: 'finance',
  department: 'Finance'
)

# Compliance (David)
david = User.create!(
  email: 'david@example.com',
  password: 'password123',
  password_confirmation: 'password123',
  employee_id: 'comp_101',
  preferred_username: 'david',
  role: 'compliance',
  department: 'Compliance',
  certification_valid_until: Date.parse('2025-12-31')
)

# VP (Eve)
eve = User.create!(
  email: 'eve@example.com',
  password: 'password123',
  password_confirmation: 'password123',
  employee_id: 'vp_202',
  preferred_username: 'eve',
  role: 'vp',
  department: 'Executive',
  quarterly_approval_quota: 10
)

# CFO (Frank)
frank = User.create!(
  email: 'frank@example.com',
  password: 'password123',
  password_confirmation: 'password123',
  employee_id: 'cfo_303',
  preferred_username: 'frank',
  role: 'cfo',
  department: 'Executive',
  quarterly_approval_quota: 20
)

# Set up management hierarchy
alice.update!(manager: bob)
bob.update!(manager: eve)
carol.update!(manager: frank)
david.update!(manager: frank)

puts "Created #{User.count} users:"
User.all.each do |user|
  puts "- #{user.preferred_username} (#{user.role}) in #{user.department}"
end

# Create a sample expense for testing
puts "\nCreating sample expense..."

sample_expense = Expense.create!(
  employee: alice,
  manager: bob,
  finance: carol,
  compliance: david,
  amount: 150.50,
  expense_category: 'MEALS',
  currency: 'USD',
  expense_date: Date.current - 1.day,
  vendor_id: 'vendor_001',
  department: 'Engineering',
  description: 'Team lunch for project kickoff meeting'
)

# Add a receipt
sample_expense.receipts.create!(
  file_name: 'receipt_001.pdf',
  upload_date: Time.current,
  file_size: 1024
)

puts "Created sample expense: #{sample_expense.id} (#{sample_expense.state})"

puts "\nSeeding completed! You can now test the API."
puts "Example login: POST /auth/login with {\"username\": \"alice\", \"password\": \"password123\"}"