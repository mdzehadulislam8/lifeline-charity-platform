// ====================================
// MAIN.JS - Global JavaScript Functions
// ====================================

let allCases = [];
let currentCategory = 'all';
let activeDonationCase = null;

// DOM Ready
document.addEventListener('DOMContentLoaded', function () {
    setupNavbar();
    setupUserAuth();
    loadFeaturedCases();
    setupEventListeners();
    setupDonationModal();
    renderGlobalFooter();
});

// Entrance animations: add 'in' class after small delay to animate elements
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
        document.querySelectorAll('.animate-fade-up').forEach(el => el.classList.add('in'));
        // stagger children if present
        document.querySelectorAll('.stagger').forEach(container => {
            container.classList.add('in');
            Array.from(container.children).forEach((child, i) => {
                child.style.transitionDelay = (i * 60) + 'ms';
            });
        });
        document.body.classList.add('site-loaded');
    }, 120);
});

// ====================================
// USER AUTHENTICATION SETUP
// ====================================

function setupUserAuth() {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');

    const navLogin = document.getElementById('nav-login');
    const navSignup = document.getElementById('nav-signup');
    const navUser = document.getElementById('nav-user');
    const userName = document.getElementById('user-name');

    if (user && token) {
        if (navLogin) navLogin.style.display = 'none';
        if (navSignup) navSignup.style.display = 'none';
        if (navUser) navUser.style.display = 'block';
        
        // Display user with avatar - Professional formatting
        if (userName) {
            // Format name: prefer firstName+lastName, then username, then email
            let displayName = 'User';
            if (user.firstName && user.lastName) {
                displayName = `${user.firstName} ${user.lastName}`;
            } else if (user.firstName) {
                displayName = user.firstName;
            } else if (user.username) {
                displayName = user.username;
            } else if (user.email) {
                displayName = user.email.split('@')[0];
            }
            
            const rawUserPhoto = user.photoPath;

            // Normalize any filesystem paths (Windows) to web paths
            let photoPath = null;
            if (rawUserPhoto) {
                try {
                    if (typeof rawUserPhoto === 'string' && /public[\\\/]uploads/i.test(rawUserPhoto)) {
                        const parts = rawUserPhoto.split(/public[\\\/]*/i);
                        const rel = parts.length > 1 ? parts[1].replace(/\\/g, '/') : rawUserPhoto.replace(/\\/g, '/');
                        photoPath = '/' + rel;
                    } else {
                        photoPath = rawUserPhoto;
                    }
                } catch (e) {
                    photoPath = rawUserPhoto;
                }
            }

            // Create avatar element with photo or initials
            let avatarHTML = '';
            if (photoPath) {
                avatarHTML = `<img src="${photoPath}" alt="${displayName}" class="user-avatar-img avatar-image" title="${displayName}" style="opacity: 1; transition: opacity 600ms ease-out;">`;
            } else {
                // Create initials avatar as fallback - professional style
                const names = displayName.split(' ');
                const initials = (names.map(n => n[0]).join('') || displayName.slice(0, 2)).toUpperCase().slice(0, 2);
                avatarHTML = `<span class="user-avatar-initials" title="${displayName}">${initials}</span>`;
            }
            
            // Get first name to display next to avatar
            // Try multiple fallback options for name
            let firstName = user.firstName;
            if (!firstName || firstName.trim() === '') {
                firstName = user.username || user.name || displayName || 'User';
            }
            
            console.log('User First Name:', firstName, 'Display Name:', displayName);
            
            // Set the name span
            const nameSpan = document.querySelector('#user-name');
            if (nameSpan) {
                nameSpan.textContent = firstName;
            }
            
            // Set the avatar in the user-avatar span
            const avatarSpan = document.querySelector('#nav-user .user-avatar');
            if (avatarSpan) {
                avatarSpan.innerHTML = avatarHTML;
            }
        }
        
        // Show role-specific menu items
        updateRoleBasedMenu(user.userType);
        // If admin, ensure there's a prominent Admin Dashboard link in the top nav
        try {
            if (user.userType === 'admin') {
                const navMenuList = document.querySelector('.nav-menu');
                if (navMenuList && !navMenuList.querySelector('a[href="admin-dashboard.html"]')) {
                    const li = document.createElement('li');
                    li.innerHTML = `<a href="admin-dashboard.html">Admin Dashboard</a>`;
                    navMenuList.appendChild(li);
                }
            }
        } catch (e) { /* ignore DOM issues */ }
        // Hide top-level "My Cases" / patient dashboard link for donors
        try {
            document.querySelectorAll('.nav-menu a').forEach(link => {
                const href = (link.getAttribute('href') || '').toLowerCase();
                if (href.includes('patient-dashboard.html') || href.includes('/patient-dashboard')) {
                    if (user.userType === 'donor') {
                        link.style.display = 'none';
                    } else {
                        link.style.display = 'inline-block';
                    }
                }
            });
        } catch (e) { /* ignore DOM errors */ }
    } else {
        if (navLogin) navLogin.style.display = 'block';
        if (navSignup) navSignup.style.display = 'block';
        if (navUser) navUser.style.display = 'none';
    }
}

