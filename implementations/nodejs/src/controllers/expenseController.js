const { Expense, User, Receipt } = require('../models');
const expenseService = require('../services/expenseService');

/**
 * ExpenseController handles all expense workflow operations
 * This demonstrates the complexity of implementing the same functionality as NPL manually
 * Each endpoint requires multiple layers of validation, authorization, and error handling
 */
class ExpenseController {

  // GET /expenses - List expenses for current user
  async index(req, res) {
    try {
      const user = req.user;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      // Determine which expenses user can see based on role
      let whereClause = {};
      
      switch (user.role) {
        case 'employee':
          // Employees see only their own expenses
          whereClause.employeeId = user.id;
          break;
        case 'manager':
          // Managers see expenses they manage + their own
          whereClause = {
            [require('sequelize').Op.or]: [
              { employeeId: user.id },
              { managerId: user.id }
            ]
          };
          break;
        case 'finance':
          // Finance sees approved expenses + their own
          whereClause = {
            [require('sequelize').Op.or]: [
              { employeeId: user.id },
              { state: 'approved' }
            ]
          };
          break;
        case 'compliance':
        case 'vp':
        case 'cfo':
          // Executives and compliance see all expenses
          break;
        default:
          whereClause.employeeId = user.id;
      }

      const expenses = await Expense.findAll({
        where: whereClause,
        include: [
          { model: User, as: 'employee' },
          { model: User, as: 'manager' },
          { model: User, as: 'finance' },
          { model: User, as: 'compliance' },
          { model: Receipt, as: 'receipts' }
        ],
        order: [['createdAt', 'DESC']],
        limit: limit,
        offset: offset
      });

      // Format response similar to NPL
      const formattedExpenses = expenses.map(expense => {
        const availableActions = expenseService.getAvailableActions(expense, user);
        return expense.toApiResponse(availableActions);
      });

      return res.json(formattedExpenses);

    } catch (error) {
      console.error('List expenses error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        details: 'Failed to retrieve expenses'
      });
    }
  }

  // GET /expenses/:id - Get specific expense
  async show(req, res) {
    try {
      const expense = req.expense; // Loaded by middleware
      const user = req.user;

      // Get available actions for this user
      const availableActions = expenseService.getAvailableActions(expense, user);

      // Format response matching NPL's format
      const response = expense.toApiResponse(availableActions);

      return res.json(response);

    } catch (error) {
      console.error('Get expense error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        details: 'Failed to retrieve expense'
      });
    }
  }

  // POST /expenses - Create new expense
  async create(req, res) {
    try {
      const user = req.user;
      const {
        amount,
        expenseCategory,
        currency,
        expenseDate,
        vendorId,
        department,
        description,
        receipts
      } = req.body;

      // Create expense
      const expense = await Expense.create({
        employeeId: user.id,
        amount: amount,
        expenseCategory: expenseCategory,
        currency: currency || 'USD',
        expenseDate: new Date(expenseDate),
        vendorId: vendorId,
        department: department || user.department,
        description: description
      });

      // Create receipts if provided
      if (receipts && receipts.length > 0) {
        const receiptData = receipts.map(receipt => ({
          expenseId: expense.id,
          fileName: receipt.fileName,
          uploadDate: new Date(receipt.uploadDate),
          fileSize: receipt.fileSize
        }));
        
        await Receipt.bulkCreate(receiptData);
      }

      // Reload with associations
      const createdExpense = await Expense.findByPk(expense.id, {
        include: [
          { model: User, as: 'employee' },
          { model: Receipt, as: 'receipts' }
        ]
      });

      // Get available actions
      const availableActions = expenseService.getAvailableActions(createdExpense, user);

      return res.status(201).json(createdExpense.toApiResponse(availableActions));

    } catch (error) {
      console.error('Create expense error:', error);
      
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => e.message).join(', ')
        });
      }
      
      return res.status(500).json({
        error: 'Internal server error',
        details: 'Failed to create expense'
      });
    }
  }

  // POST /expenses/:id/submit - Submit expense for approval
  async submit(req, res) {
    try {
      const expense = req.expense;
      const user = req.user;

      const result = await expenseService.submitExpense(expense, user);

      return res.json({ message: result });

    } catch (error) {
      console.error('Submit expense error:', error);
      return res.status(422).json({
        error: 'Validation failed',
        details: error.message
      });
    }
  }

  // POST /expenses/:id/approve - Approve expense
  async approve(req, res) {
    try {
      const expense = req.expense;
      const user = req.user;

      const result = await expenseService.approveExpense(expense, user);

      return res.json({ message: result });

    } catch (error) {
      console.error('Approve expense error:', error);
      return res.status(422).json({
        error: 'Validation failed',
        details: error.message
      });
    }
  }

  // POST /expenses/:id/process_payment - Process payment
  async processPayment(req, res) {
    try {
      const expense = req.expense;
      const user = req.user;

      const result = await expenseService.processPayment(expense, user);

      return res.json({ message: result });

    } catch (error) {
      console.error('Process payment error:', error);
      return res.status(422).json({
        error: 'Validation failed',
        details: error.message
      });
    }
  }

  // POST /expenses/:id/audit_review - Compliance audit
  async auditReview(req, res) {
    try {
      const expense = req.expense;
      const user = req.user;

      const auditReport = await expenseService.auditReview(expense, user);

      return res.json({ audit_report: auditReport });

    } catch (error) {
      console.error('Audit review error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  // POST /expenses/:id/executive_override - Executive override
  async executiveOverride(req, res) {
    try {
      const expense = req.expense;
      const user = req.user;
      const reason = req.body.reason || 'Executive override applied';

      const result = await expenseService.executiveOverride(expense, user, reason);

      return res.json({ message: result });

    } catch (error) {
      console.error('Executive override error:', error);
      return res.status(422).json({
        error: 'Validation failed',
        details: error.message
      });
    }
  }

  // POST /expenses/:id/reject - Reject expense
  async reject(req, res) {
    try {
      const expense = req.expense;
      const user = req.user;
      const reason = req.body.reason || 'Expense rejected';

      const result = await expenseService.rejectExpense(expense, user, reason);

      return res.json({ message: result });

    } catch (error) {
      console.error('Reject expense error:', error);
      return res.status(422).json({
        error: 'Validation failed',
        details: error.message
      });
    }
  }

  // POST /expenses/:id/withdraw - Withdraw expense
  async withdraw(req, res) {
    try {
      const expense = req.expense;
      const user = req.user;

      const result = await expenseService.withdrawExpense(expense, user);

      return res.json({ message: result });

    } catch (error) {
      console.error('Withdraw expense error:', error);
      return res.status(422).json({
        error: 'Validation failed',
        details: error.message
      });
    }
  }

  // POST /expenses/:id/flag_suspicious - Flag suspicious activity
  async flagSuspicious(req, res) {
    try {
      const expense = req.expense;
      const user = req.user;
      const reason = req.body.reason || 'Flagged for review';

      const result = await expenseService.flagSuspicious(expense, user, reason);

      return res.json({ message: result });

    } catch (error) {
      console.error('Flag suspicious error:', error);
      return res.status(422).json({
        error: 'Validation failed',
        details: error.message
      });
    }
  }

  // GET /expenses/:id/approval_history - Get approval history
  async approvalHistory(req, res) {
    try {
      const expense = req.expense;

      const history = await expenseService.getApprovalHistory(expense.id);

      return res.json({ approval_history: history });

    } catch (error) {
      console.error('Get approval history error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        details: 'Failed to retrieve approval history'
      });
    }
  }

  // GET /expenses/:id/status - Get expense status
  async status(req, res) {
    try {
      const expense = req.expense;

      const status = await expenseService.getExpenseStatus(expense);

      return res.json({ status: status });

    } catch (error) {
      console.error('Get expense status error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        details: 'Failed to retrieve expense status'
      });
    }
  }
}

module.exports = new ExpenseController();