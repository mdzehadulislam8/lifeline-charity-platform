// Industrial Notification System - Enhanced Version
class IndustrialNotificationSystem {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.pollInterval = 5000; // 5 seconds
        this.isInitialized = false;
    }

    // Initialize the notification system
    async initializeUI() {
        if (this.isInitialized) return;
        
        // Check if user is authenticated
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        if (!token) return;

        this.isInitialized = true;
        await this.loadNotifications();
        await this.getUnreadCount();
        this.setupEventListeners();
        this.startPolling();
    }

    // Setup event listeners
    setupEventListeners() {
        const bellBtn = document.getElementById('notificationBellIndustrial');
        const panel = document.getElementById('notificationPanelIndustrial');
        
        if (bellBtn && panel) {
            bellBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (panel.style.display === 'none') {
                    this.loadNotifications();
                    panel.style.display = 'block';
                } else {
                    panel.style.display = 'none';
                }
            });
        }

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (panel && !panel.contains(e.target) && !bellBtn?.contains(e.target)) {
                panel.style.display = 'none';
            }
        });
    }

    // Load notifications from API
    async loadNotifications() {
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            const response = await fetch('/api/notifications?limit=15', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.notifications = data.notifications || [];
                this.renderNotifications();
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    }

    // Get unread count
    async getUnreadCount() {
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            const response = await fetch('/api/notifications/unread/count', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.unreadCount = data.unreadCount || 0;
                this.updateBadge();
            }
        } catch (error) {
            console.error('Failed to get unread count:', error);
        }
    }

    // Update badge display
    updateBadge() {
        const badge = document.getElementById('notificationBadgeIndustrial');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                badge.style.display = 'flex';
                // Pulse animation trigger
                badge.style.animation = 'none';
                setTimeout(() => {
                    badge.style.animation = 'badge-pulse 2s infinite';
                }, 100);
            } else {
                badge.style.display = 'none';
            }
        }
    }

    // Render notifications in panel
    renderNotifications() {
        const listContainer = document.getElementById('notificationListIndustrial');
        if (!listContainer) return;

        if (this.notifications.length === 0) {
            listContainer.innerHTML = `
                <div class="notification-empty-state-industrial">
                    <i class="fas fa-inbox"></i>
                    <p>No notifications yet</p>
                </div>
            `;
            return;
        }

        let html = '';
        this.notifications.forEach(notif => {
            const isUnread = !notif.is_read;
            const timeStr = this.formatTime(notif.created_at);
            const statusBadge = this.getStatusBadge(notif.notification_type);

            html += `
                <div class="notification-item-industrial ${isUnread ? 'unread' : ''}" 
                     onclick="notificationSystemIndustrial.markAsRead('${notif.notification_id}')">
                    <div class="notification-item-title-industrial">
                        ${notif.title}
                        ${statusBadge}
                    </div>
                    <div class="notification-item-message-industrial">
                        ${notif.message}
                    </div>
                    <div class="notification-item-time-industrial">
                        <i class="fas fa-clock"></i> ${timeStr}
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = html;
    }

    // Get status badge HTML
    getStatusBadge(type) {
        const badgeConfig = {
            'case_submitted': { class: 'new', icon: 'fa-star', text: 'NEW' },
            'case_approved': { class: 'approved', icon: 'fa-check-circle', text: 'APPROVED' },
            'case_rejected': { class: 'rejected', icon: 'fa-times-circle', text: 'REJECTED' },
            'case_updated': { class: 'new', icon: 'fa-refresh', text: 'UPDATED' },
            'donation_received': { class: 'approved', icon: 'fa-gift', text: 'DONATION' }
        };

        const config = badgeConfig[type];
        if (!config) return '';

        return `<span class="notification-status-badge ${config.class}">
                    <i class="fas ${config.icon}"></i> ${config.text}
                </span>`;
    }

    // Mark notification as read
    async markAsRead(notificationId) {
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            const response = await fetch(`/api/notifications/${notificationId}/read`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                await this.getUnreadCount();
                await this.loadNotifications();
            }
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    }

    // Mark all as read
    async markAllAsRead() {
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            const response = await fetch('/api/notifications/read/all', {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                await this.getUnreadCount();
                await this.loadNotifications();
            }
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    }

    // Format time to relative format
    formatTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        // Format as date
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // Start polling for new notifications
    startPolling() {
        setInterval(() => {
            this.getUnreadCount();
        }, this.pollInterval);
    }
}

// Global instance
let notificationSystemIndustrial;

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    notificationSystemIndustrial = new IndustrialNotificationSystem();
    notificationSystemIndustrial.initializeUI();
});

// Also expose globally for manual initialization
window.IndustrialNotificationSystem = IndustrialNotificationSystem;
