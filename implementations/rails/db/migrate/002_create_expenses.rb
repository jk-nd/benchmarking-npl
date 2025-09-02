class CreateExpenses < ActiveRecord::Migration[7.0]
  def change
    create_table :expenses do |t|
      # Basic expense fields
      t.references :employee, null: false, foreign_key: { to_table: :users }
      t.decimal :amount, precision: 10, scale: 2, null: false
      t.string :expense_category, null: false
      t.string :currency, null: false, default: 'USD'
      t.date :expense_date, null: false
      t.string :vendor_id, null: false
      t.string :department, null: false
      t.text :description, null: false

      # Workflow participants
      t.references :manager, null: true, foreign_key: { to_table: :users }
      t.references :finance, null: true, foreign_key: { to_table: :users }
      t.references :compliance, null: true, foreign_key: { to_table: :users }

      # State machine
      t.string :state, null: false, default: 'draft', index: true

      # Approval tracking
      t.references :approved_by, null: true, foreign_key: { to_table: :users }
      t.references :processed_by, null: true, foreign_key: { to_table: :users }
      t.references :flagged_by, null: true, foreign_key: { to_table: :users }

      # Timestamps for workflow
      t.datetime :submitted_at
      t.datetime :approved_at
      t.datetime :processed_at
      t.datetime :rejected_at
      t.datetime :flagged_at

      # Additional fields
      t.text :rejection_reason
      t.text :override_reason
      t.text :flag_reason
      t.json :payment_details

      t.timestamps null: false
    end

    add_index :expenses, [:employee_id, :state]
    add_index :expenses, [:manager_id, :state]
    add_index :expenses, [:state, :created_at]
    add_index :expenses, [:department, :state]
    add_index :expenses, :expense_date
  end
end