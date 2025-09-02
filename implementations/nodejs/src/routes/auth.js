const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');

// POST /auth/login - Login with username/password
router.post('/login', authController.login);

// GET /auth/me - Get current user info (requires authentication)
router.get('/me', authenticate, authController.me);

// POST /auth/refresh - Refresh JWT token (requires authentication)
router.post('/refresh', authenticate, authController.refresh);

// POST /auth/logout - Logout (client-side token cleanup)
router.post('/logout', authController.logout);

module.exports = router;