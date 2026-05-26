// ====================================
// BLOOD DONATION PAGE - blood-donation.html
// ====================================

document.addEventListener('DOMContentLoaded', function () {
    showQuickActionsForUser();
    loadBloodDonors();
    setupBloodFilters();
    setupBloodRequestForm();
});

function showQuickActionsForUser() {
    const quickActionsSection = document.getElementById('quickActionsSection');
    const posterLink = document.getElementById('posterLink');
    const donorDashboardLink = document.getElementById('donorDashboardLink');
    const requestHistoryLink = document.getElementById('requestHistoryLink');
    const caseSubmissionLink = document.getElementById('caseSubmissionLink');
    const caseDashboardLink = document.getElementById('caseDashboardLink');

    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (token) {
        try {
            const userData = JSON.parse(localStorage.getItem('user')) || JSON.parse(localStorage.getItem('currentUser'));
            quickActionsSection.style.display = 'block';

            if (userData && userData.user_type) {
                if (userData.user_type.includes('donor')) {
                    posterLink.style.display = 'inline-block';
                    donorDashboardLink.style.display = 'inline-block';
                }
                if (userData.user_type.includes('receiver') || userData.user_type.includes('patient')) {
                    requestHistoryLink.style.display = 'inline-block';
                    caseSubmissionLink.style.display = 'inline-block';
                    caseDashboardLink.style.display = 'inline-block';
                }
            } else {
                // Show all options if user data not available (authenticated users)
                posterLink.style.display = 'inline-block';
                donorDashboardLink.style.display = 'inline-block';
                caseSubmissionLink.style.display = 'inline-block';
                caseDashboardLink.style.display = 'inline-block';
                requestHistoryLink.style.display = 'inline-block';
            }
        } catch (error) {
            console.error('Error parsing user data:', error);
            // Show all options on error
            posterLink.style.display = 'inline-block';
            donorDashboardLink.style.display = 'inline-block';
            caseSubmissionLink.style.display = 'inline-block';
            caseDashboardLink.style.display = 'inline-block';
        }
    }
}

async function loadBloodDonors() {
    const donorsGrid = document.getElementById('donorsGrid');
    
    if (!donorsGrid) return;

    showLoader();

    try {
        const bloodType = document.getElementById('bloodTypeFilter')?.value || '';
        const location = document.getElementById('locationFilter')?.value || '';
        
        let url = '/api/blood/donors?limit=20';
        if (bloodType) url += `&bloodType=${bloodType}`;
        if (location) url += `&location=${location}`;

        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success && Array.isArray(result.data)) {
            window.allBloodDonors = result.data;
            hideLoader();
            displayBloodDonors(result.data);
        } else {
            throw new Error(result.message || 'Failed to load donors');
        }
    } catch (error) {
        console.error('Error loading donors:', error);
        hideLoader();
        donorsGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: red; padding: 2rem;">Error loading donors: ${error.message}</p>`;
    }
}

function filterBloodDonors(donors) {
    const bloodTypeFilter = document.getElementById('bloodTypeFilter')?.value || '';
    const locationFilter = document.getElementById('locationFilter')?.value.toLowerCase() || '';

    return donors.filter(donor => {
        const matchesBloodType = !bloodTypeFilter || `${donor.blood_type}${donor.rh_factor}` === bloodTypeFilter;
        const matchesLocation = !locationFilter || (donor.location && donor.location.toLowerCase().includes(locationFilter));
        return matchesBloodType && matchesLocation && donor.is_available;
    });
}

