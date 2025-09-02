const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Sequelize } = require('sequelize');
require('dotenv').config();

const authenticate = require('./src/middleware/authenticate');
const authRoutes = require('./src/routes/auth');
const expenseRoutes = require('./src/routes/expenses');

const app = express();
const PORT = process.env.PORT || 3002;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Request parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Node.js Expense Approval System',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API documentation endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Node.js Expense Approval System - Manual Authorization Implementation',
    description: 'This API demonstrates the complexity of implementing authorization manually vs NPL\'s compile-time guarantees',
    endpoints: {
      authentication: {
        'POST /auth/login': 'Login with username/password',
        'GET /auth/me': 'Get current user info',
        'POST /auth/refresh': 'Refresh JWT token',
        'POST /auth/logout': 'Logout'
      },
      expenses: {
        'GET /expenses': 'List expenses for current user',
        'GET /expenses/:id': 'Get specific expense',
        'POST /expenses': 'Create new expense',
        'POST /expenses/:id/submit': 'Submit expense for approval',
        'POST /expenses/:id/approve': 'Approve expense (manager)',
        'POST /expenses/:id/process_payment': 'Process payment (finance)',
        'POST /expenses/:id/audit_review': 'Compliance audit',
        'POST /expenses/:id/executive_override': 'Executive override',
        'POST /expenses/:id/reject': 'Reject expense',
        'POST /expenses/:id/withdraw': 'Withdraw expense (employee)',
        'POST /expenses/:id/flag_suspicious': 'Flag suspicious activity',
        'GET /expenses/:id/approval_history': 'Get approval history',
        'GET /expenses/:id/status': 'Get expense status'
      }
    },
    comparison_notes: [
      'This implementation requires 2000+ lines of code vs NPL\'s 200 lines',
      'Manual state machine management vs NPL\'s automatic transitions',
      'Runtime authorization checks vs NPL\'s compile-time guarantees',
      'Manual audit trail logging vs NPL\'s automatic audit generation',
      'Complex middleware layers vs NPL\'s single permission declarations',
      'Scattered business rule validation vs NPL\'s centralized protocol definition'
    ]
  });
});

// Authentication routes
app.use('/auth', authRoutes);

// Protected expense routes (require authentication)
app.use('/expenses', authenticate, expenseRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map(e => e.message).join(', ')
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      details: err.message
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      details: err.message
    });
  }
  
  // Default error response
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    details: `Route ${req.method} ${req.path} not found`
  });
});

// Database connection and server startup
async function startServer() {
  try {
    // Initialize database connection
    const { sequelize } = require('./src/models');
    
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    // Sync database models
    await sequelize.sync();
    console.log('Database models synchronized.');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Node.js Expense Approval System running on port ${PORT}`);
      console.log(`API Documentation: http://localhost:${PORT}`);
      console.log(`Health Check: http://localhost:${PORT}/health`);
      console.log('');
      console.log('=== IMPLEMENTATION COMPARISON ===');
      console.log('NPL Implementation:');
      console.log('- Single .npl file with ~200 lines');
      console.log('- Compile-time authorization guarantees');
      console.log('- Automatic state machine management');
      console.log('- Built-in audit trail generation');
      console.log('');
      console.log('Node.js Implementation:');
      console.log('- Multiple files with ~2000+ lines of code');
      console.log('- Runtime authorization checks');
      console.log('- Manual state machine implementation');
      console.log('- Manual audit trail logging');
      console.log('- Complex middleware layers');
      console.log('- Scattered business rule validation');
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  const { sequelize } = require('./src/models');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  const { sequelize } = require('./src/models');
  await sequelize.close();
  process.exit(0);
});

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;