/**
 * Notification Navbar System
 * Displays notifications in the navbar for all users (Patient, Doctor/Lifeline Team, Admin)
 * Shows real-time notification updates and marks notifications as read
 */

class NotificationNavbar {
    constructor() {
        this.token = localStorage.getItem('token');
        this.userId = localStorage.getItem('userId');
        this.userRole = localStorage.getItem('userRole');
        this.notificationBadge = null;
        this.notificationPanel = null;
        this.pollingInterval = null;
        this.notificationBtn = null;
    }

    // Initialize notification navbar
    async init() {
        // Create and insert notification bell HTML (for all users)
        this.createNotificationHTML();
        this.attachEventListeners();
        
        // Only load notifications if user is logged in
        if (this.token) {
            await this.loadNotifications();
            // Poll for new notifications every 5 seconds
            this.startPolling();
        }
    }

    // Create notification HTML in navbar
    createNotificationHTML() {
        // Check if notification bell already exists
        if (document.getElementById('notificationBtn')) {
            this.notificationBtn = document.getElementById('notificationBtn');
            this.notificationPanel = document.getElementById('notificationPanel');
            this.notificationBadge = document.getElementById('notificationBadge');
            return;
        }

        let navActions = document.querySelector('.nav-actions');
        if (!navActions) {
            // Fallback: create notification container
            const container = document.createElement('div');
            container.style.position = 'fixed';
            container.style.top = '10px';
            container.style.right = '20px';
            container.style.zIndex = '999';
            document.body.appendChild(container);
        }

        const notificationHTML = `
            <div class="notification-bell-container" style="position: relative; display: inline-block;">
                <button id="notificationBtn" class="btn-notification" title="Notifications">
                    <i class="fas fa-bell"></i>
                    <span id="notificationBadge" class="notification-badge" style="display: none;">0</span>
                </button>

                <div id="notificationPanel" class="notification-panel" style="display: none;">
                    <div class="notification-header">
                        <h3 style="margin: 0;">
                            <i class="fas fa-bell"></i> Notifications
                        </h3>
                        <button id="closeNotificationPanel" class="btn-close" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                            &times;
                        </button>
                    </div>

                    <div id="notificationList" class="notification-list" style="max-height: 400px; overflow-y: auto;">
                        <p class="empty-state" style="text-align: center; padding: 2rem; color: #999;">
                            <i class="fas fa-inbox"></i><br>
                            No notifications
                        </p>
                    </div>

                    <div class="notification-footer" style="padding-top: 1rem; border-top: 1px solid #eee;">
                        <button id="markAllReadBtn" class="btn-mark-all-read" style="width: 100%; padding: 0.6rem; background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-weight: 500;">
                            Mark all as read
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Insert into nav-actions if exists, otherwise create separate container
        navActions = document.querySelector('.nav-actions');
        if (navActions) {
            const div = document.createElement('div');
            div.innerHTML = notificationHTML;
            navActions.insertBefore(div.firstElementChild, navActions.firstChild);
        } else {
            const container = document.createElement('div');
            container.style.position = 'fixed';
            container.style.top = '15px';
            container.style.right = '20px';
            container.style.zIndex = '999';
            container.innerHTML = notificationHTML;
            document.body.appendChild(container);
        }

        // Store references
        this.notificationBtn = document.getElementById('notificationBtn');
        this.notificationPanel = document.getElementById('notificationPanel');
        this.notificationBadge = document.getElementById('notificationBadge');
    }

    // Attach event listeners
    attachEventListeners() {
        if (this.notificationBtn) {
            this.notificationBtn.addEventListener('click', () => this.togglePanel());
        }

        const closeBtn = document.getElementById('closeNotificationPanel');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.togglePanel());
        }

        const markAllBtn = document.getElementById('markAllReadBtn');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', () => this.markAllAsRead());
        }

        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.notification-bell-container')) {
                if (this.notificationPanel && this.notificationPanel.style.display !== 'none') {
                    this.togglePanel();
                }
            }
        });
    }

    // Toggle notification panel
    togglePanel() {
        if (!this.notificationPanel) return;
        
        const isHidden = this.notificationPanel.style.display === 'none';
        this.notificationPanel.style.display = isHidden ? 'block' : 'none';
        
        if (isHidden) {
            this.loadNotifications(); // Refresh when opening
        }
    }

    // Load notifications from API
    async loadNotifications() {
        try {
            const response = await fetch('/api/notifications?limit=10&offset=0', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) throw new Error('Failed to load notifications');

            const data = await response.json();
            const notifications = data.data || [];

            // Update badge
            await this.updateBadge();

            // Render notifications
            this.renderNotifications(notifications);
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    // Update unread count badge
    async updateBadge() {
        try {
            const response = await fetch('/api/notifications/unread/count', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) throw new Error('Failed to get unread count');

            const data = await response.json();
            const unreadCount = data.unreadCount || 0;

            if (this.notificationBadge) {
                if (unreadCount > 0) {
                    this.notificationBadge.textContent = unreadCount;
                    this.notificationBadge.style.display = 'inline-block';
                    // Add animation
                    this.notificationBadge.style.animation = 'pulse 0.5s ease-in-out';
                } else {
                    this.notificationBadge.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Error updating badge:', error);
        }
    }

    // Render notifications in panel
    renderNotifications(notifications) {
        const notificationList = document.getElementById('notificationList');
        if (!notificationList) return;

        if (notifications.length === 0) {
            notificationList.innerHTML = `
                <p class="empty-state" style="text-align: center; padding: 2rem; color: #999;">
                    <i class="fas fa-inbox"></i><br>
                    No notifications
                </p>
            `;
            return;
        }

        notificationList.innerHTML = notifications.map(notification => {
            const timeAgo = this.getTimeAgo(notification.created_at);
            const icon = this.getNotificationIcon(notification.notification_type);
            const bgColor = this.getNotificationBgColor(notification.notification_type);
            const borderColor = this.getNotificationBorderColor(notification.notification_type);

            return `
                <div class="notification-item" data-id="${notification.notification_id}" 
                     style="
                         padding: 1rem;
                         border-bottom: 1px solid #eee;
                         cursor: pointer;
                         transition: all 0.3s ease;
                         background-color: ${notification.is_read ? 'transparent' : bgColor};
                         border-left: 4px solid ${borderColor};
                     "
                     onmouseover="this.style.backgroundColor='#f9f9f9';"
                     onmouseout="this.style.backgroundColor='${notification.is_read ? 'transparent' : bgColor}';">
                    
                    <div style="display: flex; gap: 0.75rem;">
                        <div style="font-size: 1.3rem; color: ${borderColor};">
                            ${icon}
                        </div>
                        <div style="flex: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                <h4 style="margin: 0 0 0.25rem 0; color: #333; font-size: 0.95rem;">
                                    ${notification.title}
                                    ${!notification.is_read ? '<span style="display: inline-block; width: 8px; height: 8px; background: #e74c3c; border-radius: 50%; margin-left: 0.5rem;"></span>' : ''}
                                </h4>
                                <span style="font-size: 0.75rem; color: #999;">${timeAgo}</span>
                            </div>
                            <p style="margin: 0.25rem 0 0 0; color: #666; font-size: 0.85rem; line-height: 1.4;">
                                ${notification.message}
                            </p>
                            <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
                                <button class="btn-mark-read" onclick="notificationNavbar.markAsRead('${notification.notification_id}')" 
                                        style="padding: 0.25rem 0.75rem; background: #3498db; color: white; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer; transition: all 0.2s;">
                                    ${notification.is_read ? 'Read' : 'Mark as read'}
                                </button>
                                <button class="btn-delete" onclick="notificationNavbar.deleteNotification('${notification.notification_id}')" 
                                        style="padding: 0.25rem 0.75rem; background: #ecf0f1; color: #e74c3c; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer; transition: all 0.2s;">
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Mark notification as read
    async markAsRead(notificationId) {
        try {
            const response = await fetch(`/api/notifications/${notificationId}/read`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                await this.loadNotifications();
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    // Mark all notifications as read
    async markAllAsRead() {
        try {
            const response = await fetch('/api/notifications/read/all', {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                await this.loadNotifications();
            }
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    }

    // Delete notification
    async deleteNotification(notificationId) {
        if (!confirm('Are you sure you want to delete this notification?')) return;

        try {
            const response = await fetch(`/api/notifications/${notificationId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                await this.loadNotifications();
            }
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    }

    // Start polling for new notifications
    startPolling() {
        this.pollingInterval = setInterval(async () => {
            await this.updateBadge();
            // Only refresh panel if it's open
            if (this.notificationPanel && this.notificationPanel.style.display !== 'none') {
                await this.loadNotifications();
            }
        }, 5000); // Poll every 5 seconds
    }

    // Stop polling
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
    }

    // Get notification icon based on type
    getNotificationIcon(type) {
        const icons = {
            'case_submitted': '📋',
            'case_approved': '✅',
            'case_rejected': '❌',
            'donation_received': '💚',
            'campaign_created': '🎯',
            'blood_request': '🩸',
            'payment_received': '💰'
        };
        return icons[type] || '🔔';
    }

    // Get background color based on notification type
    getNotificationBgColor(type) {
        const colors = {
            'case_submitted': 'rgba(52, 152, 219, 0.05)',
            'case_approved': 'rgba(39, 174, 96, 0.05)',
            'case_rejected': 'rgba(231, 76, 60, 0.05)',
            'donation_received': 'rgba(211, 47, 47, 0.05)',
            'campaign_created': 'rgba(243, 156, 18, 0.05)',
            'blood_request': 'rgba(155, 89, 182, 0.05)',
            'payment_received': 'rgba(39, 174, 96, 0.05)'
        };
        return colors[type] || '#f5f5f5';
    }

    // Get border color based on notification type
    getNotificationBorderColor(type) {
        const colors = {
            'case_submitted': '#3498db',
            'case_approved': '#27ae60',
            'case_rejected': '#e74c3c',
            'donation_received': '#c0392b',
            'campaign_created': '#f39c12',
            'blood_request': '#9b59b6',
            'payment_received': '#27ae60'
        };
        return colors[type] || '#95a5a6';
    }

    // Calculate time ago
    getTimeAgo(timestamp) {
        const now = new Date();
        const date = new Date(timestamp);
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        
        return date.toLocaleDateString();
    }

    // Cleanup
    destroy() {
        this.stopPolling();
    }
}

// Global instance
let notificationNavbar;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    notificationNavbar = new NotificationNavbar();
    notificationNavbar.init();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (notificationNavbar) {
        notificationNavbar.destroy();
    }
});
