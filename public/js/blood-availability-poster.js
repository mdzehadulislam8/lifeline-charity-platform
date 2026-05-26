// ====================================
// BLOOD AVAILABILITY POSTER SCRIPT
// ====================================

const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', () => {
    initializeForm();
    checkAuth();
});

function checkAuth() {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) {
        window.location.href = '../pages/login.html';
        return;
    }
}

function initializeForm() {
    const form = document.getElementById('bloodPosterForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
        form.addEventListener('reset', clearMessages);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    const originalText = submitText.textContent;
    
    try {
        // Validate form
        const form = document.getElementById('bloodPosterForm');
        if (!form.checkValidity()) {
            showError('Please fill out all required fields');
            return;
        }

        // Get blood type and RH factor
        const bloodTypeValue = document.querySelector('input[name="bloodType"]:checked')?.value;
        const rhFactorValue = document.querySelector('input[name="rhFactor"]:checked')?.value;

        if (!bloodTypeValue || !rhFactorValue) {
            showError('Please select both blood type and RH factor');
            return;
        }

        // Get form data
        const formData = new FormData(form);
        
        // Get checked health conditions
        const conditionCheckboxes = document.querySelectorAll('input[name="conditions"]:checked');
        const healthConditions = Array.from(conditionCheckboxes).map(cb => cb.value).join(', ') || null;

        // Combine blood type and RH factor (O+ or A-, etc.)
        const fullBloodType = bloodTypeValue + rhFactorValue;

        const data = {
            bloodType: fullBloodType,
            location: formData.get('location'),
            healthConditions: healthConditions
        };

        // Validate inputs
        if (!data.location) {
            showError('Please enter your location');
            return;
        }

        if (data.availableUnits < 1 || data.availableUnits > 10) {
            showError('Available units must be between 1 and 10');
            return;
        }

        // Show loading state
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
        submitText.innerHTML = '<span class="loading-spinner"></span>Posting...';

        // Get token
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) {
            showError('You must be logged in to post blood availability');
            window.location.href = '../pages/login.html';
            return;
        }

        // Submit form
        const response = await fetch(`${API_BASE}/blood/register-donor`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Failed to post blood availability');
        }

        // Show success message
        showSuccess(result.message || 'Your blood availability has been posted successfully!');

        // Reset form
        form.reset();

        // Redirect to donor dashboard after 2 seconds
        setTimeout(() => {
            window.location.href = 'blood-donor-dashboard-updated.html';
        }, 2000);

    } catch (error) {
        console.error('Form submission error:', error);
        showError(error.message || 'Failed to post blood availability. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        submitText.textContent = originalText;
    }
}

function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    const errorDiv = document.getElementById('errorMessage');

    if (successDiv) {
        successDiv.textContent = '✓ ' + message;
        successDiv.style.display = 'block';
    }

    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');

    if (errorDiv) {
        errorDiv.textContent = '✗ ' + message;
        errorDiv.style.display = 'block';
    }

    if (successDiv) {
        successDiv.style.display = 'none';
    }
}

function clearMessages() {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');

    if (errorDiv) errorDiv.style.display = 'none';
    if (successDiv) successDiv.style.display = 'none';
}

// Logout function
function logout(event) {
    event.preventDefault();
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('user');
    window.location.href = '../index.html';
}
