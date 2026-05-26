// ====================================
// ADMIN ROUTES
// ====================================

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, adminOnly } = require('../middleware/auth');

// Middleware to allow both admin and doctor (team) users
const adminOrDoctor = (req, res, next) => {
    if (!req.user || (req.user.userType !== 'admin' && req.user.userType !== 'doctor')) {
        return res.status(403).json({ message: 'Admin or Lifeline Charity Team access required' });
    }
    next();
};

// All routes require authentication
router.use(authenticate);

// IMPORTANT: Specific routes must come before :paramId catch-all routes!

// Get pending approvals from doctors - ADMIN ONLY
router.get('/approvals/pending', adminOnly, adminController.getPendingApprovals);

// Get all approved patients (published) - MUST be before :submissionId catch-all
router.get('/patients/approved/list', adminOnly, adminController.getApprovedPatients);

// Get submission details for review - ADMIN ONLY (catch-all for :submissionId)
router.get('/submissions/:submissionId', adminOnly, adminController.getSubmissionDetails);

// Approve patient (publish to home page) - ADMIN ONLY
router.post('/patients/:submissionId/approve', adminOnly, adminController.approvePatient);

// Reject patient submission - ADMIN ONLY
router.post('/patients/:submissionId/reject', adminOnly, adminController.rejectPatient);

// Update patient details - ADMIN ONLY (catch-all for :patientId)
router.put('/patients/:patientId', adminOnly, adminController.updatePatientDetails);

// Get all cases (for admin management - includes pending/draft) - ADMIN ONLY
router.get('/cases/all', adminOnly, adminController.getAllCases);

// Update case details (title, description, etc.) - Allow both admin and doctor (catch-all for :caseId)
router.put('/cases/:caseId', adminOrDoctor, adminController.updateCase);

// Update case homepage settings (show on home / featured) - Allow both admin and doctor
router.patch('/cases/:caseId/home', adminOrDoctor, adminController.updateCaseHomeSettings);

// Delete a case - Allow both admin and doctor
router.delete('/cases/:caseId', adminOrDoctor, adminController.deleteCase);

// BLOOD REQUESTS - specific routes before catch-all
// Get pending blood requests - ADMIN ONLY
router.get('/blood-requests/pending', adminOnly, adminController.getPendingBloodRequests);

// Approve blood donation request - ADMIN ONLY (catch-all for :donationId)
router.post('/blood-requests/:donationId/approve', adminOnly, adminController.approveBloodRequest);

// Reject blood donation request - ADMIN ONLY
router.post('/blood-requests/:donationId/reject', adminOnly, adminController.rejectBloodRequest);

// Get all users - ADMIN ONLY
router.get('/users/all', adminOnly, adminController.getAllUsers);

module.exports = router;
