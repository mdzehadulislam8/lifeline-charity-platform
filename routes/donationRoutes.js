// ====================================
// DONATIONS ROUTES
// ====================================

const express = require('express');
const router = express.Router();
const donationController = require('../controllers/donationController');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');

// Public routes
// Specific routes first to avoid conflicts with parameterized routes
router.get('/user/history', authenticate, donationController.getUserDonationHistory);

// Allow donations from both authenticated and anonymous users (optional auth)
router.post('/', optionalAuthenticate, donationController.createDonation);

// Allow query-based fetch used by patient dashboard: GET /api/donations?caseId=...
router.get('/', donationController.getDonationsForCase);

// Backwards-compatible route: GET /api/donations/:caseId
router.get('/:caseId', donationController.getDonationsByCase);

// Send thank you message (patient to donor)
router.post('/:donationId/thank-you', authenticate, donationController.sendThankYouMessage);

module.exports = router;