// Admin delete case
async function deleteCaseAdmin(caseId) {
    if (!confirm('Are you sure you want to permanently delete this case? This cannot be undone.')) return;
    try {
        const res = await fetch(`/api/admin/cases/${caseId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        alert('Case deleted');
        // Refresh the list
        if (typeof loadPublishedCases === 'function') loadPublishedCases();
        else location.reload();
    } catch (err) {
        console.error(err);
        alert('Failed to delete case');
    }
}

function updateRoleBasedMenu(userType) {
    const userMenu = document.getElementById('user-menu');
    if (!userMenu) return;
    
    // Get all menu links
    const allLinks = userMenu.querySelectorAll('a');
    
    allLinks.forEach(link => {
        const href = (link.getAttribute('href') || '').toLowerCase();
        const isLogout = (link.getAttribute('onclick') || '').includes('logout');
        const isProfile = href === 'pages/profile.html' || href === '/pages/profile.html';

        // Always show logout and profile
        if (isLogout || isProfile) {
            link.style.display = 'block';
            return;
        }

        // Role-specific visibility
        if (userType === 'patient') {
            // Patients can submit cases
            if (href.includes('submission.html')) link.style.display = 'block';
            else link.style.display = 'none';
        } else if (userType === 'doctor') {
            // Doctors see the Lifeline Charity Team dashboard
            if (href.includes('lifeline-charity-team-dashboard.html')) link.style.display = 'block';
            else link.style.display = 'none';
        } else if (userType === 'admin') {
            // Admins should see both doctor and admin dashboards for management
            if (href.includes('admin-dashboard.html') || href.includes('lifeline-charity-team-dashboard.html')) {
                link.style.display = 'block';
            } else {
                link.style.display = 'none';
            }
        } else {
            // Default: hide role-specific links
            link.style.display = 'none';
        }
    });
}

// ====================================
// NAVBAR FUNCTIONALITY
// ====================================

function setupNavbar() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');
    const navbar = document.querySelector('.navbar');
    const logo = document.querySelector('.logo');

    function closeMenu() {
        if (navMenu) navMenu.classList.remove('active');
        if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
        if (hamburger) hamburger.classList.remove('open');
    }

    if (hamburger && navMenu) {
        // Toggle mobile menu
        hamburger.setAttribute('role', 'button');
        hamburger.setAttribute('aria-controls', 'navMenu');
        hamburger.setAttribute('aria-expanded', 'false');

        hamburger.addEventListener('click', function (e) {
            const isActive = navMenu.classList.toggle('active');
            hamburger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
            hamburger.classList.toggle('open');
        });

        // Close menu when a link is clicked
        const navLinks = navMenu.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', function () {
                closeMenu();
            });
        });

        // Close on Escape
        document.addEventListener('keydown', function (ev) {
            if (ev.key === 'Escape') closeMenu();
        });

        // Close menu when clicking outside
        document.addEventListener('click', function (event) {
            if (!event.target.closest('.navbar')) {
                closeMenu();
            }
        });
    }

    // Scroll behaviour: add compact glass effect
    function onScroll() {
        const y = window.scrollY || window.pageYOffset;
        if (navbar) {
            if (y > 18) {
                navbar.classList.add('scrolled');
                if (logo) logo.style.transform = 'scale(0.96)';
            } else {
                navbar.classList.remove('scrolled');
                if (logo) logo.style.transform = '';
            }
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Set active nav item (keeps previous behaviour)
    const currentLocation = location.pathname.replace(/\\/g, '/');
    const navLinks = document.querySelectorAll('.nav-menu a');
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        // Normalize simple cases
        const normalizedHref = href.replace(/\\/g, '/');
        if (normalizedHref === currentLocation || (normalizedHref === '/' && (currentLocation === '/index.html' || currentLocation === '/'))) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// THEME (dark / light)
function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'dark') {
        root.setAttribute('data-theme', 'dark');
    } else {
        root.removeAttribute('data-theme');
    }
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        themeBtn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    }
}

function initThemeToggle() {
    const saved = localStorage.getItem('theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(saved === 'dark' ? 'dark' : 'light');

    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    toggle.addEventListener('click', function () {
        const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem('theme', next);
    });
}

// Initialize theme toggle early
document.addEventListener('DOMContentLoaded', function () {
    initThemeToggle();
});

// ====================================
// USER MENU
// ====================================

function showUserMenu(e) {
    e.preventDefault();
    const userMenu = document.getElementById('user-menu');
    if (userMenu) {
        userMenu.style.display = userMenu.style.display === 'none' ? 'block' : 'none';
    }
}

function logout(e) {
    e.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// ====================================
// FEATURED CASES LOADING
// ====================================

function loadFeaturedCases() {
    const categoryCasesContainer = document.getElementById('categoryCases');
    
    if (!categoryCasesContainer) return;

    // Fetch approved cases from API
    fetch('/api/cases?limit=50')
        .then(response => response.json())
        .then(result => {
            if (result.success && Array.isArray(result.data)) {
                allCases = result.data;
                renderCases(allCases);
            }
        })
        .catch(error => {
            console.error('Error loading cases:', error);
            categoryCasesContainer.innerHTML = '<p>Error loading cases. Please try again later.</p>';
        });
}

function filterCategory(category, buttonEl = null) {
    currentCategory = category;

    // Update active button
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (buttonEl) {
        buttonEl.classList.add('active');
    }

    // Filter and render cases
    let filteredCases = allCases;
    if (category !== 'all') {
        filteredCases = allCases.filter(c => c.category === category);
    }

    renderCases(filteredCases);
}

function renderCases(cases) {
    const container = document.getElementById('categoryCases');
    if (!container) return;

    if (cases.length === 0) {
        container.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">No cases found in this category.</p>';
        return;
    }

    container.innerHTML = cases.map((caseData, index) => {
        // Prefer authoritative donated total (sum of DONATIONS), fallback to collected_amount column
        const collected = Number(caseData.donated_total ?? caseData.collected_amount ?? 0) || 0;
        const goal = Number(caseData.goal_amount ?? 1) || 1;
        const percentage = Math.min(100, (collected / goal) * 100);
        const patientName = [caseData.first_name, caseData.last_name].filter(Boolean).join(' ') || 'Patient';
        const condition = caseData.medical_condition || caseData.category || 'Healthcare';
        const currentCondition = caseData.current_condition || 'Treatment ongoing';
        // Prefer a case-specific image if available; fall back to patient profile photo
        const rawPhoto = caseData.case_image_path || caseData.photo_path;
        
        // Normalize file-system paths (Windows absolute paths that include 'public') to web paths
        let photoPath = null;
        if (rawPhoto && !/default-patient\.jpg/i.test(rawPhoto)) {
            try {
                if (typeof rawPhoto === 'string' && /public[\\\/]uploads/i.test(rawPhoto)) {
                    const parts = rawPhoto.split(/public[\\\/]/i);
                    const rel = parts.length > 1 ? parts[1].replace(/\\/g, '/') : rawPhoto.replace(/\\/g, '/');
                    photoPath = '/' + rel;
                } else {
                    photoPath = rawPhoto;
                }
            } catch (e) {
                photoPath = rawPhoto;
            }
        }
        
        const imageHtml = photoPath 
            ? `<img src="${photoPath}" alt="Patient" class="case-image" onerror="this.style.display='none'">`
            : `<div class="case-image-placeholder">👤</div>`;
        
        const caseId = caseData.case_id || caseData.id || caseData.caseId;
        const caseTitle = caseData.case_title || 'Healthcare Case';
        const cardId = `case-card-${caseId}`;
        
        return `
            <div class="case-card professional-card" id="${cardId}" style="animation-delay: ${index * 100}ms;">
                <!-- Image Section -->
                <div class="case-card-image-container">
                    ${imageHtml}
                    ${caseData.is_urgent ? '<div class="case-urgent-badge">Urgent</div>' : ''}
                </div>
                
                <!-- Content Section -->
                <div class="case-card-content">
                    <!-- Patient Name -->
                    <h3 class="case-patient-name">${patientName}</h3>
                    
                    <!-- Progress Bar -->
                    <div class="progress-bar-container">
                        <div class="progress-bar" role="progressbar" aria-label="Fundraising progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percentage)}">
                            <div class="progress-fill" style="width: ${percentage}%"></div>
                        </div>
                    </div>
                    
                    <!-- Amount Info -->
                    <div class="case-amount-info">
                        <span class="amount-text">৳${formatCurrency(collected)} / ৳${formatCurrency(goal)}</span>
                        <span class="percentage-text">${Math.round(percentage)}%</span>
                    </div>
                    
                    <!-- Buttons -->
                    <div class="case-actions-footer">
                        <button class="btn btn-donate donate-btn" data-case-id="${caseId}" data-case-title="${caseTitle}" data-patient-name="${patientName}">Donate</button>
                        <a href="patient-details.html?case=${caseId}" class="btn btn-info">Info</a>
                    </div>
                </div>
                
                <!-- Hidden Details (for modal/expanded view) -->
                <div class="case-card-details" id="details-${caseId}" style="display: none;">
                    <p class="case-current-condition"><strong>Status:</strong> ${currentCondition}</p>
                    <div class="case-info-grid">
                        <div class="case-info-box">
                            <div class="case-info-label">Paid</div>
                            <div class="case-info-value">৳${formatCurrency(collected)}</div>
                        </div>
                        <div class="case-info-box">
                            <div class="case-info-label">Remaining</div>
                            <div class="case-info-value">৳${formatCurrency(Math.max(0, goal - collected))}</div>
                        </div>
                        <div class="case-info-box">
                            <div class="case-info-label">Donors</div>
                            <div class="case-info-value">${caseData.donor_count || 0}</div>
                        </div>
                    </div>
                    <div id="donors-list-${caseId}" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e0e0e0;">
                        <div style="font-size: 0.9rem; font-weight: 600; margin-bottom: 0.75rem; color: #2c3e50;">Recent Donors</div>
                        <div id="donors-container-${caseId}" style="max-height: 180px; overflow-y: auto;">
                            <div style="font-size: 0.8rem; color: #999;">Loading donors...</div>
                        </div>
                    </div>
                </div>
            </div>
            </div>
        `;
    }).join('');

    attachDonationButtons();
}

function toggleCaseDetails(caseId) {
    const detailsElement = document.getElementById(`details-${caseId}`);
    const cardElement = document.getElementById(`case-card-${caseId}`);
    const detailsButton = cardElement.querySelector('.btn-details');
    const detailsText = detailsButton ? detailsButton.querySelector('.details-text') : null;
    const chevron = detailsButton ? detailsButton.querySelector('i') : null;
    
    // Close all other expanded cards
    document.querySelectorAll('.case-card-expanded').forEach(expandedCard => {
        if (expandedCard.id !== `case-card-${caseId}`) {
            const otherDetailsId = expandedCard.id.replace('case-card-', 'details-');
            const otherDetails = document.getElementById(otherDetailsId);
            const otherButton = expandedCard.querySelector('.btn-details');
            const otherText = otherButton ? otherButton.querySelector('.details-text') : null;
            const otherChevron = otherButton ? otherButton.querySelector('i') : null;
            
            if (otherDetails) otherDetails.style.display = 'none';
            expandedCard.classList.remove('case-card-expanded');
            if (otherText) otherText.textContent = 'Show Details';
            if (otherChevron) otherChevron.style.transform = 'rotate(0deg)';
        }
    });
    
    // Toggle current card
    if (detailsElement.style.display === 'none' || detailsElement.style.display === '') {
        detailsElement.style.display = 'block';
        cardElement.classList.add('case-card-expanded');
        if (detailsText) detailsText.textContent = 'Hide Details';
        if (chevron) chevron.style.transform = 'rotate(180deg)';
        
        // Load donors when expanding
        loadCaseDonorsForCard(caseId);
    } else {
        detailsElement.style.display = 'none';
        cardElement.classList.remove('case-card-expanded');
        if (detailsText) detailsText.textContent = 'Show Details';
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
}

// Load and display donors for a case in the card details
async function loadCaseDonorsForCard(caseId) {
    try {
        const container = document.getElementById(`donors-container-${caseId}`);
        if (!container) return;
        
        const response = await fetch(`/api/donations?caseId=${caseId}`);
        if (!response.ok) throw new Error('Failed to load donors');
        
        const payload = await response.json();
        const donors = (payload && payload.data) ? payload.data : [];
        
        if (!donors || donors.length === 0) {
            container.innerHTML = '<div style="font-size: 0.8rem; color: #999;">No donations yet</div>';
            return;
        }
        
        // Get top 5 recent donors
        const topDonors = donors.slice(0, 5);
        
        const donorsHTML = topDonors.map(donor => {
            const name = donor.is_anonymous ? 'Anonymous' : (donor.guest_name || donor.donor_name || 'Donor');
            const amount = donor.amount || donor.total_amount || 0;
            const tier = getDonorTier(amount);
            const tierIcon = getTierIcon(tier);
            
            return `
                <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0; border-bottom: 1px solid #f0f0f0; font-size: 0.8rem;">
                    <span style="font-size: 1.1rem;">${tierIcon}</span>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 500; color: #2c3e50; word-break: break-word;">${name}</div>
                        <div style="font-size: 0.75rem; color: #7f8c8d;">${tier}</div>
                    </div>
                    <div style="color: #28a745; font-weight: 600; white-space: nowrap;">৳${formatCurrency(amount)}</div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = donorsHTML;
    } catch (err) {
        console.warn('Failed to load donors for card:', err);
        const container = document.getElementById(`donors-container-${caseId}`);
        if (container) {
            container.innerHTML = '<div style="font-size: 0.8rem; color: #999;">Unable to load donors</div>';
        }
    }
}

// Determine donor tier based on amount
function getDonorTier(amount) {
    if (amount >= 50000) return 'Platinum Donor';
    if (amount >= 25000) return 'Gold Donor';
    if (amount >= 10000) return 'Silver Donor';
    if (amount >= 5000) return 'Bronze Donor';
    return 'Helper';
}

// Get tier icon emoji
function getTierIcon(tier) {
    const icons = {
        'Platinum Donor': '💎',
        'Gold Donor': '🥇',
        'Silver Donor': '🥈',
        'Bronze Donor': '🥉',
        'Helper': '❤️'
    };
    return icons[tier] || '❤️';
}

// ====================================
// UTILITY FUNCTIONS
// ====================================

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-BD', {
        style: 'currency',
        currency: 'BDT',
        minimumFractionDigits: 0
    }).format(amount).replace('৳', '').trim();
}

