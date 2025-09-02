# AuthController handles JWT authentication
class AuthController < ApplicationController
  skip_before_action :authenticate_user!, only: [:login]

  # POST /auth/login
  def login
    user = User.find_by(preferred_username: params[:username])
    
    if user&.valid_password?(params[:password])
      token = generate_token(user)
      render json: { 
        access_token: token,
        token_type: 'Bearer',
        expires_in: 24.hours.to_i,
        user: {
          id: user.id,
          preferred_username: user.preferred_username,
          role: user.role,
          department: user.department
        }
      }
    else
      render json: { error: 'Invalid credentials' }, status: :unauthorized
    end
  end

  # GET /auth/me  
  def me
    render json: {
      id: current_user.id,
      preferred_username: current_user.preferred_username,
      role: current_user.role,
      department: current_user.department,
      employee_id: current_user.employee_id
    }
  end

  private

  def generate_token(user)
    payload = {
      user_id: user.id,
      preferred_username: user.preferred_username,
      role: user.role,
      exp: 24.hours.from_now.to_i
    }
    
    JWT.encode(payload, Rails.application.secret_key_base, 'HS256')
  end
end