# Receipt model for expense documentation
class Receipt < ApplicationRecord
  belongs_to :expense

  validates :file_name, presence: true
  validates :file_size, presence: true, numericality: { greater_than: 0 }
  validates :upload_date, presence: true

  def to_h
    {
      fileName: file_name,
      uploadDate: upload_date.iso8601,
      fileSize: file_size
    }
  end
end