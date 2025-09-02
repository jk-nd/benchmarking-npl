module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const receipts = [
      // Receipt for Alice's draft expense
      {
        id: '770e8400-e29b-41d4-a716-446655440001',
        expense_id: '660e8400-e29b-41d4-a716-446655440001',
        file_name: 'starbucks_receipt_20241201.pdf',
        upload_date: lastWeek,
        file_size: 245760, // 240KB
        mime_type: 'application/pdf',
        created_at: now,
        updated_at: now
      },
      // Receipt for Bob's submitted expense
      {
        id: '770e8400-e29b-41d4-a716-446655440002',
        expense_id: '660e8400-e29b-41d4-a716-446655440002',
        file_name: 'amazon_invoice_keyboard_mouse.pdf',
        upload_date: lastWeek,
        file_size: 512000, // 500KB
        mime_type: 'application/pdf',
        created_at: now,
        updated_at: now
      },
      // Receipt for Eve's approved expense
      {
        id: '770e8400-e29b-41d4-a716-446655440003',
        expense_id: '660e8400-e29b-41d4-a716-446655440003',
        file_name: 'adobe_subscription_receipt.pdf',
        upload_date: lastWeek,
        file_size: 187392, // 183KB
        mime_type: 'application/pdf',
        created_at: now,
        updated_at: now
      }
    ];

    await queryInterface.bulkInsert('Receipts', receipts);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('Receipts', null, {});
  }
};