const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const fs = require('fs');
const path = require('path');

// Ensure uploads path exists
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads', 'campaigns');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

class CampaignController {
  async createCampaign(req, res) {
    const connection = await db.getConnection();
    try {
      // Determine organizer
      let organizerId = req.body.organizerId || null;
      const organizerName = req.body.organizerName || null;
      const organizerEmail = req.body.organizerEmail || null;

      // Prefer authenticated user's id if available
      if (!organizerId && req.user) {
        organizerId = req.user.userId || req.user.id || null;
      }

      // If no organizerId but an organizer name/email was provided, create an organizer row
      if (!organizerId && organizerName) {
        organizerId = uuidv4();
        await connection.execute(
          `INSERT INTO ORGANIZERS (organizer_id, name, email, created_at) VALUES (?, ?, ?, NOW())`,
          [organizerId, organizerName, organizerEmail || null]
        );
      }

      const campaignId = uuidv4();
      const { patientName, title, category, goalAmount, hospitalName, description } = req.body;

      await connection.execute(
        `INSERT INTO CAMPAIGNS (campaign_id, organizer_id, patient_name, title, category, goal_amount, hospital_name, description, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [campaignId, organizerId, patientName, title, category, goalAmount || 0, hospitalName, description]
      );

      // Handle file uploads (express-fileupload middleware)
      if (req.files && req.files.documents) {
        const docs = Array.isArray(req.files.documents) ? req.files.documents : (req.files.documents.length ? req.files.documents : [req.files.documents]);

        // Create campaign-specific folder
        const campaignDir = path.join(UPLOADS_DIR, campaignId);
        if (!fs.existsSync(campaignDir)) fs.mkdirSync(campaignDir, { recursive: true });

        for (const file of docs) {
          // `file` is an UploadedFile from express-fileupload
          const safeName = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
          const destPath = path.join(campaignDir, safeName);
          await file.mv(destPath);

          const relPath = path.relative(path.join(__dirname, '..', 'public'), destPath).replace(/\\/g, '/');

          // Persist file metadata
          await connection.execute(
            `INSERT INTO CAMPAIGN_FILES (campaign_id, file_path, file_name, file_type, uploaded_at) VALUES (?, ?, ?, ?, NOW())`,
            [campaignId, relPath, file.name, file.mimetype]
          );
        }
      }

      await connection.release();
      return res.json({ success: true, campaignId });
    } catch (err) {
      await connection.release();
      console.error('createCampaign error', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  async getCampaign(req, res) {
    try {
      const campaignId = req.params.id;
      const [rows] = await db.query('SELECT * FROM CAMPAIGNS WHERE campaign_id = ?', [campaignId]);
      if (!rows || rows.length === 0) return res.status(404).json({ message: 'Campaign not found' });

      const campaign = rows[0];

      // Fetch uploaded files for the campaign (if any)
      try {
        const [files] = await db.query('SELECT file_path, file_name, file_type, uploaded_at FROM CAMPAIGN_FILES WHERE campaign_id = ? ORDER BY uploaded_at ASC', [campaignId]);
        campaign.files = (files || []).map(f => ({
          name: f.file_name,
          type: f.file_type,
          url: f.file_path ? ('/' + f.file_path.replace(/\\\\/g, '/')) : null,
          uploadedAt: f.uploaded_at
        }));
      } catch (err) {
        // If CAMPAIGN_FILES table doesn't exist yet, ignore and return campaign without files
        campaign.files = [];
      }

      return res.json(campaign);
    } catch (err) {
      console.error('getCampaign error', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }

  async listCampaigns(req, res) {
    try {
      const [rows] = await db.query('SELECT * FROM CAMPAIGNS WHERE status = "published" ORDER BY created_at DESC LIMIT 100');
      return res.json(rows);
    } catch (err) {
      console.error('listCampaigns error', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
}

module.exports = new CampaignController();
