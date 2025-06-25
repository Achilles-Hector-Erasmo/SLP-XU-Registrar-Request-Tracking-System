// Enhanced role permissions matching AuthService from user-authentication branch
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

// AccessControlService - REFACTOR phase implementation
class AccessControlService {
  constructor() {
    this.activePermissions = rolesPermissions;
  }

  // Utility method for input validation (extracted for reusability)
  _isValidStringInput(input) {
    return input && typeof input === 'string' && input.trim().length > 0;
  }

  hasPermission(userRole, permission) {
    // Input validation using extracted utility
    if (!this._isValidStringInput(userRole) || !this._isValidStringInput(permission)) {
      return false;
    }
    
    // Get role permissions
    const rolePermissions = this.activePermissions[userRole];
    if (!rolePermissions || !Array.isArray(rolePermissions)) {
      return false;
    }
    
    // Check if role has the required permission
    return rolePermissions.includes(permission);
  }
}

module.exports = {
  AccessControlService,
  rolesPermissions
}; 