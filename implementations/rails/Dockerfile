# Use official Ruby image
FROM ruby:3.2-alpine

# Install system dependencies
RUN apk add --no-cache \
    build-base \
    postgresql-dev \
    git \
    nodejs \
    npm \
    linux-headers

# Set working directory
WORKDIR /app

# Copy Gemfile first for better Docker caching
COPY Gemfile* ./

# Install gems
RUN bundle install

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start Rails server
CMD ["rails", "server", "-b", "0.0.0.0"]