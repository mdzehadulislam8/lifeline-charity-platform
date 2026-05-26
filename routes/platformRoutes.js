// ====================================
// PLATFORM ROUTES
// Donations to Lifeline fund and allocations
// ====================================

const express = require('express');
const router = express.Router();
const platformController = require('../controllers/platformController');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');

// Allow both admin and Lifeline team (doctor) users for allocations
const adminOrDoctor = (req, res, next) => {
  if (!req.user || (req.user.userType !== 'admin' && req.user.userType !== 'doctor')) {
    return res.status(403).json({ message: 'Admin or Lifeline Charity Team access required' });
  }
  next();
};

// Public: donate to platform (anonymous allowed)
router.post('/donations', optionalAuthenticate, platformController.donateToPlatform);

// Public: view platform fund summary
router.get('/fund', platformController.getPlatformFund);

// Team donation to case using platform fund
router.post('/donate-to-case', authenticate, adminOrDoctor, platformController.donateFromPlatformToCase);

// Allocation disabled by requirement: Lifeline team will donate directly to cases
// router.post('/allocate', authenticate, adminOrDoctor, platformController.allocateToCase);

module.exports = router;
