// Main JavaScript functionality

// Modal Management
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
      modal.classList.add('is-active');
  }
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
      modal.classList.remove('is-active');
  }
}

// Confirmation Dialog
function showConfirmDialog(message, onConfirm) {
  const modal = document.getElementById('confirmModal');
  const messageEl = document.getElementById('confirmMessage');
  const confirmBtn = document.getElementById('confirmOk');
  const cancelBtn = document.getElementById('confirmCancel');
  
  messageEl.textContent = message;
  
  confirmBtn.onclick = () => {
      hideModal('confirmModal');
      onConfirm();
  };
  
  cancelBtn.onclick = () => {
      hideModal('confirmModal');
  };
  
  showModal('confirmModal');
}

// Close modals when clicking background or X
document.addEventListener('DOMContentLoaded', function() {
  // Close modal when clicking background
  document.querySelectorAll('.modal-background').forEach(bg => {
      bg.addEventListener('click', function() {
          this.closest('.modal').classList.remove('is-active');
      });
  });
  
  // Close modal when clicking X
  document.querySelectorAll('.modal .delete').forEach(deleteBtn => {
      deleteBtn.addEventListener('click', function() {
          this.closest('.modal').classList.remove('is-active');
      });
  });
  
  // Close modal with ESC key
  document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
          document.querySelectorAll('.modal.is-active').forEach(modal => {
              modal.classList.remove('is-active');
          });
      }
  });
});

// Notification System
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification is-${type}`;
  notification.innerHTML = `
      <button class="delete"></button>
      ${message}
  `;
  
  document.body.appendChild(notification);
  
  // Position notification
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.right = '20px';
  notification.style.zIndex = '9999';
  notification.style.maxWidth = '400px';

  // Auto remove after 5 seconds
  setTimeout(() => {
      if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
      }
  }, 5000);

  // Remove on click
  notification.querySelector('.delete').addEventListener('click', () => {
      if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
      }
  });
}

// API Helper Functions (Note: These will not work without a backend)
async function apiRequest(url, options = {}) {
  try {
    console.warn('API request functions are for backend integration and will not work in this standalone frontend.');
    // Simulate a successful response for now
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    return { success: true, message: 'Simulated API call success.' };
  } catch (error) {
    console.error('Simulated API call failed:', error);
    showNotification('An error occurred. (Simulated)', 'danger');
    return { success: false, message: 'Simulated API call failed.' };
  }
}

// Search functionality for tables
function initializeSearch(searchInputId, tableId) {
  const searchInput = document.getElementById(searchInputId);
  const table = document.getElementById(tableId);
  
  if (searchInput && table) {
      searchInput.addEventListener('input', function() {
          const searchTerm = this.value.toLowerCase();
          const rows = table.querySelectorAll('tbody tr');
          
          rows.forEach(row => {
              const text = row.textContent.toLowerCase();
              if (text.includes(searchTerm)) {
                  row.style.display = '';
              } else {
                  row.style.display = 'none';
              }
          });
      });
  }
}

// Date Formatting
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
  });
}

// Status Badge Helper
function getStatusBadge(status) {
  const statusMap = {
      'DONE': 'is-success',
      'PENDING': 'is-warning',
      'IN PROGRESS': 'is-info',
      'CANCELLED': 'is-danger'
  };
  
  const badgeClass = statusMap[status] || 'is-light';
  return `<span class="tag ${badgeClass}">${status}</span>`;
}

// Export functionality
function exportTableData(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) return;
  
  const rows = Array.from(table.querySelectorAll('tr'));
  const csvContent = rows.map(row => {
      const cells = Array.from(row.querySelectorAll('th, td'));
      return cells.map(cell => `"${cell.textContent.trim()}"`).join(',');
  }).join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'data.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showNotification('Table data exported successfully!', 'success');
}

// Basic form validation for required fields
function validateForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return true; // No form, assume valid

    let isValid = true;
    form.querySelectorAll('[required]').forEach(input => {
        if (!input.value.trim()) {
            input.classList.add('is-danger');
            isValid = false;
        } else {
            input.classList.remove('is-danger');
        }
    });
    return isValid;
}

// Logout functionality
function logout() {
    showConfirmDialog('Are you sure you want to logout?', function() {
        // Clear session token from localStorage
        localStorage.removeItem('sessionToken');
        
        // Show logout notification
        showNotification('Logged out successfully!', 'success');
        
        // Redirect to index page after a short delay
        setTimeout(() => {
            window.location.href = './index.html';
        }, 1000);
    });
} 