// Mock data for authorized users with enhanced role hierarchy
const authorizedUsers = [
  { email: 'sysadmin@xu.edu.ph', role: 'SystemAdministrator', password: 'SysAdmin123!' },
  { email: 'registrar@xu.edu.ph', role: 'UniversityRegistrar', password: 'Registrar456!' },
  { email: 'evaluator@xu.edu.ph', role: 'Evaluator', password: 'Evaluator789!' },
  { email: 'assistant@my.xu.edu.ph', role: 'StudentAssistant', password: 'Assistant000!' },
  { email: 'intern@my.xu.edu.ph', role: 'Intern', password: 'Intern111!' }
];

// Enhanced role permissions based on functional requirements
const rolesPermissions = {
  // System Administrator: Manages access control, first user, assigns/whitelists all users
  SystemAdministrator: [
    'manage_access_control',
    'whitelist_users', 
    'assign_roles',
    'view_all_audit_logs',
    'manage_system_config',
    'create_users',
    'delete_users',
    'modify_user_roles'
  ],
  
  // University Registrar: All CRUD operations, can add intern/student assistant, assign permissions
  UniversityRegistrar: [
    'create_requests',
    'read_all_requests',
    'update_all_requests', 
    'delete_requests',
    'assign_staff_permissions',
    'manage_interns_assistants',
    'sign_documents',
    'release_documents',
    'view_all_audit_logs',
    'manage_user_access',
    'delegate_permissions'
  ],
  
  // Evaluator: Create data entry, edit status, mark as "Request Issued" or "Printed"
  Evaluator: [
    'create_requests',
    'read_assigned_requests',
    'update_request_status',
    'mark_request_issued',
    'mark_request_printed',
    'edit_request_data',
    'view_own_audit_logs',
    'process_documents'
  ],
  
  // Student Assistant: Update/verify request information per registrar guidelines
  StudentAssistant: [
    'read_assigned_requests',
    'update_request_info',
    'verify_request_data',
    'coordinate_with_registrar',
    'view_assigned_audit_logs'
  ],
  
  // Intern: Limited access for verification tasks
  Intern: [
    'read_assigned_requests',
    'verify_request_data',
    'view_limited_audit_logs'
  ]
};

class AuthService {
  constructor() {
    this.VALID_DOMAINS = ['@xu.edu.ph', '@my.xu.edu.ph'];
    this.activeSessions = new Map(); // Store active sessions
    this.SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.loginAttempts = new Map(); // Track login attempts per email
    this.MAX_LOGIN_ATTEMPTS = 5;
    this.LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes
    
    // Enhanced role hierarchy for permission inheritance
    this.ROLE_HIERARCHY = {
      SystemAdministrator: 4, // Highest level
      UniversityRegistrar: 3,
      Evaluator: 2,
      StudentAssistant: 1,
      Intern: 0 // Lowest level
    };
    
    // Domain-based role restrictions for security
    this.DOMAIN_ROLE_RESTRICTIONS = {
      '@xu.edu.ph': ['SystemAdministrator', 'UniversityRegistrar', 'Evaluator'],
      '@my.xu.edu.ph': ['StudentAssistant', 'Intern']
    };
  }
  
  /**
   * Validates email domain against allowed domains
   * @param {string} email - Email to validate
   * @returns {boolean} - True if domain is valid
   */
  validateEmailDomain(email) {
    if (!email) return false;
    const normalizedEmail = email.toLowerCase();
    return this.VALID_DOMAINS.includes(normalizedEmail.substring(normalizedEmail.indexOf('@')));
  }

  /**
   * Checks if user exists in authorized whitelist
   * @param {string} email - Email to check
   * @returns {Object|null} - User object if found, null otherwise
   */
  isUserInWhitelist(email) {
    if (!email || typeof email !== 'string') return null;
    
    // First, check if user is explicitly in the whitelist
    const explicitUser = authorizedUsers.find(user => user.email === email);
    if (explicitUser) {
      return explicitUser;
    }
    
    // For @my.xu.edu.ph domain, allow any user with default StudentAssistant role
    if (email.endsWith('@my.xu.edu.ph')) {
      return {
        email: email,
        role: 'StudentAssistant',
        password: null // OAuth users don't need password
      };
    }
    
    // For @xu.edu.ph domain, be more restrictive - only explicitly whitelisted users
    return null;
  }

