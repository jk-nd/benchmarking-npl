const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { User } = require('../models');

// Generate JWT token helper function
function generateToken(user) {
  const payload = {
    userId: user.id,
    preferred_username: user.preferredUsername,
    role: user.role,
    department: user.department,
    employee_id: user.employeeId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
}

/**
 * AuthController handles authentication
 * This mimics the JWT authentication used by NPL
 */
class AuthController {
  
  // POST /auth/login
  async login(req, res) {
    try {
      const { username, password } = req.body;

      // Validate input
      if (!username || !password) {
        return res.status(400).json({
          error: 'Bad request',
          details: 'Username and password are required'
        });
      }

      // Find user by preferred username
      const user = await User.findOne({
        where: { preferredUsername: username },
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
          error: 'Invalid credentials',
          details: 'Username or password is incorrect'
        });
      }

      // Validate password using bcrypt
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Invalid credentials',
          details: 'Username or password is incorrect'
        });
      }

      // Generate JWT token
      const token = generateToken(user);

      // Return response matching NPL's auth format
      return res.json({
        access_token: token,
        token_type: 'Bearer',
        expires_in: 86400, // 24 hours in seconds
        user: {
          id: user.id,
          preferred_username: user.preferredUsername,
          role: user.role,
          department: user.department,
          employee_id: user.employeeId
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        details: 'Authentication service error'
      });
    }
  }

  // GET /auth/me - Get current user info
  async me(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      // Get user approval and monthly limits (mock implementation)
      const approvalLimit = req.user.approvalLimit || (req.user.role === 'manager' ? 5000 : 500);
      const monthlyLimit = req.user.monthlyLimit || 2000;

      return res.json({
        id: req.user.id,
        preferred_username: req.user.preferredUsername,
        role: req.user.role,
        department: req.user.department,
        employee_id: req.user.employeeId,
        approval_limit: approvalLimit,
        monthly_limit: monthlyLimit
      });

    } catch (error) {
      console.error('Get user info error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        details: 'Failed to get user information'
      });
    }
  }

  // POST /auth/refresh - Refresh JWT token
  async refresh(req, res) {
    try {
      // In a production system, you'd validate refresh token
      const user = req.user;
      const newToken = generateToken(user);

      return res.json({
        access_token: newToken,
        token_type: 'Bearer',
        expires_in: 86400
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        details: 'Token refresh failed'
      });
    }
  }

  // POST /auth/logout - Logout
  async logout(req, res) {
    // With JWT, logout is mainly handled client-side by discarding the token
    // In a more secure system, you'd maintain a blacklist of invalidated tokens
    return res.json({
      message: 'Logged out successfully'
    });
  }
}

module.exports = new AuthController();