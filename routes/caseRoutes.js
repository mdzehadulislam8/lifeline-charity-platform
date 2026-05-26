// ====================================
// CASES ROUTES
// ====================================

const express = require('express');
const router = express.Router();
const caseController = require('../controllers/caseController');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');

// Mount campaigns listing as alias for frontend reuse
const campaignRoutes = require('./campaignRoutes');
router.use('/campaigns', campaignRoutes);

// Public routes
// Public routes (optional auth allows patient-specific view)
router.get('/', optionalAuthenticate, caseController.getAllCases);
router.get('/:id', caseController.getCaseById);

// Protected routes
// NOTE: /submit must come BEFORE / to match correctly
router.post('/submit', authenticate, caseController.submitCase);
router.post('/', authenticate, caseController.createCase);
router.put('/:id', authenticate, caseController.updateCase);
router.delete('/:id', authenticate, caseController.deleteCase);

module.exports = router;