function formatDate(date) {
    return new Intl.DateTimeFormat('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(new Date(date));
}

function showNotification(message, type = 'success') {
    // Remove existing notifications of same type to prevent overlap
    document.querySelectorAll(`.notification-${type}`).forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.setAttribute('role', 'alert');
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.3rem;">${
                type === 'success' ? '✓' : 
                type === 'error' ? '✕' : 
                type === 'warning' ? '⚠' : 'ℹ'
            }</span>
            <span>${message}</span>
        </div>
    `;
    
    const bgColor = type === 'success' ? '#27ae60' : 
                   type === 'error' ? '#e74c3c' : 
                   type === 'warning' ? '#f39c12' : '#3498db';
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 500px;
        width: calc(100% - 40px);
        padding: 16px 20px;
        background-color: ${bgColor};
        color: white;
        border-radius: 8px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.25);
        z-index: 9999;
        animation: slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        font-weight: 500;
        border-left: 5px solid rgba(255,255,255,0.3);
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

function showLoader() {
    const loader = document.createElement('div');
    loader.id = 'pageLoader';
    loader.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9998;
    `;
    loader.innerHTML = `
        <div style="
            width: 50px;
            height: 50px;
            border: 4px solid rgba(255,255,255,0.3);
            border-top: 4px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        "></div>
    `;
    document.body.appendChild(loader);
}

