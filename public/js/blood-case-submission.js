// ====================================
// BLOOD CASE SUBMISSION SCRIPT
// ====================================

const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', () => {
    initializeForm();
    setMinDateTime();
});

function initializeForm() {
    const form = document.getElementById('bloodCaseForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
        form.addEventListener('reset', clearMessages);
    }
}

function setMinDateTime() {
    // Set minimum datetime to current time
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const minDateTime = now.toISOString().slice(0, 16);
    document.getElementById('dateNeededBy').min = minDateTime;
    
    // Set default value to 24 hours from now
    const defaultDate = new Date();
    defaultDate.setHours(defaultDate.getHours() + 24);
    defaultDate.setMinutes(defaultDate.getMinutes() - defaultDate.getTimezoneOffset());
    document.getElementById('dateNeededBy').value = defaultDate.toISOString().slice(0, 16);
}

function updateUrgencyBadge() {
    const urgency = document.getElementById('urgencyLevel').value;
    const badgeContainer = document.getElementById('urgencyBadge');
    
    if (!urgency) {
        badgeContainer.innerHTML = '';
        return;
    }
    
    const urgencyText = {
        'routine': 'Routine - Planned Surgery',
        'urgent': 'Urgent - Within 48 Hours',
        'critical': 'Critical - Emergency'
    };
    
    const urgencyClass = {
        'routine': 'urgency-routine',
        'urgent': 'urgency-urgent',
        'critical': 'urgency-critical'
    };
    
    badgeContainer.innerHTML = `<span class="urgency-badge ${urgencyClass[urgency]}">${urgencyText[urgency]}</span>`;
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    const originalText = submitText.textContent;
    
    try {
        // Validate form
        const form = document.getElementById('bloodCaseForm');
        if (!form.checkValidity()) {
            showError('Please fill out all required fields correctly');
            return;
        }
        
        // Get form data
        const formData = new FormData(form);
        const data = {
            bloodType: formData.get('bloodType'),
            rhFactor: formData.get('rhFactor'),
            unitsNeeded: parseInt(formData.get('unitsNeeded')),
            urgencyLevel: formData.get('urgencyLevel'),
            hospitalName: formData.get('hospitalName'),
            location: formData.get('location'),
            patientName: formData.get('patientName'),
            patientPhone: formData.get('patientPhone'),
            dateNeededBy: new Date(formData.get('dateNeededBy')).toISOString(),
            doctorRecommendation: formData.get('doctorRecommendation') || null
        };
        
        // Validate inputs
        if (!data.bloodType || !data.rhFactor) {
            showError('Please select blood type and RH factor');
            return;
        }
        
        if (data.unitsNeeded < 1 || data.unitsNeeded > 10) {
            showError('Units needed must be between 1 and 10');
            return;
        }
        
        if (!data.urgencyLevel) {
            showError('Please select urgency level');
            return;
        }
        
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
        submitText.innerHTML = '<span class="loading-spinner"></span>Submitting...';
        
        // Get token from localStorage
        const token = localStorage.getItem('authToken');
        if (!token) {
            showError('You must be logged in to submit a blood case');
            window.location.href = '../pages/login.html';
            return;
        }
        
        // Submit form
        const response = await fetch(`${API_BASE}/blood/case`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Failed to submit blood case');
        }
        
        // Show success message
        showSuccess(result.message || 'Blood case submitted successfully!');
        
        // Reset form
        form.reset();
        updateUrgencyBadge();
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
            window.location.href = 'patient-blood-case-dashboard.html';
        }, 2000);
        
    } catch (error) {
        console.error('Form submission error:', error);
        showError(error.message || 'Failed to submit blood case. Please try again.');
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
    localStorage.removeItem('currentUser');
    window.location.href = '../index.html';
}
