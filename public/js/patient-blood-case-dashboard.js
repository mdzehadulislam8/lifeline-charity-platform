// ====================================
// PATIENT BLOOD CASE DASHBOARD SCRIPT
// ====================================

const API_BASE = '/api';
let allCases = [];
let currentTab = 'active';

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadCases();
});

function checkAuth() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = '../pages/login.html';
        return;
    }
}

async function loadCases() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            window.location.href = '../pages/login.html';
            return;
        }

        const response = await fetch(`${API_BASE}/blood/patient/cases`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load cases');
        }

        const result = await response.json();
        allCases = result.data || [];
        
        // Update statistics
        updateStatistics();
        
        // Display cases by tab
        displayActiveCases();
        displayResponses();
        displayCompletedCases();
        displayAllCases();
        
    } catch (error) {
        console.error('Load cases error:', error);
        showError('Failed to load your blood cases');
    }
}

function updateStatistics() {
    const activeCases = allCases.filter(c => c.case_status === 'open' || c.case_status === 'responded');
    const completedCases = allCases.filter(c => c.case_status === 'completed');
    
    let totalResponses = 0;
    allCases.forEach(c => {
        totalResponses += c.total_responses || 0;
    });
    
    document.getElementById('activeCasesCount').textContent = activeCases.length;
    document.getElementById('totalResponsesCount').textContent = totalResponses;
    document.getElementById('completedCasesCount').textContent = completedCases.length;
}

