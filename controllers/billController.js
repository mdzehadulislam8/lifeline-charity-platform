// ====================================
// BILL CONTROLLER
// Hospital Bill Upload & Verification
// ====================================

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class BillController {
  // Upload hospital bill (patient/family)
  async uploadBill(req, res) {
    try {
      const { caseId, hospitalName, billAmount, billDate, description } = req.body;
      if (!caseId || !hospitalName || !billAmount) {
        return res.status(400).json({ message: 'caseId, hospitalName, and billAmount are required' });
      }

      const billId = uuidv4();
      const connection = await db.getConnection();
      try {
        // Insert bill record
        await connection.execute(
          `INSERT INTO BILLS (bill_id, case_id, hospital_name, amount, bill_date, description, status, uploaded_at, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
          [billId, caseId, hospitalName, Number(billAmount), billDate || new Date(), description || null, new Date(), req.user?.userId || null]
        );

        return res.status(201).json({
          success: true,
          message: 'Bill uploaded successfully. Awaiting team verification.',
          billId,
          bill: {
            billId,
            caseId,
            hospitalName,
            amount: Number(billAmount),
            status: 'pending',
            uploadedAt: new Date()
          }
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('uploadBill error:', error);
      return res.status(500).json({ message: 'Failed to upload bill', error: error.message });
    }
  }

  // Get bills for a case
  async getBillsByCase(req, res) {
    try {
      const { caseId } = req.params;
      const connection = await db.getConnection();
      try {
        const [bills] = await connection.execute(
          `SELECT bill_id, case_id, hospital_name, amount, bill_date, description, status, uploaded_at, verified_at, verified_by
           FROM BILLS WHERE case_id = ? ORDER BY uploaded_at DESC`,
          [caseId]
        );

        res.json({
          success: true,
          data: bills,
          count: bills.length
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('getBillsByCase error:', error);
      return res.status(500).json({ message: 'Failed to fetch bills', error: error.message });
    }
  }

  // Get single bill
  async getBill(req, res) {
    try {
      const { billId } = req.params;
      const connection = await db.getConnection();
      try {
        const [rows] = await connection.execute(
          `SELECT * FROM BILLS WHERE bill_id = ? LIMIT 1`,
          [billId]
        );

        if (!rows || !rows.length) {
          return res.status(404).json({ message: 'Bill not found' });
        }

        res.json({
          success: true,
          data: rows[0]
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('getBill error:', error);
      return res.status(500).json({ message: 'Failed to fetch bill', error: error.message });
    }
  }

  // Admin: Verify bill and approve payout
  async verifyBill(req, res) {
    try {
      const { billId } = req.params;
      const { approved, comment } = req.body;

      if (typeof approved !== 'boolean') {
        return res.status(400).json({ message: 'approved (boolean) is required' });
      }

      const connection = await db.getConnection();
      try {
        // Get bill details
        const [billRows] = await connection.execute(
          `SELECT bill_id, case_id, amount, hospital_name FROM BILLS WHERE bill_id = ? LIMIT 1`,
          [billId]
        );

        if (!billRows || !billRows.length) {
          return res.status(404).json({ message: 'Bill not found' });
        }

        const bill = billRows[0];
        const status = approved ? 'verified' : 'rejected';

        // Update bill status
        await connection.execute(
          `UPDATE BILLS SET status = ?, verified_at = ?, verified_by = ?, comment = ? WHERE bill_id = ?`,
          [status, new Date(), req.user?.userId || 'admin', comment || null, billId]
        );

        // If approved, create a payout request to the hospital
        if (approved) {
          const payoutId = uuidv4();
          await connection.execute(
            `INSERT INTO PAYOUTS (payout_id, case_id, bill_id, amount, hospital_name, status, requested_at)
             VALUES (?, ?, ?, ?, ?, 'requested', ?)`,
            [payoutId, bill.case_id, billId, bill.amount, bill.hospital_name, new Date()]
          );

          return res.json({
            success: true,
            message: 'Bill verified. Payout request created and pending hospital confirmation.',
            billId,
            payoutId,
            status: 'verified'
          });
        }

        return res.json({
          success: true,
          message: 'Bill rejected.',
          billId,
          status: 'rejected'
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('verifyBill error:', error);
      return res.status(500).json({ message: 'Failed to verify bill', error: error.message });
    }
  }

  // Get pending bills for admin dashboard
  async getPendingBills(req, res) {
    try {
      const connection = await db.getConnection();
      try {
        const [bills] = await connection.execute(
          `SELECT b.bill_id, b.case_id, b.hospital_name, b.amount, b.bill_date, b.status, b.uploaded_at,
                  pc.first_name, pc.last_name, pc.phone_number
           FROM BILLS b
           JOIN PATIENT_CASES pc ON b.case_id = pc.case_id
           WHERE b.status = 'pending'
           ORDER BY b.uploaded_at ASC`
        );

        res.json({
          success: true,
          data: bills,
          count: bills.length
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('getPendingBills error:', error);
      return res.status(500).json({ message: 'Failed to fetch pending bills', error: error.message });
    }
  }
}

module.exports = new BillController();
