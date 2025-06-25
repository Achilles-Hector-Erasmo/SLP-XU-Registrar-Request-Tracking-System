const express = require('express');
const passport = require('passport');
const authService = require('../services/sharedAuthService');

const router = express.Router();

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    
    if (result.success) {
      res.json({
        success: true,
        session: result.session,
        message: 'Login successful'
      });
    } else {
      res.status(401).json({
        success: false,
        error: result.error,
        message: result.message
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An error occurred during login'
    });
  }
});

// Logout route
router.post('/logout', (req, res) => {
  try {
    const { sessionId } = req.body;
    const result = authService.logout(sessionId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An error occurred during logout'
    });
  }
});

// Session validation route
router.get('/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log('Session validation request for:', sessionId);
    
    const session = authService.validateSession(sessionId);
    console.log('Session validation result:', session ? 'VALID' : 'INVALID');
    
    if (session) {
      console.log('Session details:', {
        sessionId: session.sessionId,
        email: session.user.email,
        role: session.user.role,
        isActive: session.isActive
      });
      
      res.json({
        success: true,
        session: {
          sessionId: session.sessionId,
          email: session.user.email,
          role: session.user.role,
          permissions: session.user.permissions,
          isActive: session.isActive,
          lastAccessedAt: session.lastAccessedAt
        }
      });
    } else {
      console.log('Session validation failed for:', sessionId);
      res.status(401).json({
        success: false,
        error: 'Invalid session',
        message: 'Session not found or expired'
      });
    }
  } catch (error) {
    console.error('Error in session validation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An error occurred while validating session'
    });
  }
});

// Note: Google OAuth routes are handled directly in server.js to avoid conflicts

module.exports = router; 