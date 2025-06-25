const { AccessControlService } = require('../services/accessControlService');

describe('AccessControlService - Basic Permission Validation', () => {
  let accessControl;

  beforeEach(() => {
    accessControl = new AccessControlService();
  });

  test('should return true when SystemAdministrator has required permission', () => {
    const userRole = 'SystemAdministrator';
    const permission = 'manage_access_control';
    expect(accessControl.hasPermission(userRole, permission)).toBe(true);
  });

  test('should return true when UniversityRegistrar has create_requests permission', () => {
    const userRole = 'UniversityRegistrar';
    const permission = 'create_requests';
    expect(accessControl.hasPermission(userRole, permission)).toBe(true);
  });

  test('should return false when Intern lacks required permission', () => {
    const userRole = 'Intern';
    const permission = 'create_requests';
    expect(accessControl.hasPermission(userRole, permission)).toBe(false);
  });

  test('should return false for invalid role', () => {
    const userRole = 'InvalidRole';
    const permission = 'read_assigned_requests';
    expect(accessControl.hasPermission(userRole, permission)).toBe(false);
  });

  test('should return false for null or empty inputs', () => {
    expect(accessControl.hasPermission(null, 'manage_access_control')).toBe(false);
    expect(accessControl.hasPermission('SystemAdministrator', null)).toBe(false);
    expect(accessControl.hasPermission('', 'manage_access_control')).toBe(false);
    expect(accessControl.hasPermission('SystemAdministrator', '')).toBe(false);
  });
});

describe('AccessControlService - Session Authentication', () => {
  let accessControl;

  beforeEach(() => {
    accessControl = new AccessControlService();
  });

  test('should return true for valid authenticated session', () => {
    const sessionId = 'valid-session-123';
    expect(accessControl.isAuthenticated(sessionId)).toBe(true);
  });

  test('should return false for invalid session', () => {
    const sessionId = 'invalid-session';
    expect(accessControl.isAuthenticated(sessionId)).toBe(false);
  });

  test('should return false for null or empty session', () => {
    expect(accessControl.isAuthenticated(null)).toBe(false);
    expect(accessControl.isAuthenticated('')).toBe(false);
    expect(accessControl.isAuthenticated(undefined)).toBe(false);
  });
});

describe('AccessControlService - Resource Access', () => {
  let accessControl;

  beforeEach(() => {
    accessControl = new AccessControlService();
  });

  test('should allow CISO to access user_management resource', () => {
    const userRole = 'CISO';
    const resourceName = 'user_management';
    expect(accessControl.canAccessResource(userRole, resourceName)).toBe(true);
  });

  test('should allow Registrar to access all_records resource', () => {
    const userRole = 'Registrar';
    const resourceName = 'all_records';
    expect(accessControl.canAccessResource(userRole, resourceName)).toBe(true);
  });

  test('should deny Intern access to user_management resource', () => {
    const userRole = 'Intern';
    const resourceName = 'user_management';
    expect(accessControl.canAccessResource(userRole, resourceName)).toBe(false);
  });

  test('should deny access to non-existent resource', () => {
    const userRole = 'CISO';
    const resourceName = 'non_existent_resource';
    expect(accessControl.canAccessResource(userRole, resourceName)).toBe(false);
  });

  test('should deny access for invalid role', () => {
    const userRole = 'InvalidRole';
    const resourceName = 'user_management';
    expect(accessControl.canAccessResource(userRole, resourceName)).toBe(false);
  });

  test('should return false for null or empty inputs', () => {
    expect(accessControl.canAccessResource(null, 'user_management')).toBe(false);
    expect(accessControl.canAccessResource('CISO', null)).toBe(false);
    expect(accessControl.canAccessResource('', 'user_management')).toBe(false);
    expect(accessControl.canAccessResource('CISO', '')).toBe(false);
  });
}); 