const { AuthService } = require('../services/authService');

describe('AuthService - Email Domain Validation', () => {
  let authService;

  beforeEach(() => {
    authService = new AuthService();
  });

  test('should accept email with @xu.edu.ph domain', () => {
    const email = 'valid@xu.edu.ph';
    expect(authService.validateEmailDomain(email)).toBe(true);
  });

  test('should accept email with @my.xu.edu.ph domain', () => {
    const email = 'valid@my.xu.edu.ph';
    expect(authService.validateEmailDomain(email)).toBe(true);
  });

  test('should reject email with invalid domain', () => {
    const email = 'invalid@gmail.com';
    expect(authService.validateEmailDomain(email)).toBe(false);
  });
});

describe('AuthService - Whitelist User Validation', () => {
  let authService;

  beforeEach(() => {
    authService = new AuthService();
  });

  test('should return user object for email that exists in whitelist', () => {
    const email = 'sysadmin@xu.edu.ph';
    const result = authService.isUserInWhitelist(email);
    expect(result).toEqual({ email: 'sysadmin@xu.edu.ph', role: 'SystemAdministrator', password: 'SysAdmin123!' });
  });

  test('should return user object for another whitelisted email', () => {
    const email = 'intern@my.xu.edu.ph';
    const result = authService.isUserInWhitelist(email);
    expect(result).toEqual({ email: 'intern@my.xu.edu.ph', role: 'Intern', password: 'Intern111!' });
  });

  test('should return null for email not in whitelist', () => {
    const email = 'unauthorized@xu.edu.ph';
    expect(authService.isUserInWhitelist(email)).toBe(null);
  });

  test('should return null for email with valid domain but not in whitelist', () => {
    const email = 'random@my.xu.edu.ph';
    expect(authService.isUserInWhitelist(email)).toBe(null);
  });

  test('should return null for invalid input', () => {
    expect(authService.isUserInWhitelist(null)).toBe(null);
    expect(authService.isUserInWhitelist('')).toBe(null);
    expect(authService.isUserInWhitelist(123)).toBe(null);
  });
});

describe('AuthService - Session Creation', () => {
  let authService;

  beforeEach(() => {
    authService = new AuthService();
  });

  test('should create session with complete structure for SystemAdministrator', () => {
    const user = { email: 'sysadmin@xu.edu.ph', role: 'SystemAdministrator' };
    const session = authService.createSession(user);
    
    expect(session).toMatchObject({
      email: 'sysadmin@xu.edu.ph',
      role: 'SystemAdministrator',
      permissions: expect.arrayContaining(['manage_access_control', 'whitelist_users', 'assign_roles']),
      isActive: true
    });
    expect(session.sessionId).toMatch(/^sess_/);
    expect(session.createdAt).toBeDefined();
    expect(new Date(session.createdAt)).toBeInstanceOf(Date);
  });

  test('should create session with correct permissions for StudentAssistant', () => {
    const user = { email: 'assistant@my.xu.edu.ph', role: 'StudentAssistant' };
    const session = authService.createSession(user);
    
    expect(session).toMatchObject({
      email: 'assistant@my.xu.edu.ph',
      role: 'StudentAssistant',
      permissions: expect.arrayContaining(['read_assigned_requests', 'update_request_info', 'verify_request_data']),
      isActive: true
    });
    expect(session.sessionId).toMatch(/^sess_/);
    expect(session.createdAt).toBeDefined();
  });

  test('should generate unique session IDs for different sessions', () => {
    const user = { email: 'sysadmin@xu.edu.ph', role: 'SystemAdministrator' };
    const session1 = authService.createSession(user);
    const session2 = authService.createSession(user);
    
    expect(session1.sessionId).not.toBe(session2.sessionId);
  });

  test('should return null for invalid user input', () => {
    expect(authService.createSession(null)).toBe(null);
    expect(authService.createSession({})).toBe(null);
    expect(authService.createSession({ email: 'test@xu.edu.ph' })).toBe(null);
  });

  test('should return null for user with unknown role', () => {
    const user = { email: 'test@xu.edu.ph', role: 'UnknownRole' };
    expect(authService.createSession(user)).toBe(null);
  });
});

