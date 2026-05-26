const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

class NotificationController {
    // Create notification
    async createNotification(userId, type, title, message, relatedId = null, relatedType = null) {
        try {
            const notificationId = uuidv4();
            const connection = await db.getConnection();
            
            await connection.execute(
                `INSERT INTO NOTIFICATIONS 
                (notification_id, user_id, notification_type, title, message, related_id, related_type, is_read, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [notificationId, userId, type, title, message, relatedId, relatedType, false]
            );
            
            connection.release();
            console.log(`Notification created: ${type} for user ${userId}`);
            return notificationId;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }

    // Get user notifications
    async getNotifications(req, res) {
        try {
            const userId = req.user.userId;
            const limit = req.query.limit || 10;
            const offset = req.query.offset || 0;

            const connection = await db.getConnection();
            
            // Get total count
            const countResult = await connection.query(
                'SELECT COUNT(*) as total FROM NOTIFICATIONS WHERE user_id = ?',
                [userId]
            );
            const totalCount = countResult[0][0].total;

            // Get notifications
            const [notifications] = await connection.query(
                `SELECT * FROM NOTIFICATIONS 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?`,
                [userId, parseInt(limit), parseInt(offset)]
            );

            connection.release();

            res.json({
                success: true,
                data: notifications,
                total: totalCount,
                limit,
                offset
            });
        } catch (error) {
            console.error('Error fetching notifications:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Get unread notification count
    async getUnreadCount(req, res) {
        try {
            const userId = req.user.userId;
            const connection = await db.getConnection();
            
            const [result] = await connection.query(
                'SELECT COUNT(*) as count FROM NOTIFICATIONS WHERE user_id = ? AND is_read = FALSE',
                [userId]
            );

            connection.release();

            res.json({
                success: true,
                unreadCount: result[0].count
            });
        } catch (error) {
            console.error('Error fetching unread count:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Mark notification as read
    async markAsRead(req, res) {
        try {
            const { notificationId } = req.params;
            const userId = req.user.userId;
            const connection = await db.getConnection();
            
            await connection.execute(
                `UPDATE NOTIFICATIONS 
                SET is_read = TRUE, read_at = NOW() 
                WHERE notification_id = ? AND user_id = ?`,
                [notificationId, userId]
            );

            connection.release();

            res.json({ success: true, message: 'Notification marked as read' });
        } catch (error) {
            console.error('Error marking notification as read:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Mark all notifications as read
    async markAllAsRead(req, res) {
        try {
            const userId = req.user.userId;
            const connection = await db.getConnection();
            
            await connection.execute(
                `UPDATE NOTIFICATIONS 
                SET is_read = TRUE, read_at = NOW() 
                WHERE user_id = ? AND is_read = FALSE`,
                [userId]
            );

            connection.release();

            res.json({ success: true, message: 'All notifications marked as read' });
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Delete notification
    async deleteNotification(req, res) {
        try {
            const { notificationId } = req.params;
            const userId = req.user.userId;
            const connection = await db.getConnection();
            
            await connection.execute(
                'DELETE FROM NOTIFICATIONS WHERE notification_id = ? AND user_id = ?',
                [notificationId, userId]
            );

            connection.release();

            res.json({ success: true, message: 'Notification deleted' });
        } catch (error) {
            console.error('Error deleting notification:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Notify Lifeline team about new case submission
    async notifyLifelineTeam(caseId, caseName, patientName) {
        try {
            const connection = await db.getConnection();
            
            // Get all lifeline team members (doctors)
            const [doctors] = await connection.query(
                'SELECT user_id FROM USERS WHERE user_type = "doctor"'
            );

            connection.release();

            // Create notification for each lifeline team member
            for (const doctor of doctors) {
                await this.createNotification(
                    doctor.user_id,
                    'case_submitted',
                    'New Case Submission',
                    `Patient ${patientName} has submitted a new case: "${caseName}". Please review and take action.`,
                    caseId,
                    'patient_case'
                );
            }

            console.log(`Notified ${doctors.length} lifeline team members about new case`);
        } catch (error) {
            console.error('Error notifying lifeline team:', error);
        }
    }

    // Notify patient about case status change
    async notifyCaseStatusChange(userId, caseId, caseName, status) {
        try {
            let title, message;
            const notificationType = status === 'approved' ? 'case_approved' : 'case_rejected';
            
            if (status === 'approved') {
                title = 'Case Approved ✅';
                message = `Your case "${caseName}" has been approved by the Lifeline Charity Team. Donations can now be received.`;
            } else {
                title = 'Case Rejected';
                message = `Your case "${caseName}" has been rejected by the Lifeline Charity Team. Please contact support for more details.`;
            }

            await this.createNotification(
                userId,
                notificationType,
                title,
                message,
                caseId,
                'patient_case'
            );

            console.log(`Notified patient about case ${status}`);
        } catch (error) {
            console.error('Error notifying patient about case status:', error);
        }
    }
}

module.exports = new NotificationController();
