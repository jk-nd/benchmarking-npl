const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('AuditLogs', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      expenseId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'expense_id',
        references: {
          model: 'Expenses',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'user_id',
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      action: {
        type: DataTypes.STRING,
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
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
    await queryInterface.addConstraint('AuditLogs', {
      fields: ['expense_id'],
      type: 'foreign key',
      name: 'fk_audit_logs_expense',
      references: {
        table: 'Expenses',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('AuditLogs', {
      fields: ['user_id'],
      type: 'foreign key',
      name: 'fk_audit_logs_user',
      references: {
        table: 'Users',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // Create indexes for performance
    await queryInterface.addIndex('AuditLogs', ['expense_id']);
    await queryInterface.addIndex('AuditLogs', ['user_id']);
    await queryInterface.addIndex('AuditLogs', ['action']);
    await queryInterface.addIndex('AuditLogs', ['timestamp']);
    await queryInterface.addIndex('AuditLogs', ['created_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('AuditLogs');
  }
};