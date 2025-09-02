class CreateUsers < ActiveRecord::Migration[7.0]
  def change
    create_table :users do |t|
      t.string :email,              null: false, default: ""
      t.string :encrypted_password, null: false, default: ""

      # User profile fields
      t.string :employee_id,        null: false, index: { unique: true }
      t.string :preferred_username, null: false, index: { unique: true }
      t.string :role,              null: false, index: true
      t.string :department,        null: false, index: true
      
      # Manager hierarchy
      t.references :manager, null: true, foreign_key: { to_table: :users }
      
      # Role-specific fields
      t.decimal :approval_limit,    precision: 10, scale: 2
      t.decimal :monthly_limit,     precision: 10, scale: 2
      t.integer :seniority_level
      t.integer :quarterly_approval_quota
      t.date    :certification_valid_until

      # Devise trackable
      t.integer  :sign_in_count, default: 0, null: false
      t.datetime :current_sign_in_at
      t.datetime :last_sign_in_at
      t.string   :current_sign_in_ip
      t.string   :last_sign_in_ip

      t.timestamps null: false
    end

    add_index :users, :email,                unique: true
    add_index :users, [:role, :department]
  end
end