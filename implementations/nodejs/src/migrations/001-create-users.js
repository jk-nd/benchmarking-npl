const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('Users', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      preferredUsername: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'preferred_username'
      },
      employeeId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'employee_id'
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'password_hash'
      },
      role: {
        type: DataTypes.ENUM(
          'employee',
          'manager', 
          'finance',
          'compliance',
          'vp',
          'cfo'
        ),
        allowNull: false,
        defaultValue: 'employee'
      },
      department: {
        type: DataTypes.STRING,
        allowNull: false
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

    // Add manager foreign key constraint
    await queryInterface.addConstraint('Users', {
      fields: ['manager_id'],
      type: 'foreign key',
      name: 'fk_users_manager',
      references: {
        table: 'Users',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // Create indexes for performance
    await queryInterface.addIndex('Users', ['preferred_username']);
    await queryInterface.addIndex('Users', ['employee_id']);
    await queryInterface.addIndex('Users', ['role']);
    await queryInterface.addIndex('Users', ['department']);
    await queryInterface.addIndex('Users', ['manager_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('Users');
  }
};