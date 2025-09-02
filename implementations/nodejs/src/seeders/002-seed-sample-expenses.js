module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const expenses = [
      // Alice's draft expense
      {
        id: '660e8400-e29b-41d4-a716-446655440001',
        employee_id: '550e8400-e29b-41d4-a716-446655440001', // alice.employee
        amount: 45.67,
        currency: 'USD',
        expense_category: 'MEALS',
        expense_date: lastWeek,
        vendor_id: 'VENDOR_STARBUCKS',
        department: 'Engineering',
        description: 'Team lunch meeting to discuss Q4 roadmap and sprint planning',
        state: 'draft',
        created_at: now,
        updated_at: now
      },
      // Bob's submitted expense (waiting for his manager approval)
      {
        id: '660e8400-e29b-41d4-a716-446655440002',
        employee_id: '550e8400-e29b-41d4-a716-446655440002', // bob.manager
        manager_id: '550e8400-e29b-41d4-a716-446655440006', // frank.vp
        finance_id: '550e8400-e29b-41d4-a716-446655440003', // charlie.finance
        compliance_id: '550e8400-e29b-41d4-a716-446655440004', // diana.compliance
        amount: 150.00,
        currency: 'USD',
        expense_category: 'OFFICE_SUPPLIES',
        expense_date: lastWeek,
        vendor_id: 'VENDOR_AMAZON',
        department: 'Engineering',
        description: 'Ergonomic keyboard and mouse for home office setup',
        state: 'submitted',
        submitted_at: now,
        created_at: now,
        updated_at: now
      },
      // Eve's approved expense (waiting for payment processing)
      {
        id: '660e8400-e29b-41d4-a716-446655440003',
        employee_id: '550e8400-e29b-41d4-a716-446655440005', // eve.employee
        manager_id: '550e8400-e29b-41d4-a716-446655440008', // henry.manager
        finance_id: '550e8400-e29b-41d4-a716-446655440003', // charlie.finance
        compliance_id: '550e8400-e29b-41d4-a716-446655440004', // diana.compliance
        approved_by_id: '550e8400-e29b-41d4-a716-446655440008', // henry.manager
        amount: 89.99,
        currency: 'USD',
        expense_category: 'SOFTWARE',
        expense_date: lastWeek,
        vendor_id: 'VENDOR_ADOBE',
        department: 'Marketing',
        description: 'Adobe Creative Suite monthly subscription for marketing materials',
        state: 'approved',
        submitted_at: lastWeek,
        approved_at: now,
        created_at: now,
        updated_at: now
      }
    ];

    await queryInterface.bulkInsert('Expenses', expenses);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('Expenses', null, {});
  }
};