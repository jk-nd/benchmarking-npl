class CreateReceipts < ActiveRecord::Migration[7.0]
  def change
    create_table :receipts do |t|
      t.references :expense, null: false, foreign_key: true
      t.string :file_name, null: false
      t.datetime :upload_date, null: false
      t.integer :file_size, null: false

      t.timestamps null: false
    end

    add_index :receipts, [:expense_id, :file_name]
  end
end