function displayBloodDonors(donors) {
    const donorsGrid = document.getElementById('donorsGrid');
    
    if (!donorsGrid) return;

    if (donors.length === 0) {
        donorsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem;">No available donors found</p>';
        return;
    }

    donorsGrid.innerHTML = '';
    donors.forEach(donor => {
        const donorCard = document.createElement('div');
        donorCard.className = 'donor-card';
        const fullBloodGroup = donor.full_blood_group || (donor.blood_type + donor.rh_factor);
        donorCard.innerHTML = `
            <div class="blood-badge">${fullBloodGroup}</div>
            <h4>${donor.username || 'Anonymous Donor'}</h4>
            <div class="donor-info">
                <strong>Location:</strong>
                <span>${donor.location || 'Not specified'}</span>
            </div>
            <div class="donor-info">
                <strong>Last Donated:</strong>
                <span>${donor.last_donation_date ? formatDate(donor.last_donation_date) : 'Recently'}</span>
            </div>
            <div class="donor-info">
                <strong>Status:</strong>
                <span style="color: ${donor.is_available ? '#27ae60' : '#e74c3c'}">
                    ${donor.is_available ? '✓ Available' : '✗ Not Available'}
                </span>
            </div>
            <button class="btn btn-primary" onclick="requestBloodFromDonor('${donor.blood_donor_id}', '${fullBloodGroup}')">
                <i class="fas fa-hand-holding-heart"></i> Request Blood
            </button>
        `;
        donorsGrid.appendChild(donorCard);
    });
}

function setupBloodFilters() {
    const bloodTypeFilter = document.getElementById('bloodTypeFilter');
    const locationFilter = document.getElementById('locationFilter');

    [bloodTypeFilter, locationFilter].forEach(element => {
        if (element) {
            element.addEventListener('change', () => {
                loadBloodDonors();
            });
        }
    });

    if (locationFilter) {
        locationFilter.addEventListener('keyup', () => {
            loadBloodDonors();
        });
    }
}

async function requestBloodFromDonor(bloodDonorId, bloodGroup) {
    if (!isUserLoggedIn()) {
        showNotification('Please login to request blood', 'warning');
        window.location.href = '/pages/login.html';
        return;
    }

    showLoader();

    try {
        // Get donor from already-loaded donors array
        const donor = window.allBloodDonors?.find(d => d.blood_donor_id === bloodDonorId);
        
        if (!donor) {
            hideLoader();
            showNotification('Donor not found', 'error');
            return;
        }

        const userData = JSON.parse(localStorage.getItem('user') || '{}');

        const response = await fetch('/api/blood/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                bloodDonorId: bloodDonorId,
                donorId: donor.donor_id,
                recipientId: userData.patient_id || null,
                bloodType: donor.blood_type,
                rhFactor: donor.rh_factor,
                units: 1,
                urgency: 'urgent',
                message: `Blood request for ${bloodGroup}`
            })
        });

        const result = await response.json();
        hideLoader();

        if (result.success) {
            showNotification('Blood request sent successfully! Donor will review your request.', 'success');
            loadBloodDonors(); // Reload list
        } else {
            showNotification(result.message || 'Failed to send request', 'error');
        }
    } catch (error) {
        hideLoader();
        console.error('Error:', error);
        showNotification('Error sending request: ' + error.message, 'error');
    }
}

function setupBloodRequestForm() {
    const bloodRequestForm = document.getElementById('bloodRequestForm');
    
    if (bloodRequestForm) {
        bloodRequestForm.addEventListener('submit', handleBloodRequest);
    }
}

async function handleBloodRequest(e) {
    e.preventDefault();

    if (!isUserLoggedIn()) {
        showNotification('Please login to submit a blood request', 'warning');
        window.location.href = '/pages/login.html';
        return;
    }

    const bloodType = document.getElementById('bloodTypeRequired').value;
    const units = document.getElementById('unitsRequired').value;
    const urgency = document.getElementById('urgencyLevel').value;
    const message = `Units needed: ${units}, Urgency: ${urgency}`;

    if (!bloodType || !units || !urgency) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    showLoader();

    try {
        // This would create a generic blood request (without a specific donor)
        // For now, we show available donors matching the blood type
        const response = await fetch(`/api/blood/donors?bloodType=${bloodType}`);
        const result = await response.json();
        hideLoader();

        if (result.success && result.data.length > 0) {
            showNotification(`Found ${result.data.length} available donor(s) for ${bloodType}. Please select one to request blood.`, 'success');
            // Scroll to donors section
            document.getElementById('donorsGrid').scrollIntoView({ behavior: 'smooth' });
            displayBloodDonors(result.data);
        } else {
            showNotification(`No available donors found for ${bloodType}. Please try again later.`, 'warning');
        }
    } catch (error) {
        hideLoader();
        showNotification('Error: ' + error.message, 'error');
    }
}
