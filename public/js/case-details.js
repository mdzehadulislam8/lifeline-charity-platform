// ====================================
// CASE DETAILS PAGE - case-details.html
// ====================================

let caseId = null;
let caseData = null;

document.addEventListener('DOMContentLoaded', function () {
    caseId = getUrlParameter('id');
    
    if (!caseId) {
        showNotification('Case not found', 'error');
        setTimeout(() => window.location.href = '../pages/cases.html', 2000);
        return;
    }

    loadCaseDetails();
    setupDonationForm();
});

function getUrlParameter(name) {
    const url = new URLSearchParams(window.location.search);
    return url.get(name);
}

async function loadCaseDetails() {
    showLoader();

    // Mock data - will be replaced with API call
    const mockCaseData = {
        id: '1',
        title: 'Child Heart Surgery Fund',
        condition: 'Congenital Heart Disease',
        fullDescription: `
            <h3>About This Case</h3>
            <p>Ravi is a 5-year-old boy who was born with a critical heart condition that requires immediate surgical intervention. 
            Without this surgery, his life is at serious risk. His family has limited financial resources and is desperately seeking help.</p>
            
            <h3>Medical Details</h3>
            <p>The surgery requires specialized equipment and a team of experienced cardiologists. The procedure will take 6-8 hours 
            and requires a month-long hospital stay for recovery.</p>
            
            <h3>Financial Need</h3>
            <p>The total cost including surgery, hospital stay, medication, and post-operative care comes to ৳5,00,000. 
            The family can contribute ৳1,50,000 from their savings, leaving a gap of ৳3,50,000.</p>
            
            <h3>Medical Team Recommendation</h3>
            <p>"This surgery is critical and should be done as soon as possible. The child's condition is stable for now, 
            but any delay could be life-threatening." - Dr. Sharma, Pediatric Cardiologist</p>
        `,
        goalAmount: 500000,
        collectedAmount: 350000,
        status: 'approved',
        urgent: true,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        approvedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        patientName: 'Ravi Kumar',
        patientAge: 5,
        hospital: 'Apollo Hospitals, Delhi',
        adminNotes: 'Case verified by medical team. All documents submitted and approved.'
    };

    caseData = mockCaseData;
    hideLoader();
    displayCaseDetails();
    // loadDonors(); // Donor section hidden from display
}

function displayCaseDetails() {
    const caseContent = document.getElementById('caseContent');
    const percentage = (caseData.collectedAmount / caseData.goalAmount) * 100;

    caseContent.innerHTML = `
        <div class="case-header">
            <h1>${caseData.title}</h1>
            <p class="case-meta">
                <span class="badge ${caseData.status}">${caseData.status.toUpperCase()}</span>
                ${caseData.urgent ? '<span class="badge urgent">URGENT</span>' : ''}
            </p>
        </div>

        <div class="case-info-bar">
            <div class="info-item">
                <strong>Patient Name:</strong> ${caseData.patientName}
            </div>
            <div class="info-item">
                <strong>Age:</strong> ${caseData.patientAge} years
            </div>
            <div class="info-item">
                <strong>Hospital:</strong> ${caseData.hospital}
            </div>
        </div>

        <div class="case-description">
            ${caseData.fullDescription}
        </div>
    `;

    // Update sidebar
    document.getElementById('caseBreadcrumb').textContent = caseData.title;
    document.getElementById('progressFill').style.width = percentage + '%';
    document.getElementById('collectedAmount').textContent = '৳' + formatCurrency(caseData.collectedAmount);
    document.getElementById('goalAmount').textContent = '৳' + formatCurrency(caseData.goalAmount);
    document.getElementById('caseStatus').textContent = caseData.status.toUpperCase();
    document.getElementById('caseStatus').className = 'badge ' + caseData.status;
    document.getElementById('createdDate').textContent = formatDate(caseData.createdAt);
    document.getElementById('urgency').textContent = caseData.urgent ? '🔴 Urgent' : '🟢 Normal';
}

async function loadDonors() {
    // Mock donor data
    const mockDonors = [
        { name: 'Anonymous', amount: 50000, date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
        { name: 'Amit Kumar', amount: 25000, date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
        { name: 'Anonymous', amount: 100000, date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        { name: 'Priya Sharma', amount: 10000, date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
        { name: 'Rajesh Patel', amount: 75000, date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    ];

    const donorsList = document.getElementById('donorsList');
    
    donorsList.innerHTML = '';
    mockDonors.forEach(donor => {
        const donorItem = document.createElement('div');
        donorItem.className = 'donor-item';
        donorItem.innerHTML = `
            <div class="donor-name">${donor.name}</div>
            <div class="donor-amount">৳${formatCurrency(donor.amount)}</div>
            <div class="donor-date">${formatDate(donor.date)}</div>
        `;
        donorsList.appendChild(donorItem);
    });
}

function setupDonationForm() {
    const donationForm = document.getElementById('donationForm');
    const anonymousCheckbox = document.getElementById('anonymousDonation');
    const donorFields = document.getElementById('donorFields');

    if (anonymousCheckbox) {
        anonymousCheckbox.addEventListener('change', function () {
            donorFields.style.display = this.checked ? 'none' : 'block';
            const inputs = donorFields.querySelectorAll('input');
            inputs.forEach(input => input.required = !this.checked);
        });
    }

    if (donationForm) {
        donationForm.addEventListener('submit', handleDonation);
    }
}

function openDonateModal() {
    const modal = document.getElementById('donateModal');
    if (modal) {
        modal.classList.add('show');
    }
}

function closeDonateModal() {
    const modal = document.getElementById('donateModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

async function handleDonation(e) {
    e.preventDefault();

    const amount = document.getElementById('donationAmount').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    const isAnonymous = document.getElementById('anonymousDonation').checked;
    const donorName = document.getElementById('donorName').value;
    const donorEmail = document.getElementById('donorEmail').value;

    if (!amount || amount < 100) {
        showNotification('Minimum donation amount is ৳100', 'error');
        return;
    }

    if (!paymentMethod) {
        showNotification('Please select a payment method', 'error');
        return;
    }

    if (!isAnonymous && (!donorName || !donorEmail)) {
        showNotification('Please fill in your details', 'error');
        return;
    }

    showLoader();

    const donationData = {
        caseId: caseId,
        amount: parseFloat(amount),
        paymentMethod: paymentMethod,
        isAnonymous: isAnonymous,
        guestName: isAnonymous ? 'Anonymous' : donorName,
        guestEmail: isAnonymous ? '' : donorEmail
    };

    try {
        const response = await api.makeDonation(donationData);
        hideLoader();

        if (response && response.success) {
            showNotification('Thank you for your donation!', 'success');
            closeDonateModal();
            document.getElementById('donationForm').reset();
            
            // Reload case details to update collection
            setTimeout(() => {
                loadCaseDetails();
            }, 1500);
        } else {
            showNotification(response?.message || 'Donation failed', 'error');
        }
    } catch (error) {
        hideLoader();
        showNotification('Error processing donation: ' + error.message, 'error');
    }
}

// Close modal when clicking outside
window.addEventListener('click', function (e) {
    const modal = document.getElementById('donateModal');
    if (e.target === modal) {
        closeDonateModal();
    }
});