function hideLoader() {
    const loader = document.getElementById('pageLoader');
    if (loader) loader.remove();
}

// ====================================
// API FUNCTIONS
// ====================================

class APIClient {
    constructor(baseURL = '/api') {
        // Use relative API base so frontend works regardless of dev port or proxy
        this.baseURL = baseURL;
        this.token = localStorage.getItem('authToken') || localStorage.getItem('token');
    }

    setToken(token) {
        this.token = token;
        // Save token under both keys for backward compatibility
        try {
            localStorage.setItem('authToken', token);
            localStorage.setItem('token', token);
        } catch (e) {
            console.warn('Failed to save token to localStorage', e);
        }
    }

    getToken() {
        return this.token;
    }

    clearToken() {
        this.token = null;
        try {
            localStorage.removeItem('authToken');
            localStorage.removeItem('token');
        } catch (e) {}
    }

    async request(endpoint, method = 'GET', data = null, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const showErrors = options.showErrors !== false; // Default to true
        const fetchOptions = {
            method
        };

        if (this.token) {
            if (!fetchOptions.headers) fetchOptions.headers = {};
            fetchOptions.headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (data && (method === 'POST' || method === 'PUT')) {
            // Check if data is FormData (for file uploads)
            if (data instanceof FormData) {
                // Don't set Content-Type header; browser will set it with boundary
                fetchOptions.body = data;
            } else {
                // Regular JSON data
                if (!fetchOptions.headers) fetchOptions.headers = {};
                fetchOptions.headers['Content-Type'] = 'application/json';
                fetchOptions.body = JSON.stringify(data);
            }
        } else {
            // No data, ensure headers object exists for auth header
            if (!fetchOptions.headers) fetchOptions.headers = {};
            fetchOptions.headers['Content-Type'] = 'application/json';
        }

        try {
            const response = await fetch(url, fetchOptions);

            if (response.status === 401) {
                // Token expired or invalid
                this.clearToken();
                window.location.href = '/pages/login.html';
                return null;
            }

            // Attempt to parse JSON body when possible
            let result = null;
            try {
                result = await response.json();
            } catch (parseError) {
                // Non-JSON response
                result = null;
            }

            if (!response.ok) {
                // Build a detailed error message from common server shapes
                let detail = `Request failed (${response.status})`;

                if (result) {
                    if (result.message) {
                        detail = result.message;
                    } else if (result.error) {
                        detail = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
                    } else if (result.errors) {
                        // errors may be array or object
                        if (Array.isArray(result.errors)) {
                            detail = result.errors.map(e => (e.msg || e.message || e)).join('; ');
                        } else {
                            detail = JSON.stringify(result.errors);
                        }
                    } else {
                        detail = JSON.stringify(result);
                    }
                }

                const err = new Error(detail);
                err.status = response.status;
                throw err;
            }

            return result;
        } catch (error) {
            console.error('API Error:', error);
            // Show notification only if enabled
            if (showErrors) {
                const msg = error.message || 'An unexpected error occurred';
                showNotification(msg, 'error');
            }
            // Return error object so calling code can handle it
            const errorObj = {
                success: false,
                message: error.message || 'An unexpected error occurred',
                error: error
            };
            return errorObj;
        }
    }

    // Cases
    async getCases(filters = {}) {
        let endpoint = '/cases';
        const params = new URLSearchParams(filters);
        if (params.toString()) endpoint += `?${params.toString()}`;
        return this.request(endpoint);
    }

    async getCaseById(id) {
        return this.request(`/cases/${id}`);
    }

    async createCase(data) {
        return this.request('/cases', 'POST', data);
    }

    // Donations
    async makeDonation(data) {
        return this.request('/donations', 'POST', data, { showErrors: false });
    }

    // Platform Fund
    async makePlatformDonation(data) {
        return this.request('/platform/donations', 'POST', data, { showErrors: false });
    }

    async getPlatformFund() {
        return this.request('/platform/fund');
    }

    async donateFromPlatformToCase(data) {
        return this.request('/platform/donate-to-case', 'POST', data);
    }

    // Allocation disabled per requirement

    async getDonations(caseId) {
        return this.request(`/donations?caseId=${caseId}`);
    }

    // Blood Donations
    async getBloodDonors(filters = {}) {
        let endpoint = '/blood-donors';
        const params = new URLSearchParams(filters);
        if (params.toString()) endpoint += `?${params.toString()}`;
        return this.request(endpoint);
    }

    async createBloodRequest(data) {
        return this.request('/blood-request', 'POST', data);
    }

    // Users
    async registerUser(data) {
        return this.request('/auth/register', 'POST', data);
    }

    async loginUser(email, password, expectedRole = null) {
        const payload = { email, password };
        if (expectedRole) payload.expectedRole = expectedRole;
        return this.request('/auth/login', 'POST', payload);
    }

    async logoutUser() {
        this.clearToken();
        return true;
    }

    // User Profile
    async getUserProfile() {
        return this.request('/user/profile');
    }

    async updateUserProfile(data) {
        return this.request('/user/profile', 'PUT', data);
    }
}

// Initialize global API client
const api = new APIClient();

// Real-time Socket.io client (optional)
try {
    if (typeof io !== 'undefined') {
        const socket = io();

        // Automatically join a campaign room if page has data-campaign-id element
        document.addEventListener('DOMContentLoaded', () => {
            const campaignEl = document.querySelector('[data-campaign-id]');
            const caseEl = document.querySelector('[data-case-id]');

            if (campaignEl && campaignEl.dataset.campaignId) {
                socket.emit('joinCampaign', campaignEl.dataset.campaignId);
            }
            if (caseEl && caseEl.dataset.caseId) {
                socket.emit('joinCase', caseEl.dataset.caseId);
            }
        });

        socket.on('donation:created', (payload) => {
            // payload: { campaignId, amount, paymentId }
            try {
                // If we're on a campaign/case details page, update progress UI if present
                const progressBar = document.getElementById('progressBar');
                const collectedEl = document.getElementById('collectedAmount');
                const goalEl = document.getElementById('goalAmount');
                if (collectedEl && goalEl && progressBar) {
                    // Fetch latest totals from API to keep consistent
                    const campaignId = payload.campaignId || (document.querySelector('[data-campaign-id]') || {}).dataset.campaignId;
                    if (campaignId) {
                        api.request(`/campaigns/${campaignId}`).then(res => {
                            if (res && res.data) {
                                const c = res.data;
                                const collected = Number(c.collected_amount || 0);
                                const goal = Number(c.goal_amount || 1);
                                const percentage = Math.round((collected / goal) * 100);
                                collectedEl.textContent = '৳' + new Intl.NumberFormat('en-BD').format(Math.round(collected));
                                goalEl.textContent = '৳' + new Intl.NumberFormat('en-BD').format(Math.round(goal));
                                progressBar.style.width = Math.min(100, percentage) + '%';
                                const progressText = document.getElementById('progressText');
                                if (progressText) progressText.textContent = percentage + '%';
                            }
                        }).catch(()=>{});
                    }
                }
            } catch (err) {
                // ignore client-side socket errors
            }
        });

        socket.on('case:donation', (payload) => {
            // payload: { caseId, amount, donationId }
            try {
                const caseId = payload.caseId || (document.querySelector('[data-case-id]') || {}).dataset.caseId;
                if (!caseId) return;
                // Fetch updated case and refresh UI
                api.getCaseById(caseId).then(result => {
                    if (result && result.data) {
                        const c = result.data;
                        const collectedEl = document.getElementById('collectedAmount');
                        const goalEl = document.getElementById('goalAmount');
                        const progressBar = document.getElementById('progressBar');
                        if (collectedEl) collectedEl.textContent = '৳' + new Intl.NumberFormat('en-BD').format(Math.round(c.collected_amount || 0));
                        if (goalEl) goalEl.textContent = '৳' + new Intl.NumberFormat('en-BD').format(Math.round(c.goal_amount || 0));
                        if (progressBar) {
                            const perc = Math.round(((c.collected_amount||0) / (c.goal_amount||1)) * 100);
                            progressBar.style.width = Math.min(100, perc) + '%';
                            const progressText = document.getElementById('progressText');
                            if (progressText) progressText.textContent = perc + '%';
                        }
                    }
                }).catch(()=>{});
            } catch (err) {}
        });
    }
} catch (e) {
    // socket.io client not available or blocked; ignore
}

// ====================================
// EVENT LISTENERS SETUP
// ====================================

function setupEventListeners() {
    // Password toggle
    const toggleButtons = document.querySelectorAll('.toggle-password');
    toggleButtons.forEach(button => {
        button.addEventListener('click', function (e) {
            e.preventDefault();
            const input = this.previousElementSibling;
            const icon = this.querySelector('i');

            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });

    // Click outside to close mobile menu
    document.addEventListener('click', function (event) {
        const navbar = document.querySelector('.navbar');
        const hamburger = document.getElementById('hamburger');
        const navMenu = document.getElementById('navMenu');

        if (navbar && hamburger && navMenu) {
            if (!navbar.contains(event.target)) {
                navMenu.classList.remove('active');
            }
        }
    });
}

// ====================================
// SITE STATS: fetch + animate counters
// ====================================

async function fetchAndRenderStats() {
    try {
        const resp = await fetch('/api/stats');
        if (!resp.ok) return;
        const payload = await resp.json();
        if (!payload || !payload.data) return;
        const data = payload.data;

        // Map data to DOM counters (order matches markup)
        const counters = Array.from(document.querySelectorAll('.progress-stats .counter'));
        const values = [data.livesSaved || 0, data.amountRaised || 0, data.activeCases || 0, data.activeDonors || 0];

        counters.forEach((el, idx) => {
            const target = Number(values[idx] || 0);
            // store formatted target for accessibility
            el.dataset.target = String(target);
            animateCounter(el, target, idx === 1); // second item is amount
        });
    } catch (err) {
        // silently ignore; optional: showNotification('Unable to load site stats')
        console.error('Stats load error', err);
    }
}

function animateCounter(el, target, currency = false) {
    const start = 0;
    const duration = 1400; // ms
    const startTime = performance.now();

    function format(n) {
        if (currency) return '৳' + new Intl.NumberFormat('en-BD').format(Math.round(n));
        return new Intl.NumberFormat('en-US').format(Math.round(n));
    }

    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = start + (target - start) * eased;
        el.textContent = format(current);
        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            el.textContent = format(target);
        }
    }

    requestAnimationFrame(step);
}

// Fire stats fetch after DOM ready and a short delay so other resources load first
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(fetchAndRenderStats, 300);
});

