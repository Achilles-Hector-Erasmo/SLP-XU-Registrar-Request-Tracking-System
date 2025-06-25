const express = require('express');
const authRoutes = require('./authRoutes');
const searchRoutes = require('./searchRoutes');
const adminRoutes = require('./adminRoutes');

const router = express.Router();

// API root endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    version: '1.0.0',
    availableEndpoints: [
      'POST /api/auth/login',
      'POST /api/auth/logout',
      'GET /api/auth/session/:sessionId',
      'GET /api/auth/google',
      'GET /api/auth/google/callback',
      'GET /api/search/:trackingCode',
      'GET /api/admin/users'
    ]
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/search', searchRoutes);
router.use('/admin', adminRoutes);

module.exports = router; 