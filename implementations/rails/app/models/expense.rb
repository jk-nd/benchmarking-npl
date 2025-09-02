# Expense model implementing the expense approval workflow
class Expense < ApplicationRecord
  # State machine states
  STATES = %w[draft submitted approved compliance_hold rejected paid].freeze
  CATEGORIES = %w[MEALS TRAVEL ACCOMMODATION ENTERTAINMENT SUPPLIES CAPITAL OTHER].freeze
  CURRENCIES = %w[USD EUR GBP JPY].freeze

  # Associations
  belongs_to :employee, class_name: 'User', foreign_key: 'employee_id'
  belongs_to :manager, class_name: 'User', foreign_key: 'manager_id', optional: true
  belongs_to :finance_user, class_name: 'User', foreign_key: 'finance_id', optional: true
  belongs_to :compliance_user, class_name: 'User', foreign_key: 'compliance_id', optional: true
  belongs_to :approved_by, class_name: 'User', optional: true
  belongs_to :processed_by, class_name: 'User', optional: true
  
  has_many :receipts, dependent: :destroy
  has_many :audit_logs, dependent: :destroy
  has_many :approval_history_entries, dependent: :destroy

  # Validations
  validates :state, inclusion: { in: STATES }
  validates :amount, presence: true, numericality: { greater_than: 0 }
  validates :expense_category, inclusion: { in: CATEGORIES }
  validates :currency, inclusion: { in: CURRENCIES }
  validates :expense_date, presence: true
  validates :vendor_id, presence: true
  validates :department, presence: true
  validates :description, presence: true, length: { minimum: 10, maximum: 500 }

  # Scopes
  scope :draft, -> { where(state: 'draft') }
  scope :submitted, -> { where(state: 'submitted') }
  scope :approved, -> { where(state: 'approved') }
  scope :rejected, -> { where(state: 'rejected') }
  scope :paid, -> { where(state: 'paid') }
  scope :pending_approval, -> { where(state: ['submitted', 'compliance_hold']) }

  # Callbacks
  before_validation :set_initial_state, on: :create
  after_update :log_state_change, if: :saved_change_to_state?

  # State check methods
  def draft?
    state == 'draft'
  end

  def submitted?
    state == 'submitted'
  end

  def approved?
    state == 'approved'
  end

  def rejected?
    state == 'rejected'
  end

  def paid?
    state == 'paid'
  end

  def compliance_hold?
    state == 'compliance_hold'
  end

  # Business logic methods

  # Employee submission - equivalent to NPL submit permission
  def submit!(current_user)
    authorize_employee!(current_user)
    validate_submission_rules!
    
    update!(
      state: 'submitted',
      submitted_at: Time.current,
      manager_id: get_direct_manager_id
    )
    
    log_action(current_user, 'submit', 'Expense submitted successfully')
    'Expense submitted successfully'
  end

  # Manager approval - equivalent to NPL approve permission  
  def approve!(current_user)
    authorize_manager!(current_user)
    validate_manager_approval_rules!(current_user)
    
    update!(
      state: 'approved',
      approved_at: Time.current,
      approved_by: current_user
    )
    
    log_action(current_user, 'approve', 'Expense approved by manager')
    'Expense approved by manager'
  end

  # Finance payment processing - equivalent to NPL processPayment permission
  def process_payment!(current_user)
    authorize_finance!(current_user)
    validate_payment_processing_rules!
    
    update!(
      state: 'paid',
      processed_at: Time.current,
      processed_by: current_user,
      payment_details: generate_payment_details
    )
    
    log_action(current_user, 'processPayment', 'Payment processed successfully')
    'Payment processed successfully'
  end

  # Compliance audit - equivalent to NPL auditReview permission
  def audit_review!(current_user)
    authorize_compliance!(current_user)
    
    audit_report = generate_audit_report
    log_action(current_user, 'auditReview', 'Compliance audit completed')
    audit_report
  end

  # Executive override - equivalent to NPL executiveOverride permission
  def executive_override!(current_user, reason)
    authorize_executive!(current_user)
    
    update!(
      state: 'approved',
      approved_at: Time.current,
      approved_by: current_user,
      override_reason: reason
    )
    
    log_action(current_user, 'executiveOverride', "Executive override: #{reason}")
    'Executive override applied'
  end

  # Rejection
  def reject!(current_user, reason)
    authorize_approver!(current_user)
    
    update!(
      state: 'rejected',
      rejected_at: Time.current,
      rejection_reason: reason
    )
    
    log_action(current_user, 'reject', "Expense rejected: #{reason}")
    'Expense rejected'
  end

  # Get approval history - equivalent to NPL getApprovalHistory permission
  def get_approval_history(current_user)
    authorize_participant!(current_user)
    approval_history_entries.order(:created_at).map do |entry|
      {
        action: entry.action,
        user: entry.user.preferred_username,
        timestamp: entry.created_at,
        details: entry.details
      }
    end
  end

  # Get status - equivalent to NPL getStatus permission  
  def get_status(current_user)
    authorize_participant!(current_user)
    {
      state: state,
      submitted_at: submitted_at,
      approved_at: approved_at,
      processed_at: processed_at,
      current_approver: get_current_approver&.preferred_username
    }
  end

  private

  def set_initial_state
    self.state ||= 'draft'
  end

  def log_state_change
    log_action(nil, 'state_change', "State changed to #{state}")
  end

  def log_action(user, action, description)
    approval_history_entries.create!(
      user: user,
      action: action,
      description: description,
      created_at: Time.current
    )
  end

  # Authorization methods - these replace NPL's compile-time checks with runtime checks

  def authorize_employee!(user)
    unless user == employee
      raise AuthorizationError, 'Only the employee who created this expense can perform this action'
    end
    
    unless user.employee? || user.manager? || user.finance? || user.compliance? || user.vp? || user.cfo?
      raise AuthorizationError, 'User does not have required role permissions'
    end
  end

  def authorize_manager!(user)
    unless user.can_approve_expenses?
      raise AuthorizationError, 'User cannot approve expenses'
    end
    
    unless submitted?
      raise StateError, 'Expense must be in submitted state for manager approval'
    end
    
    # This is the key business rule validation that NPL enforces at compile time
    unless user.id == manager_id
      raise AuthorizationError, 'Manager can only approve direct reports'
    end
  end

  def authorize_finance!(user)
    unless user.can_process_payments?
      raise AuthorizationError, 'User cannot process payments'
    end
    
    unless approved?
      raise StateError, 'Expense must be approved before payment processing'
    end
  end

  def authorize_compliance!(user)
    unless user.can_audit_expenses?
      raise AuthorizationError, 'User cannot perform compliance audits'
    end
  end

  def authorize_executive!(user)
    unless user.vp? || user.cfo?
      raise AuthorizationError, 'Only executives can override approvals'
    end
  end

  def authorize_approver!(user)
    unless user.can_approve_expenses?
      raise AuthorizationError, 'User cannot approve/reject expenses'
    end
  end

  def authorize_participant!(user)
    participant_ids = [employee_id, manager_id, finance_id, compliance_id].compact
    participant_ids += User.where(role: ['vp', 'cfo']).pluck(:id)
    
    unless participant_ids.include?(user.id)
      raise AuthorizationError, 'User is not a participant in this expense approval process'
    end
  end

  # Business rule validation methods - these implement NPL's require statements

  def validate_submission_rules!
    raise ValidationError, 'Amount must be positive' unless amount > 0
    raise ValidationError, 'Description is required' if description.blank?
    raise ValidationError, 'Receipts are required for expenses over $25' if amount > 25 && receipts.empty?
    raise ValidationError, 'Vendor cannot be blacklisted' if vendor_blacklisted?
    raise ValidationError, 'Expense date cannot be more than 90 days old' if expense_date < 90.days.ago
    raise ValidationError, 'Expense exceeds monthly limit' if exceeds_monthly_limit?
  end

  def validate_manager_approval_rules!(manager)
    # Budget validation
    remaining_budget = get_remaining_budget(department)
    raise ValidationError, 'Insufficient departmental budget remaining' unless amount <= remaining_budget
    
    # Vendor validation
    raise ValidationError, 'Vendor is currently under investigation' if vendor_blacklisted?
    
    # Entertainment expense validation
    if expense_category == 'ENTERTAINMENT' && amount > 200
      raise ValidationError, 'Entertainment expenses over $200 require VP approval'
    end
    
    # Business day validation
    raise ValidationError, 'Approvals can only be processed on business days' unless business_day?
    
    # Manager approval limit validation
    raise ValidationError, 'Amount exceeds manager approval limit' unless amount <= manager.approval_limit
  end

  def validate_payment_processing_rules!
    raise ValidationError, 'Vendor payment details must be verified' unless vendor_payment_verified?
    raise ValidationError, 'Duplicate payment detected' if payment_already_processed?
  end

  # Helper methods for business rules

  def get_direct_manager_id
    # Simulate the getDirectManager function from NPL
    # In a real system, this would query an organizational chart
    employee.manager_id || User.find_by(role: 'manager', department: department)&.id
  end

  def get_current_approver
    case state
    when 'submitted' then manager
    when 'compliance_hold' then compliance_user
    else nil
    end
  end

  def get_remaining_budget(dept)
    # Simulate budget checking - in real system would query budget service
    case dept
    when 'Engineering' then 50000
    when 'Marketing' then 30000
    when 'Finance' then 25000
    else 10000
    end
  end

  def vendor_blacklisted?
    # Simulate vendor blacklist check
    %w[VENDOR_999 SUSPICIOUS_CO].include?(vendor_id)
  end

  def vendor_payment_verified?
    # Simulate vendor verification
    vendor_id.present? && !vendor_blacklisted?
  end

  def payment_already_processed?
    # Check for duplicate payments
    self.class.where(vendor_id: vendor_id, amount: amount, state: 'paid')
              .where.not(id: id)
              .where('processed_at > ?', 1.day.ago)
              .exists?
  end

  def business_day?
    date = Date.current
    date.wday.between?(1, 5) # Monday to Friday
  end

  def exceeds_monthly_limit?
    monthly_total = employee.submitted_expenses
                           .where('created_at >= ?', Date.current.beginning_of_month)
                           .sum(:amount)
    (monthly_total + amount) > employee.monthly_expense_limit
  end

  def generate_payment_details
    {
      payment_id: SecureRandom.uuid,
      processed_at: Time.current,
      payment_method: 'ACH_TRANSFER',
      vendor_id: vendor_id
    }.to_json
  end

  def generate_audit_report
    {
      expense_id: id,
      audit_date: Date.current,
      compliance_status: 'COMPLIANT',
      risk_score: calculate_risk_score,
      recommendations: generate_recommendations
    }.to_json
  end

  def calculate_risk_score
    score = 0
    score += 10 if amount > 1000
    score += 15 if expense_category == 'ENTERTAINMENT'
    score += 20 if vendor_blacklisted?
    score += 5 if expense_date < 30.days.ago
    [score, 100].min
  end

  def generate_recommendations
    recommendations = []
    recommendations << 'Consider vendor re-evaluation' if calculate_risk_score > 30
    recommendations << 'Verify receipt authenticity' if amount > 500
    recommendations << 'Monitor for pattern abuse' if employee.submitted_expenses.count > 10
    recommendations
  end

  # Custom exception classes
  class AuthorizationError < StandardError; end
  class StateError < StandardError; end
  class ValidationError < StandardError; end
end