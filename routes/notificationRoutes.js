const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

// Get all notifications for user
router.get('/', authenticate, (req, res) => notificationController.getNotifications(req, res));

// Get unread count
router.get('/unread/count', authenticate, (req, res) => notificationController.getUnreadCount(req, res));

// Mark notification as read
router.patch('/:notificationId/read', authenticate, (req, res) => notificationController.markAsRead(req, res));

// Mark all as read
router.patch('/read/all', authenticate, (req, res) => notificationController.markAllAsRead(req, res));

// Delete notification
router.delete('/:notificationId', authenticate, (req, res) => notificationController.deleteNotification(req, res));

module.exports = router;
