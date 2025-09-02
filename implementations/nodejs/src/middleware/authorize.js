const { Expense, User, AuditLog } = require('../models');

/**
 * Authorization middleware for role-based access control
 * This demonstrates the complexity required to implement authorization manually
 * vs NPL's compile-time guarantees
 */

// Role-based authorization - check if user has required role
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        details: 'User not authenticated'
      });
    }

    const userRole = req.user.role;
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!rolesArray.includes(userRole)) {
      return res.status(403).json({
        error: 'Authorization failed',
        details: `Role '${userRole}' not authorized. Required: ${rolesArray.join(', ')}`
      });
    }

    next();
  };
};

// Load expense and check basic ownership/participation
const loadExpenseAndCheckAccess = async (req, res, next) => {
  try {
    const expenseId = req.params.id;
    
    if (!expenseId) {
      return res.status(400).json({
        error: 'Bad request',
        details: 'Expense ID is required'
      });
    }

    // Load expense with all related users
    const expense = await Expense.findByPk(expenseId, {
      include: [
        { model: User, as: 'employee' },
        { model: User, as: 'manager' },
        { model: User, as: 'finance' },
        { model: User, as: 'compliance' },
        { model: User, as: 'approvedBy' },
        { model: User, as: 'processedBy' },
        { 
          model: AuditLog, 
          as: 'auditLogs',
          include: [{ model: User, as: 'user' }]
        }
      ]
    });

    if (!expense) {
      return res.status(404).json({
        error: 'Not found',
        details: 'Expense not found'
      });
    }

    // Check if user is a participant in the expense workflow
    const userId = req.user.id;
    const isParticipant = 
      expense.employeeId === userId ||
      expense.managerId === userId ||
      expense.financeId === userId ||
      expense.complianceId === userId ||
      req.user.isVP() ||
      req.user.isCFO();

    if (!isParticipant) {
      return res.status(403).json({
        error: 'Authorization failed',
        details: 'User is not a participant in this expense approval process'
      });
    }

    req.expense = expense;
    next();
  } catch (error) {
    console.error('Authorization error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: 'Failed to load expense'
    });
  }
};

// State-based authorization - check if expense is in required state
const requireExpenseState = (allowedStates) => {
  return (req, res, next) => {
    if (!req.expense) {
      return res.status(500).json({
        error: 'Internal server error',
        details: 'Expense not loaded'
      });
    }

    const currentState = req.expense.state;
    const statesArray = Array.isArray(allowedStates) ? allowedStates : [allowedStates];

    if (!statesArray.includes(currentState)) {
      return res.status(422).json({
        error: 'Invalid state',
        details: `Current state '${currentState}' is not one of: ${statesArray.join(', ')}`
      });
    }

    next();
  };
};

// Employee-specific authorization
const requireExpenseOwner = (req, res, next) => {
  if (!req.expense || !req.user) {
    return res.status(500).json({
      error: 'Internal server error',
      details: 'Expense or user not loaded'
    });
  }

  if (req.expense.employeeId !== req.user.id) {
    return res.status(403).json({
      error: 'Authorization failed',
      details: 'Only the expense owner can perform this action'
    });
  }

  next();
};

// Manager-specific authorization - complex business rule validation
const requireDirectManager = async (req, res, next) => {
  try {
    if (!req.expense || !req.user) {
      return res.status(500).json({
        error: 'Internal server error',
        details: 'Expense or user not loaded'
      });
    }

    // Check if user can approve expenses
    if (!req.user.canApproveExpenses()) {
      return res.status(403).json({
        error: 'Authorization failed',
        details: 'User cannot approve expenses'
      });
    }

    // Key business rule: Manager can only approve direct reports
    // This is automatically enforced by NPL at compile-time
    if (req.user.role === 'manager' && req.expense.managerId !== req.user.id) {
      return res.status(403).json({
        error: 'Authorization failed',
        details: 'Manager can only approve direct reports'
      });
    }

    // Additional validation for approval amount limits
    const approvalLimit = req.user.getApprovalLimit();
    if (parseFloat(req.expense.amount) > approvalLimit) {
      return res.status(403).json({
        error: 'Authorization failed',
        details: `Amount ${req.expense.amount} exceeds approval limit ${approvalLimit}`
      });
    }

    next();
  } catch (error) {
    console.error('Manager authorization error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: 'Authorization check failed'
    });
  }
};

// Finance-specific authorization
const requireFinanceRole = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  if (!req.user.canProcessPayments()) {
    return res.status(403).json({
      error: 'Authorization failed',
      details: 'User cannot process payments'
    });
  }

  next();
};

// Compliance-specific authorization
const requireComplianceRole = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  if (!req.user.canAuditExpenses()) {
    return res.status(403).json({
      error: 'Authorization failed',
      details: 'User cannot perform compliance audits'
    });
  }

  next();
};

// Executive override authorization
const requireExecutiveRole = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  if (!req.user.isVP() && !req.user.isCFO()) {
    return res.status(403).json({
      error: 'Authorization failed',
      details: 'Only executives can override approvals'
    });
  }

  next();
};

// Complex business rule validation - this logic is scattered vs NPL's centralized approach
const validateBusinessRules = async (req, res, next) => {
  try {
    const expense = req.expense;
    const user = req.user;

    // Multiple validation layers needed (vs NPL's single require statements)

    // 1. Budget validation
    const remainingBudget = expense.getRemainingDepartmentBudget();
    if (parseFloat(expense.amount) > remainingBudget) {
      return res.status(422).json({
        error: 'Validation failed',
        details: 'Insufficient departmental budget remaining'
      });
    }

    // 2. Vendor validation
    if (expense.isVendorBlacklisted()) {
      return res.status(422).json({
        error: 'Validation failed',
        details: 'Vendor is currently under investigation'
      });
    }

    // 3. Entertainment expense validation
    if (expense.requiresVPApproval() && !user.isVP() && !user.isCFO()) {
      return res.status(422).json({
        error: 'Validation failed',
        details: 'Entertainment expenses over $200 require VP approval'
      });
    }

    // 4. Business day validation
    if (!expense.isBusinessDay()) {
      return res.status(422).json({
        error: 'Validation failed',
        details: 'Approvals can only be processed on business days'
      });
    }

    // 5. Duplicate payment check
    const hasDuplicate = await expense.hasPaymentDuplicate();
    if (hasDuplicate) {
      return res.status(422).json({
        error: 'Validation failed',
        details: 'Duplicate payment detected'
      });
    }

    next();
  } catch (error) {
    console.error('Business rule validation error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: 'Business rule validation failed'
    });
  }
};

module.exports = {
  requireRole,
  loadExpenseAndCheckAccess,
  requireExpenseState,
  requireExpenseOwner,
  requireDirectManager,
  requireFinanceRole,
  requireComplianceRole,
  requireExecutiveRole,
  validateBusinessRules
};