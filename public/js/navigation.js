/**
 * PROFESSIONAL BACK NAVIGATION SYSTEM
 * Handles smart routing and navigation across the platform
 */

class NavigationManager {
    constructor() {
        this.navigationStack = JSON.parse(sessionStorage.getItem('navStack') || '[]');
        this.maxStackSize = 10;
        this.routeMap = {
            // Pages that link to their default return pages
            'donate.html': 'cases.html',
            'case-details.html': 'cases.html',
            'patient-details.html': 'cases.html',
            'profile.html': 'index.html',
            'create-campaign.html': 'campaigns.html',
            'blood-donation.html': 'index.html',
            'login.html': 'index.html',
            'signup.html': 'index.html',
            'submission.html': 'index.html',
            'campaign.html': 'campaigns.html'
        };
        
        this.init();
    }

    init() {
        // Track current page
        const currentPage = this.getCurrentPage();
        if (currentPage && !this.navigationStack.includes(currentPage)) {
            this.addToStack(currentPage);
        }

        // Setup back buttons
        this.setupBackButtons();
    }

    getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop() || 'index.html';
        return filename;
    }

    addToStack(page) {
        if (this.navigationStack[this.navigationStack.length - 1] !== page) {
            this.navigationStack.push(page);
            if (this.navigationStack.length > this.maxStackSize) {
                this.navigationStack.shift();
            }
            this.saveStack();
        }
    }

    saveStack() {
        sessionStorage.setItem('navStack', JSON.stringify(this.navigationStack));
    }

    getPreviousPage() {
        if (this.navigationStack.length > 1) {
            return this.navigationStack[this.navigationStack.length - 2];
        }
        return null;
    }

    setupBackButtons() {
        // Setup all back buttons
        document.querySelectorAll('[data-back-button]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.goBack();
            });
        });

        // Older style back links (backward compatibility)
        document.querySelectorAll('a.back-link').forEach(link => {
            if (link.getAttribute('href') === '#' && link.getAttribute('onclick')?.includes('history.back')) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.goBack();
                });
            }
        });
    }

    goBack() {
        const previousPage = this.getPreviousPage();
        const currentPage = this.getCurrentPage();

        // Remove current page from stack before going back
        if (this.navigationStack[this.navigationStack.length - 1] === currentPage) {
            this.navigationStack.pop();
            this.saveStack();
        }

        if (previousPage && previousPage !== currentPage) {
            // Use relative path navigation
            const relativePath = this.getRelativePath(currentPage, previousPage);
            window.location.href = relativePath;
        } else {
            // Fallback: use history API
            if (window.history.length > 1) {
                window.history.back();
            } else {
                // Last resort: go to home
                window.location.href = '/index.html';
            }
        }
    }

    getRelativePath(fromPage, toPage) {
        const isFromPages = fromPage.includes('-') || ['donate.html', 'login.html', 'signup.html'].includes(fromPage);
        const isToPages = toPage.includes('-') || ['donate.html', 'login.html', 'signup.html'].includes(toPage);

        // Both in pages folder
        if (isFromPages && isToPages) {
            return `./${toPage}`;
        }
        // Going from pages to root
        if (isFromPages && !isToPages) {
            return `../${toPage}`;
        }
        // Going from root to pages
        if (!isFromPages && isToPages) {
            return `./pages/${toPage}`;
        }
        // Both in root
        return `./${toPage}`;
    }

    navigateTo(page, queryParams = {}) {
        this.addToStack(page);
        const currentPage = this.getCurrentPage();
        const relativePath = this.getRelativePath(currentPage, page);
        
        let url = relativePath;
        if (Object.keys(queryParams).length > 0) {
            const params = new URLSearchParams(queryParams);
            url += `?${params.toString()}`;
        }
        
        window.location.href = url;
    }

    navigateToRoot(page, queryParams = {}) {
        this.addToStack(page);
        let url = `/${page}`;
        if (Object.keys(queryParams).length > 0) {
            const params = new URLSearchParams(queryParams);
            url += `?${params.toString()}`;
        }
        window.location.href = url;
    }
}

// Initialize globally
let navigationManager = null;

document.addEventListener('DOMContentLoaded', () => {
    navigationManager = new NavigationManager();
    
    // Make it available globally
    window.navManager = navigationManager;
});