// ====================================
// DONATION MODAL (HOME PAGE)
// ====================================

function setupDonationModal() {
    const modal = document.getElementById('donationModal');
    const closeBtn = document.getElementById('donationModalClose');
    const form = document.getElementById('homeDonationForm');
    const anonymousCheckbox = document.getElementById('donationAnonymous');
    const nameInput = document.getElementById('donationName');
    const emailInput = document.getElementById('donationEmail');

    // Only setup if modal exists on this page
    if (!modal) return;

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', closeDonationModal);
    }

    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                closeDonationModal();
            }
        });
    }

    if (anonymousCheckbox && nameInput && emailInput) {
        anonymousCheckbox.addEventListener('change', () => {
            const disabled = anonymousCheckbox.checked;
            nameInput.disabled = disabled;
            emailInput.disabled = disabled;
            if (disabled) {
                nameInput.value = '';
                emailInput.value = '';
            }
        });
    }

    if (form) {
        form.addEventListener('submit', handleHomeDonationSubmit);
    }
}

function attachDonationButtons() {
    const donateButtons = document.querySelectorAll('.donate-btn');
    
    donateButtons.forEach((btn) => {
        // Clone the button to remove all existing event listeners
        const newBtn = btn.cloneNode(true);
        btn.replaceWith(newBtn);
        
        // Add single click listener to the new button
        newBtn.addEventListener('click', handleDonateButtonClick);
    });
}

