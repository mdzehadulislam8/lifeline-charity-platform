const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const { authenticate } = require('../middleware/auth');

// Public: list published campaigns
router.get('/', campaignController.listCampaigns);

// Public: get single campaign
router.get('/:id', campaignController.getCampaign);

// Protected: create campaign (organizer must be logged in)
router.post('/', authenticate, campaignController.createCampaign);

module.exports = router;
