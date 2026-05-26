// ====================================
// PAYOUT CONTROLLER
// Hospital Payout & Fund Transfers
// ====================================

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class PayoutController {
  // Get all payouts (admin dashboard)
  async getPayouts(req, res) {
    try {
      const { status, caseId } = req.query;
      const connection = await db.getConnection();
      try {
        let query = `SELECT p.payout_id, p.case_id, p.bill_id, p.amount, p.hospital_name, p.status, p.requested_at, p.approved_at, p.paid_at, 
                             pc.first_name, pc.last_name
                     FROM PAYOUTS p
                     JOIN PATIENT_CASES pc ON p.case_id = pc.case_id`;
        let params = [];

        if (status) {
          query += ` WHERE p.status = ?`;
          params.push(status);
        }
        if (caseId) {
          query += status ? ` AND p.case_id = ?` : ` WHERE p.case_id = ?`;
          params.push(caseId);
        }

        query += ` ORDER BY p.requested_at DESC`;

        const [payouts] = await connection.execute(query, params);
        res.json({
          success: true,
          data: payouts,
          count: payouts.length
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('getPayouts error:', error);
      return res.status(500).json({ message: 'Failed to fetch payouts', error: error.message });
    }
  }

  // Get single payout
  async getPayout(req, res) {
    try {
      const { payoutId } = req.params;
      const connection = await db.getConnection();
      try {
        const [rows] = await connection.execute(
          `SELECT * FROM PAYOUTS WHERE payout_id = ? LIMIT 1`,
          [payoutId]
        );

        if (!rows || !rows.length) {
          return res.status(404).json({ message: 'Payout not found' });
        }

        res.json({
          success: true,
          data: rows[0]
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('getPayout error:', error);
      return res.status(500).json({ message: 'Failed to fetch payout', error: error.message });
    }
  }

  // Admin: Approve payout (transfer funds to hospital)
  async approvePayout(req, res) {
    try {
      const { payoutId } = req.params;
      const { comment } = req.body;

      const connection = await db.getConnection();
      try {
        // Get payout details
        const [payoutRows] = await connection.execute(
          `SELECT payout_id, case_id, bill_id, amount FROM PAYOUTS WHERE payout_id = ? LIMIT 1`,
          [payoutId]
        );

        if (!payoutRows || !payoutRows.length) {
          return res.status(404).json({ message: 'Payout not found' });
        }

        const payout = payoutRows[0];

        // Check if wallet has sufficient funds
        const [walletRows] = await connection.execute(
          `SELECT wallet_id, balance FROM WALLETS WHERE case_id = ? LIMIT 1`,
          [payout.case_id]
        );

        if (!walletRows || !walletRows.length) {
          return res.status(400).json({ message: 'No wallet found for this case' });
        }

        const wallet = walletRows[0];
        if (wallet.balance < payout.amount) {
          return res.status(400).json({
            message: 'Insufficient funds in wallet',
            available: wallet.balance,
            required: payout.amount
          });
        }

        // Deduct from wallet and mark payout as paid
        await connection.execute(
          `UPDATE WALLETS SET balance = balance - ? WHERE wallet_id = ?`,
          [payout.amount, wallet.wallet_id]
        );

        await connection.execute(
          `UPDATE PAYOUTS SET status = 'paid', approved_at = ?, paid_at = ?, approved_by = ?, comment = ? WHERE payout_id = ?`,
          [new Date(), new Date(), req.user?.userId || 'admin', comment || null, payoutId]
        );

        // Record transaction
        const transactionId = uuidv4();
        await connection.execute(
          `INSERT INTO TRANSACTIONS (tx_id, payout_id, case_id, type, amount, status, created_at)
           VALUES (?, ?, ?, 'hospital_payout', ?, 'completed', ?)`,
          [transactionId, payoutId, payout.case_id, payout.amount, new Date()]
        );

        return res.json({
          success: true,
          message: 'Payout approved and funds transferred to hospital',
          payoutId,
          transactionId,
          status: 'paid',
          remainingBalance: wallet.balance - payout.amount
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('approvePayout error:', error);
      return res.status(500).json({ message: 'Failed to approve payout', error: error.message });
    }
  }

  // Hospital: Confirm receipt of payout
  async confirmPayoutReceipt(req, res) {
    try {
      const { payoutId } = req.params;
      const { receiptNumber, comment } = req.body;

      const connection = await db.getConnection();
      try {
        const [payoutRows] = await connection.execute(
          `SELECT payout_id, status FROM PAYOUTS WHERE payout_id = ? LIMIT 1`,
          [payoutId]
        );

        if (!payoutRows || !payoutRows.length) {
          return res.status(404).json({ message: 'Payout not found' });
        }

        const payout = payoutRows[0];
        if (payout.status !== 'paid') {
          return res.status(400).json({ message: 'Only paid payouts can be confirmed' });
        }

        // Update payout status to confirmed
        await connection.execute(
          `UPDATE PAYOUTS SET status = 'confirmed', receipt_number = ?, confirmed_at = ?, confirmed_comment = ? WHERE payout_id = ?`,
          [receiptNumber || null, new Date(), comment || null, payoutId]
        );

        return res.json({
          success: true,
          message: 'Payout receipt confirmed',
          payoutId,
          status: 'confirmed'
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('confirmPayoutReceipt error:', error);
      return res.status(500).json({ message: 'Failed to confirm receipt', error: error.message });
    }
  }

  // Reject payout
  async rejectPayout(req, res) {
    try {
      const { payoutId } = req.params;
      const { reason } = req.body;

      const connection = await db.getConnection();
      try {
        await connection.execute(
          `UPDATE PAYOUTS SET status = 'rejected', rejection_reason = ?, rejected_at = ?, rejected_by = ? WHERE payout_id = ?`,
          [reason || null, new Date(), req.user?.userId || 'admin', payoutId]
        );

        return res.json({
          success: true,
          message: 'Payout rejected',
          payoutId,
          status: 'rejected'
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('rejectPayout error:', error);
      return res.status(500).json({ message: 'Failed to reject payout', error: error.message });
    }
  }

  // Get wallet balance for a case
  async getCaseWallet(req, res) {
    try {
      const { caseId } = req.params;
      const connection = await db.getConnection();
      try {
        const [walletRows] = await connection.execute(
          `SELECT w.wallet_id, w.balance, pc.first_name, pc.last_name
           FROM WALLETS w
           JOIN PATIENT_CASES pc ON w.case_id = pc.case_id
           WHERE w.case_id = ? LIMIT 1`,
          [caseId]
        );

        if (!walletRows || !walletRows.length) {
          return res.status(404).json({ message: 'Wallet not found for this case' });
        }

        const wallet = walletRows[0];

        // Get pending payouts for this case
        const [pendingPayouts] = await connection.execute(
          `SELECT SUM(amount) as totalPending FROM PAYOUTS WHERE case_id = ? AND status IN ('requested', 'approved')`,
          [caseId]
        );

        const totalPending = pendingPayouts[0]?.totalPending || 0;
        const availableForWithdrawal = wallet.balance - totalPending;

        res.json({
          success: true,
          wallet: {
            caseId,
            walletId: wallet.wallet_id,
            balance: wallet.balance,
            patientName: `${wallet.first_name} ${wallet.last_name}`,
            pendingPayouts: totalPending,
            availableForWithdrawal: Math.max(0, availableForWithdrawal)
          }
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('getCaseWallet error:', error);
      return res.status(500).json({ message: 'Failed to fetch wallet', error: error.message });
    }
  }
}

module.exports = new PayoutController();