function handleDonateButtonClick(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const btn = this;
    const caseId = btn.dataset.caseId;

    if (!caseId) {
        showNotification('Error: Case information not found', 'error');
        return;
    }

    window.location.href = `/pages/donate.html?case=${caseId}`;
}

function openHomeDonationModal(caseMeta) {
    
    if (!caseMeta || !caseMeta.caseId) {
        console.error('Invalid case metadata provided to donation modal');
        showNotification('Error: Invalid case information', 'error');
        return;
    }
    
    activeDonationCase = caseMeta;
    const modal = document.getElementById('donationModal');
    const titleEl = document.getElementById('donationModalTitle');
    const subtitleEl = document.getElementById('donationModalSubtitle');
    const form = document.getElementById('homeDonationForm');
    const anonymousCheckbox = document.getElementById('donationAnonymous');
    const nameInput = document.getElementById('donationName');
    const emailInput = document.getElementById('donationEmail');

    if (!modal) {
        console.error('Donation modal element not found');
        showNotification('Error: Donation form not available', 'error');
        return;
    }

    // Update modal title and subtitle
    if (titleEl) {
        const label = caseMeta.caseTitle || caseMeta.patientName || 'Patient';
        titleEl.textContent = `Donate to ${label}`;
    }

    if (subtitleEl) {
        const patient = caseMeta.patientName || 'this patient';
        subtitleEl.textContent = `Your support will directly help ${patient} receive treatment.`;
    }

    // Reset form
    if (form) {
        form.reset();
        if (anonymousCheckbox) anonymousCheckbox.checked = false;
        if (nameInput) {
            nameInput.disabled = false;
            nameInput.value = '';
        }
        if (emailInput) {
            emailInput.disabled = false;
            emailInput.value = '';
        }
    }

    // Show modal
    modal.style.display = 'flex';
    modal.classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    
    console.debug('✅ Donation modal opened for case', caseMeta.caseId);
}

