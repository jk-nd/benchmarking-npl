const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('Receipts', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      expenseId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'expense_id',
        references: {
          model: 'Expenses',
          key: 'id'
        },
        onDelete: 'CASCADE'
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
        field: 'file_size'
      },
      mimeType: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'mime_type'
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

    // Add foreign key constraint
    await queryInterface.addConstraint('Receipts', {
      fields: ['expense_id'],
      type: 'foreign key',
      name: 'fk_receipts_expense',
      references: {
        table: 'Expenses',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Create indexes for performance
    await queryInterface.addIndex('Receipts', ['expense_id']);
    await queryInterface.addIndex('Receipts', ['upload_date']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('Receipts');
  }
};