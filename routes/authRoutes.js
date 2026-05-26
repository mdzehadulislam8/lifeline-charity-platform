// ====================================
// AUTHENTICATION ROUTES
// ====================================

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authenticate, authController.logout);

// Protected routes
router.get('/verify-token', authenticate, (req, res) => {
    res.json({ valid: true, user: req.user });
});

router.put('/profile', authenticate, authController.updateProfile);

module.exports = router;
