// Global variables
let currentSession = null;

// API base URL - change this if your backend runs on a different port
const API_BASE_URL = 'http://localhost:3000/api';

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    checkForTokenInURL();
    checkExistingSession();
});

/**
 * Check if there's a token in the URL (from Google OAuth redirect)
 */
function checkForTokenInURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');
    const welcome = urlParams.get('welcome');

    if (token) {
        // Store the session token
        localStorage.setItem('sessionToken', token);
        // Clean up the URL
        window.history.replaceState({}, document.title, window.location.pathname);
        // Validate the session
        validateSession(token, welcome === 'true');
    } else if (error) {
        showError(`Authentication failed: ${error}`);
        // Clean up the URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

/**
 * Check if there's an existing session in localStorage
 */
function checkExistingSession() {
    const token = localStorage.getItem('sessionToken');
    if (token) {
        validateSession(token);
    }
}

/**
 * Validate session with the backend
 */
async function validateSession(token, showWelcome = false) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/session/${token}`);
        const data = await response.json();

        if (data.success) {
            currentSession = data.session;
            updateUIForLoggedInUser();
            
            // Show welcome message for non-admin users who stay on index page
            if (showWelcome) {
                showSuccess(`Welcome, ${currentSession.email}! You are now logged in.`);
            }
        } else {
            // Invalid session, remove it
            localStorage.removeItem('sessionToken');
            updateUIForLoggedOutUser();
        }
    } catch (error) {
        console.error('Error validating session:', error);
        localStorage.removeItem('sessionToken');
        updateUIForLoggedOutUser();
    }
}

/**
 * Update UI for logged in user
 */
function updateUIForLoggedInUser() {
    const loginButton = document.querySelector('button[onclick="handleGoogleLogin()"]');
    if (loginButton && currentSession) {
        // Check if user has admin role for dashboard access
        const adminRoles = ['SystemAdministrator', 'UniversityRegistrar', 'Evaluator', 'StudentAssistant'];
        const hasAdminAccess = adminRoles.includes(currentSession.role);
        
        loginButton.innerHTML = `
            <img src="./assets/account.png" alt="Account">
            <span>${currentSession.email}</span>
            ${hasAdminAccess ? '<span onclick="goToDashboard()" style="margin-left: 10px; cursor: pointer; color: #3a53a4;">Dashboard</span>' : ''}
            <span onclick="handleLogout()" style="margin-left: 10px; cursor: pointer;">Logout</span>
        `;
        loginButton.onclick = null; // Remove the login handler
    }
}

/**
 * Update UI for logged out user
 */
function updateUIForLoggedOutUser() {
    const loginButton = document.querySelector('button');
    if (loginButton) {
        loginButton.innerHTML = `
            <img src="./assets/account.png" alt="Account">
            <span>Login</span>
        `;
        loginButton.onclick = handleGoogleLogin;
    }
}

/**
 * Handle Google login
 */
function handleGoogleLogin() {
    // Redirect to Google OAuth
    window.location.href = '/auth/google';
}

/**
 * Navigate to dashboard for admin users
 */
function goToDashboard() {
    const token = localStorage.getItem('sessionToken');
    if (token) {
        window.location.href = `/dashboard?token=${token}`;
    } else {
        showError('Session expired. Please log in again.');
        updateUIForLoggedOutUser();
    }
}

/**
 * Handle logout
 */
async function handleLogout() {
    try {
        const token = localStorage.getItem('sessionToken');
        if (token) {
            await fetch(`${API_BASE_URL}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sessionId: token })
            });
        }
    } catch (error) {
        console.error('Error during logout:', error);
    } finally {
        // Clear local session data regardless of API response
        localStorage.removeItem('sessionToken');
        currentSession = null;
        updateUIForLoggedOutUser();
    }
}

/**
 * Validate tracking code format
 */
