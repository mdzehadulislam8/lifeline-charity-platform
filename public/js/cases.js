// ====================================
// CASES PAGE - cases.html
// ====================================

let allCases = [];
let currentPage = 1;
const itemsPerPage = 9;

document.addEventListener('DOMContentLoaded', function () {
    loadCases();
    setupFilters();
});

async function loadCases() {
    const casesGrid = document.getElementById('casesGrid');
    
    if (!casesGrid) return;

    showLoader();

    // Mock data - will be replaced with API call
    const mockCases = [
        {
            id: '1',
            title: 'Child Heart Surgery Fund',
            condition: 'Congenital Heart Disease',
            description: 'Help save a 5-year-old child\'s life with urgent heart surgery',
            goalAmount: 500000,
            collectedAmount: 350000,
            status: 'approved',
            urgent: true,
            createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        },
        {
            id: '2',
            title: 'Cancer Treatment Support',
            condition: 'Advanced Cancer',
            description: 'Support aggressive cancer treatment for a young mother',
            goalAmount: 750000,
            collectedAmount: 520000,
            status: 'approved',
            urgent: true,
            createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
        },
        {
            id: '3',
            title: 'Emergency Surgery Fund',
            condition: 'Accident Recovery',
            description: 'Emergency funds needed for accident victim recovery',
            goalAmount: 300000,
            collectedAmount: 150000,
            status: 'pending',
            urgent: false,
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
        },
        {
            id: '4',
            title: 'Kidney Transplant Operation',
            condition: 'Kidney Failure',
            description: 'Life-saving kidney transplant operation needed',
            goalAmount: 600000,
            collectedAmount: 450000,
            status: 'approved',
            urgent: false,
            createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
        },
        {
            id: '5',
            title: 'Brain Tumor Surgery',
            condition: 'Brain Tumor',
            description: 'Critical brain tumor surgery in specialized hospital',
            goalAmount: 1000000,
            collectedAmount: 700000,
            status: 'approved',
            urgent: true,
            createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
        },
        {
            id: '6',
            title: 'Diabetic Complications Treatment',
            condition: 'Diabetes Complications',
            description: 'Treatment for severe diabetic complications',
            goalAmount: 250000,
            collectedAmount: 120000,
            status: 'approved',
            urgent: false,
            createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        },
        {
            id: '7',
            title: 'Burn Victim Recovery',
            condition: 'Severe Burns',
            description: 'Multiple surgeries needed for burn recovery',
            goalAmount: 400000,
            collectedAmount: 280000,
            status: 'pending',
            urgent: true,
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        },
        {
            id: '8',
            title: 'Premature Baby Care',
            condition: 'Premature Birth',
            description: 'NICU care for premature newborn',
            goalAmount: 350000,
            collectedAmount: 200000,
            status: 'approved',
            urgent: false,
            createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
        },
        {
            id: '9',
            title: 'Joint Replacement Surgery',
            condition: 'Arthritis',
            description: 'Urgent joint replacement surgery',
            goalAmount: 280000,
            collectedAmount: 180000,
            status: 'approved',
            urgent: false,
            createdAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000)
        }
    ];

    allCases = mockCases;
    hideLoader();
    displayCases(filterAndSortCases());
}

function filterAndSortCases() {
    const searchInput = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    const sortFilter = document.getElementById('sortFilter')?.value || 'recent';

    let filtered = allCases.filter(caseData => {
        const matchesSearch = caseData.title.toLowerCase().includes(searchInput) ||
                              caseData.condition.toLowerCase().includes(searchInput);
        const matchesStatus = !statusFilter || caseData.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    // Sort
    filtered.sort((a, b) => {
        switch (sortFilter) {
            case 'urgent':
                return (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0);
            case 'needed':
                const percentageA = (a.collectedAmount / a.goalAmount) * 100;
                const percentageB = (b.collectedAmount / b.goalAmount) * 100;
                return percentageA - percentageB;
            case 'recent':
            default:
                return new Date(b.createdAt) - new Date(a.createdAt);
        }
    });

    return filtered;
}

function displayCases(cases) {
    const casesGrid = document.getElementById('casesGrid');
    
    if (!casesGrid) return;

    if (cases.length === 0) {
        casesGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem;">No cases found</p>';
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    // Pagination
    const totalPages = Math.ceil(cases.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageCases = cases.slice(startIndex, endIndex);

    // Render cases
    casesGrid.innerHTML = '';
    pageCases.forEach(caseData => {
        const percentage = (caseData.collectedAmount / caseData.goalAmount) * 100;
        const caseCard = document.createElement('div');
        caseCard.className = 'case-card';
        caseCard.innerHTML = `
            <div class="case-card-header">
                <div>
                    <h3 class="case-card-title">${caseData.title}</h3>
                    <p class="case-condition">${caseData.condition}</p>
                </div>
                ${caseData.urgent ? '<span class="case-badge">Urgent</span>' : ''}
            </div>
            <div class="case-card-body">
                <p>${caseData.description}</p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
                <p class="progress-text">
                    <span>৳${formatCurrency(caseData.collectedAmount)}</span> of 
                    <span>৳${formatCurrency(caseData.goalAmount)}</span>
                </p>
                <div class="case-footer">
                    <span>${Math.round(percentage)}% Funded</span>
                    <a href="case-details.html?id=${caseData.id}">View Details →</a>
                </div>
            </div>
        `;
        casesGrid.appendChild(caseCard);
    });

    // Render pagination
    renderPagination(totalPages, cases.length);
}

function renderPagination(totalPages, totalItems) {
    const paginationContainer = document.getElementById('pagination');
    
    if (!paginationContainer) return;

    paginationContainer.innerHTML = '';

    if (totalPages <= 1) return;

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Previous';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayCases(filterAndSortCases());
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    paginationContainer.appendChild(prevBtn);

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.className = i === currentPage ? 'active' : '';
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            displayCases(filterAndSortCases());
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        paginationContainer.appendChild(pageBtn);
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next →';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            displayCases(filterAndSortCases());
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    paginationContainer.appendChild(nextBtn);
}

function setupFilters() {
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const sortFilter = document.getElementById('sortFilter');

    [searchInput, statusFilter, sortFilter].forEach(element => {
        if (element) {
            element.addEventListener('change', () => {
                currentPage = 1;
                displayCases(filterAndSortCases());
            });
        }
    });

    if (searchInput) {
        searchInput.addEventListener('keyup', () => {
            currentPage = 1;
            displayCases(filterAndSortCases());
        });
    }
}