  /**
   * Validates if a role is appropriate for the given email domain
   * @param {string} email - User email
   * @param {string} role - Role to validate
   * @returns {boolean} - True if role is valid for domain
   */
  validateRoleForDomain(email, role) {
    if (!email || !role) return false;
    
    const domain = email.substring(email.indexOf('@'));
    const allowedRoles = this.DOMAIN_ROLE_RESTRICTIONS[domain];
    
    return allowedRoles ? allowedRoles.includes(role) : false;
  }

  /**
   * Gets role hierarchy level for permission comparison
   * @param {string} role - Role name
   * @returns {number} - Hierarchy level (higher number = more permissions)
   */
  getRoleLevel(role) {
    return this.ROLE_HIERARCHY[role] || -1;
  }

  /**
   * Checks if one role has higher or equal permissions than another
   * @param {string} role1 - First role
   * @param {string} role2 - Second role  
   * @returns {boolean} - True if role1 >= role2 in hierarchy
   */
  hasEqualOrHigherRole(role1, role2) {
    return this.getRoleLevel(role1) >= this.getRoleLevel(role2);
  }

  /**
   * Creates an authenticated session for a user
   * @param {Object} user - User object with email and role
   * @returns {Object|null} - Session object or null if invalid
   */
  createSession(user) {
    if (!user || !user.email || !user.role) return null;
    
    // Validate role exists in permissions mapping
    const permissions = rolesPermissions[user.role];
    if (!permissions) return null;
    
    // Validate role is appropriate for user's domain
    if (!this.validateRoleForDomain(user.email, user.role)) {
      this._logSecurityEvent('SESSION_CREATION', 'INVALID_ROLE_FOR_DOMAIN', {
        email: user.email,
        role: user.role,
        domain: user.email.substring(user.email.indexOf('@'))
      });
      return null;
    }
    
    // Generate unique session ID and timestamp
    const sessionId = this._generateSessionId();
    const createdAt = new Date().toISOString();
    
    const session = {
      sessionId,
      email: user.email,
      role: user.role,
      permissions: [...permissions], // Create copy to avoid reference issues
      createdAt,
      isActive: true,
      lastAccessedAt: createdAt,
      roleLevel: this.getRoleLevel(user.role),
      domain: user.email.substring(user.email.indexOf('@'))
    };

    // Store session in memory
    this.activeSessions.set(sessionId, session);
    
    // Log session creation for audit
    this._logSessionActivity(sessionId, 'CREATE', 
      `Session created for ${user.email} with role ${user.role}`);
    
    return session;
  }

  /**
   * Checks if a session has a specific permission
   * @param {string} sessionId - Session ID
   * @param {string} permission - Permission to check
   * @returns {boolean} - True if session has permission
   */
  hasPermission(sessionId, permission) {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isActive) return false;
    
    // Check if session is expired
    if (this._isSessionExpired(session)) {
      this._expireSession(sessionId);
      return false;
    }
    
