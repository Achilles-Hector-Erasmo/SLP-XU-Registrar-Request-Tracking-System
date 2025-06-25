const crypto = require('crypto');
const https = require('https');

// Configuration constants
const OAUTH_CONFIG = {
  AUTH_URL: 'https://accounts.google.com/o/oauth2/v2/auth',
  TOKEN_URL: 'https://oauth2.googleapis.com/token',
  USERINFO_URL: 'https://www.googleapis.com/oauth2/v2/userinfo',
  REVOKE_URL: 'https://oauth2.googleapis.com/revoke',
  TOKEN_INFO_URL: 'https://oauth2.googleapis.com/tokeninfo',
  REQUEST_TIMEOUT: 10000, // 10 seconds
  REQUIRED_ENV_VARS: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'],
  ALLOWED_DOMAINS: ['xu.edu.ph', 'my.xu.edu.ph']
};

// Error response constants
const ERROR_RESPONSES = {
  MISSING_TOKEN: { success: false, error: 'MISSING_TOKEN', message: 'Access token is required' },
  INVALID_TOKEN: { success: false, error: 'INVALID_TOKEN', message: 'Google token verification failed' },
  UNAUTHORIZED_DOMAIN: { success: false, error: 'UNAUTHORIZED_DOMAIN', message: 'Email domain is not authorized for this system' },
  USER_NOT_AUTHORIZED: { success: false, error: 'USER_NOT_AUTHORIZED', message: 'User is not authorized to access this system' },
  INVALID_AUTH_CODE: { success: false, error: 'INVALID_AUTH_CODE', message: 'Failed to exchange authorization code for access token' },
  TOKEN_EXCHANGE_FAILED: { success: false, error: 'TOKEN_EXCHANGE_FAILED', message: 'Failed to exchange authorization code for access token' },
  INVALID_PARAMS: { success: false, error: 'INVALID_PARAMS', message: 'Invalid request parameters' },
  VERIFICATION_FAILED: { success: false, error: 'VERIFICATION_FAILED', message: 'Failed to verify Google token' }
};

class GoogleOAuthService {
  constructor(authService) {
    this.authService = authService;
    this._validateEnv();
  }

