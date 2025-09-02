class CreateApprovalHistoryEntries < ActiveRecord::Migration[7.0]
  def change
    create_table :approval_history_entries do |t|
      t.references :expense, null: false, foreign_key: true
      t.references :user, null: true, foreign_key: true
      t.string :action, null: false
      t.text :description, null: false
      t.datetime :created_at, null: false
    end

    add_index :approval_history_entries, [:expense_id, :created_at]
    add_index :approval_history_entries, :action
  end
end