function displayActiveCases() {
    const container = document.getElementById('activeCases');
    const activeCases = allCases.filter(c => c.case_status === 'open' || c.case_status === 'responded');
    
    if (activeCases.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <h3>No Active Cases</h3>
                <p>You don't have any active blood case requests right now.</p>
                <a href="blood-case-submission.html" class="btn-primary">Submit New Case</a>
            </div>
        `;
        return;
    }
    
    container.innerHTML = activeCases.map(caseData => createCaseCard(caseData)).join('');
}

function displayResponses() {
    const container = document.getElementById('responsesContainer');
    const casesWithResponses = allCases.filter(c => c.total_responses > 0);
    
    if (casesWithResponses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No Responses Yet</h3>
                <p>When donors respond to your blood cases, you'll see them here.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    casesWithResponses.forEach(caseData => {
        html += `
            <div style="margin-bottom: 30px;">
                <div style="margin-bottom: 15px;">
                    <h3 style="color: #333; margin-bottom: 10px;">
                        Blood Type: <span style="color: #e74c3c; font-size: 24px; font-weight: bold;">${caseData.blood_type}${caseData.rh_factor}</span>
                    </h3>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <span class="case-status ${getStatusClass(caseData.case_status)}">${caseData.case_status}</span>
                        <span class="urgency-badge ${getUrgencyClass(caseData.urgency_level)}">${caseData.urgency_level}</span>
                    </div>
                </div>
                <div class="response-list">
                    ${caseData.donor_responses ? caseData.donor_responses.map(response => `
                        <div class="response-item">
                            <div class="response-header">
                                <div class="donor-name">${response.username}</div>
                                <span class="response-status ${getResponseStatusClass(response.response_status)}">${response.response_status}</span>
                            </div>
                            <div class="response-details">
                                📍 ${response.location} | 📞 ${response.phone_number}
                            </div>
                            <div class="response-details">
                                🩸 ${response.blood_type}${response.rh_factor} | ${formatDate(response.created_at)}
                            </div>
                            ${response.response_message ? `
                                <div class="response-message">${escapeHtml(response.response_message)}</div>
                            ` : ''}
                        </div>
                    `).join('') : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function displayCompletedCases() {
    const container = document.getElementById('completedCases');
    const completedCases = allCases.filter(c => c.case_status === 'completed');
    
    if (completedCases.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <h3>No Completed Cases</h3>
                <p>Once you receive blood and complete a case, it will appear here.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = completedCases.map(caseData => createCaseCard(caseData)).join('');
}

function displayAllCases() {
    const container = document.getElementById('allCases');
    
    if (allCases.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <h3>No Cases Yet</h3>
                <p>You haven't submitted any blood case requests yet.</p>
                <a href="blood-case-submission.html" class="btn-primary">Submit Your First Case</a>
            </div>
        `;
        return;
    }
    
    container.innerHTML = allCases.map(caseData => createCaseCard(caseData)).join('');
}

function createCaseCard(caseData) {
    const dateNeeded = new Date(caseData.date_needed_by);
    const createdDate = new Date(caseData.created_at);
    const isUrgent = caseData.urgency_level === 'critical' || caseData.urgency_level === 'urgent';
    
    return `
        <div class="case-card" onclick="expandCaseDetails('${caseData.case_id}')">
            <div class="case-header">
                <div class="blood-badge">${caseData.blood_type}${caseData.rh_factor}</div>
                <span class="case-status ${getStatusClass(caseData.case_status)}">${caseData.case_status}</span>
            </div>
            
            <span class="urgency-badge ${getUrgencyClass(caseData.urgency_level)}">${caseData.urgency_level}</span>
            
            <div class="case-info">
                <div class="info-item">
                    <span class="info-label">📍 Hospital:</span>
                    <span class="info-value">${caseData.hospital_name}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">📍 Location:</span>
                    <span class="info-value">${caseData.location}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">🩸 Units:</span>
                    <span class="info-value">${caseData.units_needed} units</span>
                </div>
                <div class="info-item">
                    <span class="info-label">⏰ Needed By:</span>
                    <span class="info-value">${formatDate(dateNeeded)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">📅 Submitted:</span>
                    <span class="info-value">${formatDate(createdDate)}</span>
                </div>
            </div>
            
            ${caseData.total_responses > 0 ? `
                <div class="donor-count">
                    <div class="donor-count-number">${caseData.total_responses}</div>
                    <div class="donor-count-label">Donor Response${caseData.total_responses !== 1 ? 's' : ''}</div>
                </div>
            ` : ''}
        </div>
    `;
}

function getStatusClass(status) {
    const classes = {
        'open': 'status-open',
        'responded': 'status-responded',
        'completed': 'status-completed',
        'cancelled': 'status-open'
    };
    return classes[status] || 'status-open';
}

function getUrgencyClass(urgency) {
    const classes = {
        'routine': 'urgency-routine',
        'urgent': 'urgency-urgent',
        'critical': 'urgency-critical'
    };
    return classes[urgency] || 'urgency-routine';
}

function getResponseStatusClass(status) {
    const classes = {
        'interested': 'status-interested',
        'accepted': 'status-accepted',
        'rejected': 'status-open',
        'completed': 'status-accepted'
    };
    return classes[status] || 'status-interested';
}

function switchTab(tab) {
    // Update active tab button
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const tabMap = {
        'active': 'activeTab',
        'responses': 'responsesTab',
        'completed': 'completedTab',
        'history': 'historyTab'
    };
    
    const tabId = tabMap[tab];
    if (document.getElementById(tabId)) {
        document.getElementById(tabId).classList.add('active');
    }
    
    currentTab = tab;
}

function expandCaseDetails(caseId) {
    const caseData = allCases.find(c => c.case_id === caseId);
    if (!caseData) return;
    
    // Show detailed view (in a real app, this could open a modal)
    console.log('Case details:', caseData);
    alert(`Case: ${caseData.blood_type}${caseData.rh_factor} at ${caseData.hospital_name}\n\nTotal Responses: ${caseData.total_responses}`);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
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

function showError(message) {
    const container = document.querySelector('.dashboard-container');
    if (container) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'background: #f8d7da; color: #721c24; padding: 15px; border-radius: 6px; margin-bottom: 20px;';
        errorDiv.textContent = '✗ ' + message;
        container.insertBefore(errorDiv, container.firstChild);
        
        setTimeout(() => errorDiv.remove(), 5000);
    }
}

// Logout function
function logout(event) {
    event.preventDefault();
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    window.location.href = '../index.html';
}
