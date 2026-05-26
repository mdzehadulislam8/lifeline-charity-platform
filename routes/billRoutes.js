// ====================================
// BILL ROUTES
// ====================================

const express = require('express');
const router = express.Router();
const billController = require('../controllers/billController');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');

// Patient/Family: Upload bill
router.post('/', authenticate, billController.uploadBill);

// Get bills for a case (public)
router.get('/case/:caseId', billController.getBillsByCase);

// Get single bill
router.get('/:billId', billController.getBill);

// Admin: Verify bill
router.post('/:billId/verify', authenticate, billController.verifyBill);

// Admin: Get pending bills
router.get('/pending/list', authenticate, billController.getPendingBills);

module.exports = router;
