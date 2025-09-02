const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('Expenses', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      employeeId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'employee_id',
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      managerId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'manager_id',
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      financeId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'finance_id',
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      complianceId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'compliance_id',
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      approvedById: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'approved_by_id',
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      processedById: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'processed_by_id',
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      flaggedById: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'flagged_by_id',
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'USD'
      },
      expenseCategory: {
        type: DataTypes.ENUM(
          'TRAVEL',
          'MEALS',
          'OFFICE_SUPPLIES', 
          'ENTERTAINMENT',
          'SOFTWARE',
          'OTHER'
        ),
        allowNull: false,
        field: 'expense_category'
      },
      expenseDate: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expense_date'
      },
      vendorId: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'vendor_id'
      },
      department: {
        type: DataTypes.STRING,
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      state: {
        type: DataTypes.ENUM(
          'draft',
          'submitted',
          'approved',
          'paid',
          'rejected',
          'compliance_hold'
        ),
        allowNull: false,
        defaultValue: 'draft'
      },
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
      rejectionReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'rejection_reason'
      },
      flagReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'flag_reason'
      },
      overrideReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'override_reason'
      },
      paymentDetails: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'payment_details'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at'
      }
    });

    // Add foreign key constraints
    await queryInterface.addConstraint('Expenses', {
      fields: ['employee_id'],
      type: 'foreign key',
      name: 'fk_expenses_employee',
      references: {
        table: 'Users',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('Expenses', {
      fields: ['manager_id'],
      type: 'foreign key', 
      name: 'fk_expenses_manager',
      references: {
        table: 'Users',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('Expenses', {
      fields: ['finance_id'],
      type: 'foreign key',
      name: 'fk_expenses_finance',
      references: {
        table: 'Users',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('Expenses', {
      fields: ['compliance_id'],
      type: 'foreign key',
      name: 'fk_expenses_compliance',
      references: {
        table: 'Users',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // Create indexes for performance
    await queryInterface.addIndex('Expenses', ['employee_id']);
    await queryInterface.addIndex('Expenses', ['manager_id']);
    await queryInterface.addIndex('Expenses', ['finance_id']);
    await queryInterface.addIndex('Expenses', ['compliance_id']);
    await queryInterface.addIndex('Expenses', ['state']);
    await queryInterface.addIndex('Expenses', ['expense_date']);
    await queryInterface.addIndex('Expenses', ['department']);
    await queryInterface.addIndex('Expenses', ['expense_category']);
    await queryInterface.addIndex('Expenses', ['created_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('Expenses');
  }
};