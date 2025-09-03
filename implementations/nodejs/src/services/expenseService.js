const { Expense, User, Receipt, AuditLog } = require('../models');
const auditService = require('./auditService');

/**
 * ExpenseService handles core business logic for expense workflow
 * This demonstrates the manual implementation complexity vs NPL's automatic handling
 */
class ExpenseService {
  
  // Submit expense - equivalent to NPL's submit permission
  async submitExpense(expense, user) {
    try {
      // Pre-submission validation (manual vs NPL's automatic)
      await this.validateSubmissionRules(expense, user);
      
      // Find direct manager (manual lookup vs NPL's automatic getDirectManager)
      const directManager = await this.getDirectManagerForEmployee(user);
      
      if (!directManager) {
        throw new Error('No manager found for employee');
      }

      // Find finance and compliance users
      const financeUser = await User.findOne({ where: { role: 'finance', department: 'Finance' } });
      const complianceUser = await User.findOne({ where: { role: 'compliance' } });

      // Manual state transition (vs NPL's automatic state management)
      await expense.update({
        state: 'submitted',
        submittedAt: new Date(),
        managerId: directManager.id,
        financeId: financeUser?.id,
        complianceId: complianceUser?.id
      });

      // Manual audit logging (vs NPL's automatic audit trail)
      await auditService.logAction(expense.id, user.id, 'submit', 'Expense submitted successfully');

      return 'Expense submitted successfully';
    } catch (error) {
      console.error('Submit expense error:', error);
      throw error;
    }
  }

  // Approve expense - equivalent to NPL's approve permission
  async approveExpense(expense, user) {
    try {
      // Validate business rules before approval (manual vs NPL's automatic)
      await this.validateManagerApprovalRules(expense, user);

      // Manual state transition with timestamp tracking
      await expense.update({
        state: 'approved',
        approvedAt: new Date(),
        approvedById: user.id
      });

      // Manual audit logging
      await auditService.logAction(expense.id, user.id, 'approve', 'Expense approved by manager');

      return 'Expense approved by manager';
    } catch (error) {
      console.error('Approve expense error:', error);
      throw error;
    }
  }

  // Process payment - equivalent to NPL's processPayment permission
  async processPayment(expense, user) {
    try {
      // Validate payment processing rules
      await this.validatePaymentProcessingRules(expense, user);

      // Generate payment details (manual vs NPL's automatic)
      const paymentDetails = this.generatePaymentDetails(expense);

      // Manual state transition
      await expense.update({
        state: 'paid',
        processedAt: new Date(),
        processedById: user.id,
        paymentDetails: paymentDetails
      });

      // Manual audit logging
      await auditService.logAction(expense.id, user.id, 'processPayment', 'Payment processed successfully');

      return 'Payment processed successfully';
    } catch (error) {
      console.error('Process payment error:', error);
      throw error;
    }
  }

  // Audit review - equivalent to NPL's auditReview permission
  async auditReview(expense, user) {
    try {
      const auditReport = await this.generateAuditReport(expense);
      
      await auditService.logAction(expense.id, user.id, 'auditReview', 'Compliance audit completed');
      
      return auditReport;
    } catch (error) {
      console.error('Audit review error:', error);
      throw error;
    }
  }

  // Executive override - equivalent to NPL's executiveOverride permission
  async executiveOverride(expense, user, reason = 'Executive override applied') {
    try {
      await expense.update({
        state: 'approved',
        approvedAt: new Date(),
        approvedById: user.id,
        overrideReason: reason
      });

      await auditService.logAction(expense.id, user.id, 'executiveOverride', `Executive override: ${reason}`);

      return 'Executive override applied';
    } catch (error) {
      console.error('Executive override error:', error);
      throw error;
    }
  }

  // Reject expense
  async rejectExpense(expense, user, reason = 'Expense rejected') {
    try {
      await expense.update({
        state: 'rejected',
        rejectedAt: new Date(),
        rejectionReason: reason
      });

      await auditService.logAction(expense.id, user.id, 'reject', `Expense rejected: ${reason}`);

      return 'Expense rejected';
    } catch (error) {
      console.error('Reject expense error:', error);
      throw error;
    }
  }

  // Withdraw expense
  async withdrawExpense(expense, user) {
    try {
      await expense.update({
        state: 'draft',
        submittedAt: null,
        managerId: null,
        financeId: null,
        complianceId: null
      });

      await auditService.logAction(expense.id, user.id, 'withdraw', 'Expense withdrawn by employee');

      return 'Expense withdrawn successfully';
    } catch (error) {
      console.error('Withdraw expense error:', error);
      throw error;
    }
  }