function validateTrackingCode(input) {
    // Check for empty or whitespace-only input
    if (!input || input.trim() === '') {
        return {
            isValid: false,
            error: 'Invalid tracking code format',
            message: 'Please enter a tracking code. Use format: SURNAME_NUMBER'
        };
    }

    const trimmedInput = input.trim();

    // Check for multiple tracking codes
    const multipleCodePatterns = [',', ';', '\n', '|', '&'];
    for (const pattern of multipleCodePatterns) {
        if (trimmedInput.includes(pattern)) {
            return {
                isValid: false,
                error: 'Multiple tracking codes not allowed',
                message: 'Please enter only one tracking code at a time'
            };
        }
    }
    
    // Check if input contains spaces (which might indicate multiple codes)
    if (trimmedInput.includes(' ') && trimmedInput.split(' ').length > 1) {
        return {
            isValid: false,
            error: 'Multiple tracking codes not allowed', 
            message: 'Please enter only one tracking code at a time'
        };
    }

    // Check basic format - must contain exactly one underscore
    const underscoreCount = (trimmedInput.match(/_/g) || []).length;
    if (underscoreCount === 0) {
        return {
            isValid: false,
            error: 'Invalid tracking code format',
            message: 'Missing underscore separator. Use format: SURNAME_NUMBER'
        };
    }
    
    if (underscoreCount > 1) {
        return {
            isValid: false,
            error: 'Invalid tracking code format',
            message: 'Too many underscores. Use format: SURNAME_NUMBER'
        };
    }

    // Split by underscore
    const parts = trimmedInput.split('_');
    if (parts.length !== 2) {
        return {
            isValid: false,
            error: 'Invalid tracking code format',
            message: 'Please use format: SURNAME_NUMBER'
        };
    }

    const [surname, controlNumber] = parts;

    // Check for missing components
    if (!surname) {
        return {
            isValid: false,
            error: 'Invalid tracking code format',
            message: 'Missing surname. Use format: SURNAME_NUMBER'
        };
    }

    if (!controlNumber) {
        return {
            isValid: false,
            error: 'Invalid tracking code format',
            message: 'Missing control number. Use format: SURNAME_NUMBER'
        };
    }

    // Check minimum length requirements
    if (surname.length < 2) {
        return {
            isValid: false,
            error: 'Invalid tracking code format',
            message: 'Surname must be at least 2 characters long'
        };
    }

    if (controlNumber.length < 2) {
        return {
            isValid: false,
            error: 'Invalid tracking code format',
            message: 'Control number must be at least 2 digits long'
        };
    }

    // Check surname format - only letters allowed
    const surnamePattern = /^[A-Za-z]+$/;
    if (!surnamePattern.test(surname)) {
        return {
            isValid: false,
            error: 'Invalid tracking code format',
            message: 'Surname can only contain letters (A-Z). Use format: SURNAME_NUMBER'
        };
    }

    // Check control number format - only numbers allowed
    const controlNumberPattern = /^\d+$/;
    if (!controlNumberPattern.test(controlNumber)) {
        return {
            isValid: false,
            error: 'Invalid tracking code format',
            message: 'Control number can only contain digits (0-9). Use format: SURNAME_NUMBER'
        };
    }

    // Check for trailing special characters
    const specialCharPattern = /[!@#$%^&*()+=\[\]{}|\\:";'<>?,./]$/;
    if (specialCharPattern.test(trimmedInput)) {
        return {
            isValid: false,
            error: 'Invalid tracking code format',
            message: 'Remove special characters at the end. Use format: SURNAME_NUMBER'
        };
    }

    return {
        isValid: true,
        trackingCode: trimmedInput.toUpperCase()
    };
}

/**
 * Handle tracking search form submission
 */
function handleTrackingSearch(event) {
    event.preventDefault();
    
    const trackingCodeInput = document.getElementById('trackingCode');
    const trackingCode = trackingCodeInput.value.trim();

    // Clear any existing error message
    clearSearchError();

    // Validate tracking code format
    const validation = validateTrackingCode(trackingCode);
    if (!validation.isValid) {
        showSearchError(validation.message);
        return;
    }

    // Store the validated tracking code and redirect to tracking page
    localStorage.setItem('searchTrackingCode', validation.trackingCode);
    window.location.href = '/tracking';
}

/**
 * Show error message under the search form
 */
function showSearchError(message) {
    // Clear any existing error
    clearSearchError();
    
    // Find the form element
    const form = document.querySelector('form[onsubmit="handleTrackingSearch(event)"]');
    
    // Create error message element
    const errorDiv = document.createElement('div');
    errorDiv.id = 'search-error';
    errorDiv.style.cssText = 'position: absolute; text-align: center; color: #ff3860; font-size: 18px; font-weight: bold; width: 100%; margin-top: 10px; z-index: 100;';
    errorDiv.textContent = message;
    
    // Position it relative to the form
    form.style.position = 'relative';
    form.appendChild(errorDiv);
}

/**
 * Clear search error message
 */
function clearSearchError() {
    const existingError = document.getElementById('search-error');
    if (existingError) {
        existingError.remove();
    }
}

/**
 * Show error message
 */
function showError(message) {
    // Create a temporary error message element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'notification is-danger';
    errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1000; max-width: 400px;';
    errorDiv.innerHTML = `
        <button class="delete" onclick="this.parentElement.remove()"></button>
        ${message}
    `;
    
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 5000);
}

/**
 * Show success message
 */
function showSuccess(message) {
    // Create a temporary success message element
    const successDiv = document.createElement('div');
    successDiv.className = 'notification is-success';
    successDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1000; max-width: 400px;';
    successDiv.innerHTML = `
        <button class="delete" onclick="this.parentElement.remove()"></button>
        ${message}
    `;
    
    document.body.appendChild(successDiv);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (successDiv.parentElement) {
            successDiv.remove();
        }
    }, 3000);
}

// Make functions globally available
window.handleGoogleLogin = handleGoogleLogin;
window.handleTrackingSearch = handleTrackingSearch;
window.handleLogout = handleLogout; 