function closeDonationModal() {
    const modal = document.getElementById('donationModal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
    document.body.style.overflow = ''; // Restore scrolling
    activeDonationCase = null;
}

async function handleHomeDonationSubmit(e) {
    e.preventDefault();
    console.log('📝 Form submission started');

    if (!activeDonationCase || !activeDonationCase.caseId) {
        console.warn('❌ No active donation case');
        showNotification('Please select a patient case first', 'error');
        return;
    }
    console.log('✅ Case found:', activeDonationCase);

    const amountInput = document.getElementById('donationAmountHome');
    const methodSelect = document.getElementById('donationPaymentMethod');
    const anonymousCheckbox = document.getElementById('donationAnonymous');
    const donorNameInput = document.getElementById('donationName');
    const donorEmailInput = document.getElementById('donationEmail');

    console.log('📋 Form inputs found:', {
        amount: amountInput?.value,
        method: methodSelect?.value,
        anonymous: anonymousCheckbox?.checked,
        name: donorNameInput?.value,
        email: donorEmailInput?.value
    });

    const amount = Number(amountInput?.value || 0);
    const paymentMethod = methodSelect?.value || '';
    const isAnonymous = !!anonymousCheckbox?.checked;
    const donorName = donorNameInput?.value?.trim();
    const donorEmail = donorEmailInput?.value?.trim();

    if (!amount || amount < 100) {
        console.warn('❌ Invalid amount:', amount);
        showNotification('Minimum donation amount is ৳100', 'error');
        return;
    }
    console.log('✅ Amount valid:', amount);

    if (!paymentMethod) {
        console.warn('❌ No payment method selected');
        showNotification('Please choose a payment method', 'error');
        return;
    }
    console.log('✅ Payment method valid:', paymentMethod);

    // If not anonymous, validate basic donor info when provided
    if (!isAnonymous && donorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail)) {
        console.warn('❌ Invalid email format:', donorEmail);
        showNotification('Please enter a valid email', 'error');
        return;
    }
    console.log('✅ Email validation passed');

    showLoader();

    try {
        console.log('🎁 Starting donation flow for case:', activeDonationCase.caseId);
        const payload = {
            caseId: activeDonationCase.caseId,
            amount,
            paymentMethod,
            isAnonymous,
            guestName: isAnonymous ? 'Anonymous' : (donorName || null),
            guestEmail: isAnonymous ? '' : (donorEmail || null)
        };

        console.log('📤 Sending donation payload:', payload);
        const response = await api.makeDonation(payload);
        console.log('📨 Received response:', response);
        hideLoader();

        if (response && response.success) {
            console.log('✅ Donation successful!');
            showNotification('Thank you for your donation!', 'success');
            closeDonationModal();
            // Refresh list to reflect new totals
            loadFeaturedCases();
        } else {
            console.warn('❌ Donation failed:', response);
            // Handle both API errors and validation errors
            const errorMsg = response?.message || 'Donation failed. Please try again.';
            showNotification(errorMsg, 'error');
        }
    } catch (err) {
        console.error('🚨 Error during donation:', err);
        hideLoader();
        showNotification(err.message || 'Unable to process donation right now', 'error');
    }
}

// ====================================
// AUTHENTICATION HELPERS
// ====================================

function isUserLoggedIn() {
    return !!api.getToken();
}

function getCurrentUser() {
    const userRaw = localStorage.getItem('currentUser') || localStorage.getItem('user');
    return userRaw ? JSON.parse(userRaw) : null;
}

function setCurrentUser(user) {
    // Keep compatibility: set both `currentUser` (new) and `user` (existing pages)
    try {
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('user', JSON.stringify(user));
    } catch (e) {
        console.warn('Failed to save user to localStorage', e);
    }
}

function logoutUser() {
    api.clearToken();
    try {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
    } catch (e) {}
    window.location.href = '/pages/login.html';
}

// ====================================
// GLOBAL FOOTER RENDERER
// ====================================

function renderGlobalFooter() {
    let footer = document.querySelector('.footer');
    if (!footer) {
        footer = document.createElement('footer');
        footer.className = 'footer';
        document.body.appendChild(footer);
    }
    if (footer.dataset.enhanced === '1') return;
    footer.dataset.enhanced = '1';

    injectFooterStyles();

    const year = new Date().getFullYear();
    const user = JSON.parse(localStorage.getItem('user') || localStorage.getItem('currentUser') || 'null');
    const userRole = user?.userType || '';

    const roleLinks = [];
    if (userRole === 'admin') roleLinks.push('<li><a href="/admin-dashboard.html">Admin dashboard</a></li>');
    if (userRole === 'doctor') roleLinks.push('<li><a href="/lifeline-charity-team-dashboard.html">Team dashboard</a></li>');
    if (userRole === 'patient') roleLinks.push('<li><a href="/patient-dashboard.html">Patient dashboard</a></li>');
    if (userRole === 'donor') roleLinks.push('<li><a href="/pages/profile.html">My profile</a></li>');

    footer.innerHTML = `
        <div class="footer-shell">
            <div class="footer-col brand">
                <div class="footer-logo">◉ LIFELINE</div>
                <p class="footer-tagline">Trusted medical crowdfunding and blood support across Bangladesh. Verify, donate, and save lives with transparency.</p>
                <div class="footer-badges">
                    <span>Verified Cases</span>
                    <span>Transparent Tracking</span>
                    <span>BDT-First</span>
                </div>
            </div>
            <div class="footer-col">
                <h4>Platform</h4>
                <ul>
                    <li><a href="/">Home</a></li>
                    <li><a href="/pages/cases.html">Patient Cases</a></li>
                    <li><a href="/pages/donate-lifeline.html">Lifeline Fund</a></li>
                    <li><a href="/pages/blood-donation.html">Blood Drive</a></li>
                    <li><a href="/pages/about.html">About Us</a></li>
                </ul>
            </div>
            <div class="footer-col">
                <h4>Account</h4>
                <ul>
                    <li><a href="/pages/login.html">Login</a></li>
                    <li><a href="/pages/signup.html">Sign Up</a></li>
                    <li><a href="/pages/profile.html">My Profile</a></li>
                    <li><a href="/pages/donate.html">Donate Now</a></li>
                    <li><a href="/pages/process.html">How It Works</a></li>
                </ul>
            </div>
            <div class="footer-col">
                <h4>Help & Info</h4>
                <ul>
                    <li><a href="/pages/contact.html">Contact Us</a></li>
                    <li><a href="#">FAQs</a></li>
                    <li><a href="#">Privacy Policy</a></li>
                    <li><a href="#">Terms of Service</a></li>
                    ${roleLinks.length ? '<li style="border-top:1px solid rgba(255,255,255,0.1);padding-top:0.65rem;margin-top:0.65rem;">' + roleLinks[0] + '</li>' : ''}
                </ul>
            </div>
            <div class="footer-col cta">
                <h4>Get In Touch</h4>
                <p style="margin:0 0 1rem;">Have questions? Reach out to our support team—we're here to help.</p>
                <div class="footer-contact">
                    <div style="margin-bottom:0.5rem;"><strong style="color:#38bdf8;">Email:</strong><br><a href="mailto:support@lifeline.org">support@lifeline.org</a></div>
                    <div style="margin-bottom:1rem;"><strong style="color:#38bdf8;">Phone:</strong><br><a href="tel:+880123456789">+880 1234 567890</a></div>
                </div>
                <h4 style="font-size:0.95rem;margin:1rem 0 0.75rem;">Follow Us</h4>
                <div class="footer-socials">
                    <a href="https://facebook.com" title="Facebook" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
                    <a href="https://instagram.com" title="Instagram" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
                    <a href="https://twitter.com" title="Twitter" aria-label="Twitter"><i class="fab fa-twitter"></i></a>
                    <a href="https://linkedin.com" title="LinkedIn" aria-label="LinkedIn"><i class="fab fa-linkedin-in"></i></a>
                    <a href="https://youtube.com" title="YouTube" aria-label="YouTube"><i class="fab fa-youtube"></i></a>
                </div>
            </div>
        </div>
        <div class="footer-bottom">
            <span>&copy; ${year} Lifeline Charity Platform. All rights reserved.</span>
            <div class="footer-meta">
                <span>💚 Verified & Trusted</span>
                <span>🔒 Data Secured</span>
                <span>📊 Transparent Reports</span>
            </div>
        </div>
    `;
}