  // Flag suspicious activity
  async flagSuspicious(expense, user, reason = 'Flagged for review') {
    try {
      await expense.update({
        state: 'compliance_hold',
        flaggedAt: new Date(),
        flaggedById: user.id,
        flagReason: reason
      });

      await auditService.logAction(expense.id, user.id, 'flagSuspicious', 'Expense flagged for suspicious activity');

      return 'Expense flagged for review';
    } catch (error) {
      console.error('Flag suspicious error:', error);
      throw error;
    }
  }

  // Get approval history - equivalent to NPL's getApprovalHistory permission
  async getApprovalHistory(expenseId) {
    try {
      const auditLogs = await AuditLog.findAll({
        where: { expenseId },
        include: [{ model: User, as: 'user' }],
        order: [['timestamp', 'ASC']]
      });

      return auditLogs.map(log => log.toHistoryEntry());
    } catch (error) {
      console.error('Get approval history error:', error);
      throw error;
    }
  }

  // Get expense status - equivalent to NPL's getStatus permission
  async getExpenseStatus(expense) {
    try {
      return {
        state: expense.state,
        submittedAt: expense.submittedAt,
        approvedAt: expense.approvedAt,
        processedAt: expense.processedAt,
        currentApprover: await this.getCurrentApprover(expense)
      };
    } catch (error) {
      console.error('Get expense status error:', error);
      throw error;
    }
  }

  // Private helper methods - these implement complex business logic manually

  async validateSubmissionRules(expense, user) {
    // Rule 1: Amount must be positive
    if (parseFloat(expense.amount) <= 0) {
      throw new Error('Amount must be positive');
    }

    // Rule 2: Description is required and must be meaningful
    if (!expense.description || expense.description.length < 10) {
      throw new Error('Description must be at least 10 characters');
    }

    // Rule 3: Receipts required for expenses over $25
    if (expense.requiresReceipts()) {
      const receipts = await expense.getReceipts();
      if (!receipts || receipts.length === 0) {
        throw new Error('Receipts are required for expenses over $25');
      }
    }

    // Rule 4: Vendor cannot be blacklisted
    if (expense.isVendorBlacklisted()) {
      throw new Error('Vendor is currently under investigation');
    }

    // Rule 5: Expense date cannot be too old
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    if (expense.expenseDate < ninetyDaysAgo) {
      throw new Error('Expense date cannot be more than 90 days old');
    }

    // Rule 6: Check monthly limit
    const exceedsLimit = await expense.exceedsMonthlyLimit();
    if (exceedsLimit) {
      throw new Error('Expense exceeds monthly limit');
    }
  }

  async validateManagerApprovalRules(expense, manager) {
    // Rule 1: Budget validation
    const remainingBudget = expense.getRemainingDepartmentBudget();
    if (parseFloat(expense.amount) > remainingBudget) {
      throw new Error('Insufficient departmental budget remaining');
    }

    // Rule 2: Vendor validation
    if (expense.isVendorBlacklisted()) {
      throw new Error('Vendor is currently under investigation');
    }

    // Rule 3: Entertainment expense validation
    if (expense.requiresVPApproval()) {
      throw new Error('Entertainment expenses over $200 require VP approval');
    }

    // Rule 4: Business day validation
    if (!expense.isBusinessDay()) {
      throw new Error('Approvals can only be processed on business days');
    }

    // Rule 5: Manager approval limit validation
    const approvalLimit = manager.getApprovalLimit();
    if (parseFloat(expense.amount) > approvalLimit) {
      throw new Error('Amount exceeds manager approval limit');
    }
  }

  async validatePaymentProcessingRules(expense, user) {
    // Rule 1: Vendor payment details must be verified
    if (expense.isVendorBlacklisted()) {
      throw new Error('Vendor payment details must be verified');
    }

    // Rule 2: Check for duplicate payments
    const hasDuplicate = await expense.hasPaymentDuplicate();
    if (hasDuplicate) {
      throw new Error('Duplicate payment detected');
    }
  }

