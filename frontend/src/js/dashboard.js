// Dashboard specific functionality 
let currentEditingStudent = null;
let currentUser = null;
let mockStudents = [
    { id: 1, lastName: 'Doe', firstName: 'John', middleName: 'A', publicComments: 'Initial request', privateComments: 'Internal note', evalStatus: 'PENDING', signedStatus: 'PENDING', claimedBy: 'UNCLAIMED' },
    { id: 2, lastName: 'Smith', firstName: 'Jane', middleName: 'B', publicComments: 'Follow up needed', privateComments: 'Urgent', evalStatus: 'DONE', signedStatus: 'PENDING', claimedBy: 'UNCLAIMED' }
];

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

/**
 * Initialize dashboard - check authentication and load user info
 */
async function initializeDashboard() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
        // Store token for future use
        localStorage.setItem('sessionToken', token);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Check if user is authenticated
    const sessionToken = localStorage.getItem('sessionToken');
    if (!sessionToken) {
        showNotification('Authentication required. Redirecting to login...', 'warning');
        setTimeout(() => {
            window.location.href = '/?error=authentication_required';
        }, 2000);
        return;
    }
    
    // Add a small delay to ensure the session is properly created on the server
    if (token) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Validate session
    try {
        console.log('Validating session token:', sessionToken);
        const response = await fetch(`http://localhost:3000/api/auth/session/${sessionToken}`);
        const data = await response.json();
        
        console.log('Session validation response:', data);
        
        if (data.success) {
            currentUser = data.session;
            updateDashboardForUser();
            updateStudentsTable();
            showNotification(`Welcome to the dashboard, ${currentUser.email}!`, 'success');
        } else {
            console.error('Session validation failed:', data);
            localStorage.removeItem('sessionToken');
            showNotification('Session expired. Redirecting to login...', 'warning');
            setTimeout(() => {
                window.location.href = '/?error=invalid_session';
            }, 2000);
        }
    } catch (error) {
        console.error('Error validating session:', error);
        showNotification('Authentication error. Redirecting to login...', 'danger');
        setTimeout(() => {
            window.location.href = '/?error=auth_error';
        }, 2000);
    }
}

/**
 * Update dashboard UI based on user role
 */
function updateDashboardForUser() {
    if (!currentUser) return;
    
    // Update user info in header if element exists
    const userEmail = document.querySelector('.user-email');
    if (userEmail) {
        userEmail.textContent = currentUser.email;
    }
    
    const userRole = document.querySelector('.user-role');
    if (userRole) {
        userRole.textContent = currentUser.role;
    }
} 

function editStudent(studentId) {
    showConfirmDialog('Are you sure you want to edit this student record?', function() {
        const student = mockStudents.find(s => s.id === studentId);
        if (student) {
            currentEditingStudent = student;
            populateEditForm(student);
            showModal('editStudentModal');
        } else {
            showNotification('Student not found.', 'danger');
        }
    });
}

function deleteStudent(studentId) {
    showConfirmDialog('Are you sure you want to delete this student record? This action cannot be undone.', function() {
        // Simulate API call
        console.log(`Simulating DELETE /api/students/${studentId}`);
        mockStudents = mockStudents.filter(s => s.id !== studentId);
        showNotification('Student record deleted successfully! (Simulated)', 'success');
        updateStudentsTable(); // Update table without full reload
    });
}

function populateEditForm(student) {
    document.getElementById('editLastName').value = student.lastName || '';
    document.getElementById('editFirstName').value = student.firstName || '';
    document.getElementById('editMiddleName').value = student.middleName || '';
    document.getElementById('editPublicComments').value = student.publicComments || '';
    document.getElementById('editPrivateComments').value = student.privateComments || '';
}

function saveStudent() {
    if (!currentEditingStudent) return;
    
    showConfirmDialog('Are you sure you want to save these changes?', function() {
        const updatedData = {
            lastName: document.getElementById('editLastName').value,
            firstName: document.getElementById('editFirstName').value,
            middleName: document.getElementById('editMiddleName').value,
            publicComments: document.getElementById('editPublicComments').value,
            privateComments: document.getElementById('editPrivateComments').value
        };
        
        // Simulate API call
        console.log(`Simulating PUT /api/students/${currentEditingStudent.id}`, updatedData);
        Object.assign(currentEditingStudent, updatedData); // Update mock data
        showNotification('Student record updated successfully! (Simulated)', 'success');
        hideModal('editStudentModal');
        
        // Simulate navigation based on status (will not actually navigate without server)
        if (currentEditingStudent.evalStatus === 'DONE' && currentEditingStudent.signedStatus === 'PENDING') {
            showEvaluationModal();
        } else if (currentEditingStudent.signedStatus === 'DONE' && currentEditingStudent.claimedBy === 'UNCLAIMED') {
            showClaimDetailsModal();
        } else {
            updateStudentsTable(); // Update table without full reload
        }
    });
}

function revertChanges() {
    if (currentEditingStudent) {
        populateEditForm(currentEditingStudent);
        showNotification('Changes reverted to original values.', 'info');
    }
}

