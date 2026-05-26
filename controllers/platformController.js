// ====================================
// PLATFORM CONTROLLER
// General donations to Lifeline pool and allocations to cases
// ====================================

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Ensure required tables exist (bootstrap for environments missing migrations)
async function ensureTables(connection) {
  try {
    await connection.execute(`CREATE TABLE IF NOT EXISTS PLATFORM_DONATIONS (
      platform_donation_id CHAR(36) PRIMARY KEY,
      donor_id CHAR(36),
      amount DECIMAL(14,2) NOT NULL,
      payment_method VARCHAR(50),
      provider_reference VARCHAR(255),
      donation_date DATETIME NOT NULL,
      status VARCHAR(50) DEFAULT 'completed',
      is_anonymous TINYINT(1) DEFAULT 0,
      guest_name VARCHAR(255),
      guest_email VARCHAR(255),
      message TEXT
    )`);

    await connection.execute(`CREATE TABLE IF NOT EXISTS PLATFORM_ALLOCATIONS (
      allocation_id CHAR(36) PRIMARY KEY,
      case_id VARCHAR(255) NOT NULL,
      amount DECIMAL(14,2) NOT NULL,
      allocated_by VARCHAR(255),
      allocated_at DATETIME NOT NULL,
      comment TEXT
    )`);

    await connection.execute(`CREATE TABLE IF NOT EXISTS WALLETS (
      wallet_id CHAR(36) PRIMARY KEY,
      case_id VARCHAR(255),
      campaign_id VARCHAR(255),
      balance DECIMAL(14,2) DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'BDT',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch (e) {
    // swallow errors to avoid breaking flow; tables may already exist
    console.warn('ensureTables warning:', e.message);
  }
}

class PlatformController {
  // Create a donation to Lifeline platform fund
  async donateToPlatform(req, res) {
    try {
      const { amount, paymentMethod, providerReference, isAnonymous, guestName, guestEmail, message } = req.body;

      const donateAmount = Number(amount || 0);
      if (!donateAmount || donateAmount < 100) {
        return res.status(400).json({ success: false, message: 'Minimum donation amount is ৳100' });
      }

      const connection = await db.getConnection();
      try {
        await ensureTables(connection);
        const donationDate = new Date();
        const isAnon = !!isAnonymous || !req.user;

        // Resolve donor_id from authenticated user if present
        let donorId = null;
        if (!isAnon && req.user) {
          const userId = req.user.userId || req.user.id;
          const [donorRows] = await connection.execute('SELECT donor_id FROM DONORS WHERE user_id = ? LIMIT 1', [userId]);
          if (donorRows && donorRows.length) {
            donorId = donorRows[0].donor_id;
          } else {
            donorId = uuidv4();
            await connection.execute(
              'INSERT INTO DONORS (donor_id, user_id, preferred_payment_method, total_donated_amount, last_donation_date) VALUES (?, ?, ?, 0, ?)',
              [donorId, userId, paymentMethod || null, donationDate]
            );
          }
        }

        // Insert platform donation record
        const platformDonationId = uuidv4();
        await connection.execute(
          `INSERT INTO PLATFORM_DONATIONS 
           (platform_donation_id, donor_id, amount, payment_method, provider_reference, donation_date, status, is_anonymous, guest_name, guest_email, message)
           VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)`,
          [platformDonationId, donorId, donateAmount, paymentMethod || null, providerReference || null, donationDate, isAnon ? 1 : 0, isAnon ? 'Anonymous' : (guestName || null), isAnon ? '' : (guestEmail || null), message || null]
        );

        // Upsert platform wallet (WALLETS row with both case_id and campaign_id NULL)
        const [platWalletRows] = await connection.execute(
          'SELECT wallet_id, balance FROM WALLETS WHERE case_id IS NULL AND campaign_id IS NULL LIMIT 1'
        );

        if (platWalletRows && platWalletRows.length) {
          await connection.execute('UPDATE WALLETS SET balance = balance + ? WHERE wallet_id = ?', [donateAmount, platWalletRows[0].wallet_id]);
        } else {
          const walletId = uuidv4();
          await connection.execute(
            'INSERT INTO WALLETS (wallet_id, case_id, campaign_id, balance, currency, created_at) VALUES (?, NULL, NULL, ?, "BDT", ?)',
            [walletId, donateAmount, donationDate]
          );
        }

        // Record transaction for audit
        const txId = uuidv4();
        await connection.execute(
          `INSERT INTO TRANSACTIONS (tx_id, payment_id, related_id, type, amount, currency, status, created_at)
           VALUES (?, NULL, ?, 'platform_donation', ?, 'BDT', 'completed', ?)`,
          [txId, platformDonationId, donateAmount, donationDate]
        );

        return res.status(201).json({
          success: true,
          message: 'Donation recorded to Lifeline fund',
          platformDonationId,
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('donateToPlatform error:', error);
      return res.status(500).json({ success: false, message: 'Failed to process donation', error: error.message });
    }
  }

  // Get platform fund balance and recent donations
  async getPlatformFund(req, res) {
    try {
      const connection = await db.getConnection();
      try {
        await ensureTables(connection);
        let wallet = { wallet_id: null, balance: 0, currency: 'BDT' };
        let recentDonations = [];
        let totalDonated = 0;
        let totalReceived = 0;
        let totalDisbursed = 0;
        // Allocation flow disabled; keep zero/empty for compatibility
        let totalAllocated = 0;
        let recentAllocations = [];
        
        try {
          const [walletRows] = await connection.execute(
            'SELECT wallet_id, balance, currency, created_at FROM WALLETS WHERE case_id IS NULL AND campaign_id IS NULL LIMIT 1'
          );
          if (walletRows && walletRows.length) wallet = walletRows[0];
        } catch (e) {
          console.warn('getPlatformFund wallet query warning:', e.message);
        }

        try {
          const [donRows] = await connection.execute(
            `SELECT platform_donation_id, amount, donation_date, is_anonymous, guest_name
             FROM PLATFORM_DONATIONS 
             ORDER BY donation_date DESC
             LIMIT 10`
          );
          recentDonations = donRows;

          // Gross received into the Lifeline fund (completed only)
          const [sumPlatformRows] = await connection.execute(
            `SELECT COALESCE(SUM(amount),0) AS total FROM PLATFORM_DONATIONS WHERE status = 'completed'`
          );
          totalReceived = Number(sumPlatformRows?.[0]?.total || 0);

          // Total sent from the Lifeline fund to patient cases (platform-sourced donations)
          const [sumDisbursedRows] = await connection.execute(
            `SELECT COALESCE(SUM(amount),0) AS total FROM DONATIONS WHERE payment_method = 'platform' AND status = 'completed'`
          );
          totalDisbursed = Number(sumDisbursedRows?.[0]?.total || 0);

          // Net remaining from gross receipts after disbursements (should align with wallet balance)
          totalDonated = Math.max(0, totalReceived - totalDisbursed);
        } catch (e) {
          console.warn('getPlatformFund donations query warning:', e.message);
        }

        // Allocation queries removed as per new requirement

        return res.json({
          success: true,
          fund: wallet,
          recentDonations,
          totalDonated,
          totalReceived,
          totalDisbursed,
          totalAllocated,
          recentAllocations
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('getPlatformFund error:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch platform fund', error: error.message });
    }
  }

  // Donate to a specific patient case using platform fund (admin or Lifeline team)
  async donateFromPlatformToCase(req, res) {
    try {
      const { caseId, amount, comment } = req.body;
      const donateAmount = Number(amount || 0);
      if (!caseId || !donateAmount || donateAmount <= 0) {
        return res.status(400).json({ success: false, message: 'caseId and positive amount required' });
      }

      const connection = await db.getConnection();
      try {
        await ensureTables(connection);

        // Check platform wallet balance
        const [platWalletRows] = await connection.execute(
          'SELECT wallet_id, balance FROM WALLETS WHERE case_id IS NULL AND campaign_id IS NULL LIMIT 1'
        );

        if (!platWalletRows || !platWalletRows.length) {
          return res.status(400).json({ success: false, message: 'Platform fund is not initialized' });
        }

        const platWallet = platWalletRows[0];
        if (platWallet.balance < donateAmount) {
          return res.status(400).json({ success: false, message: 'Insufficient platform funds', available: platWallet.balance });
        }

        // Deduct from platform wallet
        await connection.execute('UPDATE WALLETS SET balance = balance - ? WHERE wallet_id = ?', [donateAmount, platWallet.wallet_id]);

        // Create a donation record for the case, marked as coming from platform
        const donationId = uuidv4();
        const transactionUk = uuidv4();
        const donationDate = new Date();

        await connection.execute(
          `INSERT INTO DONATIONS 
           (donation_id, case_id, donor_id, amount, payment_method, transaction_uk, donation_date, status, is_anonymous, guest_name, guest_email)
           VALUES (?, ?, NULL, ?, 'platform', ?, ?, 'completed', 1, 'Lifeline Charity Team', '')`,
          [donationId, caseId, donateAmount, transactionUk, donationDate]
        );

        // Credit case wallet (create if missing)
        const [caseWalletRows] = await connection.execute('SELECT wallet_id FROM WALLETS WHERE case_id = ? LIMIT 1', [caseId]);
        if (caseWalletRows && caseWalletRows.length) {
          await connection.execute('UPDATE WALLETS SET balance = balance + ? WHERE wallet_id = ?', [donateAmount, caseWalletRows[0].wallet_id]);
        } else {
          const newWalletId = uuidv4();
          await connection.execute('INSERT INTO WALLETS (wallet_id, case_id, balance, currency, created_at) VALUES (?, ?, ?, "BDT", ?)', [newWalletId, caseId, donateAmount, new Date()]);
        }

        // Update collected_amount on case for visibility
        await connection.execute('UPDATE PATIENT_CASES SET collected_amount = collected_amount + ? WHERE case_id = ?', [donateAmount, caseId]);

        // Record transaction for audit
        const txId = uuidv4();
        await connection.execute(
          `INSERT INTO TRANSACTIONS (tx_id, related_id, type, amount, currency, status, created_at)
           VALUES (?, ?, 'platform_case_donation', ?, 'BDT', 'completed', ?)`,
          [txId, donationId, donateAmount, donationDate]
        );

        return res.json({ success: true, message: 'Donated from platform fund to case', donationId });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('donateFromPlatformToCase error:', error);
      return res.status(500).json({ success: false, message: 'Donation from platform failed', error: error.message });
    }
  }

  // Allocate platform funds to a specific patient case (admin or Lifeline team)
  async allocateToCase(req, res) {
    try {
      const { caseId, amount, comment } = req.body;
      const allocateAmount = Number(amount || 0);
      if (!caseId || !allocateAmount || allocateAmount <= 0) {
        return res.status(400).json({ success: false, message: 'caseId and positive amount required' });
      }

      const connection = await db.getConnection();
      try {
        // Check platform wallet balance
        const [platWalletRows] = await connection.execute(
          'SELECT wallet_id, balance FROM WALLETS WHERE case_id IS NULL AND campaign_id IS NULL LIMIT 1'
        );

        if (!platWalletRows || !platWalletRows.length) {
          return res.status(400).json({ success: false, message: 'Platform fund is not initialized' });
        }

        const platWallet = platWalletRows[0];
        if (platWallet.balance < allocateAmount) {
          return res.status(400).json({ success: false, message: 'Insufficient platform funds', available: platWallet.balance });
        }

        // Deduct from platform wallet
        await connection.execute('UPDATE WALLETS SET balance = balance - ? WHERE wallet_id = ?', [allocateAmount, platWallet.wallet_id]);

        // Credit case wallet (create if missing)
        const [caseWalletRows] = await connection.execute('SELECT wallet_id FROM WALLETS WHERE case_id = ? LIMIT 1', [caseId]);
        if (caseWalletRows && caseWalletRows.length) {
          await connection.execute('UPDATE WALLETS SET balance = balance + ? WHERE wallet_id = ?', [allocateAmount, caseWalletRows[0].wallet_id]);
        } else {
          const newWalletId = uuidv4();
          await connection.execute('INSERT INTO WALLETS (wallet_id, case_id, balance, currency, created_at) VALUES (?, ?, ?, "BDT", ?)', [newWalletId, caseId, allocateAmount, new Date()]);
        }

        // Update collected_amount on case for visibility
        await connection.execute('UPDATE PATIENT_CASES SET collected_amount = collected_amount + ? WHERE case_id = ?', [allocateAmount, caseId]);

        // Record allocation
        const allocationId = uuidv4();
        await connection.execute(
          `INSERT INTO PLATFORM_ALLOCATIONS (allocation_id, case_id, amount, allocated_by, allocated_at, comment)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [allocationId, caseId, allocateAmount, req.user?.userId || 'admin', new Date(), comment || null]
        );

        // Record transaction
        const txId = uuidv4();
        await connection.execute(
          `INSERT INTO TRANSACTIONS (tx_id, related_id, type, amount, currency, status, created_at)
           VALUES (?, ?, 'platform_allocation', ?, 'BDT', 'completed', ?)`,
          [txId, allocationId, allocateAmount, new Date()]
        );

        return res.json({ success: true, message: 'Funds allocated to case', allocationId });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('allocateToCase error:', error);
      return res.status(500).json({ success: false, message: 'Allocation failed', error: error.message });
    }
  }
}

module.exports = new PlatformController();
