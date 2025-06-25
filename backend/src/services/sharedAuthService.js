const { AuthService } = require('./authService');

// Create a single instance to be shared across the application
const authService = new AuthService();

module.exports = authService; 