function showEvaluationModal() {
    const modal = document.createElement('div');
    modal.className = 'modal is-active';
    modal.innerHTML = `
        <div class="modal-background"></div>
        <div class="modal-card">
            <header class="modal-card-head">
                <p class="modal-card-title">Evaluation Status Update</p>
                <button class="delete" onclick="this.closest('.modal').remove();"></button>
            </header>
            <section class="modal-card-body">
                <div class="field">
                    <label class="label">Evaluation Status</label>
                    <div class="control">
                        <div class="select is-fullwidth">
                            <select id="evalStatusUpdate">
                                <option value="PENDING">Pending</option>
                                <option value="IN PROGRESS">In Progress</option>
                                <option value="DONE">Done</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="field">
                    <label class="label">Signed Status</label>
                    <div class="control">
                        <div class="select is-fullwidth">
                            <select id="signedStatusUpdate">
                                <option value="PENDING">Pending</option>
                                <option value="SIGNED">Signed</option>
                            </select>
                        </div>
                    </div>
                </div>
            </section>
            <footer class="modal-card-foot">
                <button class="button" onclick="this.closest('.modal').remove();">Cancel</button>
                <button class="button is-primary" onclick="updateEvaluationStatus()">Save Changes</button>
            </footer>
        </div>
    `;
    document.body.appendChild(modal);

    // Populate current values
    document.getElementById('evalStatusUpdate').value = currentEditingStudent.evalStatus;
    document.getElementById('signedStatusUpdate').value = currentEditingStudent.signedStatus;
}

function updateEvaluationStatus() {
    const evalStatus = document.getElementById('evalStatusUpdate').value;
    const signedStatus = document.getElementById('signedStatusUpdate').value;

    showConfirmDialog('Are you sure you want to update evaluation status?', function() {
        // Simulate API call
        console.log(`Simulating PUT /api/students/${currentEditingStudent.id}/status`, { evalStatus, signedStatus });
        currentEditingStudent.evalStatus = evalStatus;
        currentEditingStudent.signedStatus = signedStatus;
        showNotification('Evaluation status updated! (Simulated)', 'success');
        document.querySelector('.modal.is-active').remove(); // Close current modal
        updateStudentsTable();
    });
}

function showClaimDetailsModal() {
    const modal = document.createElement('div');
    modal.className = 'modal is-active';
    modal.innerHTML = `
        <div class="modal-background"></div>
        <div class="modal-card">
            <header class="modal-card-head">
                <p class="modal-card-title">Claim Details</p>
                <button class="delete" onclick="this.closest('.modal').remove();"></button>
            </header>
            <section class="modal-card-body">
                <p><strong>Student Name:</strong> ${currentEditingStudent.firstName} ${currentEditingStudent.lastName}</p>
                <p><strong>Document Status:</strong> Evaluated and Signed</p>
                <div class="field mt-4">
                    <label class="label">Claimed By (Name of person claiming)</label>
                    <div class="control">
                        <input class="input" type="text" id="claimedByInput" placeholder="Enter name">
                    </div>
                </div>
            </section>
            <footer class="modal-card-foot">
                <button class="button" onclick="this.closest('.modal').remove();">Cancel</button>
                <button class="button is-primary" onclick="updateClaimStatus()">Mark as Claimed</button>
            </footer>
        </div>
    `;
    document.body.appendChild(modal);
}

function updateClaimStatus() {
    const claimedBy = document.getElementById('claimedByInput').value;
    if (!claimedBy) {
        showNotification('Please enter the name of the person claiming.', 'warning');
        return;
    }

    showConfirmDialog('Are you sure you want to mark this record as claimed?', function() {
        // Simulate API call
        console.log(`Simulating PUT /api/students/${currentEditingStudent.id}/claimed`, { claimedBy });
        currentEditingStudent.claimedBy = claimedBy;
        showNotification('Record marked as claimed! (Simulated)', 'success');
        document.querySelector('.modal.is-active').remove(); // Close current modal
        updateStudentsTable();
    });
}

// Function to update the students table (mock data)
function updateStudentsTable() {
    const tableBody = document.querySelector('#studentsTable tbody');
    if (!tableBody) return;

    tableBody.innerHTML = ''; // Clear existing rows

    mockStudents.forEach(student => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${student.lastName}, ${student.firstName} ${student.middleName ? student.middleName[0] + '.' : ''}</td>
            <td>${student.publicComments}</td>
            <td>${student.privateComments}</td>
            <td>${getStatusBadge(student.evalStatus)}</td>
            <td>${getStatusBadge(student.signedStatus)}</td>
            <td><span class="tag is-info">${student.claimedBy}</span></td>
            <td>
                <div class="buttons are-small">
                    <button class="button is-info is-small" onclick="editStudent(${student.id})">
                        <span class="icon"><i class="fas fa-edit"></i></span>
                    </button>
                    <button class="button is-danger is-small" onclick="deleteStudent(${student.id})">
                        <span class="icon"><i class="fas fa-trash"></i></span>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Initialize search functionality and mock data display
document.addEventListener('DOMContentLoaded', function() {
    initializeSearch('searchInput', 'studentsTable');
    updateStudentsTable(); // Populate table with mock data on load
    
    // Status sort functionality
    const statusSort = document.getElementById('statusSort');
    if (statusSort) {
        statusSort.addEventListener('change', function() {
            const selectedStatus = this.value.toUpperCase();
            const rows = document.querySelectorAll('#studentsTable tbody tr');
            
            rows.forEach(row => {
                if (!selectedStatus) {
                    row.style.display = '';
                } else {
                    const statusCell = row.querySelector('.tag'); // Assuming status is in a tag
                    const status = statusCell ? statusCell.textContent.trim().toUpperCase() : '';
                    
                    if (status.includes(selectedStatus)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                }
            });
        });
    }
}); 