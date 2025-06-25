// Access Control specific functionality
let currentEditingUser = null;

// Mock user data for demonstration
let mockUsers = [
    { id: 1, name: 'Rangie Obispo', email: 'rangie.obispo@xu.edu.ph', role: 'System Administrator', department: 'CISO', status: 'Active' },
    { id: 2, name: 'Dr. Maria Santos', email: 'registrar@xu.edu.ph', role: 'University Registrar', department: 'Registrar Office', status: 'Active' },
    { id: 3, name: 'John Dela Cruz', email: 'evaluator@xu.edu.ph', role: 'Evaluator', department: 'Records Management', status: 'Active' },
    { id: 4, name: 'Sarah Johnson', email: 'assistant@my.xu.edu.ph', role: 'Student Assistant', department: 'Student Services', status: 'Inactive' },
    { id: 5, name: 'Mark Rodriguez', email: 'intern@my.xu.edu.ph', role: 'Intern', department: 'IT Support', status: 'Active' }
];

function switchTab(tab) {
    // Update tab appearance
    document.getElementById('usersTab').classList.remove('is-active');
    document.getElementById('rolesTab').classList.remove('is-active');
    document.getElementById(tab + 'Tab').classList.add('is-active');
    
    // Show/hide content
    document.getElementById('usersContent').style.display = tab === 'users' ? 'block' : 'none';
    document.getElementById('rolesContent').style.display = tab === 'roles' ? 'block' : 'none';
}

function showAddUserModal() {
    // Clear form
    document.getElementById('addUserName').value = '';
    document.getElementById('addUserEmail').value = '';
    document.getElementById('addUserRole').value = 'SystemAdministrator';
    
    showModal('addUserModal');
}

function addUser() {
    const name = document.getElementById('addUserName').value;
    const email = document.getElementById('addUserEmail').value;
    const role = document.getElementById('addUserRole').value;
    
    if (!name || !email) {
        showNotification('Please fill in all required fields.', 'warning');
        return;
    }
    
    showConfirmDialog('Are you sure you want to add this user?', function() {
        const newUser = {
            id: mockUsers.length > 0 ? Math.max(...mockUsers.map(u => u.id)) + 1 : 1,
            name: name,
            email: email,
            role: role,
            department: 'Registrar Office', // Default department
            status: 'Active' // Default status
        };
        
        // Simulate API call
        console.log('Simulating POST /api/users', newUser);
        mockUsers.push(newUser); // Add to mock data
        showNotification('User added successfully! (Simulated)', 'success');
        hideModal('addUserModal');
        updateUsersTable(); // Update table without full reload
    });
}

function editUser(userId) {
    const user = mockUsers.find(u => u.id === userId);
    if (user) {
        currentEditingUser = user;
        // Populate form
        document.getElementById('editUserName').value = user.name;
        document.getElementById('editUserEmail').value = user.email;
        document.getElementById('editUserRole').value = user.role;
        showModal('editUserModal');
    }
}

function saveUser() {
    if (!currentEditingUser) return;
    
    const name = document.getElementById('editUserName').value;
    const email = document.getElementById('editUserEmail').value;
    const role = document.getElementById('editUserRole').value;
    
    if (!name || !email) {
        showNotification('Please fill in all required fields.', 'warning');
        return;
    }

    showConfirmDialog('Are you sure you want to save changes to this user?', function() {
        // Simulate API call
        console.log(`Simulating PUT /api/users/${currentEditingUser.id}`);
        
        currentEditingUser.name = name;
        currentEditingUser.email = email;
        currentEditingUser.role = role;

        showNotification('User updated successfully! (Simulated)', 'success');
        hideModal('editUserModal');
        updateUsersTable(); // Update table without full reload
    });
}

function deleteUser(userId) {
    showConfirmDialog('Are you sure you want to delete this user? This action cannot be undone.', function() {
        // Simulate API call
        console.log(`Simulating DELETE /api/users/${userId}`);
        mockUsers = mockUsers.filter(user => user.id !== userId);
        showNotification('User deleted successfully! (Simulated)', 'success');
        updateUsersTable(); // Update table without full reload
    });
}

// Permissions Modal
function showPermissionModal(role) {
    const modalTitle = document.getElementById('permissionModalTitle');
    const permissionList = document.getElementById('permissionList');
    
    // Convert camelCase role names to display names
    const roleDisplayNames = {
        'SystemAdministrator': 'System Administrator',
        'UniversityRegistrar': 'University Registrar',
        'Evaluator': 'Evaluator',
        'StudentAssistant': 'Student Assistant',
        'Intern': 'Intern'
    };
    
    const displayRole = roleDisplayNames[role] || role;
    modalTitle.textContent = `${displayRole} Permissions`;
    permissionList.innerHTML = ''; // Clear previous permissions

    // Mock permissions based on role
    const permissions = {
        'System Administrator': ['Manage access control', 'Whitelist users', 'Assign roles', 'Full system control', 'View Audit Log', 'Generate Reports', 'Access All Data'],
        'University Registrar': ['All CRUD operations', 'Add intern/student assistant', 'Assign permissions', 'Manage documents', 'View Audit Log', 'Generate Reports'],
        'Evaluator': ['Create data entry', 'Edit status', 'Mark as Request Issued', 'Mark as Printed', 'Process documents'],
        'Student Assistant': ['Update request information', 'Verify request information', 'Coordinate with registrar'],
        'Intern': ['Limited verification tasks', 'Read-only permissions', 'Basic data entry']
    };

    (permissions[displayRole] || []).forEach(perm => {
        const li = document.createElement('li');
        li.textContent = perm;
        permissionList.appendChild(li);
    });

    showModal('permissionModal');
}

// Function to update the users table (mock data)
function updateUsersTable() {
    const tableBody = document.querySelector('#usersTable tbody');
    if (!tableBody) return;

    tableBody.innerHTML = ''; // Clear existing rows

    mockUsers.forEach(user => {
        const statusClass = user.status === 'Active' ? 'is-success' : 'is-warning';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td><span class="tag ${statusClass}">${user.status}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="button is-small is-info" onclick="editUser(${user.id})" title="Edit User">
                        <img src="./assets/edit.png" alt="Edit" class="action-icon">
                    </button>
                    <button class="button is-small is-danger" onclick="deleteUser(${user.id})" title="Delete User">
                        <img src="./assets/delete.png" alt="Delete" class="action-icon">
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Initialize search functionality and mock data display
document.addEventListener('DOMContentLoaded', function() {
    initializeSearch('userSearch', 'usersTable');
    updateUsersTable(); // Populate table with mock data on load
}); 