describe('AuthService - Logout Functionality', () => {
  let authService;

  beforeEach(() => {
    authService = new AuthService();
  });

  test('should destroy session and return success status', () => {
    // Create a session first
    const user = { email: 'sysadmin@xu.edu.ph', role: 'SystemAdministrator' };
    const session = authService.createSession(user);
    
    // Logout should destroy the session
    const logoutResult = authService.logout(session.sessionId);
    expect(logoutResult).toEqual({
      success: true,
      message: 'Session destroyed successfully',
      sessionId: session.sessionId
    });
  });

  test('should deactivate session on logout', () => {
    // Create a session first
    const user = { email: 'intern@my.xu.edu.ph', role: 'Intern' };
    const session = authService.createSession(user);
    
    // Logout should set session as inactive
    authService.logout(session.sessionId);
    
    // Check session status
    const sessionStatus = authService.getSessionStatus(session.sessionId);
    expect(sessionStatus).toEqual({
      isActive: false,
      destroyedAt: expect.any(String),
      lastAccessedAt: expect.any(String),
      expiresAt: expect.any(String)
    });
  });

  test('should return error for invalid session ID', () => {
    const logoutResult = authService.logout('invalid_session_id');
    expect(logoutResult).toEqual({
      success: false,
      message: 'Invalid session ID format'
    });
  });

  test('should return error for null session ID', () => {
    expect(authService.logout(null)).toEqual({
      success: false,
      message: 'Session ID is required'
    });
  });

  test('should return error for already destroyed session', () => {
    // Create and destroy session
    const user = { email: 'registrar@xu.edu.ph', role: 'UniversityRegistrar' };
    const session = authService.createSession(user);
    authService.logout(session.sessionId);
    
    // Try to logout again
    const secondLogout = authService.logout(session.sessionId);
    expect(secondLogout).toEqual({
      success: false,
      message: 'Session already destroyed'
    });
  });
});

describe('AuthService - Login Process Integration', () => {
  let authService;

  beforeEach(() => {
    authService = new AuthService();
  });

  test('should successfully login with valid credentials', async () => {
    const email = 'sysadmin@xu.edu.ph';
    const password = 'SysAdmin123!';
    
    const loginResult = await authService.login(email, password);
    
    expect(loginResult).toMatchObject({
      success: true,
      message: 'Login successful',
      user: {
        email: 'sysadmin@xu.edu.ph',
        role: 'SystemAdministrator',
        permissions: expect.arrayContaining(['manage_access_control', 'whitelist_users', 'assign_roles'])
      },
      session: {
        sessionId: expect.stringMatching(/^sess_/),
        isActive: true,
        expiresAt: expect.any(String)
      },
      loginTimestamp: expect.any(String),
      securityInfo: {
        previousFailedAttempts: 0,
        accountStatus: 'active',
        lastSuccessfulLogin: expect.any(String)
      }
    });
  });

  test('should successfully login with different user credentials', async () => {
    const email = 'assistant@my.xu.edu.ph';
    const password = 'Assistant000!';
    
    const loginResult = await authService.login(email, password);
    
    expect(loginResult.success).toBe(true);
    expect(loginResult.user.role).toBe('StudentAssistant');
    expect(loginResult.user.permissions).toEqual(expect.arrayContaining(['read_assigned_requests', 'update_request_info', 'verify_request_data']));
  });

  test('should reject login with invalid email domain', async () => {
    const email = 'hacker@gmail.com';
    const password = 'password123';
    
    const loginResult = await authService.login(email, password);
    
    expect(loginResult).toEqual({
      success: false,
      message: 'Invalid email domain',
      errorCode: 'INVALID_DOMAIN'
    });
  });

  test('should reject login for unauthorized email', async () => {
    const email = 'unauthorized@xu.edu.ph';
    const password = 'password123';
    
    const loginResult = await authService.login(email, password);
    
    expect(loginResult).toEqual({
      success: false,
      message: 'User not authorized',
      errorCode: 'UNAUTHORIZED_USER'
    });
  });

  test('should reject login with incorrect password', async () => {
    const email = 'sysadmin@xu.edu.ph';
    const password = 'wrongpassword';
    
    const loginResult = await authService.login(email, password);
    
    expect(loginResult).toEqual({
      success: false,
      message: 'Invalid credentials',
      errorCode: 'INVALID_PASSWORD'
    });
  });

  test('should reject login with missing credentials', async () => {
    const loginResult1 = await authService.login(null, 'password');
    const loginResult2 = await authService.login('sysadmin@xu.edu.ph', null);
    const loginResult3 = await authService.login(null, null);
    
    expect(loginResult1.success).toBe(false);
    expect(loginResult2.success).toBe(false);
    expect(loginResult3.success).toBe(false);
  });

  test('should track login attempts for security', async () => {
    const email = 'sysadmin@xu.edu.ph';
    const wrongPassword = 'wrongpassword';
    
    // Make multiple failed attempts
    const firstAttempt = await authService.login(email, wrongPassword);
    const secondAttempt = await authService.login(email, wrongPassword);
    const thirdAttempt = await authService.login(email, wrongPassword);
    
    // Should track failed attempts
    expect(thirdAttempt.success).toBe(false);
    expect(thirdAttempt.errorCode).toBe('INVALID_PASSWORD');
    
    // Get login attempt history
    const attempts = authService.getLoginAttempts(email);
    expect(attempts.failedAttempts).toBe(3);
  });

  test('should prevent login after too many failed attempts', async () => {
    const email = 'intern@my.xu.edu.ph';
    const wrongPassword = 'wrongpassword';
    
    // Make 5 failed attempts to trigger lockout
    for (let i = 0; i < 5; i++) {
      await authService.login(email, wrongPassword);
    }
    
    // 6th attempt should be blocked due to lockout
    const lockedAttempt = await authService.login(email, wrongPassword);
    expect(lockedAttempt.success).toBe(false);
    expect(lockedAttempt.errorCode).toBe('ACCOUNT_LOCKED');
    expect(lockedAttempt.message).toContain('temporarily locked');
  });
});

