# Expense model implementing the expense approval workflow
class Expense < ApplicationRecord
  include AASM
  
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

  # AASM State Machine Configuration - replaces manual state management
  aasm column: 'state', initial: :draft do
    state :draft, initial: true
    state :submitted
    state :approved
    state :compliance_hold
    state :rejected, final: true
    state :paid, final: true

    # Employee submission transition - equivalent to NPL permission[employee] submit()
    event :submit do
      transitions from: :draft, to: :submitted, guard: :can_submit?, after: :after_submit
    end

    # Manager approval transition - equivalent to NPL permission[manager] approve()
    event :approve do
      transitions from: [:submitted, :compliance_hold], to: :approved, guard: :can_approve?, after: :after_approve
    end

    # Rejection transition
    event :reject do
      transitions from: [:submitted, :compliance_hold], to: :rejected, guard: :can_reject?, after: :after_reject
    end

    # Finance payment processing - equivalent to NPL permission[finance] processPayment()
    event :process_payment do
      transitions from: :approved, to: :paid, guard: :can_process_payment?, after: :after_process_payment
    end

    # Compliance hold
    event :flag_for_compliance do
      transitions from: :submitted, to: :compliance_hold, guard: :can_flag_compliance?
    end

    # Executive override
    event :executive_override do
      transitions from: [:submitted, :compliance_hold, :rejected], to: :approved, guard: :can_executive_override?, after: :after_executive_override
    end
  end

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

  # AASM Guard methods - these replace NPL's compile-time checks with runtime checks
  def can_submit?
    @current_user && authorize_employee!(@current_user) && validate_submission_rules!
    true
  rescue => e
    false
  end

  def can_approve?
    @current_user && authorize_manager!(@current_user) && validate_manager_approval_rules!(@current_user)
    true
  rescue => e
    false
  end

  def can_process_payment?
    @current_user && authorize_finance!(@current_user) && validate_payment_processing_rules!
    true
  rescue => e
    false
  end

  def can_reject?
    @current_user && authorize_approver!(@current_user)
    true
  rescue => e
    false
  end

  def can_flag_compliance?
    @current_user && authorize_compliance!(@current_user)
    true
  rescue => e
    false
  end

  def can_executive_override?
    @current_user && authorize_executive!(@current_user)
    true
  rescue => e
    false
  end

  # AASM Callback methods - handle state transition side effects
  def after_submit
    update!(
      submitted_at: Time.current,
      manager_id: get_direct_manager_id
    )
    log_action(@current_user, 'submit', 'Expense submitted successfully')
  end

  def after_approve
    update!(
      approved_at: Time.current,
      approved_by: @current_user
    )
    log_action(@current_user, 'approve', 'Expense approved by manager')
  end

  def after_reject
    update!(
      rejected_at: Time.current,
      rejection_reason: @rejection_reason
    )
    log_action(@current_user, 'reject', "Expense rejected: #{@rejection_reason}")
  end

  def after_process_payment
    update!(
      processed_at: Time.current,
      processed_by: @current_user,
      payment_details: generate_payment_details
    )
    log_action(@current_user, 'processPayment', 'Payment processed successfully')
  end

  def after_executive_override
    update!(
      approved_at: Time.current,
      approved_by: @current_user,
      override_reason: @override_reason
    )
    log_action(@current_user, 'executiveOverride', "Executive override: #{@override_reason}")
  end

  # Public methods using AASM state machine - equivalent to NPL permissions
  def submit_expense!(current_user)
    @current_user = current_user
    submit!
    'Expense submitted successfully'
  end

  def approve_expense!(current_user)
    @current_user = current_user
    approve!
    'Expense approved by manager'
  end

  def process_payment_expense!(current_user)
    @current_user = current_user
    process_payment!
    'Payment processed successfully'
  end

  def reject_expense!(current_user, reason)
    @current_user = current_user
    @rejection_reason = reason
    reject!
    'Expense rejected'
  end

  def executive_override_expense!(current_user, reason)
    @current_user = current_user
    @override_reason = reason
    executive_override!
    'Executive override applied'
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
    # Simulate the getDirectManager function from NPL - matches NPL logic
    employee_id_str = employee_id.to_s
    return 'mgr_engineering_001' if employee_id_str.include?('eng')
    return 'mgr_sales_001' if employee_id_str.include?('sales')
    return 'mgr_marketing_001' if employee_id_str.include?('mkt')
    return 'mgr_finance_001' if employee_id_str.include?('fin')
    return 'mgr_hr_001' if employee_id_str.include?('hr')
    'mgr_general_001'
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
    when 'Engineering' then 75000
    when 'Marketing' then 45000
    when 'Sales' then 60000
    when 'Finance' then 25000
    when 'HR' then 15000
    else 30000
    end
  end

  def vendor_blacklisted?
    # Simulate vendor blacklist check - matches NPL logic
    blacklisted_vendors = ['VENDOR_BLACKLISTED', 'SUSPICIOUS_CORP', 'FRAUD_COMPANY']
    blacklisted_vendors.include?(vendor_id) || vendor_id&.include?('_BLOCKED')
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
    # Monday to Friday excluding major holidays
    return false unless date.wday.between?(1, 5)
    # Exclude major holidays (simplified)
    return false if date.day == 25 && date.month == 12 # Christmas
    return false if date.day == 1 && date.month == 1   # New Year
    return false if date.day == 4 && date.month == 7   # July 4th
    true
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