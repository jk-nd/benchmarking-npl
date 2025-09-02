# ExpensePolicy implements authorization rules for expense operations
# This attempts to replicate NPL's compile-time authorization guarantees at runtime
class ExpensePolicy < ApplicationPolicy
  # Show expense - users can see expenses they participate in
  def show?
    participant?
  end

  # Create expense - any authenticated user can create expenses
  def create?
    user.present?
  end

  # Update expense - only employee can update draft expenses
  def update?
    return false unless user == record.employee
    record.draft?
  end

  # Submit expense - only employee can submit their own expenses
  def submit?
    return false unless user == record.employee
    record.draft?
  end

  # Approve expense - managers can approve submitted expenses from their direct reports
  def approve?
    return false unless user.can_approve_expenses?
    return false unless record.submitted?
    
    # Key authorization rule: Manager can only approve direct reports
    user.id == record.manager_id
  end

  # Process payment - finance users can process approved expenses
  def process_payment?
    return false unless user.can_process_payments?
    record.approved?
  end

  # Audit review - compliance users can audit any expense
  def audit_review?
    user.can_audit_expenses?
  end

  # Executive override - VPs and CFOs can override any expense
  def executive_override?
    user.vp? || user.cfo?
  end

  # Reject expense - approvers can reject expenses in appropriate states
  def reject?
    return false unless user.can_approve_expenses?
    record.submitted? || record.compliance_hold?
  end

  # Get approval history - participants can view history
  def approval_history?
    participant?
  end

  # Get status - participants can view status
  def status?
    participant?
  end

  # Withdraw expense - employees can withdraw their own submitted expenses
  def withdraw?
    return false unless user == record.employee
    record.submitted?
  end

  # Flag suspicious - compliance can flag any expense
  def flag_suspicious?
    user.compliance? || user.vp? || user.cfo?
  end

  private

  # Check if user is a participant in the expense workflow
  def participant?
    return true if user == record.employee
    return true if user.id == record.manager_id
    return true if user.id == record.finance_id
    return true if user.id == record.compliance_id
    return true if user.vp? || user.cfo?
    false
  end

  class Scope < Scope
    # Define which expenses a user can see
    def resolve
      case user.role
      when 'employee'
        # Employees see their own expenses
        scope.where(employee_id: user.id)
      when 'manager'
        # Managers see expenses from their direct reports + their own
        scope.where('employee_id = ? OR manager_id = ?', user.id, user.id)
      when 'finance'
        # Finance sees approved expenses + their own
        scope.where('state = ? OR employee_id = ?', 'approved', user.id)
      when 'compliance'
        # Compliance sees all expenses
        scope.all
      when 'vp', 'cfo'
        # Executives see all expenses
        scope.all
      else
        scope.none
      end
    end
  end
end