describe('AuthService - Enhanced Role-Based Access Control (Phase 6)', () => {
  let authService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('Updated Role Hierarchy and Users', () => {
    test('should have System Administrator with complete access control permissions', () => {
      const user = authService.isUserInWhitelist('sysadmin@xu.edu.ph');
      expect(user).not.toBeNull();
      expect(user.role).toBe('SystemAdministrator');
      
      const session = authService.createSession(user);
      expect(session.permissions).toEqual(expect.arrayContaining([
        'manage_access_control',
        'whitelist_users',
        'assign_roles',
        'view_all_audit_logs',
        'manage_system_config'
      ]));
    });

    test('should have University Registrar with full CRUD operations', () => {
      const user = authService.isUserInWhitelist('registrar@xu.edu.ph');
      expect(user).not.toBeNull();
      expect(user.role).toBe('UniversityRegistrar');
      
      const session = authService.createSession(user);
      expect(session.permissions).toEqual(expect.arrayContaining([
        'create_requests',
        'read_all_requests',
        'update_all_requests',
        'delete_requests',
        'assign_staff_permissions',
        'manage_interns_assistants',
        'sign_documents',
        'release_documents',
        'view_all_audit_logs'
      ]));
    });

    test('should have Evaluator with specific request processing permissions', () => {
      const user = authService.isUserInWhitelist('evaluator@xu.edu.ph');
      expect(user).not.toBeNull();
      expect(user.role).toBe('Evaluator');
      
      const session = authService.createSession(user);
      expect(session.permissions).toEqual(expect.arrayContaining([
        'create_requests',
        'read_assigned_requests',
        'update_request_status',
        'mark_request_issued',
        'mark_request_printed',
        'view_own_audit_logs'
      ]));
    });

    test('should have Student Assistant with delegated task permissions', () => {
      const user = authService.isUserInWhitelist('assistant@my.xu.edu.ph');
      expect(user).not.toBeNull();
      expect(user.role).toBe('StudentAssistant');
      
      const session = authService.createSession(user);
      expect(session.permissions).toEqual(expect.arrayContaining([
        'read_assigned_requests',
        'update_request_info',
        'verify_request_data',
        'view_assigned_audit_logs'
      ]));
    });

    test('should have Intern with limited verification permissions', () => {
      const user = authService.isUserInWhitelist('intern@my.xu.edu.ph');
      expect(user).not.toBeNull();
      expect(user.role).toBe('Intern');
      
      const session = authService.createSession(user);
      expect(session.permissions).toEqual(expect.arrayContaining([
        'read_assigned_requests',
        'verify_request_data',
        'view_limited_audit_logs'
      ]));
    });
  });

  describe('Domain-based Role Assignment', () => {
    test('should assign @xu.edu.ph domain users to Registrar Office roles only', () => {
      const registrar = authService.isUserInWhitelist('registrar@xu.edu.ph');
      const evaluator = authService.isUserInWhitelist('evaluator@xu.edu.ph');
      const sysadmin = authService.isUserInWhitelist('sysadmin@xu.edu.ph');
      
      expect(registrar.role).toBe('UniversityRegistrar');
      expect(evaluator.role).toBe('Evaluator');
      expect(sysadmin.role).toBe('SystemAdministrator');
    });

    test('should assign @my.xu.edu.ph domain users to Student roles only', () => {
      const assistant = authService.isUserInWhitelist('assistant@my.xu.edu.ph');
      const intern = authService.isUserInWhitelist('intern@my.xu.edu.ph');
      
      expect(assistant.role).toBe('StudentAssistant');
      expect(intern.role).toBe('Intern');
    });
  });

  describe('Hierarchical Permission Structure', () => {
    test('should validate SystemAdministrator has highest level permissions', () => {
      const sysadmin = authService.isUserInWhitelist('sysadmin@xu.edu.ph');
      const session = authService.createSession(sysadmin);
      
      // Should have exclusive access control permissions
      expect(session.permissions).toContain('manage_access_control');
      expect(session.permissions).toContain('whitelist_users');
      expect(session.permissions).toContain('assign_roles');
    });

    test('should validate UniversityRegistrar has comprehensive CRUD permissions', () => {
      const registrar = authService.isUserInWhitelist('registrar@xu.edu.ph');
      const session = authService.createSession(registrar);
      
      // Should have all CRUD operations
      expect(session.permissions).toContain('create_requests');
      expect(session.permissions).toContain('read_all_requests');
      expect(session.permissions).toContain('update_all_requests');
      expect(session.permissions).toContain('delete_requests');
      
      // Should have staff management permissions
      expect(session.permissions).toContain('assign_staff_permissions');
      expect(session.permissions).toContain('manage_interns_assistants');
    });

    test('should validate Evaluator has restricted but essential permissions', () => {
      const evaluator = authService.isUserInWhitelist('evaluator@xu.edu.ph');
      const session = authService.createSession(evaluator);
      
      // Should have creation and status update permissions
      expect(session.permissions).toContain('create_requests');
      expect(session.permissions).toContain('update_request_status');
      
      // Should NOT have delete or full read permissions
      expect(session.permissions).not.toContain('delete_requests');
      expect(session.permissions).not.toContain('read_all_requests');
    });
  });

  describe('Whitelist Validation with New Role Structure', () => {
    test('should maintain whitelist functionality for all new roles', () => {
      const validEmails = [
        'sysadmin@xu.edu.ph',
        'registrar@xu.edu.ph', 
        'evaluator@xu.edu.ph',
        'assistant@my.xu.edu.ph',
        'intern@my.xu.edu.ph'
      ];

      validEmails.forEach(email => {
        const user = authService.isUserInWhitelist(email);
        expect(user).not.toBeNull();
        expect(user.email).toBe(email);
      });
    });

    test('should reject unauthorized users not in whitelist', () => {
      const invalidEmails = [
        'random@xu.edu.ph',
        'student@my.xu.edu.ph',
        'outsider@gmail.com'
      ];

      invalidEmails.forEach(email => {
        const user = authService.isUserInWhitelist(email);
        expect(user).toBeNull();
      });
    });
  });
}); 