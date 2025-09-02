# User model with multi-role support for expense approval workflow
class User < ApplicationRecord
  # Include default devise modules
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  # Associations
  has_many :submitted_expenses, class_name: 'Expense', foreign_key: 'employee_id', dependent: :destroy
  has_many :managed_expenses, class_name: 'Expense', foreign_key: 'manager_id', dependent: :nullify
  has_many :approved_expenses, class_name: 'Expense', foreign_key: 'approved_by_id', dependent: :nullify
  has_many :processed_expenses, class_name: 'Expense', foreign_key: 'processed_by_id', dependent: :nullify

  # Validations
  validates :role, presence: true, inclusion: { in: %w[employee manager finance compliance vp cfo] }
  validates :employee_id, presence: true, uniqueness: true
  validates :department, presence: true
  validates :preferred_username, presence: true, uniqueness: true

  # Role-based methods
  def employee?
    role == 'employee'
  end

  def manager?
    role == 'manager'
  end

  def finance?
    role == 'finance'
  end

  def compliance?
    role == 'compliance'
  end

  def vp?
    role == 'vp'
  end

  def cfo?
    role == 'cfo'
  end

  # Authorization helpers
  def can_approve_expenses?
    %w[manager finance vp cfo].include?(role)
  end

  def can_process_payments?
    finance? || cfo?
  end

  def can_audit_expenses?
    compliance? || vp? || cfo?
  end

  # Manager-specific methods
  def approval_limit
    case role
    when 'manager' then attributes['approval_limit'] || 5000
    when 'vp' then 50000
    when 'cfo' then Float::INFINITY
    else 0
    end
  end

  def reports
    User.where(manager_id: id) if manager?
  end

  def direct_manager
    User.find_by(id: manager_id) if manager_id
  end

  # Department-specific helpers
  def same_department?(user)
    department == user.department
  end

  def monthly_expense_limit
    case role
    when 'employee' then attributes['monthly_limit'] || 2000
    when 'manager' then 10000
    when 'vp', 'cfo' then Float::INFINITY
    else 1000
    end
  end
end