    return session.permissions.includes(permission);
  }

  /**
   * Gets all permissions for a role, including inherited permissions
   * @param {string} role - Role name
   * @returns {Array} - Array of permissions
   */
  getRolePermissions(role) {
    return rolesPermissions[role] || [];
  }

  /**
   * Gets detailed role information including hierarchy level and domain
   * @param {string} role - Role name
   * @returns {Object} - Role information object
   */
  getRoleInfo(role) {
    const permissions = this.getRolePermissions(role);
    const level = this.getRoleLevel(role);
    const allowedDomains = Object.keys(this.DOMAIN_ROLE_RESTRICTIONS)
      .filter(domain => this.DOMAIN_ROLE_RESTRICTIONS[domain].includes(role));
    
    return {
      role,
      level,
      permissions,
      allowedDomains,
      permissionCount: permissions.length
    };
  }

  logout(sessionId) {
    // Input validation
    if (!sessionId) {
      return {
        success: false,
        message: 'Session ID is required'
      };
    }

    if (!this._isValidSessionId(sessionId)) {
      return {
        success: false,
        message: 'Invalid session ID format'
      };
    }

    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return {
        success: false,
        message: 'Invalid or expired session'
      };
    }

    if (!session.isActive) {
      return {
        success: false,
        message: 'Session already destroyed'
      };
    }

    // Destroy session and update metadata
    session.isActive = false;
    session.destroyedAt = new Date().toISOString();
    session.destroyedBy = 'user_logout';
    
    // Log session activity for audit trail
    this._logSessionActivity(sessionId, 'LOGOUT', 'User initiated logout');
    
    return {
      success: true,
      message: 'Session destroyed successfully',
      sessionId: sessionId
    };
  }

  getSessionStatus(sessionId) {
    if (!this._isValidSessionId(sessionId)) {
      return null;
    }

    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check for session timeout
    if (this._isSessionExpired(session)) {
      this._expireSession(sessionId);
      return {
        isActive: false,
        destroyedAt: session.destroyedAt,
        reason: 'timeout'
      };
    }

    return {
      isActive: session.isActive,
      destroyedAt: session.destroyedAt || null,
      lastAccessedAt: session.lastAccessedAt,
      expiresAt: new Date(new Date(session.createdAt).getTime() + this.SESSION_TIMEOUT).toISOString()
    };
  }

  /**
   * Validates a session token and returns session data if valid
   * @param {string} token - Session token/ID to validate
   * @returns {Object|null} - Session object if valid, null otherwise
   */
  validateSession(token) {
    if (!token) return null;
    
    if (!this._isValidSessionId(token)) {
      return null;
    }

    const session = this.activeSessions.get(token);
    
    if (!session || !session.isActive) {
      return null;
    }

    // Check for session expiration
    if (this._isSessionExpired(session)) {
      this._expireSession(token);
      return null;
    }

    // Update last accessed time
    session.lastAccessedAt = new Date().toISOString();
    
    // Return session with user information
    return {
      sessionId: session.sessionId,
      user: {
        email: session.email,
        role: session.role,
        permissions: session.permissions
      },
      isActive: session.isActive,
      lastAccessedAt: session.lastAccessedAt,
      createdAt: session.createdAt
    };
  }

  // Helper method to validate session ID format
  _isValidSessionId(sessionId) {
    return sessionId && typeof sessionId === 'string' && sessionId.startsWith('sess_');
  }

  // Helper method to check if session has expired
  _isSessionExpired(session) {
    const now = Date.now();
    const createdAt = new Date(session.createdAt).getTime();
    return (now - createdAt) > this.SESSION_TIMEOUT;
  }

  // Helper method to expire a session due to timeout
  _expireSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session && session.isActive) {
      session.isActive = false;
      session.destroyedAt = new Date().toISOString();
      session.destroyedBy = 'timeout';
      this._logSessionActivity(sessionId, 'EXPIRE', 'Session expired due to timeout');
    }
  }

  // Helper method to log session activities for audit trail
  _logSessionActivity(sessionId, action, description) {
    // In a real application, this would write to a proper logging system
    // For now, we'll just add to console for debugging
    const timestamp = new Date().toISOString();
    console.log(`[SESSION_AUDIT] ${timestamp} - ${action}: ${sessionId} - ${description}`);
  }

  // Utility method to clean up expired sessions (garbage collection)
  cleanupExpiredSessions() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (this._isSessionExpired(session)) {
        this._expireSession(sessionId);
        cleanedCount++;
      }
    }
    
    return {
      cleanedSessions: cleanedCount,
      activeSessions: Array.from(this.activeSessions.values()).filter(s => s.isActive).length
    };
  }

  _generateSessionId() {
    return 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  async login(email, password) {
    const loginTimestamp = new Date().toISOString();
    const clientInfo = this._generateClientInfo(); // For audit trail
    
    // Step 1: Input validation with sanitization
    const sanitizedInput = this._sanitizeLoginInput(email, password);
    if (!sanitizedInput.isValid) {
      this._logSecurityEvent('LOGIN_ATTEMPT', 'INVALID_INPUT', { 
        email: email || 'null', 
        reason: sanitizedInput.reason 
      });
      return {
        success: false,
        message: 'Email and password are required',
        errorCode: 'MISSING_CREDENTIALS'
      };
    }

    const { email: cleanEmail, password: cleanPassword } = sanitizedInput;

    // Step 2: Check if account is locked
    if (this._isAccountLocked(cleanEmail)) {
      this._logSecurityEvent('LOGIN_ATTEMPT', 'ACCOUNT_LOCKED', { 
        email: cleanEmail, 
        lockoutInfo: this.getLoginAttempts(cleanEmail) 
      });
      return {
        success: false,
        message: 'Account temporarily locked due to multiple failed login attempts',
        errorCode: 'ACCOUNT_LOCKED',
        retryAfter: this._getLockoutTimeRemaining(cleanEmail)
      };
    }

    // Step 3: Domain validation
    if (!this.validateEmailDomain(cleanEmail)) {
      this._recordFailedAttempt(cleanEmail, 'INVALID_DOMAIN', clientInfo);
      this._logSecurityEvent('LOGIN_ATTEMPT', 'INVALID_DOMAIN', { email: cleanEmail });
      return {
        success: false,
        message: 'Invalid email domain',
        errorCode: 'INVALID_DOMAIN'
      };
    }

    // Step 4: User whitelist validation
    const user = this.isUserInWhitelist(cleanEmail);
    if (!user) {
      this._recordFailedAttempt(cleanEmail, 'UNAUTHORIZED_USER', clientInfo);
      this._logSecurityEvent('LOGIN_ATTEMPT', 'UNAUTHORIZED_USER', { email: cleanEmail });
      return {
        success: false,
        message: 'User not authorized',
        errorCode: 'UNAUTHORIZED_USER'
      };
    }

    // Step 5: Password validation with timing attack protection
    const passwordValid = await this._validatePasswordSecure(user, cleanPassword);
    if (!passwordValid) {
      this._recordFailedAttempt(cleanEmail, 'INVALID_PASSWORD', clientInfo);
      this._logSecurityEvent('LOGIN_ATTEMPT', 'INVALID_PASSWORD', { 
        email: cleanEmail, 
        attemptCount: this.getLoginAttempts(cleanEmail).failedAttempts + 1 
      });
      return {
        success: false,
        message: 'Invalid credentials',
        errorCode: 'INVALID_PASSWORD'
      };
    }

    // Step 6: Create session with enhanced metadata
    const session = this.createSession(user);
    if (!session) {
      this._logSecurityEvent('LOGIN_ATTEMPT', 'SESSION_CREATION_FAILED', { email: cleanEmail });
      return {
        success: false,
        message: 'Failed to create session',
        errorCode: 'SESSION_CREATION_FAILED'
      };
    }

    // Step 7: Clear failed attempts and update session metadata
    this._clearFailedAttempts(cleanEmail);
    session.clientInfo = clientInfo;
    session.loginMethod = 'email_password';
    
    // Step 8: Comprehensive success logging
    this._logSecurityEvent('LOGIN_SUCCESS', 'USER_AUTHENTICATED', {
      email: cleanEmail,
      role: user.role,
      sessionId: session.sessionId,
      clientInfo: clientInfo
    });
    this._logSessionActivity(session.sessionId, 'LOGIN', `Successful login for ${cleanEmail}`);

    return {
      success: true,
      message: 'Login successful',
      user: {
        email: user.email,
        role: user.role,
        permissions: session.permissions
      },
      session: {
        sessionId: session.sessionId,
        expiresAt: new Date(new Date(session.createdAt).getTime() + this.SESSION_TIMEOUT).toISOString(),
        isActive: session.isActive
      },
      loginTimestamp: loginTimestamp,
      securityInfo: {
        previousFailedAttempts: 0, // Cleared on success
        accountStatus: 'active',
        lastSuccessfulLogin: loginTimestamp
      }
    };
  }

  // Helper method to validate password
  _validatePassword(user, password) {
    return user.password === password;
  }

  // Helper method to check if account is locked
  _isAccountLocked(email) {
    const attempts = this.loginAttempts.get(email);
    if (!attempts) return false;
    
    const now = Date.now();
    const lockoutExpiry = attempts.lockedUntil;
    
    // If locked and lockout period has expired, unlock account
    if (lockoutExpiry && now > lockoutExpiry) {
      this._clearFailedAttempts(email);
      return false;
    }
    
    return attempts.failedAttempts >= this.MAX_LOGIN_ATTEMPTS;
  }

  // Helper method to record failed login attempt
  _recordFailedAttempt(email, reason, clientInfo = null) {
    const now = Date.now();
    const attempts = this.loginAttempts.get(email) || {
      failedAttempts: 0,
      lastAttempt: null,
      lockedUntil: null,
      attempts: []
    };

    attempts.failedAttempts++;
    attempts.lastAttempt = now;
    attempts.attempts.push({
      timestamp: new Date().toISOString(),
      reason: reason,
      clientInfo: clientInfo
    });

    // Lock account if max attempts reached
    if (attempts.failedAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      attempts.lockedUntil = now + this.LOCKOUT_DURATION;
      this._logSessionActivity(`email_${email}`, 'ACCOUNT_LOCKED', 
        `Account locked after ${attempts.failedAttempts} failed attempts`);
    }

    this.loginAttempts.set(email, attempts);
  }

  // Helper method to clear failed attempts
  _clearFailedAttempts(email) {
    this.loginAttempts.delete(email);
  }

  // Helper method to get login attempts for an email
  getLoginAttempts(email) {
    const attempts = this.loginAttempts.get(email);
    if (!attempts) {
      return {
        failedAttempts: 0,
        lastAttempt: null,
        isLocked: false
      };
    }

    return {
      failedAttempts: attempts.failedAttempts,
      lastAttempt: attempts.lastAttempt,
      isLocked: this._isAccountLocked(email),
      lockedUntil: attempts.lockedUntil
    };
  }

  // Enhanced helper method to sanitize login input
  _sanitizeLoginInput(email, password) {
    if (!email || !password) {
      return { isValid: false, reason: 'Missing credentials' };
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return { isValid: false, reason: 'Invalid data type' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (cleanEmail === '' || cleanPassword === '') {
      return { isValid: false, reason: 'Empty credentials' };
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return { isValid: false, reason: 'Invalid email format' };
    }

    return {
      isValid: true,
      email: cleanEmail,
      password: cleanPassword
    };
  }

  // Enhanced password validation with timing attack protection
  async _validatePasswordSecure(user, password) {
    // Add artificial delay to prevent timing attacks
    const delay = Math.floor(Math.random() * 100) + 50; // 50-150ms random delay
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return user.password === password;
  }

  // Helper method to generate client info for audit trail
  _generateClientInfo() {
    return {
      timestamp: new Date().toISOString(),
      userAgent: 'Node.js-AuthService/1.0', // In real app, would get from request
      ipAddress: '127.0.0.1', // In real app, would get from request
      sessionSource: 'direct_login'
    };
  }

  // Helper method to get remaining lockout time
  _getLockoutTimeRemaining(email) {
    const attempts = this.loginAttempts.get(email);
    if (!attempts || !attempts.lockedUntil) return 0;
    
    const remaining = attempts.lockedUntil - Date.now();
    return Math.max(0, Math.ceil(remaining / 1000)); // Return seconds
  }

  // Enhanced security event logging
  _logSecurityEvent(eventType, action, details) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      eventType,
      action,
      details,
      severity: this._getEventSeverity(eventType, action)
    };
    
    // In a real application, this would write to a security audit log
    console.log(`[SECURITY_AUDIT] ${timestamp} - ${eventType}:${action} - ${JSON.stringify(details)}`);
    
    // Store in memory for demo purposes (in real app, would persist to database)
    if (!this.securityAuditLog) {
      this.securityAuditLog = [];
    }
    this.securityAuditLog.push(logEntry);
  }

  // Helper to determine event severity
  _getEventSeverity(eventType, action) {
    const highSeverityEvents = ['ACCOUNT_LOCKED', 'INVALID_PASSWORD', 'UNAUTHORIZED_USER'];
    const mediumSeverityEvents = ['INVALID_DOMAIN', 'SESSION_CREATION_FAILED'];
    
    if (highSeverityEvents.includes(action)) return 'HIGH';
    if (mediumSeverityEvents.includes(action)) return 'MEDIUM';
    if (eventType === 'LOGIN_SUCCESS') return 'INFO';
    
    return 'LOW';
  }

  // Utility method to get security audit log
  getSecurityAuditLog(limit = 100) {
    if (!this.securityAuditLog) return [];
    return this.securityAuditLog.slice(-limit);
  }

  /**
   * Administrative Methods for System Administrator
   */

  /**
   * Validates if user can perform administrative action based on role hierarchy
   * @param {string} adminSessionId - Session ID of admin user
   * @param {string} targetRole - Role being managed
   * @returns {boolean} - True if admin has sufficient privileges
   */
  canManageRole(adminSessionId, targetRole) {
    const adminSession = this.activeSessions.get(adminSessionId);
    if (!adminSession || !adminSession.isActive) return false;
    
    // Only SystemAdministrator can manage roles
    if (adminSession.role !== 'SystemAdministrator') return false;
    
    // System admin can manage all roles
    return true;
  }

  /**
   * Gets comprehensive system status for administrators
   * @param {string} adminSessionId - Session ID of admin user
   * @returns {Object|null} - System status or null if unauthorized
   */
  getSystemStatus(adminSessionId) {
    if (!this.canManageRole(adminSessionId, 'SystemAdministrator')) return null;
    
    const activeUsers = Array.from(this.activeSessions.values())
      .filter(session => session.isActive)
      .reduce((acc, session) => {
        acc[session.role] = (acc[session.role] || 0) + 1;
        return acc;
      }, {});
    
    const securityStats = {
      totalUsers: authorizedUsers.length,
      activeSessionsCount: Array.from(this.activeSessions.values()).filter(s => s.isActive).length,
      lockedAccounts: Array.from(this.loginAttempts.values()).filter(attempt => 
        attempt.failedAttempts >= this.MAX_LOGIN_ATTEMPTS
      ).length,
      recentSecurityEvents: this.getSecurityAuditLog(50).length
    };
    
    return {
      timestamp: new Date().toISOString(),
      activeUsersByRole: activeUsers,
      securityStatistics: securityStats,
      roleHierarchy: this.ROLE_HIERARCHY,
      domainRestrictions: this.DOMAIN_ROLE_RESTRICTIONS,
      systemHealth: 'operational'
    };
  }

  /**
   * Gets detailed user information for administrators
   * @param {string} adminSessionId - Session ID of admin user
   * @param {string} userEmail - Email of user to inspect
   * @returns {Object|null} - User details or null if unauthorized
   */
  getUserDetails(adminSessionId, userEmail) {
    const adminSession = this.activeSessions.get(adminSessionId);
    if (!adminSession || !adminSession.isActive) return null;
    
    // Only admin and registrar can view user details
    if (!['SystemAdministrator', 'UniversityRegistrar'].includes(adminSession.role)) {
      return null;
    }
    
    const user = this.isUserInWhitelist(userEmail);
    if (!user) return null;
    
    const loginHistory = this.getLoginAttempts(userEmail);
    const activeSessions = Array.from(this.activeSessions.values())
      .filter(session => session.email === userEmail && session.isActive);
    
    return {
      email: user.email,
      role: user.role,
      roleInfo: this.getRoleInfo(user.role),
      loginHistory: loginHistory,
      activeSessionsCount: activeSessions.length,
      lastActivity: activeSessions.length > 0 ? 
        Math.max(...activeSessions.map(s => new Date(s.lastAccessedAt).getTime())) : null,
      accountStatus: loginHistory.isLocked ? 'locked' : 'active'
    };
  }

  /**
   * Validates system integrity and role assignments
   * @returns {Object} - Validation report
   */
  validateSystemIntegrity() {
    const validationReport = {
      timestamp: new Date().toISOString(),
      issues: [],
      warnings: [],
      statistics: {}
    };
    
    // Check all users have valid role-domain combinations
    authorizedUsers.forEach(user => {
      if (!this.validateRoleForDomain(user.email, user.role)) {
        validationReport.issues.push({
          type: 'INVALID_ROLE_DOMAIN',
          user: user.email,
          role: user.role,
          domain: user.email.substring(user.email.indexOf('@'))
        });
      }
    });
    
    // Check for orphaned sessions
    const orphanedSessions = Array.from(this.activeSessions.values())
      .filter(session => !authorizedUsers.find(user => user.email === session.email));
    
    if (orphanedSessions.length > 0) {
      validationReport.warnings.push({
        type: 'ORPHANED_SESSIONS',
        count: orphanedSessions.length
      });
    }
    
    // Gather statistics
    validationReport.statistics = {
      totalUsers: authorizedUsers.length,
      usersByDomain: authorizedUsers.reduce((acc, user) => {
        const domain = user.email.substring(user.email.indexOf('@'));
        acc[domain] = (acc[domain] || 0) + 1;
        return acc;
      }, {}),
      usersByRole: authorizedUsers.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {}),
      activeSessions: Array.from(this.activeSessions.values()).filter(s => s.isActive).length
    };
    
    return validationReport;
  }
}

module.exports = {
  AuthService,
  authorizedUsers,
  rolesPermissions
}; 