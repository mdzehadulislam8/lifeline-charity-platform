// ====================================
// NOTIFICATION SYSTEM
// ====================================

class NotificationSystem {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.pollInterval = 5000; // Poll every 5 seconds
        this.initializeUI();
    }

    initializeUI() {
        // Note: Add notification-bell.html to your navbar
        this.setupEventListeners();
        this.loadNotifications();
        this.startPolling();
    }

    setupEventListeners() {
        const notificationBtn = document.getElementById('notificationBtn');
        const closeBtn = document.getElementById('closeNotificationPanel');
        const markAllReadBtn = document.getElementById('markAllReadBtn');
        const notificationPanel = document.getElementById('notificationPanel');

        if (notificationBtn) {
            notificationBtn.addEventListener('click', () => {
                notificationPanel.style.display = 
                    notificationPanel.style.display === 'none' ? 'flex' : 'none';
                if (notificationPanel.style.display === 'flex') {
                    this.loadNotifications();
                }
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                notificationPanel.style.display = 'none';
            });
        }

        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', () => {
                this.markAllAsRead();
            });
        }

        // Close notification panel when clicking outside
        document.addEventListener('click', (e) => {
            if (notificationPanel && !notificationPanel.contains(e.target) && 
                !notificationBtn.contains(e.target)) {
                notificationPanel.style.display = 'none';
            }
        });
    }

    async loadNotifications() {
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            if (!token) return;

            const response = await fetch('/api/notifications?limit=10', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to load notifications');

            const data = await response.json();
            this.notifications = data.data || [];
            await this.getUnreadCount();
            this.renderNotifications();
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    async getUnreadCount() {
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            if (!token) return;

            const response = await fetch('/api/notifications/unread/count', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to get unread count');

            const data = await response.json();
            this.unreadCount = data.unreadCount;
            this.updateBadge();
        } catch (error) {
            console.error('Error getting unread count:', error);
        }
    }

    updateBadge() {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    renderNotifications() {
        const list = document.getElementById('notificationList');
        if (!list) return;

        if (this.notifications.length === 0) {
            list.innerHTML = '<p class="empty-state">No notifications</p>';
            return;
        }

        list.innerHTML = this.notifications.map(notification => `
            <div class="notification-item ${!notification.is_read ? 'unread' : ''}" 
                 data-id="${notification.notification_id}">
                <div class="notification-item-title">${notification.title}</div>
                <div class="notification-item-message">${notification.message}</div>
                <div class="notification-item-time">${this.formatTime(notification.created_at)}</div>
            </div>
        `).join('');

        // Add click listeners to mark as read
        list.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-id');
                this.markAsRead(id);
            });
        });
    }

    async markAsRead(notificationId) {
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            if (!token) return;

            await fetch(`/api/notifications/${notificationId}/read`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            this.loadNotifications();
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    async markAllAsRead() {
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            if (!token) return;

            await fetch('/api/notifications/read/all', {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            this.loadNotifications();
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }

    startPolling() {
        // Poll for new notifications every 5 seconds
        setInterval(() => {
            this.getUnreadCount();
        }, this.pollInterval);
    }

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
        
        return date.toLocaleDateString();
    }
}

// Initialize notification system when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('token') || localStorage.getItem('authToken')) {
        window.notificationSystem = new NotificationSystem();
    }
});
