const { GoogleOAuthService } = require('../services/googleOAuthService');
const { AuthService } = require('../services/authService');

// Mock the AuthService for testing isolation
jest.mock('../services/authService');

describe('GoogleOAuthService - Phase 5.1: Token Verification', () => {
  let googleOAuthService;
  let mockAuthService;

  beforeEach(() => {
    // Create fresh mocks for each test
    mockAuthService = {
      validateEmailDomain: jest.fn(),
      isUserInWhitelist: jest.fn(),
      createSession: jest.fn()
    };
    
    // Mock environment variables for testing
    process.env.GOOGLE_CLIENT_ID = 'test_client_id';
    process.env.GOOGLE_CLIENT_SECRET = 'test_client_secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/google/callback';
    
    googleOAuthService = new GoogleOAuthService(mockAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clean up environment variables
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
  });

  test('should verify Google access token and extract user info', async () => {
    // This test expects the service to verify a Google token and return user info
    const mockAccessToken = 'mock_google_access_token';
    const expectedUserInfo = {
      email: 'sysadmin@xu.edu.ph',
      name: 'System Administrator',
      picture: 'https://example.com/photo.jpg'
    };

    // Mock the domain validation to return true
    mockAuthService.validateEmailDomain.mockReturnValue(true);
    
    const result = await googleOAuthService.verifyGoogleToken(mockAccessToken);
    
    expect(result).toEqual({
      success: true,
      userInfo: expectedUserInfo
    });
    expect(mockAuthService.validateEmailDomain).toHaveBeenCalledWith('sysadmin@xu.edu.ph');
  });

  test('should reject token if email domain is not authorized', async () => {
    const mockAccessToken = 'mock_google_access_token';
    
    // Mock the domain validation to return false (unauthorized domain)
    mockAuthService.validateEmailDomain.mockReturnValue(false);
    
    const result = await googleOAuthService.verifyGoogleToken(mockAccessToken);
    
    expect(result).toEqual({
      success: false,
      error: 'UNAUTHORIZED_DOMAIN',
      message: 'Email domain is not authorized for this system'
    });
  });

  test('should reject invalid or expired tokens', async () => {
    const invalidToken = 'invalid_token_12345';
    
    const result = await googleOAuthService.verifyGoogleToken(invalidToken);
    
    expect(result).toEqual({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Google token verification failed'
    });
  });

  test('should handle missing or null access token', async () => {
    const result1 = await googleOAuthService.verifyGoogleToken(null);
    const result2 = await googleOAuthService.verifyGoogleToken('');
    const result3 = await googleOAuthService.verifyGoogleToken(undefined);
    
    [result1, result2, result3].forEach(result => {
      expect(result).toEqual({
        success: false,
        error: 'MISSING_TOKEN',
        message: 'Access token is required'
      });
    });
  });

  test('should validate environment configuration on initialization', () => {
    // Test that service validates required environment variables
    const originalClientId = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    
    expect(() => {
      new GoogleOAuthService(mockAuthService);
    }).toThrow('Missing required Google OAuth configuration: GOOGLE_CLIENT_ID');
    
    // Restore for cleanup
    process.env.GOOGLE_CLIENT_ID = originalClientId;
  });
});

describe('GoogleOAuthService - Phase 5.2: Session Creation Integration', () => {
  let googleOAuthService;
  let mockAuthService;

  beforeEach(() => {
    mockAuthService = {
      validateEmailDomain: jest.fn(),
      isUserInWhitelist: jest.fn(),
      createSession: jest.fn()
    };
    
    process.env.GOOGLE_CLIENT_ID = 'test_client_id';
    process.env.GOOGLE_CLIENT_SECRET = 'test_client_secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/google/callback';
    
    googleOAuthService = new GoogleOAuthService(mockAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
  });

  test('should create session after successful OAuth authentication', async () => {
    const mockAccessToken = 'valid_access_token';
    const mockUser = { email: 'registrar@xu.edu.ph', role: 'UniversityRegistrar' };
    const mockSession = {
      sessionId: 'sess_oauth_12345',
      email: 'registrar@xu.edu.ph',
      role: 'UniversityRegistrar',
      permissions: ['create_requests', 'read_all_requests'],
      isActive: true,
      authMethod: 'google_oauth'
    };

    // Setup mocks
    mockAuthService.validateEmailDomain.mockReturnValue(true);
    mockAuthService.isUserInWhitelist.mockReturnValue(mockUser);
    mockAuthService.createSession.mockReturnValue(mockSession);

    const result = await googleOAuthService.authenticateWithGoogle(mockAccessToken);

    expect(result).toEqual({
      success: true,
      session: mockSession,
      authMethod: 'google_oauth'
    });
    expect(mockAuthService.isUserInWhitelist).toHaveBeenCalledWith('registrar@xu.edu.ph');
    expect(mockAuthService.createSession).toHaveBeenCalledWith(mockUser);
  });

  test('should reject authentication if user not in whitelist', async () => {
    const mockAccessToken = 'valid_access_token';

    mockAuthService.validateEmailDomain.mockReturnValue(true);
    mockAuthService.isUserInWhitelist.mockReturnValue(null); // Not in whitelist

    const result = await googleOAuthService.authenticateWithGoogle(mockAccessToken);

    expect(result).toEqual({
      success: false,
      error: 'USER_NOT_AUTHORIZED',
      message: 'User is not authorized to access this system'
    });
  });
});

describe('GoogleOAuthService - Phase 5.3: OAuth URL Generation', () => {
  let googleOAuthService;
  let mockAuthService;

  beforeEach(() => {
    mockAuthService = {
      validateEmailDomain: jest.fn(),
      isUserInWhitelist: jest.fn(),
      createSession: jest.fn()
    };
    
    process.env.GOOGLE_CLIENT_ID = 'test_client_id_for_url';
    process.env.GOOGLE_CLIENT_SECRET = 'test_client_secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/google/callback';
    
    googleOAuthService = new GoogleOAuthService(mockAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET; 
    delete process.env.GOOGLE_REDIRECT_URI;
  });

  test('should generate valid Google OAuth authorization URL', () => {
    const state = 'csrf_protection_state_12345';
    
    const authUrl = googleOAuthService.generateAuthUrl(state);
    
    expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(authUrl).toContain('client_id=test_client_id_for_url');
    expect(authUrl).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fgoogle%2Fcallback');
    expect(authUrl).toContain('response_type=code');
    expect(authUrl).toContain('scope=openid%20email%20profile');
    expect(authUrl).toContain(`state=${state}`);
  });

  test('should generate unique state parameter when none provided', () => {
    const authUrl1 = googleOAuthService.generateAuthUrl();
    const authUrl2 = googleOAuthService.generateAuthUrl();
    
    const state1 = new URL(authUrl1).searchParams.get('state');
    const state2 = new URL(authUrl2).searchParams.get('state');
    
    expect(state1).toBeTruthy();
    expect(state2).toBeTruthy();
    expect(state1).not.toBe(state2);
    expect(state1).toMatch(/^csrf_[a-zA-Z0-9]{32}$/);
  });
});

describe('GoogleOAuthService - Phase 5.4: OAuth Callback Handling', () => {
  let googleOAuthService;
  let mockAuthService;

  beforeEach(() => {
    mockAuthService = {
      validateEmailDomain: jest.fn(),
      isUserInWhitelist: jest.fn(),
      createSession: jest.fn()
    };
    
    process.env.GOOGLE_CLIENT_ID = 'test_client_id';
    process.env.GOOGLE_CLIENT_SECRET = 'test_client_secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/google/callback';
    
    googleOAuthService = new GoogleOAuthService(mockAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
  });

  test('should handle OAuth callback and exchange code for tokens', async () => {
    const authCode = 'mock_authorization_code';
    const state = 'csrf_protection_state';
    const mockUser = { email: 'evaluator@xu.edu.ph', role: 'Evaluator' };

    // Setup mocks for successful flow
    mockAuthService.validateEmailDomain.mockReturnValue(true);
    mockAuthService.isUserInWhitelist.mockReturnValue(mockUser);
    mockAuthService.createSession.mockReturnValue({
      sessionId: 'sess_callback_12345',
      email: 'evaluator@xu.edu.ph',
      role: 'Evaluator'
    });

    const result = await googleOAuthService.handleOAuthCallback(authCode, state);

    expect(result).toEqual({
      success: true,
      session: expect.objectContaining({
        email: 'evaluator@xu.edu.ph',
        role: 'Evaluator'
      }),
      authMethod: 'google_oauth'
    });
  });

  test('should reject callback with invalid authorization code', async () => {
    const invalidCode = 'invalid_auth_code';
    const state = 'csrf_protection_state';

    const result = await googleOAuthService.handleOAuthCallback(invalidCode, state);

    expect(result).toEqual({
      success: false,
      error: 'INVALID_AUTH_CODE',
      message: 'Failed to exchange authorization code for access token'
    });
  });
});

describe('GoogleOAuthService - Phase 5.5: Token Management', () => {
  let googleOAuthService;
  let mockAuthService;

  beforeEach(() => {
    mockAuthService = {
      validateEmailDomain: jest.fn(),
      isUserInWhitelist: jest.fn(),
      createSession: jest.fn(),
      logout: jest.fn()
    };
    
    process.env.GOOGLE_CLIENT_ID = 'test_client_id';
    process.env.GOOGLE_CLIENT_SECRET = 'test_client_secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/google/callback';
    
    googleOAuthService = new GoogleOAuthService(mockAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
  });

  test('should revoke Google tokens on logout', async () => {
    const sessionId = 'sess_oauth_12345';
    const googleAccessToken = 'google_access_token_to_revoke';

    // Mock successful logout from AuthService
    mockAuthService.logout.mockReturnValue({
      success: true,
      message: 'Session destroyed successfully',
      sessionId: sessionId
    });

    const result = await googleOAuthService.logout(sessionId, googleAccessToken);

    expect(result).toEqual({
      success: true,
      message: 'Google OAuth session terminated successfully',
      sessionId: sessionId,
      googleTokenRevoked: true
    });
    expect(mockAuthService.logout).toHaveBeenCalledWith(sessionId);
  });

  test('should handle logout even if Google token revocation fails', async () => {
    const sessionId = 'sess_oauth_12345';
    const invalidGoogleToken = 'invalid_google_token';

    mockAuthService.logout.mockReturnValue({
      success: true,
      message: 'Session destroyed successfully',
      sessionId: sessionId
    });

    const result = await googleOAuthService.logout(sessionId, invalidGoogleToken);

    expect(result).toEqual({
      success: true,
      message: 'Session terminated successfully (Google token revocation failed)',
      sessionId: sessionId,
      googleTokenRevoked: false
    });
  });
}); 