// Helper function to get relative path for navigation
function getPageLink(page, queryParams = {}) {
    if (!navigationManager) {
        navigationManager = new NavigationManager();
    }
    
    const currentPage = navigationManager.getCurrentPage();
    let path = navigationManager.getRelativePath(currentPage, page);
    
    if (Object.keys(queryParams).length > 0) {
        const params = new URLSearchParams(queryParams);
        path += `?${params.toString()}`;
    }
    
    return path;
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NavigationManager;
}

/* ====================================== */
/* USER MENU & NAVBAR FUNCTIONS */
/* ====================================== */

/**
 * Toggle mobile navigation menu
 */
function toggleNavMenu() {
    const navMenu = document.getElementById('navMenu');
    const hamburger = document.getElementById('hamburger');
    
    if (navMenu) {
        navMenu.classList.toggle('active');
    }
    if (hamburger) {
        hamburger.classList.toggle('active');
    }
}

/**
 * Show/hide user dropdown menu
 */
function showUserMenu(event) {
    event.preventDefault();
    const userMenu = document.getElementById('user-menu');
    if (userMenu) {
        userMenu.style.display = userMenu.style.display === 'none' ? 'block' : 'none';
    }
}

/**
 * Close user menu when clicking outside
 */
document.addEventListener('click', function(event) {
    const navUser = document.getElementById('nav-user');
    const userMenu = document.getElementById('user-menu');
    
    if (navUser && userMenu && !navUser.contains(event.target)) {
        userMenu.style.display = 'none';
    }
});

/**
 * Logout user
 */
function logoutUser() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/pages/login.html';
}

/**
 * Update navbar based on authentication status
 */
function updateNavbarUser() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const navLogin = document.getElementById('nav-login');
    const navSignup = document.getElementById('nav-signup');
    const navUser = document.getElementById('nav-user');
    const userName = document.getElementById('user-name');
    
    if (token && user) {
        // User is logged in
        if (navLogin) navLogin.style.display = 'none';
        if (navSignup) navSignup.style.display = 'none';
        if (navUser) navUser.style.display = 'flex';
        
        // Update user display with profile picture or initials
        if (userName) {
            // Create profile avatar with picture or initials
            const userLink = navUser.querySelector('a');
            if (userLink) {
                // Clear existing content
                userLink.innerHTML = '';
                
                // Set userLink to display as flex row (avatar and name side by side)
                userLink.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                `;
                
                // Create avatar container
                const avatarDiv = document.createElement('div');
                avatarDiv.className = 'user-avatar';
                avatarDiv.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    flex-shrink: 0;
                `;
                
                // Create inner div for initials or image container
                const avatarContent = document.createElement('div');
                avatarContent.setAttribute('id', 'user-name');
                avatarDiv.appendChild(avatarContent);
                
                // Add profile picture if available (check both photoPath and profilePicture)
                const photoUrl = user.photoPath || user.profilePicture;
                
                // Get full name from firstName + lastName or fallback to name
                const fullName = user.firstName && user.lastName 
                    ? `${user.firstName} ${user.lastName}` 
                    : (user.name || user.firstName || user.email || 'User');
                
                if (photoUrl && photoUrl.trim()) {
                    avatarContent.className = 'avatar-image-container';
                    const img = document.createElement('img');
                    img.src = photoUrl;
                    img.alt = 'Profile';
                    img.className = 'avatar-image';
                    img.onerror = function() {
                        // Fallback to initials if image fails to load
                        const initials = fullName
                            .split(' ')
                            .map(n => n[0])
                            .join('')
                            .toUpperCase()
                            .substring(0, 2);
                        this.style.display = 'none';
                        avatarContent.className = 'avatar-initials-container';
                        avatarContent.textContent = initials;
                    };
                    avatarContent.appendChild(img);
                } else {
                    // Show initials if no picture
                    avatarContent.className = 'avatar-initials-container';
                    const initials = fullName
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()
                        .substring(0, 2);
                    avatarContent.textContent = initials;
                }
                
                userLink.appendChild(avatarDiv);
                
                // Create tooltip with user full name
                userLink.title = fullName;
            }
        }
    } else {
        // User is not logged in
        if (navLogin) navLogin.style.display = 'flex';
        if (navSignup) navSignup.style.display = 'flex';
        if (navUser) navUser.style.display = 'none';
    }
}

// Update navbar on page load
document.addEventListener('DOMContentLoaded', updateNavbarUser);
