require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Import our services
const authService = require('./src/services/sharedAuthService');
const searchService = require('./src/services/searchService');
const accessControlService = require('./src/services/accessControlService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(require('cookie-parser')()); // Add cookie parser for session management
app.use(express.static(path.join(__dirname, '../frontend/src')));

// Debug environment variables
console.log('=== ENVIRONMENT DEBUG ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Available env vars containing GOOGLE:', Object.keys(process.env).filter(key => key.includes('GOOGLE')));
console.log('GOOGLE_CLIENT_SECRET exists:', !!process.env.GOOGLE_CLIENT_SECRET);
console.log('GOOGLE_CLIENT_SECRET length:', process.env.GOOGLE_CLIENT_SECRET ? process.env.GOOGLE_CLIENT_SECRET.length : 0);
console.log('========================');

// Validate Google OAuth environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '1057136948196-07tm319dcacdu4srembadkfgmmne5qau.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!GOOGLE_CLIENT_SECRET || GOOGLE_CLIENT_SECRET === 'your-client-secret') {
  console.warn('WARNING: Google OAuth client secret not properly configured. OAuth may not work correctly.');
  console.warn('Please set GOOGLE_CLIENT_SECRET environment variable with your actual client secret.');
}

// Passport configuration for Google OAuth
passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET || 'your-client-secret',
  callbackURL: "http://localhost:3000/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('Google OAuth Strategy called with profile:', {
      id: profile.id,
      displayName: profile.displayName,
      emails: profile.emails
    });

    if (!profile.emails || profile.emails.length === 0) {
      console.error('No email found in Google profile');
      return done(null, false, { message: 'No email found in Google profile' });
    }

    const email = profile.emails[0].value;
    console.log('Checking authorization for email:', email);
    
    // Check if user is in whitelist
    const user = authService.isUserInWhitelist(email);
    if (!user) {
      console.error('User not authorized:', email);
      return done(null, false, { message: 'User not authorized' });
    }
    
    console.log('User authorized:', { email, role: user.role });
    return done(null, { email, role: user.role });
  } catch (error) {
    console.error('Error in Google OAuth Strategy:', error);
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

app.use(passport.initialize());

// Import routes
const apiRoutes = require('./src/routes');

// Mount API routes
app.use('/api', apiRoutes);

// Mount Google OAuth routes directly (they need to be at root level for OAuth flow)
app.get('/auth/google', (req, res, next) => {
  console.log('=== OAUTH INITIATION DEBUG ===');
  console.log('Client ID:', GOOGLE_CLIENT_ID);
  console.log('Client Secret set:', !!GOOGLE_CLIENT_SECRET && GOOGLE_CLIENT_SECRET !== 'your-client-secret');
  console.log('Callback URL: http://localhost:3000/auth/google/callback');
  console.log('Requested scopes: profile, email');
  console.log('==============================');
  next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: '/?error=oauth_failed'
  }),
  (req, res) => {
    try {
      console.log('OAuth callback received:', {
        user: req.user,
        query: req.query,
        params: req.params
      });

      if (req.user) {
        console.log('User authenticated:', req.user);
        
        // Create session using our auth service
        const session = authService.createSession(req.user);
        if (session) {
          console.log('Session created successfully:', {
            sessionId: session.sessionId,
            email: session.email,
            role: session.role,
            isActive: session.isActive,
            createdAt: session.createdAt
          });
          
          // Store session token in a secure cookie for easier access
          res.cookie('sessionToken', session.sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
          });
          
          // Test session validation immediately
          const testValidation = authService.validateSession(session.sessionId);
          console.log('Immediate session validation test:', testValidation ? 'SUCCESS' : 'FAILED');
          
          // Redirect based on user role
          const userRole = req.user.role;
          if (['SystemAdministrator', 'UniversityRegistrar', 'Evaluator', 'StudentAssistant'].includes(userRole)) {
            console.log('Redirecting admin user to dashboard with token:', session.sessionId);
            res.redirect(`/dashboard?token=${session.sessionId}`);
          } else {
            console.log('Redirecting regular user to home');
            res.redirect(`/?token=${session.sessionId}&welcome=true`);
          }
        } else {
          console.error('Failed to create session for user:', req.user);
          res.redirect('/?error=session_creation_failed');
        }
      } else {
        console.error('No user found in OAuth callback');
        res.redirect('/?error=unauthorized');
      }
    } catch (error) {
      console.error('Error in OAuth callback:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'OAuth callback failed'
      });
    }
  }
);

// Authentication middleware for admin routes
function requireAuth(req, res, next) {
  // Try to get token from multiple sources: URL query, cookies, or authorization header
  const token = req.query.token || 
                req.cookies?.sessionToken || 
                req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.redirect('/?error=authentication_required');
  }
  
  const session = authService.validateSession(token);
  if (!session) {
    // Clear invalid cookie if it exists
    if (req.cookies?.sessionToken) {
      res.clearCookie('sessionToken');
    }
    return res.redirect('/?error=invalid_session');
  }
  
  req.user = session.user;
  next();
}

// Serve frontend files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/src/index.html'));
});

app.get('/tracking', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/src/tracking.html'));
});

// Protected admin routes - Let JavaScript handle authentication
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/src/dashboard.html'));
});

app.get('/data-entry', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/src/data-entry.html'));
});

app.get('/access-control', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/src/access-control.html'));
});

// 404 handler - Fixed the problematic wildcard route
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('=== SERVER ERROR DETAILS ===');
  console.error('Error message:', error.message);
  console.error('Error stack:', error.stack);
  console.error('Request URL:', req.url);
  console.error('Request method:', req.method);
  console.error('Request headers:', req.headers);
  console.error('============================');
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Frontend available at: http://localhost:${PORT}/`);
  console.log(`API endpoints available at: http://localhost:${PORT}/api/`);
});

module.exports = app; 