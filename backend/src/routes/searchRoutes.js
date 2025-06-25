const express = require('express');
const searchService = require('../services/searchService');

const router = express.Router();

// Search tracking code route
router.get('/:trackingCode', (req, res) => {
  try {
    const { trackingCode } = req.params;
    const result = searchService.searchTrackingCode(trackingCode);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error,
        message: result.message
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An error occurred during search'
    });
  }
});

module.exports = router; 