function injectFooterStyles() {
    if (document.getElementById('global-footer-style')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'global-footer-style';
    styleEl.textContent = `
        .footer { background: linear-gradient(180deg, #0f1419 0%, #0a0d11 100%); color: #e2e8f0; padding: 3.5rem 1.25rem; margin-top: 4rem; border-top: 1px solid rgba(56,189,248,0.15); }
        .footer-shell { max-width: 1320px; margin: 0 auto; display: grid; gap: 2.5rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); align-items: start; }
        .footer-col h4 { color: #fff; margin: 0 0 1rem; font-size: 1.05rem; letter-spacing: 0.02em; font-weight: 700; }
        .footer-col ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.65rem; }
        .footer-col ul a { color: #cbd5e1; text-decoration: none; font-weight: 500; transition: color 0.3s; }
        .footer-col ul a:hover { color: #38bdf8; }
        .footer-logo { font-size: 1.6rem; font-weight: 900; color: #fff; letter-spacing: 0.03em; background: linear-gradient(135deg, #38bdf8, #22d3ee); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .footer-tagline { margin: 0.75rem 0 1rem; color: #a1aec7; line-height: 1.5; font-size: 0.95rem; }
        .footer-badges { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
        .footer-badges span { background: rgba(56,189,248,0.08); color: #a5d4ff; border: 1px solid rgba(56,189,248,0.25); padding: 0.4rem 0.7rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600; }
        .footer-col.cta p { color: #cbd5e1; margin: 0 0 1.25rem; line-height: 1.6; }
        .footer-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.5rem; }
        .footer-btn { display: inline-flex; align-items: center; justify-content: center; padding: 0.75rem 1.3rem; border-radius: 10px; font-weight: 700; text-decoration: none; border: 1px solid transparent; font-size: 0.95rem; transition: all 0.3s; }
        .footer-btn.primary { background: linear-gradient(135deg, #38bdf8, #22d3ee); color: #0b1220; }
        .footer-btn.ghost { background: transparent; border-color: rgba(255,255,255,0.2); color: #e2e8f0; }
        .footer-btn.primary:hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(56,189,248,0.3); }
        .footer-btn.ghost:hover { border-color: rgba(56,189,248,0.5); background: rgba(56,189,248,0.08); color: #38bdf8; }
        .footer-contact { margin-top: 1rem; color: #a1aec7; font-size: 0.9rem; }
        .footer-contact a { color: #38bdf8; text-decoration: none; font-weight: 600; }
        .footer-contact a:hover { text-decoration: underline; }
        .footer-bottom { max-width: 1320px; margin: 2.5rem auto 0; padding-top: 1.75rem; border-top: 1px solid rgba(255,255,255,0.08); display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: space-between; align-items: center; color: #718096; font-size: 0.85rem; }
        .footer-socials { display: flex; gap: 0.8rem; }
        .footer-socials a { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; background: rgba(56,189,248,0.1); color: #38bdf8; text-decoration: none; border: 1.5px solid rgba(56,189,248,0.25); transition: all 0.3s ease; font-size: 1rem; }
        .footer-socials a:hover { background: rgba(56,189,248,0.25); border-color: rgba(56,189,248,0.6); transform: translateY(-3px); box-shadow: 0 6px 20px rgba(56,189,248,0.2); }
        .footer-meta { display: flex; gap: 1rem; flex-wrap: wrap; }
        .footer-col.brand { min-width: 250px; }
        @media (max-width: 768px) { .footer { padding: 2.5rem 1rem; margin-top: 2.5rem; } .footer-shell { gap: 2rem; grid-template-columns: 1fr; } .footer-btn { width: 100%; } .footer-bottom { flex-direction: column; text-align: center; justify-content: center; } .footer-socials { justify-content: center; } }
    `;
    document.head.appendChild(styleEl);
}

// ====================================
// ADD STYLES FOR ANIMATIONS
// ====================================

const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
