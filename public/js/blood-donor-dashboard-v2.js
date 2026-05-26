// ====================================
// DONOR DASHBOARD SCRIPT
// ====================================

const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadDonorData();
});

function checkAuth() {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) {
        window.location.href = '../pages/login.html';
        return;
    }
}

async function loadDonorData() {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) {
            window.location.href = '../pages/login.html';
            return;
        }

        // Get available donors (posts)
        const donorResponse = await fetch(`${API_BASE}/blood/donors?limit=100`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const donorData = donorResponse.ok ? await donorResponse.json() : { data: [] };

        // Get incoming requests
        const requestsResponse = await fetch(`${API_BASE}/blood/requests`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const requestsData = requestsResponse.ok ? await requestsResponse.json() : { data: [] };

        // Update statistics
        updateStatistics(donorData.data || [], requestsData.data || []);

        // Display data by tab
        displayDonorPosts(donorData.data || []);
        displayIncomingRequests(requestsData.data || []);
        displayDonationHistory(requestsData.data || []);

    } catch (error) {
        console.error('Load donor data error:', error);
        showError('Failed to load your dashboard data');
    }
}

function updateStatistics(posts, requests) {
    const activePosts = posts.filter(p => p.is_available).length;
    const completedDonations = requests.filter(r => r.request_status === 'accepted').length;

    document.getElementById('activePostsCount').textContent = activePosts;
    document.getElementById('incomingRequestsCount').textContent = requests.length;
    document.getElementById('completedDonationsCount').textContent = completedDonations;
}

