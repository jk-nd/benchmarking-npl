const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * JWT Authentication middleware
 * Verifies JWT token and loads user information
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        details: 'Bearer token not provided'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        details: 'Token not provided'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    
    // Load user from database
    const user = await User.findByPk(decoded.userId, {
      include: [
        { model: User, as: 'manager' }
      ]
    });

    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        details: 'User not found'
      });
    }

    // Attach user to request
    req.user = user;
    next();

  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        details: error.message
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        details: 'Please login again'
      });
    }
    
    return res.status(500).json({
      error: 'Internal server error',
      details: 'Authentication service error'
    });
  }
};

module.exports = authenticate;