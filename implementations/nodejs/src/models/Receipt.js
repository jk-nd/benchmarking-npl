'use strict';

module.exports = (sequelize, DataTypes) => {
  const Receipt = sequelize.define('Receipt', {
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
    fileName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'file_name'
    },
    uploadDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'upload_date'
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'file_size',
      validate: {
        isPositive(value) {
          if (value <= 0) {
            throw new Error('File size must be positive');
          }
        }
      }
    }
  }, {
    tableName: 'receipts',
    timestamps: true
  });

  Receipt.associate = function(models) {
    Receipt.belongsTo(models.Expense, {
      foreignKey: 'expenseId',
      as: 'expense'
    });
  };

  // Format for API response matching NPL format
  Receipt.prototype.toApiResponse = function() {
    return {
      fileName: this.fileName,
      uploadDate: this.uploadDate.toISOString(),
      fileSize: this.fileSize
    };
  };

  return Receipt;
};