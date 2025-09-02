'use strict';

module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    expenseId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'expense_id',
      references: {
        model: 'Expenses',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'user_id',
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [[
          'submit',
          'approve', 
          'reject',
          'processPayment',
          'withdraw',
          'auditReview',
          'flagSuspicious',
          'executiveOverride',
          'state_change'
        ]]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'audit_logs',
    timestamps: false // We manage timestamp manually
  });

  AuditLog.associate = function(models) {
    AuditLog.belongsTo(models.Expense, {
      foreignKey: 'expenseId',
      as: 'expense'
    });

    AuditLog.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  // Format for approval history API response
  AuditLog.prototype.toHistoryEntry = function() {
    return {
      action: this.action,
      user: this.user?.preferredUsername || 'System',
      timestamp: this.timestamp.toISOString(),
      details: this.description,
      metadata: this.metadata
    };
  };

  return AuditLog;
};