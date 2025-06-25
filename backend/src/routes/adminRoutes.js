const express = require('express');
const authService = require('../services/authService');

const router = express.Router();

// Protected route example - requires authentication
router.get('/users', (req, res) => {
  try {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    if (!sessionId) {
      return res.status(401).json({
        success: false,
        error: 'No session provided',
        message: 'Authorization header required'
      });
    }
    
    const session = authService.getSessionStatus(sessionId);
    
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session',
        message: 'Session not found or expired'
      });
    }
    
    // Check if user has permission to view users
    if (!authService.hasPermission(sessionId, 'view_all_audit_logs')) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: 'You do not have permission to view user data'
      });
    }
    
    // Return user list (mock data for now)
    res.json({
      success: true,
      users: [
        { email: 'sysadmin@xu.edu.ph', role: 'SystemAdministrator', active: true },
        { email: 'registrar@xu.edu.ph', role: 'UniversityRegistrar', active: true },
        { email: 'evaluator@xu.edu.ph', role: 'Evaluator', active: true }
      ]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An error occurred while fetching user data'
    });
  }
});

module.exports = router; 