Rails.application.routes.draw do
  # Authentication routes
  post '/auth/login', to: 'auth#login'
  get '/auth/me', to: 'auth#me'

  # Expense management routes
  resources :expenses do
    member do
      post :submit
      post :approve
      post :process_payment
      post :audit_review
      post :executive_override
      post :reject
      post :withdraw
      post :flag_suspicious
      get :approval_history
      get :status
    end
  end

  # Health check
  get '/health', to: 'application#health'
end