  async getDirectManagerForEmployee(employee) {
    // Simulate organizational chart lookup - matches NPL getDirectManager logic
    const employeeId = employee.employeeId || employee.id || '';
    
    let managerEmployeeId = 'mgr_general_001';
    if (employeeId.includes('eng')) managerEmployeeId = 'mgr_engineering_001';
    else if (employeeId.includes('sales')) managerEmployeeId = 'mgr_sales_001';
    else if (employeeId.includes('mkt')) managerEmployeeId = 'mgr_marketing_001';
    else if (employeeId.includes('fin')) managerEmployeeId = 'mgr_finance_001';
    else if (employeeId.includes('hr')) managerEmployeeId = 'mgr_hr_001';
    
    return await User.findOne({
      where: { 
        employeeId: managerEmployeeId
      }
    }) || await User.findOne({
      where: { 
        role: 'manager',
        department: employee.department 
      }
    });
  }

  async getCurrentApprover(expense) {
    switch (expense.state) {
      case 'submitted':
        return expense.manager?.preferredUsername || null;
      case 'compliance_hold':
        return expense.compliance?.preferredUsername || null;
      default:
        return null;
    }
  }

  generatePaymentDetails(expense) {
    // Manual payment details generation (vs NPL's automatic)
    return {
      paymentId: require('uuid').v4(),
      processedAt: new Date().toISOString(),
      paymentMethod: 'ACH_TRANSFER',
      vendorId: expense.vendorId,
      amount: parseFloat(expense.amount),
      currency: expense.currency
    };
  }

  async generateAuditReport(expense) {
    const riskScore = this.calculateRiskScore(expense);
    const recommendations = this.generateRecommendations(expense, riskScore);

    return {
      expenseId: expense.id,
      auditDate: new Date().toISOString(),
      complianceStatus: 'COMPLIANT',
      riskScore: riskScore,
      recommendations: recommendations,
      auditTrail: await this.getApprovalHistory(expense.id)
    };
  }

  calculateRiskScore(expense) {
    let score = 0;
    
    if (parseFloat(expense.amount) > 1000) score += 10;
    if (expense.expenseCategory === 'ENTERTAINMENT') score += 15;
    if (expense.isVendorBlacklisted()) score += 20;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (expense.expenseDate < thirtyDaysAgo) score += 5;

    return Math.min(score, 100);
  }

  generateRecommendations(expense, riskScore) {
    const recommendations = [];
    
    if (riskScore > 30) {
      recommendations.push('Consider vendor re-evaluation');
    }
    
    if (parseFloat(expense.amount) > 500) {
      recommendations.push('Verify receipt authenticity');
    }
    
    // This would require additional database queries in a real system
    recommendations.push('Monitor for pattern abuse');
    
    return recommendations;
  }

  // Get available actions for expense based on current user and state
  getAvailableActions(expense, user, baseUrl = '') {
    const actions = {};
    
    try {
      // Submit action
      if (expense.isDraft() && expense.employeeId === user.id) {
        actions.submit = `${baseUrl}/expenses/${expense.id}/submit`;
      }

      // Approve action
      if (expense.isSubmitted() && user.canApproveExpenses() && 
          (user.role !== 'manager' || expense.managerId === user.id)) {
        actions.approve = `${baseUrl}/expenses/${expense.id}/approve`;
      }

      // Process payment action
      if (expense.isApproved() && user.canProcessPayments()) {
        actions.processPayment = `${baseUrl}/expenses/${expense.id}/process_payment`;
      }

      // Audit review action
      if (user.canAuditExpenses()) {
        actions.auditReview = `${baseUrl}/expenses/${expense.id}/audit_review`;
      }

      // Executive override action
      if ((user.isVP() || user.isCFO()) && !expense.isPaid()) {
        actions.executiveOverride = `${baseUrl}/expenses/${expense.id}/executive_override`;
      }

      // Reject action
      if ((expense.isSubmitted() || expense.isOnComplianceHold()) && user.canApproveExpenses()) {
        actions.reject = `${baseUrl}/expenses/${expense.id}/reject`;
      }

      // Withdraw action
      if (expense.isSubmitted() && expense.employeeId === user.id) {
        actions.withdraw = `${baseUrl}/expenses/${expense.id}/withdraw`;
      }

      // Flag suspicious action
      if (user.canAuditExpenses()) {
        actions.flagSuspicious = `${baseUrl}/expenses/${expense.id}/flag_suspicious`;
      }

      // Always available for participants
      actions.approvalHistory = `${baseUrl}/expenses/${expense.id}/approval_history`;
      actions.status = `${baseUrl}/expenses/${expense.id}/status`;

    } catch (error) {
      console.error('Error getting available actions:', error);
    }

    return actions;
  }
}

module.exports = new ExpenseService();