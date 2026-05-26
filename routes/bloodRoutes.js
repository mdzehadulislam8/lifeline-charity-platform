// ====================================
// BLOOD DONATION ROUTES
// ====================================

const express = require('express');
const router = express.Router();
const bloodController = require('../controllers/bloodController');
const { authenticate } = require('../middleware/auth');

// Public routes
router.get('/donors', (req, res) => bloodController.getAvailableDonors(req, res));
router.get('/donor/:id', (req, res) => bloodController.getDonorById(req, res));
router.get('/cases', (req, res) => bloodController.getBloodCases(req, res));
router.get('/cases/:caseId', (req, res) => bloodController.getBloodCaseDetails(req, res));

// Protected routes - Blood Request (existing system)
router.post('/register-donor', authenticate, (req, res) => bloodController.registerBloodDonor(req, res));
router.post('/request', authenticate, (req, res) => bloodController.createBloodRequest(req, res));
router.get('/requests/:userId', authenticate, (req, res) => bloodController.getUserBloodRequests(req, res));
router.get('/requests', authenticate, (req, res) => bloodController.getIncomingRequests(req, res));
router.patch('/requests/:id/accept', authenticate, (req, res) => bloodController.acceptBloodRequest(req, res));
router.patch('/requests/:id/reject', authenticate, (req, res) => bloodController.rejectBloodRequest(req, res));
router.put('/donor/:id', authenticate, (req, res) => bloodController.updateDonorAvailability(req, res));

// Protected routes - Blood Case (patient initiated)
router.post('/case', authenticate, (req, res) => bloodController.submitBloodCase(req, res));
router.get('/patient/cases', authenticate, (req, res) => bloodController.getPatientCases(req, res));
router.patch('/case/:caseId/respond', authenticate, (req, res) => bloodController.respondToCase(req, res));
router.get('/donor/notifications', authenticate, (req, res) => bloodController.getDonorCaseNotifications(req, res));
router.post('/notifications/read', authenticate, (req, res) => bloodController.markNotificationsAsRead(req, res));

module.exports = router;
