class ApplicationController < ActionController::API
  include Pundit::Authorization

  before_action :authenticate_user!
  
  # Handle authorization errors
  rescue_from Pundit::NotAuthorizedError, with: :user_not_authorized
  rescue_from Expense::AuthorizationError, with: :authorization_error
  rescue_from Expense::StateError, with: :state_error
  rescue_from Expense::ValidationError, with: :validation_error
  rescue_from ActiveRecord::RecordNotFound, with: :record_not_found

  private

  def authenticate_user!
    token = request.headers['Authorization']&.sub('Bearer ', '')
    
    if token
      begin
        payload = JWT.decode(token, jwt_secret, true, algorithm: 'HS256')[0]
        @current_user = User.find(payload['user_id'])
      rescue JWT::DecodeError, ActiveRecord::RecordNotFound
        render json: { error: 'Invalid token' }, status: :unauthorized
      end
    else
      render json: { error: 'Token required' }, status: :unauthorized
    end
  end

  def current_user
    @current_user
  end

  def user_not_authorized(exception)
    render json: { 
      error: 'Not authorized',
      details: exception.message 
    }, status: :forbidden
  end

  def authorization_error(exception)
    render json: { 
      error: 'Authorization failed',
      details: exception.message 
    }, status: :forbidden
  end

  def state_error(exception)
    render json: { 
      error: 'Invalid state',
      details: exception.message 
    }, status: :unprocessable_entity
  end

  def validation_error(exception)
    render json: { 
      error: 'Validation failed',
      details: exception.message 
    }, status: :unprocessable_entity
  end

  def record_not_found(exception)
    render json: { 
      error: 'Record not found',
      details: exception.message 
    }, status: :not_found
  end

  def jwt_secret
    Rails.application.secret_key_base
  end

  # Health check endpoint
  def health
    render json: { status: 'OK', timestamp: Time.current }
  end
end