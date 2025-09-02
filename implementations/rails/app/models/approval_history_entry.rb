# ApprovalHistoryEntry model for audit trail
class ApprovalHistoryEntry < ApplicationRecord
  belongs_to :expense
  belongs_to :user, optional: true

  validates :action, presence: true
  validates :description, presence: true
  validates :created_at, presence: true

  scope :ordered, -> { order(:created_at) }
end