function displayDonorPosts(posts) {
    const container = document.getElementById('postsContainer');

    if (posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <h3>No Active Posts</h3>
                <p>You haven't posted your blood availability yet.</p>
                <a href="blood-availability-poster.html" class="btn-primary">Post Your Blood Availability</a>
            </div>
        `;
        return;
    }

    container.innerHTML = posts.map(post => `
        <div class="post-card">
            <div class="post-header">
                <div class="blood-badge">${post.blood_type}${post.rh_factor}</div>
                <span class="availability-status ${post.is_available ? 'status-available' : 'status-unavailable'}">
                    ${post.is_available ? '✓ Available' : '✗ Unavailable'}
                </span>
            </div>

            <div class="post-info">
                <div class="info-item">
                    <span class="info-label">📍 Location:</span>
                    <span class="info-value">${post.location || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">🩸 Available Units:</span>
                    <span class="info-value">${post.available_units || 1} unit(s)</span>
                </div>
                <div class="info-item">
                    <span class="info-label">📅 Last Donation:</span>
                    <span class="info-value">${post.last_donation_date ? formatDate(post.last_donation_date) : 'Never'}</span>
                </div>
                ${post.health_conditions ? `
                <div class="info-item">
                    <span class="info-label">⚕️ Health Status:</span>
                    <span class="info-value">${post.health_conditions}</span>
                </div>
                ` : ''}
            </div>

            <div class="post-actions">
                <button class="btn-action btn-edit" onclick="editPost('${post.blood_donor_id}')">
                    Edit Post
                </button>
                <button class="btn-action btn-toggle ${!post.is_available ? 'inactive' : ''}" 
                    onclick="toggleAvailability('${post.blood_donor_id}', ${post.is_available})">
                    ${post.is_available ? 'Mark Unavailable' : 'Mark Available'}
                </button>
            </div>
        </div>
    `).join('');
}

function displayIncomingRequests(requests) {
    const container = document.getElementById('requestsContainer');

    const incomingRequests = requests.filter(r => r.request_status === 'pending');

    if (incomingRequests.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No Incoming Requests</h3>
                <p>You don't have any pending blood requests at the moment.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="requests-list">
            ${incomingRequests.map(request => `
                <div class="request-item">
                    <div class="request-info">
                        <div class="request-patient">
                            Patient: ${request.receiver_name || 'Anonymous'}
                        </div>
                        <div class="request-details">
                            📞 ${request.receiver_phone || 'N/A'} | 
                            🩸 ${request.blood_type}${request.rh_factor} | 
                            📊 ${request.units_donated} unit(s)
                        </div>
                        ${request.notes ? `
                        <div class="request-message">
                            ${escapeHtml(request.notes)}
                        </div>
                        ` : ''}
                    </div>
                    <div class="request-actions">
                        <button class="btn-small btn-accept" onclick="acceptRequest('${request.donation_id}')">
                            Accept
                        </button>
                        <button class="btn-small btn-reject" onclick="rejectRequest('${request.donation_id}')">
                            Reject
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function displayDonationHistory(requests) {
    const container = document.getElementById('historyContainer');

    const completedRequests = requests.filter(r => r.request_status === 'accepted');

    if (completedRequests.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No Donation History</h3>
                <p>You haven't completed any donations yet.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="requests-list">
            ${completedRequests.map(donation => `
                <div class="request-item">
                    <div class="request-info">
                        <div class="request-patient">
                            ✓ Donated to: ${donation.receiver_name || 'Anonymous'}
                        </div>
                        <div class="request-details">
                            📞 ${donation.receiver_phone || 'N/A'} | 
                            🩸 ${donation.blood_type}${donation.rh_factor} | 
                            📊 ${donation.units_donated} unit(s) | 
                            📅 ${formatDate(donation.donation_date)}
                        </div>
                        ${donation.notes ? `
                        <div class="request-message">
                            "${escapeHtml(donation.notes)}"
                        </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function acceptRequest(donationId) {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) {
            window.location.href = '../pages/login.html';
            return;
        }

        const response = await fetch(`${API_BASE}/blood/requests/${donationId}/accept`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to accept request');
        }

        showSuccess('Request accepted!');
        setTimeout(() => loadDonorData(), 1500);

    } catch (error) {
        console.error('Accept request error:', error);
        showError(error.message || 'Failed to accept request');
    }
}

async function rejectRequest(donationId) {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) {
            window.location.href = '../pages/login.html';
            return;
        }

        const response = await fetch(`${API_BASE}/blood/requests/${donationId}/reject`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to reject request');
        }

        showSuccess('Request rejected');
        setTimeout(() => loadDonorData(), 1500);

    } catch (error) {
        console.error('Reject request error:', error);
        showError(error.message || 'Failed to reject request');
    }
}

async function toggleAvailability(donorId, currentStatus) {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) {
            window.location.href = '../pages/login.html';
            return;
        }

        const response = await fetch(`${API_BASE}/blood/donor/${donorId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                isAvailable: !currentStatus
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to update availability');
        }

        showSuccess(`Availability updated!`);
        setTimeout(() => loadDonorData(), 1500);

    } catch (error) {
        console.error('Toggle availability error:', error);
        showError(error.message || 'Failed to update availability');
    }
}

function editPost(donorId) {
    // Redirect to edit page
    window.location.href = `blood-availability-poster.html?edit=${donorId}`;
}

function switchTab(tab) {
    // Update active button
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const tabMap = {
        'posts': 'postsTab',
        'requests': 'requestsTab',
        'history': 'historyTab'
    };

    if (document.getElementById(tabMap[tab])) {
        document.getElementById(tabMap[tab]).classList.add('active');
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function showSuccess(message) {
    const container = document.querySelector('.dashboard-container');
    if (container) {
        const successDiv = document.createElement('div');
        successDiv.style.cssText = 'background: #d4edda; color: #155724; padding: 15px; border-radius: 6px; margin-bottom: 20px; position: fixed; top: 20px; right: 20px; z-index: 1000; max-width: 300px;';
        successDiv.textContent = '✓ ' + message;
        document.body.appendChild(successDiv);

        setTimeout(() => successDiv.remove(), 3000);
    }
}

function showError(message) {
    const container = document.querySelector('.dashboard-container');
    if (container) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'background: #f8d7da; color: #721c24; padding: 15px; border-radius: 6px; margin-bottom: 20px; position: fixed; top: 20px; right: 20px; z-index: 1000; max-width: 300px;';
        errorDiv.textContent = '✗ ' + message;
        document.body.appendChild(errorDiv);

        setTimeout(() => errorDiv.remove(), 3000);
    }
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
