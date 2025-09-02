const bcrypt = require('bcrypt');

module.exports = {
  up: async (queryInterface) => {
    const saltRounds = 10;
    const now = new Date();

    // Hash passwords for all users (using 'password123' for demo)
    const hashedPassword = await bcrypt.hash('password123', saltRounds);

    const users = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        preferred_username: 'alice.employee',
        employee_id: 'EMP001',
        password_hash: hashedPassword,
        role: 'employee',
        department: 'Engineering',
        manager_id: '550e8400-e29b-41d4-a716-446655440002',
        created_at: now,
        updated_at: now
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        preferred_username: 'bob.manager',
        employee_id: 'MGR001',
        password_hash: hashedPassword,
        role: 'manager',
        department: 'Engineering',
        manager_id: '550e8400-e29b-41d4-a716-446655440006',
        created_at: now,
        updated_at: now
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        preferred_username: 'charlie.finance',
        employee_id: 'FIN001',
        password_hash: hashedPassword,
        role: 'finance',
        department: 'Finance',
        manager_id: '550e8400-e29b-41d4-a716-446655440007',
        created_at: now,
        updated_at: now
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440004',
        preferred_username: 'diana.compliance',
        employee_id: 'COM001',
        password_hash: hashedPassword,
        role: 'compliance',
        department: 'Legal',
        manager_id: '550e8400-e29b-41d4-a716-446655440007',
        created_at: now,
        updated_at: now
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440005',
        preferred_username: 'eve.employee',
        employee_id: 'EMP002',
        password_hash: hashedPassword,
        role: 'employee',
        department: 'Marketing',
        manager_id: '550e8400-e29b-41d4-a716-446655440008',
        created_at: now,
        updated_at: now
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440006',
        preferred_username: 'frank.vp',
        employee_id: 'VP001',
        password_hash: hashedPassword,
        role: 'vp',
        department: 'Executive',
        manager_id: '550e8400-e29b-41d4-a716-446655440007',
        created_at: now,
        updated_at: now
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440007',
        preferred_username: 'grace.cfo',
        employee_id: 'CFO001',
        password_hash: hashedPassword,
        role: 'cfo',
        department: 'Executive',
        manager_id: null,
        created_at: now,
        updated_at: now
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440008',
        preferred_username: 'henry.manager',
        employee_id: 'MGR002',
        password_hash: hashedPassword,
        role: 'manager',
        department: 'Marketing',
        manager_id: '550e8400-e29b-41d4-a716-446655440006',
        created_at: now,
        updated_at: now
      }
    ];

    await queryInterface.bulkInsert('Users', users);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('Users', null, {});
  }
};