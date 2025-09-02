const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const {
  loadExpenseAndCheckAccess,
  requireExpenseState,
  requireExpenseOwner,
  requireDirectManager,
  requireFinanceRole,
  requireComplianceRole,
  requireExecutiveRole,
  validateBusinessRules
} = require('../middleware/authorize');

// GET /expenses - List expenses for current user
router.get('/', expenseController.index);

// GET /expenses/:id - Get specific expense
router.get('/:id', 
  loadExpenseAndCheckAccess,
  expenseController.show
);

// POST /expenses - Create new expense
router.post('/', expenseController.create);

// POST /expenses/:id/submit - Submit expense for approval
router.post('/:id/submit',
  loadExpenseAndCheckAccess,
  requireExpenseOwner,
  requireExpenseState('draft'),
  expenseController.submit
);

// POST /expenses/:id/approve - Approve expense (manager action)
router.post('/:id/approve',
  loadExpenseAndCheckAccess,
  requireExpenseState('submitted'),
  requireDirectManager,
  validateBusinessRules,
  expenseController.approve
);

// POST /expenses/:id/process_payment - Process payment (finance action)
router.post('/:id/process_payment',
  loadExpenseAndCheckAccess,
  requireExpenseState('approved'),
  requireFinanceRole,
  validateBusinessRules,
  expenseController.processPayment
);

// POST /expenses/:id/audit_review - Compliance audit
router.post('/:id/audit_review',
  loadExpenseAndCheckAccess,
  requireComplianceRole,
  expenseController.auditReview
);

// POST /expenses/:id/executive_override - Executive override
router.post('/:id/executive_override',
  loadExpenseAndCheckAccess,
  requireExecutiveRole,
  expenseController.executiveOverride
);

// POST /expenses/:id/reject - Reject expense
router.post('/:id/reject',
  loadExpenseAndCheckAccess,
  requireExpenseState(['submitted', 'compliance_hold']),
  requireDirectManager,
  expenseController.reject
);

// POST /expenses/:id/withdraw - Withdraw expense (employee action)
router.post('/:id/withdraw',
  loadExpenseAndCheckAccess,
  requireExpenseOwner,
  requireExpenseState('submitted'),
  expenseController.withdraw
);

// POST /expenses/:id/flag_suspicious - Flag suspicious activity
router.post('/:id/flag_suspicious',
  loadExpenseAndCheckAccess,
  requireComplianceRole,
  expenseController.flagSuspicious
);

// GET /expenses/:id/approval_history - Get approval history
router.get('/:id/approval_history',
  loadExpenseAndCheckAccess,
  expenseController.approvalHistory
);

// GET /expenses/:id/status - Get expense status
router.get('/:id/status',
  loadExpenseAndCheckAccess,
  expenseController.status
);

module.exports = router;