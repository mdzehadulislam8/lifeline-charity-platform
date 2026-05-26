const express = require('express');
const router = express.Router();
const { getStats, markCaseSatisfied } = require('../controllers/statsController');
const { authenticate } = require('../middleware/auth');

// GET /api/stats
router.get('/', getStats);

// The case-satisfaction endpoint (user-mark-resolved) has been disabled —
// marking cases as 'satisfied' from the user side is removed per product decision.

module.exports = router;
