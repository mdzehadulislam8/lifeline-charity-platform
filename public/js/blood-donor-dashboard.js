// ====================================
// BLOOD DONOR DASHBOARD - blood-donor-dashboard.html
// ====================================

document.addEventListener('DOMContentLoaded', function () {
    if (!isUserLoggedIn()) {
        window.location.href = '/pages/login.html';
        return;
    }

    loadDashboardData();
    setupBloodPostForm();
});

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));

    // Show selected tab - handle multiple naming conventions
    let selectedTab = document.getElementById(tabName + 'Tab');
    if (!selectedTab) {
        selectedTab = document.getElementById(tabName + 'Content');
    }
    if (!selectedTab) {
        selectedTab = document.getElementById(tabName);
    }
    
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    // Mark button as active
    document.querySelectorAll('.tab-button').forEach(btn => {
        if (btn.onclick && btn.onclick.toString().includes(`'${tabName}'`)) {
            btn.classList.add('active');
        }
    });

    // Load tab-specific data
    if (tabName === 'requests' || tabName === 'incoming-requests') {
        loadIncomingRequests();
    } else if (tabName === 'history' || tabName === 'donation-history') {
        loadDonationHistory();
    }
}

async function loadDashboardData() {
    try {
        const userData = JSON.parse(localStorage.getItem('user'));
        if (userData && userData.user_type && userData.user_type.includes('donor')) {
            const bloodType = userData.blood_type || 'Not specified';
            document.getElementById('bloodTypeDisplay').value = bloodType;

            // Set today as minimum date
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('availableDate').min = today;
            document.getElementById('availableDate').value = today;
        }

        // Load incoming requests count
        loadRequestsCount();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

async function loadRequestsCount() {
    try {
        const response = await fetch('/api/blood/requests', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
            const pendingCount = result.data.filter(r => r.request_status === 'pending').length;
            document.getElementById('requestCount').textContent = pendingCount;
        }
    } catch (error) {
        console.error('Error loading request count:', error);
    }
}

async function loadIncomingRequests() {
    // Try both possible container IDs for compatibility
    const requestsList = document.getElementById('requestsContainer') || document.getElementById('requestsList');
    
    if (!requestsList) {
        console.error('No requests container found. Looking for #requestsContainer or #requestsList');
        return;
    }
    
    showLoader();

    try {
        const response = await fetch('/api/blood/requests', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || localStorage.getItem('authToken')}` }
        });
        const result = await response.json();
        hideLoader();

        if (result.success && Array.isArray(result.data)) {
            const pendingRequests = result.data.filter(r => r.request_status === 'pending');

            if (pendingRequests.length === 0) {
                requestsList.innerHTML = `
                    <div class="no-data">
                        <i class="fas fa-inbox" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                        <p>No pending requests</p>
                    </div>
                `;
                return;
            }

            requestsList.innerHTML = '';
            pendingRequests.forEach(request => {
                const requestCard = document.createElement('div');
                requestCard.className = 'request-card';
                const createdDate = new Date(request.donation_date).toLocaleDateString();

                requestCard.innerHTML = `
                    <div class="request-status pending">
                        <i class="fas fa-hourglass-half"></i> Pending
                    </div>

                    <div class="request-info">
                        <strong>Receiver</strong>
                        ${request.receiver_name || 'Anonymous'}
                    </div>

                    <div class="request-info">
                        <strong>Blood Type Needed</strong>
                        ${request.blood_type}${request.rh_factor}
                    </div>

                    <div class="request-info">
                        <strong>Units Required</strong>
                        ${request.units_donated || 1} unit(s)
                    </div>

                    <div class="request-info">
                        <strong>Requested On</strong>
                        ${createdDate}
                    </div>

                    <div class="request-info">
                        <strong>Message/Notes</strong>
                        ${request.notes || 'No additional notes'}
                    </div>

                    ${request.receiver_phone ? `
                    <div class="request-info">
                        <strong>Contact</strong>
                        <a href="tel:${request.receiver_phone}">${request.receiver_phone}</a>
                    </div>
                    ` : ''}

                    <div class="request-actions">
                        <button class="btn-accept" onclick="acceptBloodRequest('${request.donation_id}')">
                            <i class="fas fa-check"></i> Accept
                        </button>
                        <button class="btn-reject" onclick="rejectBloodRequest('${request.donation_id}')">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    </div>
                `;

                requestsList.appendChild(requestCard);
            });
        } else {
            requestsList.innerHTML = `<div class="no-data">Error loading requests</div>`;
        }
    } catch (error) {
        hideLoader();
        console.error('Error:', error);
        requestsList.innerHTML = `<div class="no-data">Error loading requests: ${error.message}</div>`;
    }
}

async function acceptBloodRequest(donationId) {
    if (!confirm('Accept this blood request?')) return;

    showLoader();

    try {
        const response = await fetch(`/api/blood/requests/${donationId}/accept`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        hideLoader();

        if (result.success) {
            showNotification('Request accepted! Your blood post is now unavailable.', 'success');
            loadRequestsCount();
            loadIncomingRequests();
            switchTab('create-post');
        } else {
            showNotification(result.message || 'Failed to accept request', 'error');
        }
    } catch (error) {
        hideLoader();
        console.error('Error:', error);
        showNotification('Error accepting request: ' + error.message, 'error');
    }
}

async function rejectBloodRequest(donationId) {
    if (!confirm('Reject this blood request?')) return;

    showLoader();

    try {
        const response = await fetch(`/api/blood/requests/${donationId}/reject`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        hideLoader();

        if (result.success) {
            showNotification('Request rejected.', 'success');
            loadRequestsCount();
            loadIncomingRequests();
        } else {
            showNotification(result.message || 'Failed to reject request', 'error');
        }
    } catch (error) {
        hideLoader();
        console.error('Error:', error);
        showNotification('Error rejecting request: ' + error.message, 'error');
    }
}

async function loadDonationHistory() {
    const historyList = document.getElementById('historyList');
    showLoader();

    try {
        const response = await fetch('/api/blood/requests', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await response.json();
        hideLoader();

        if (result.success && Array.isArray(result.data)) {
            const completedRequests = result.data.filter(r => r.request_status === 'accepted' || r.request_status === 'rejected');

            if (completedRequests.length === 0) {
                historyList.innerHTML = `
                    <div class="no-data">
                        <i class="fas fa-history" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                        <p>No donation history yet</p>
                    </div>
                `;
                return;
            }

            historyList.innerHTML = '';
            completedRequests.forEach(request => {
                const historyCard = document.createElement('div');
                historyCard.className = 'request-card';
                const createdDate = new Date(request.donation_date).toLocaleDateString();
                const statusClass = request.request_status === 'accepted' ? 'accepted' : 'rejected';
                const statusIcon = request.request_status === 'accepted' ? 'fa-check-circle' : 'fa-times-circle';

                historyCard.innerHTML = `
                    <div class="request-status ${statusClass}">
                        <i class="fas ${statusIcon}"></i> ${request.request_status.charAt(0).toUpperCase() + request.request_status.slice(1)}
                    </div>

                    <div class="request-info">
                        <strong>Receiver</strong>
                        ${request.receiver_name || 'Anonymous'}
                    </div>

                    <div class="request-info">
                        <strong>Blood Type</strong>
                        ${request.blood_type}${request.rh_factor}
                    </div>

                    <div class="request-info">
                        <strong>Date</strong>
                        ${createdDate}
                    </div>
                `;

                historyList.appendChild(historyCard);
            });
        }
    } catch (error) {
        hideLoader();
        console.error('Error:', error);
        historyList.innerHTML = `<div class="no-data">Error loading history</div>`;
    }
}

function setupBloodPostForm() {
    const form = document.getElementById('bloodPostForm');
    if (form) {
        form.addEventListener('submit', handleBloodPostSubmit);
    }
}

async function handleBloodPostSubmit(e) {
    e.preventDefault();

    const bloodType = document.getElementById('bloodTypeDisplay').value;
    const location = document.getElementById('location').value;
    const availableDate = document.getElementById('availableDate').value;
    const notes = document.getElementById('notes').value;

    if (!bloodType || !location || !availableDate) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    showLoader();

    try {
        const response = await fetch('/api/blood/register-donor', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                bloodType: bloodType,
                location: location,
                healthConditions: notes
            })
        });

        const result = await response.json();
        hideLoader();

        if (result.success) {
            showNotification('Blood availability post created successfully!', 'success');
            document.getElementById('bloodPostForm').reset();
            document.getElementById('postSuccess').style.display = 'block';

            // Hide success message after 5 seconds
            setTimeout(() => {
                document.getElementById('postSuccess').style.display = 'none';
            }, 5000);

            // Reload dashboard
            loadRequestsCount();
        } else {
            showNotification(result.message || 'Failed to create post', 'error');
        }
    } catch (error) {
        hideLoader();
        console.error('Error:', error);
        showNotification('Error creating post: ' + error.message, 'error');
    }
}

// Helper: Check if user is logged in
function isUserLoggedIn() {
    return !!localStorage.getItem('token');
}

// Helper: Show notification
function showNotification(message, type = 'info') {
    // Use built-in alert if notification system not available
    const notificationDiv = document.createElement('div');
    notificationDiv.className = `alert alert-${type}`;
    notificationDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
    `;

    if (type === 'success') {
        notificationDiv.style.backgroundColor = '#27ae60';
    } else if (type === 'error') {
        notificationDiv.style.backgroundColor = '#e74c3c';
    } else {
        notificationDiv.style.backgroundColor = '#3498db';
    }

    notificationDiv.textContent = message;
    document.body.appendChild(notificationDiv);

    setTimeout(() => {
        notificationDiv.remove();
    }, 3000);
}

// Helper: Show loader
function showLoader() {
    let loader = document.querySelector('.loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.className = 'loader';
        loader.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 9998;
            font-size: 1rem;
        `;
        document.body.appendChild(loader);
    }
    loader.style.display = 'block';
}

// Helper: Hide loader
function hideLoader() {
    const loader = document.querySelector('.loader');
    if (loader) loader.style.display = 'none';
}