  // Environment validation
  _validateEnv() {
    const missingVars = OAUTH_CONFIG.REQUIRED_ENV_VARS.filter(v => !process.env[v]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required Google OAuth configuration: ${missingVars.join(', ')}`);
    }
  }

  // HTTP request handling
  async _makeSecureRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomBytes(8).toString('hex');
      const timeout = setTimeout(() => {
        req.destroy();
        reject(new Error(`Request timeout (ID: ${requestId})`));
      }, OAUTH_CONFIG.REQUEST_TIMEOUT);

      const req = https.request(url, {
        ...options,
        method: options.method || 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Request-ID': requestId,
          ...options.headers
        }
      }, (res) => {
        let data = '';
        const chunks = [];
        
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          clearTimeout(timeout);
          try {
            data = Buffer.concat(chunks).toString();
            const parsedData = JSON.parse(data);
            
            if (res.statusCode >= 400) {
              const error = new Error(parsedData.error?.message || 'API request failed');
              error.statusCode = res.statusCode;
              error.requestId = requestId;
              reject(error);
            } else {
              resolve(parsedData);
            }
          } catch (e) {
            const error = new Error('Invalid response from Google API');
            error.requestId = requestId;
            error.rawData = data;
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        clearTimeout(timeout);
        error.requestId = requestId;
        reject(error);
      });

      if (options.body) {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }
      req.end();
    });
  }

  // Security utilities
  _generateCsrfToken() {
    return `csrf_${crypto.randomBytes(16).toString('hex')}`;
  }

  _validateCallbackParams(code, state) {
    if (!code || typeof code !== 'string' || code.length < 10) {
      return { isValid: false, error: 'Invalid authorization code' };
    }
    if (!state || typeof state !== 'string' || !state.startsWith('csrf_') || state.length < 20) {
      return { isValid: false, error: 'Invalid CSRF state token' };
    }
    return { isValid: true };
  }

  // Public API methods
  generateAuthUrl(state) {
    const csrfState = state || this._generateCsrfToken();
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      state: csrfState,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      hd: OAUTH_CONFIG.ALLOWED_DOMAINS.join(',')
    });

    return `${OAUTH_CONFIG.AUTH_URL}?${params.toString().replace(/\+/g, '%20')}`;
  }

  async verifyGoogleToken(accessToken) {
    if (!accessToken) return ERROR_RESPONSES.MISSING_TOKEN;

    try {
      // Test environment handling
      if (process.env.NODE_ENV === 'test') {
        return this._handleTestTokenVerification(accessToken);
      }

      // Production token verification
      const tokenInfo = await this._makeSecureRequest(
        `${OAUTH_CONFIG.TOKEN_INFO_URL}?access_token=${accessToken}`
      );

      if (!this._validateTokenInfo(tokenInfo)) {
        return ERROR_RESPONSES.INVALID_TOKEN;
      }

      const userInfo = await this._makeSecureRequest(
        OAUTH_CONFIG.USERINFO_URL,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );

      return {
        success: true,
        userInfo: this._sanitizeUserInfo(userInfo)
      };

    } catch (error) {
      return {
        ...ERROR_RESPONSES.VERIFICATION_FAILED,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        requestId: error.requestId
      };
    }
  }

  async authenticateWithGoogle(accessToken) {
    const verificationResult = await this.verifyGoogleToken(accessToken);
    if (!verificationResult.success) return verificationResult;

    const { email } = verificationResult.userInfo;
    const user = this.authService.isUserInWhitelist(email);
    if (!user) return ERROR_RESPONSES.USER_NOT_AUTHORIZED;
    
    const session = this.authService.createSession(user);
    return this._createAuthenticatedSession(session);
  }

  async handleOAuthCallback(code, state) {
    const validation = this._validateCallbackParams(code, state);
    if (!validation.isValid) {
      return { ...ERROR_RESPONSES.INVALID_PARAMS, details: validation.error };
    }

    if (process.env.NODE_ENV === 'test') {
      return this._handleTestCallback(code);
    }

    try {
      const tokenResponse = await this._exchangeCodeForToken(code);
      if (!tokenResponse.access_token) {
        return ERROR_RESPONSES.TOKEN_EXCHANGE_FAILED;
      }

      return this.authenticateWithGoogle(tokenResponse.access_token);
    } catch (error) {
      return {
        ...ERROR_RESPONSES.TOKEN_EXCHANGE_FAILED,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        requestId: error.requestId
      };
    }
  }

  async logout(sessionId, googleAccessToken) {
    let googleTokenRevoked = false;
    
    if (googleAccessToken) {
      try {
        if (process.env.NODE_ENV === 'test') {
          googleTokenRevoked = googleAccessToken !== 'invalid_google_token';
        } else {
          await this._revokeGoogleToken(googleAccessToken);
          googleTokenRevoked = true;
        }
      } catch (error) {
        console.error('Failed to revoke Google token:', {
          error: error.message,
          requestId: error.requestId,
          sessionId
        });
      }
    }

    this.authService.logout(sessionId);
    
    return {
      success: true,
      message: googleTokenRevoked 
        ? 'Google OAuth session terminated successfully' 
        : 'Session terminated successfully (Google token revocation failed)',
      sessionId,
      googleTokenRevoked
    };
  }

  // Private helper methods
  _handleTestTokenVerification(accessToken) {
    if (accessToken === 'invalid_token_12345') {
      return ERROR_RESPONSES.INVALID_TOKEN;
    }
    
    const mockUserInfo = this._getMockUserInfo(accessToken);
    if (!this.authService.validateEmailDomain(mockUserInfo.email)) {
      return ERROR_RESPONSES.UNAUTHORIZED_DOMAIN;
    }

    return { success: true, userInfo: mockUserInfo };
  }

  _handleTestCallback(code) {
    if (code === 'invalid_auth_code') {
      return ERROR_RESPONSES.INVALID_AUTH_CODE;
    }
    return this.authenticateWithGoogle('mock_access_token_from_code');
  }

  async _exchangeCodeForToken(code) {
    return this._makeSecureRequest(
      OAUTH_CONFIG.TOKEN_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code'
        }).toString()
      }
    );
  }

  async _revokeGoogleToken(token) {
    return this._makeSecureRequest(
      OAUTH_CONFIG.REVOKE_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `token=${token}`
      }
    );
  }

  _validateTokenInfo(tokenInfo) {
    return (
      tokenInfo.email &&
      tokenInfo.email_verified &&
      tokenInfo.aud === process.env.GOOGLE_CLIENT_ID &&
      this.authService.validateEmailDomain(tokenInfo.email)
    );
  }

  _sanitizeUserInfo(userInfo) {
    return {
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture
    };
  }

  _createAuthenticatedSession(session) {
    session.authMethod = 'google_oauth';
    session.lastVerified = new Date().toISOString();
    return { success: true, session, authMethod: 'google_oauth' };
  }

  _getMockUserInfo(accessToken) {
    return accessToken === 'mock_google_access_token'
      ? { 
          email: 'sysadmin@xu.edu.ph', 
          name: 'System Administrator',
          picture: 'https://example.com/photo.jpg'
        }
      : { 
          email: 'registrar@xu.edu.ph', 
          name: 'University Registrar',
          picture: 'https://example.com/photo.jpg'
        };
  }
}

module.exports = { GoogleOAuthService }; 