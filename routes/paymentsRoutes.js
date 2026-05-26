const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');

// Create a payment intent (requires authentication for donor info, but allow guests)
router.post('/create-intent', optionalAuthenticate, paymentController.createPaymentIntent.bind(paymentController));
// Confirm a pending payment (mobile wallets / bank transfers)
router.post('/confirm', optionalAuthenticate, paymentController.confirmPayment.bind(paymentController));

module.exports = router;
