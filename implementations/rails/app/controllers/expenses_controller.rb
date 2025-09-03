# ExpensesController handles expense approval workflow operations
# This controller implements the same API endpoints as the NPL system
class ExpensesController < ApplicationController
  before_action :find_expense, except: [:index, :create]
  
  # GET /expenses
  def index
    @expenses = policy_scope(Expense).includes(:employee, :receipts)
    render json: @expenses.map { |expense| expense_json(expense) }
  end

  # GET /expenses/:id  
  def show
    authorize @expense
    render json: expense_json(@expense)
  end

  # POST /expenses
  def create
    @expense = Expense.new(expense_params)
    @expense.employee = current_user
    
    authorize @expense
    
    if @expense.save
      # Create receipts if provided
      if params[:receipts].present?
        params[:receipts].each do |receipt_params|
          @expense.receipts.create!(
            file_name: receipt_params[:fileName],
            upload_date: receipt_params[:uploadDate],
            file_size: receipt_params[:fileSize]
          )
        end
      end
      
      render json: expense_json(@expense), status: :created
    else
      render json: { errors: @expense.errors }, status: :unprocessable_entity
    end
  end

  # POST /expenses/:id/submit
  def submit
    authorize @expense, :submit?
    result = @expense.submit_expense!(current_user)
    render json: { message: result }
  end

  # POST /expenses/:id/approve  
  def approve
    authorize @expense, :approve?
    result = @expense.approve_expense!(current_user)
    render json: { message: result }
  end

  # POST /expenses/:id/process_payment
  def process_payment
    authorize @expense, :process_payment?
    result = @expense.process_payment_expense!(current_user)
    render json: { message: result }
  end

  # POST /expenses/:id/audit_review
  def audit_review
    authorize @expense, :audit_review?
    result = @expense.audit_review!(current_user)
    render json: { audit_report: JSON.parse(result) }
  end

  # POST /expenses/:id/executive_override
  def executive_override
    authorize @expense, :executive_override?
    reason = params[:reason] || 'Executive override applied'
    result = @expense.executive_override_expense!(current_user, reason)
    render json: { message: result }
  end

  # POST /expenses/:id/reject
  def reject
    authorize @expense, :reject?
    reason = params[:reason] || 'Expense rejected'
    result = @expense.reject_expense!(current_user, reason)
    render json: { message: result }
  end

  # GET /expenses/:id/approval_history
  def approval_history
    authorize @expense, :approval_history?
    history = @expense.get_approval_history(current_user)
    render json: { approval_history: history }
  end

  # GET /expenses/:id/status
  def status
    authorize @expense, :status?
    status_info = @expense.get_status(current_user)
    render json: { status: status_info }
  end

  # POST /expenses/:id/withdraw
  def withdraw
    authorize @expense, :withdraw?
    
    @expense.update!(
      state: 'draft',
      submitted_at: nil,
      manager_id: nil
    )
    
    @expense.send(:log_action, current_user, 'withdraw', 'Expense withdrawn by employee')
    render json: { message: 'Expense withdrawn successfully' }
  end

  # POST /expenses/:id/flag_suspicious
  def flag_suspicious
    authorize @expense, :flag_suspicious?
    
    @expense.update!(
      state: 'compliance_hold',
      flagged_at: Time.current,
      flagged_by: current_user,
      flag_reason: params[:reason] || 'Flagged for review'
    )
    
    @expense.send(:log_action, current_user, 'flagSuspicious', 'Expense flagged for suspicious activity')
    render json: { message: 'Expense flagged for review' }
  end

  private

  def find_expense
    @expense = Expense.find(params[:id])
  end

  def expense_params
    params.permit(
      :amount, :expense_category, :currency, :expense_date,
      :vendor_id, :department, :description, :manager_id,
      :finance_id, :compliance_id
    )
  end

  # Format expense data similar to NPL API response
  def expense_json(expense)
    {
      '@id': expense.id,
      '@state': expense.state,
      '@actions': available_actions(expense),
      '@parties': {
        employee: {
          entity: { preferred_username: [expense.employee.preferred_username] }
        },
        manager: expense.manager ? {
          entity: { preferred_username: [expense.manager.preferred_username] }
        } : nil,
        finance: expense.finance_user ? {
          entity: { preferred_username: [expense.finance_user.preferred_username] }
        } : nil,
        compliance: expense.compliance_user ? {
          entity: { preferred_username: [expense.compliance_user.preferred_username] }
        } : nil
      }.compact,
      employeeId: expense.employee.employee_id,
      managerId: expense.manager&.employee_id,
      financeId: expense.finance_user&.employee_id,
      complianceId: expense.compliance_user&.employee_id,
      amount: expense.amount,
      expenseCategory: expense.expense_category,
      currency: expense.currency,
      expenseDate: expense.expense_date.iso8601,
      vendorId: expense.vendor_id,
      department: expense.department,
      description: expense.description,
      receipts: expense.receipts.map(&:to_h),
      createdAt: expense.created_at.iso8601,
      updatedAt: expense.updated_at.iso8601
    }
  end

  # Determine available actions based on current state and user permissions  
  def available_actions(expense)
    actions = {}
    
    begin
      actions[:submit] = "/expenses/#{expense.id}/submit" if ExpensePolicy.new(current_user, expense).submit?
    rescue
      # Action not available
    end

    begin
      actions[:approve] = "/expenses/#{expense.id}/approve" if ExpensePolicy.new(current_user, expense).approve?
    rescue
      # Action not available
    end

    begin
      actions[:process_payment] = "/expenses/#{expense.id}/process_payment" if ExpensePolicy.new(current_user, expense).process_payment?
    rescue
      # Action not available
    end

    begin
      actions[:audit_review] = "/expenses/#{expense.id}/audit_review" if ExpensePolicy.new(current_user, expense).audit_review?
    rescue
      # Action not available
    end

    begin
      actions[:executive_override] = "/expenses/#{expense.id}/executive_override" if ExpensePolicy.new(current_user, expense).executive_override?
    rescue
      # Action not available
    end

    begin
      actions[:reject] = "/expenses/#{expense.id}/reject" if ExpensePolicy.new(current_user, expense).reject?
    rescue
      # Action not available
    end

    begin
      actions[:withdraw] = "/expenses/#{expense.id}/withdraw" if ExpensePolicy.new(current_user, expense).withdraw?
    rescue
      # Action not available
    end

    begin
      actions[:flag_suspicious] = "/expenses/#{expense.id}/flag_suspicious" if ExpensePolicy.new(current_user, expense).flag_suspicious?
    rescue
      # Action not available
    end

    begin
      actions[:approval_history] = "/expenses/#{expense.id}/approval_history" if ExpensePolicy.new(current_user, expense).approval_history?
    rescue
      # Action not available
    end

    begin
      actions[:status] = "/expenses/#{expense.id}/status" if ExpensePolicy.new(current_user, expense).status?
    rescue
      # Action not available
    end

    actions
  end
end