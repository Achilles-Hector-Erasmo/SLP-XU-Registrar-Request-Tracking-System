// API base URL - change this if your backend runs on a different port
const API_BASE_URL = 'http://localhost:3000/api';

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    performSearch();
});

/**
 * Perform the tracking search
 */
async function performSearch() {
    const trackingCode = localStorage.getItem('searchTrackingCode');
    
    // If no tracking code, redirect back to search page
    if (!trackingCode) {
        window.location.href = '/';
        return;
    }

    // Clear the search code from localStorage
    localStorage.removeItem('searchTrackingCode');

    // Show loading state
    showLoading();

    try {
        const apiUrl = `${API_BASE_URL}/search/${encodeURIComponent(trackingCode)}`;
        console.log('Making API request to:', apiUrl);
        
        const response = await fetch(apiUrl);
        console.log('Response status:', response.status);
        
        const data = await response.json();
        console.log('Response data:', data);

        hideLoading();

        if (data.success) {
            displayResults(data.data);
        } else {
            // Display server-side errors (not format validation errors)
            displayNotFound(data.message || 'Tracking code does not exist in our system.');
        }
    } catch (error) {
        hideLoading();
        console.error('Search error:', error);
        displayNetworkError();
    }
}

/**
 * Show loading state
 */
function showLoading() {
    const loadingElement = document.getElementById('loading');
    const resultsContainer = document.getElementById('results-container');
    
    loadingElement.style.display = 'block';
    resultsContainer.style.display = 'none';
}

/**
 * Hide loading state
 */
function hideLoading() {
    const loadingElement = document.getElementById('loading');
    const resultsContainer = document.getElementById('results-container');
    
    loadingElement.style.display = 'none';
    resultsContainer.style.display = 'block';
}

/**
 * Display successful search results
 */
function displayResults(data) {
    const successResults = document.getElementById('success-results');
    const notFoundResults = document.getElementById('not-found-results');
    
    // Show success, hide not found
    successResults.style.display = 'block';
    notFoundResults.style.display = 'none';

    // Populate the result fields
    document.getElementById('tracking-code').textContent = data.trackingCode;
    document.getElementById('document-type').textContent = data.documentType;
    document.getElementById('date-requested').textContent = formatDate(data.dateRequested);

    // Set status badge
    const statusBadge = document.getElementById('status-badge');
    statusBadge.textContent = data.status;
    statusBadge.className = `status-badge ${getStatusClass(data.status)}`;

    // Generate processing stages
    generateProcessingStages(data.status);
}

/**
 * Display not found results
 */
function displayNotFound(message) {
    const successResults = document.getElementById('success-results');
    const notFoundResults = document.getElementById('not-found-results');
    
    // Hide success, show not found
    successResults.style.display = 'none';
    notFoundResults.style.display = 'block';

    // Update not found message
    document.getElementById('not-found-message').textContent = message;
}

/**
 * Display network error results
 */
function displayNetworkError() {
    const successResults = document.getElementById('success-results');
    const notFoundResults = document.getElementById('not-found-results');
    
    // Hide success, show not found with network error message
    successResults.style.display = 'none';
    notFoundResults.style.display = 'block';
    document.getElementById('not-found-message').textContent = 'Unable to connect to the server. Please check your internet connection and try again.';
}

/**
 * Get CSS class for status badge
 */
function getStatusClass(status) {
    switch (status.toLowerCase()) {
        case 'processing':
            return 'status-processing';
        case 'ready for pickup':
        case 'ready':
            return 'status-ready';
        case 'request received':
        case 'received':
            return 'status-received';
        default:
            return 'status-processing';
    }
}

/**
 * Generate processing stages based on current status
 */
function generateProcessingStages(currentStatus) {
    const stagesContainer = document.getElementById('stages-container');
    
    const stages = [
        { id: 'received', name: 'Request Received', description: 'Your request has been received and is in our system' },
        { id: 'processing', name: 'Processing', description: 'Your document is being prepared' },
        { id: 'ready', name: 'Ready for Pickup', description: 'Your document is ready for pickup at the Registrar\'s Office' }
    ];

    // Determine which stages are completed
    const statusMap = {
        'request received': ['received'],
        'processing': ['received', 'processing'],
        'ready for pickup': ['received', 'processing', 'ready'],
        'ready': ['received', 'processing', 'ready']
    };

    const completedStages = statusMap[currentStatus.toLowerCase()] || ['received'];

    // Generate HTML for stages
    stagesContainer.innerHTML = stages.map((stage, index) => {
        const isCompleted = completedStages.includes(stage.id);
        const stageNumber = index + 1;

        return `
            <div class="stage-item ${isCompleted ? 'completed' : ''}">
                <div class="stage-icon ${isCompleted ? 'completed' : 'pending'}">
                    ${isCompleted ? '✓' : stageNumber}
                </div>
                <div>
                    <div style="font-size: 1.25rem; font-weight: bold; color: #222; margin-bottom: 0.25rem;">${stage.name}</div>
                    <div style="font-size: 1.1rem; color: #222;">${stage.description}</div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Format date string for display
 */
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        return dateString; // Return original string if parsing fails
    }
}

 