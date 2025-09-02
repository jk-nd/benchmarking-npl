'use strict';

module.exports = (sequelize, DataTypes) => {
  const Expense = sequelize.define('Expense', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    // Employee who submitted the expense
    employeeId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'employee_id',
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        isPositive(value) {
          if (value <= 0) {
            throw new Error('Amount must be positive');
          }
        }
      }
    },
    expenseCategory: {
      type: DataTypes.ENUM(
        'MEALS',
        'TRAVEL', 
        'ACCOMMODATION',
        'ENTERTAINMENT',
        'SUPPLIES',
        'CAPITAL',
        'OTHER'
      ),
      allowNull: false,
      field: 'expense_category'
    },
    currency: {
      type: DataTypes.ENUM('USD', 'EUR', 'GBP', 'JPY'),
      allowNull: false,
      defaultValue: 'USD'
    },
    expenseDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expense_date',
      validate: {
        notTooOld(value) {
          const ninetyDaysAgo = new Date();
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
          if (value < ninetyDaysAgo) {
            throw new Error('Expense date cannot be more than 90 days old');
          }
        }
      }
    },
    vendorId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'vendor_id'
    },
    department: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [10, 500]
      }
    },
    
    // Workflow participants (set during submission)
    managerId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'manager_id',
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    financeId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'finance_id',
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    complianceId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'compliance_id',
      references: {
        model: 'Users',
        key: 'id'
      }
    },

    // State machine - manual implementation (vs NPL's automatic)
    state: {
      type: DataTypes.ENUM(
        'draft',
        'submitted', 
        'approved',
        'compliance_hold',
        'rejected',
        'paid'
      ),
      allowNull: false,
      defaultValue: 'draft'
    },

    // Approval tracking
    approvedById: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'approved_by_id',
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    processedById: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'processed_by_id',
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    flaggedById: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'flagged_by_id',
      references: {
        model: 'Users',
        key: 'id'
      }
    },

    // Workflow timestamps  
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'submitted_at'
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'approved_at'
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'processed_at'
    },
    rejectedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'rejected_at'
    },
    flaggedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'flagged_at'
    },

    // Additional tracking fields
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'rejection_reason'
    },
    overrideReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'override_reason'
    },
    flagReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'flag_reason'
    },
    paymentDetails: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'payment_details'
    }
  }, {
    tableName: 'expenses',
    timestamps: true,
    validate: {
      // Model-level validations for business rules
      async businessRules() {
        if (this.amount <= 0) {
          throw new Error('Amount must be positive');
        }
        
        if (this.description && this.description.length < 10) {
          throw new Error('Description must be at least 10 characters');
        }

        // Check if vendor is blacklisted
        if (this.isVendorBlacklisted()) {
          throw new Error('Vendor is currently under investigation');
        }
      }
    }
  });

  Expense.associate = function(models) {
    // Employee who submitted the expense
    Expense.belongsTo(models.User, {
      foreignKey: 'employeeId',
      as: 'employee'
    });

    // Manager assigned to approve
    Expense.belongsTo(models.User, {
      foreignKey: 'managerId',
      as: 'manager'
    });

    // Finance user assigned
    Expense.belongsTo(models.User, {
      foreignKey: 'financeId',
      as: 'finance'
    });

    // Compliance user assigned
    Expense.belongsTo(models.User, {
      foreignKey: 'complianceId',
      as: 'compliance'
    });

    // Who approved/processed/flagged
    Expense.belongsTo(models.User, {
      foreignKey: 'approvedById',
      as: 'approvedBy'
    });
    
    Expense.belongsTo(models.User, {
      foreignKey: 'processedById',
      as: 'processedBy'
    });
    
    Expense.belongsTo(models.User, {
      foreignKey: 'flaggedById',
      as: 'flaggedBy'
    });

    // Related records
    Expense.hasMany(models.Receipt, {
      foreignKey: 'expenseId',
      as: 'receipts'
    });

    Expense.hasMany(models.AuditLog, {
      foreignKey: 'expenseId',
      as: 'auditLogs'
    });
  };

  // State check methods (manual implementation vs NPL's automatic)
  Expense.prototype.isDraft = function() {
    return this.state === 'draft';
  };

  Expense.prototype.isSubmitted = function() {
    return this.state === 'submitted';
  };

  Expense.prototype.isApproved = function() {
    return this.state === 'approved';
  };

  Expense.prototype.isRejected = function() {
    return this.state === 'rejected';
  };

  Expense.prototype.isPaid = function() {
    return this.state === 'paid';
  };

  Expense.prototype.isOnComplianceHold = function() {
    return this.state === 'compliance_hold';
  };

  // Business rule validation methods
  Expense.prototype.isVendorBlacklisted = function() {
    const blacklistedVendors = ['VENDOR_999', 'SUSPICIOUS_CO'];
    return blacklistedVendors.includes(this.vendorId);
  };

  Expense.prototype.exceedsMonthlyLimit = async function() {
    const employee = await this.getEmployee();
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const monthlyTotal = await Expense.sum('amount', {
      where: {
        employeeId: this.employeeId,
        createdAt: {
          [sequelize.Sequelize.Op.gte]: startOfMonth
        }
      }
    }) || 0;
    
    const monthlyLimit = employee.getMonthlyExpenseLimit();
    return (monthlyTotal + parseFloat(this.amount)) > monthlyLimit;
  };

  Expense.prototype.requiresReceipts = function() {
    return parseFloat(this.amount) > 25;
  };

  Expense.prototype.isBusinessDay = function() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
  };

  Expense.prototype.getRemainingDepartmentBudget = function() {
    // Simulate budget checking - in real system would query budget service
    const budgets = {
      'Engineering': 50000,
      'Marketing': 30000,
      'Finance': 25000
    };
    return budgets[this.department] || 10000;
  };

  Expense.prototype.requiresVPApproval = function() {
    return this.expenseCategory === 'ENTERTAINMENT' && parseFloat(this.amount) > 200;
  };

  Expense.prototype.hasPaymentDuplicate = async function() {
    return await Expense.findOne({
      where: {
        vendorId: this.vendorId,
        amount: this.amount,
        state: 'paid',
        id: {
          [sequelize.Sequelize.Op.ne]: this.id
        },
        processedAt: {
          [sequelize.Sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });
  };

  // Generate response format similar to NPL
  Expense.prototype.toApiResponse = function(availableActions = {}) {
    return {
      '@id': this.id,
      '@state': this.state,
      '@actions': availableActions,
      '@parties': {
        employee: this.employee ? {
          entity: { preferred_username: [this.employee.preferredUsername] }
        } : null,
        manager: this.manager ? {
          entity: { preferred_username: [this.manager.preferredUsername] }
        } : null,
        finance: this.finance ? {
          entity: { preferred_username: [this.finance.preferredUsername] }
        } : null,
        compliance: this.compliance ? {
          entity: { preferred_username: [this.compliance.preferredUsername] }
        } : null
      },
      employeeId: this.employee?.employeeId,
      managerId: this.manager?.employeeId,
      financeId: this.finance?.employeeId,
      complianceId: this.compliance?.employeeId,
      amount: parseFloat(this.amount),
      expenseCategory: this.expenseCategory,
      currency: this.currency,
      expenseDate: this.expenseDate.toISOString(),
      vendorId: this.vendorId,
      department: this.department,
      description: this.description,
      receipts: this.receipts ? this.receipts.map(r => r.toApiResponse()) : [],
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  };

  return Expense;
};