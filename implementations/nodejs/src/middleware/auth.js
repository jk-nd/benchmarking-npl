const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Authentication middleware - checks for valid JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        details: 'Bearer token required in Authorization header'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        details: 'Token is missing'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password'] },
      include: [
        { 
          model: User, 
          as: 'manager',
          attributes: ['id', 'preferredUsername', 'role', 'department']
        }
      ]
    });

    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        details: 'User not found'
      });
    }

    // Check if token is expired
    if (decoded.exp < Date.now() / 1000) {
      return res.status(401).json({
        error: 'Authentication failed',
        details: 'Token has expired'
      });
    }

    // Add user to request object
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Authentication failed',
        details: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Authentication failed',
        details: 'Token has expired'
      });
    }
    
    return res.status(500).json({
      error: 'Internal server error',
      details: 'Authentication service error'
    });
  }
};

// Optional authentication - don't fail if no token provided
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // No authentication provided, continue
  }

  // If auth header is provided, validate it
  return authenticate(req, res, next);
};

module.exports = {
  authenticate,
  optionalAuth
};