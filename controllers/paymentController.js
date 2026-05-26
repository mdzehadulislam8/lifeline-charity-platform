const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class PaymentController {
  constructor() {}

  // Create a pending payment record. Payments are confirmed separately to credit Ketto wallet.
  async createPaymentIntent(req, res) {
    try {
      const { amount, campaignId, caseId, donorName, donorEmail, paymentMethod = 'manual', providerReference } = req.body;
      if (!amount || (!campaignId && !caseId)) return res.status(400).json({ message: 'Amount and campaignId or caseId are required' });

      const paymentId = uuidv4();
      const connection = await db.getConnection();
      try {
        // Validate referenced campaignId / caseId exist to avoid FK constraint errors
        let campaignIdParam = campaignId || null;
        let caseIdParam = caseId || null;
        // If this request is clearly for a case donation, ensure we don't accidentally set campaign_id
        if (caseIdParam) {
          campaignIdParam = null;
        }

        if (campaignIdParam) {
          try {
            const [crows] = await connection.execute('SELECT 1 FROM CAMPAIGNS WHERE campaign_id = ? LIMIT 1', [campaignIdParam]);
            if (!crows || !crows.length) {
              console.warn('createPaymentIntent: campaignId not found, clearing campaignId to avoid FK error', campaignIdParam);
              campaignIdParam = null;
            }
          } catch (vErr) {
            console.warn('createPaymentIntent: campaign validation failed', vErr && vErr.message);
            campaignIdParam = campaignIdParam; // leave as-is
          }
        }

        if (caseIdParam) {
          try {
            const [crow2] = await connection.execute('SELECT 1 FROM PATIENT_CASES WHERE case_id = ? LIMIT 1', [caseIdParam]);
            if (!crow2 || !crow2.length) {
              console.warn('createPaymentIntent: caseId not found, clearing caseId', caseIdParam);
              caseIdParam = null;
            }
          } catch (vErr2) {
            console.warn('createPaymentIntent: case validation failed', vErr2 && vErr2.message);
            caseIdParam = caseIdParam;
          }
        }

        // Diagnostic log to help debug FK failures
        console.debug('createPaymentIntent: inserting payment', { paymentId, campaignIdParam, caseIdParam, amount, paymentMethod });

        // Try inserting with case_id (newer schema). If DB doesn't have that column, fall back.
        try {
          await connection.execute(
            `INSERT INTO PAYMENTS (payment_id, campaign_id, case_id, donor_name, donor_email, amount, provider, provider_reference, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)` ,
            [paymentId, campaignIdParam, caseIdParam, donorName || null, donorEmail || null, Number(amount), paymentMethod || 'manual', providerReference || null, new Date()]
          );

          return res.json({ success: true, paymentId, message: 'Payment created. Confirm payment to credit Ketto wallet.' });
        } catch (innerErr) {
          // If the error is due to missing case_id column, retry without it and create a pending DONATIONS row for case flow
          if (innerErr && innerErr.code === 'ER_BAD_FIELD_ERROR' && /case_id/.test(innerErr.sqlMessage || '')) {
            await connection.execute(
              `INSERT INTO PAYMENTS (payment_id, campaign_id, donor_name, donor_email, amount, provider, provider_reference, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)` ,
              [paymentId, campaignIdParam, donorName || null, donorEmail || null, Number(amount), paymentMethod || 'manual', providerReference || null, new Date()]
            );

            // If this payment is for a patient case, record a pending DONATIONS row referencing this payment so confirmPayment can find it.
            if (caseId) {
              const donationId = uuidv4();
              await connection.execute(
                `INSERT INTO DONATIONS (donation_id, case_id, amount, donor_name, donor_email, status, transaction_uk, created_at)
                 VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
                [donationId, caseId, Number(amount), donorName || null, donorEmail || null, paymentId, new Date()]
              );
            }

            return res.json({ success: true, paymentId, message: 'Payment created (fallback). Confirm payment to credit Ketto wallet.' });
          }

          // If foreign key error because campaign_id references a missing campaign, retry with campaign null
          if (innerErr && innerErr.code === 'ER_NO_REFERENCED_ROW_2') {
            console.warn('createPaymentIntent: FK error inserting payment, retrying with campaign_id=null', innerErr.sqlMessage);
            await connection.execute(
              `INSERT INTO PAYMENTS (payment_id, case_id, donor_name, donor_email, amount, provider, provider_reference, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)` ,
              [paymentId, caseIdParam, donorName || null, donorEmail || null, Number(amount), paymentMethod || 'manual', providerReference || null, new Date()]
            );

            if (caseId && caseIdParam) {
              const donationId2 = uuidv4();
              await connection.execute(
                `INSERT INTO DONATIONS (donation_id, case_id, amount, donor_name, donor_email, status, transaction_uk, created_at)
                 VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
                [donationId2, caseIdParam, Number(amount), donorName || null, donorEmail || null, paymentId, new Date()]
              );
            }

            return res.json({ success: true, paymentId, message: 'Payment created (FK fallback). Confirm payment to credit Ketto wallet.' });
          }

          throw innerErr; // rethrow other errors
        }
      } finally {
        connection.release();
      }
    } catch (err) {
      console.error('createPaymentIntent error:', err);
      return res.status(500).json({ message: 'Failed to create payment intent', error: err.message });
    }
  }

  // Confirm a pending payment: mark completed and credit wallet
  async confirmPayment(req, res) {
    try {
      const { paymentId, providerReference, guestName, guestEmail } = req.body;
      if (!paymentId) return res.status(400).json({ message: 'paymentId is required' });

      const connection = await db.getConnection();
      try {
        // Mark payment as completed (if exists)
        try {
          await connection.execute(`UPDATE PAYMENTS SET status = 'completed', provider_reference = ? WHERE payment_id = ?`, [providerReference || null, paymentId]);
        } catch (uErr) {
          // If PAYMENTS table doesn't exist or other issue, still continue to try donation-path
          console.warn('Warning updating PAYMENTS:', uErr && uErr.message);
        }

        // Try to find campaign/payment row. Be resilient if case_id column is missing.
        let paymentRow = null;
        try {
          const [rows] = await connection.execute('SELECT campaign_id, case_id, amount FROM PAYMENTS WHERE payment_id = ? LIMIT 1', [paymentId]);
          if (rows && rows.length) paymentRow = rows[0];
        } catch (selErr) {
          // If selecting campaign_id/case_id fails (schema mismatch), try selecting minimal fields
          try {
            const [rows2] = await connection.execute('SELECT campaign_id, amount FROM PAYMENTS WHERE payment_id = ? LIMIT 1', [paymentId]);
            if (rows2 && rows2.length) paymentRow = rows2[0];
          } catch (selErr2) {
            // ignore
            paymentRow = null;
          }
        }

        const amount = paymentRow ? Number(paymentRow.amount || 0) : 0;

        if (paymentRow && paymentRow.campaign_id) {
          // credit campaign wallet and update campaign collected_amount
          const [w] = await connection.execute('SELECT wallet_id FROM WALLETS WHERE campaign_id = ? LIMIT 1', [paymentRow.campaign_id]);
          if (w && w.length) {
            await connection.execute('UPDATE WALLETS SET balance = balance + ? WHERE wallet_id = ?', [amount, w[0].wallet_id]);
          } else {
            const wid = uuidv4();
            await connection.execute('INSERT INTO WALLETS (wallet_id, campaign_id, balance, created_at) VALUES (?, ?, ?, ?)', [wid, paymentRow.campaign_id, amount, new Date()]);
          }
          await connection.execute('UPDATE CAMPAIGNS SET collected_amount = collected_amount + ? WHERE campaign_id = ?', [amount, paymentRow.campaign_id]);
          return res.json({ success: true, message: 'Payment confirmed and campaign wallet credited', paymentId });
        }

        // If paymentRow indicates a case_id, or if we created a DONATIONS pending row during fallback, handle case flow.
        if (paymentRow && paymentRow.case_id) {
          const caseId = paymentRow.case_id;
          const [w] = await connection.execute('SELECT wallet_id FROM WALLETS WHERE case_id = ? LIMIT 1', [caseId]);
          if (w && w.length) {
            await connection.execute('UPDATE WALLETS SET balance = balance + ? WHERE wallet_id = ?', [amount, w[0].wallet_id]);
          } else {
            const wid = uuidv4();
            await connection.execute('INSERT INTO WALLETS (wallet_id, case_id, balance, created_at) VALUES (?, ?, ?, ?)', [wid, caseId, amount, new Date()]);
          }
          await connection.execute('UPDATE PATIENT_CASES SET collected_amount = collected_amount + ? WHERE case_id = ?', [amount, caseId]);

          // Ensure a DONATIONS record exists for this confirmed payment so donation lists show it
          try {
            const [existing] = await connection.execute('SELECT donation_id FROM DONATIONS WHERE transaction_uk = ? LIMIT 1', [paymentId]);
            if (!existing || !existing.length) {
              const donationId = uuidv4();
              // Try to pull donor info from PAYMENTS table (best-effort)
              let donorName = null;
              let donorEmail = null;
              try {
                const [prow] = await connection.execute('SELECT donor_name, donor_email, provider FROM PAYMENTS WHERE payment_id = ? LIMIT 1', [paymentId]);
                if (prow && prow.length) {
                  donorName = prow[0].donor_name || null;
                  donorEmail = prow[0].donor_email || null;
                }
              } catch (pErr) {
                // ignore
              }

              await connection.execute(
                `INSERT INTO DONATIONS (donation_id, case_id, donor_id, amount, payment_method, transaction_uk, donation_date, status, is_anonymous, guest_name, guest_email)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [donationId, caseId, null, amount, (paymentRow.provider || null), paymentId, new Date(), 'completed', donorName ? 0 : 1, donorName || null, donorEmail || null]
              );
            }
          } catch (dErr) {
            console.warn('Failed to ensure DONATIONS entry for payment confirm:', dErr && dErr.message);
          }

          return res.json({ success: true, message: 'Payment confirmed and patient wallet credited', paymentId });
        }

        // Fallback: check DONATIONS table for a pending donation referencing this paymentId (transaction_uk)
        try {
          const [donRows] = await connection.execute('SELECT donation_id, case_id, amount FROM DONATIONS WHERE transaction_uk = ? LIMIT 1', [paymentId]);
          if (donRows && donRows.length) {
            const d = donRows[0];
            const donAmount = Number(d.amount || 0);
            // mark donation completed
            await connection.execute('UPDATE DONATIONS SET status = ? WHERE donation_id = ?', ['completed', d.donation_id]);

            const [w2] = await connection.execute('SELECT wallet_id FROM WALLETS WHERE case_id = ? LIMIT 1', [d.case_id]);
            if (w2 && w2.length) {
              await connection.execute('UPDATE WALLETS SET balance = balance + ? WHERE wallet_id = ?', [donAmount, w2[0].wallet_id]);
            } else {
              const wid2 = uuidv4();
              await connection.execute('INSERT INTO WALLETS (wallet_id, case_id, balance, created_at) VALUES (?, ?, ?, ?)', [wid2, d.case_id, donAmount, new Date()]);
            }
            await connection.execute('UPDATE PATIENT_CASES SET collected_amount = collected_amount + ? WHERE case_id = ?', [donAmount, d.case_id]);
            return res.json({ success: true, message: 'Payment confirmed and case donation applied', paymentId });
          }
        } catch (donErr) {
          // ignore donation lookup errors
          console.warn('Donation lookup failed during confirmPayment:', donErr && donErr.message);
        }

        return res.json({ success: true, message: 'Payment confirmed (no linked campaign/case found)', paymentId });
      } finally {
        connection.release();
      }
    } catch (err) {
      console.error('confirmPayment error:', err);
      return res.status(500).json({ message: 'Failed to confirm payment', error: err.message });
    }
  }
}

module.exports = new PaymentController();
