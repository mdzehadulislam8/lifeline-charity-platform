// ====================================
// PAYOUT ROUTES
// ====================================

const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');
const { authenticate } = require('../middleware/auth');

// Admin: Get all payouts (with optional filters)
router.get('/', authenticate, payoutController.getPayouts);

// Get single payout
router.get('/:payoutId', authenticate, payoutController.getPayout);

// Get case wallet balance and pending payouts
router.get('/wallet/:caseId', authenticate, payoutController.getCaseWallet);

// Admin: Approve payout and transfer funds
router.post('/:payoutId/approve', authenticate, payoutController.approvePayout);

// Hospital: Confirm payout receipt
router.post('/:payoutId/confirm-receipt', authenticate, payoutController.confirmPayoutReceipt);

// Admin: Reject payout
router.post('/:payoutId/reject', authenticate, payoutController.rejectPayout);

module.exports = router;
