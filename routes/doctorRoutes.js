// ====================================
// DOCTOR ROUTES
// ====================================

const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { authenticate, doctorOnly } = require('../middleware/auth');

// All routes require doctor authentication
router.use(authenticate, doctorOnly);

// IMPORTANT: Specific routes must come before :submissionId catch-all route!
// Get all pending patient submissions
router.get('/submissions/pending', doctorController.getPendingSubmissions);

// Get approved submissions (awaiting admin review) - MUST be before :submissionId
router.get('/submissions/status/approved', doctorController.getApprovedSubmissions);

// Get medical documents for a case - MUST be before catch-all routes
router.get('/cases/:caseId/documents', doctorController.getMedicalDocuments);

// Get submission details - MUST be last as it's the catch-all
router.get('/submissions/:submissionId', doctorController.getSubmissionDetails);

// Approve submission
router.post('/submissions/:submissionId/approve', doctorController.approveSubmission);

// Reject submission
router.post('/submissions/:submissionId/reject', doctorController.rejectSubmission);

module.exports = router;
