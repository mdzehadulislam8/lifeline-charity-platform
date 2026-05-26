// ====================================
// BLOOD RECEIVER REQUEST HISTORY
// ====================================

let allRequests = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', function () {
    if (!isUserLoggedIn()) {
        window.location.href = '/pages/login.html';
        return;
    }

    loadRequestHistory();
});

async function loadRequestHistory() {
    const container = document.getElementById('historyContainer');
    container.innerHTML = '<div class="no-data"><i class="fas fa-spinner fa-spin"></i><p>Loading your requests...</p></div>';

    try {
        const response = await fetch('/api/blood/requests', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
            // Filter to only show requests made BY the current user (receiver)
            const userData = JSON.parse(localStorage.getItem('user'));
            allRequests = result.data;

            if (allRequests.length === 0) {
                container.innerHTML = `
                    <div class="no-data">
                        <i class="fas fa-inbox"></i>
                        <p>You haven't made any blood requests yet</p>
                        <a href="/pages/blood-donation.html" style="color: #d32f2f; text-decoration: none; font-weight: 600; margin-top: 1rem; display: inline-block;">
                            Browse Available Donors <i class="fas fa-arrow-right"></i>
                        </a>
                    </div>
                `;
                return;
            }

            // Update counts
            updateCounts();
            filterRequests('all');
        } else {
            container.innerHTML = '<div class="no-data">Error loading requests</div>';
        }
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = `<div class="no-data">Error loading requests: ${error.message}</div>`;
    }
}

function updateCounts() {
    const pending = allRequests.filter(r => r.request_status === 'pending').length;
    const accepted = allRequests.filter(r => r.request_status === 'accepted').length;
    const rejected = allRequests.filter(r => r.request_status === 'rejected').length;

    document.getElementById('allCount').textContent = allRequests.length;
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('acceptedCount').textContent = accepted;
    document.getElementById('rejectedCount').textContent = rejected;
}

function filterRequests(status) {
    currentFilter = status;

    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Filter requests
    let filtered = allRequests;
    if (status !== 'all') {
        filtered = allRequests.filter(r => r.request_status === status);
    }

    displayRequests(filtered);
}

function displayRequests(requests) {
    const container = document.getElementById('historyContainer');

    if (requests.length === 0) {
        container.innerHTML = `
            <div class="no-data">
                <i class="fas fa-inbox"></i>
                <p>No ${currentFilter} requests</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';

    requests.forEach(request => {
        const requestDate = new Date(request.donation_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const statusClass = request.request_status === 'pending' ? 'pending' :
            request.request_status === 'accepted' ? 'accepted' : 'rejected';

        const statusIcon = request.request_status === 'pending' ? 'fa-hourglass-half' :
            request.request_status === 'accepted' ? 'fa-check-circle' : 'fa-times-circle';

        const card = document.createElement('div');
        card.className = 'request-card';

        card.innerHTML = `
            <div class="request-header">
                <div>
                    <div class="request-status ${statusClass}">
                        <i class="fas ${statusIcon}"></i> ${request.request_status.charAt(0).toUpperCase() + request.request_status.slice(1)}
                    </div>
                </div>
                <small style="color: #6c757d;">${requestDate}</small>
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
                <strong>Notes</strong>
                ${request.notes || 'No additional notes'}
            </div>

            ${request.request_status === 'accepted' && request.donor_name ? `
            <div class="donor-contact">
                <strong><i class="fas fa-user-md"></i> Donor Information</strong>
                <div style="margin-top: 0.75rem;">
                    <strong>Name:</strong> ${request.donor_name || 'Anonymous'}
                </div>
                ${request.donor_phone ? `
                <div style="margin-top: 0.5rem;">
                    <strong>Contact:</strong>
                    <a href="tel:${request.donor_phone}">
                        <i class="fas fa-phone"></i> ${request.donor_phone}
                    </a>
                </div>
                ` : ''}
                <div style="margin-top: 0.5rem;">
                    <strong>Location:</strong>
                    ${request.location || 'Not specified'}
                </div>
            </div>
            ` : ''}
        `;

        container.appendChild(card);
    });
}

function isUserLoggedIn() {
    return !!localStorage.getItem('token');
}

// Show notification
function showNotification(message, type = 'info') {
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
