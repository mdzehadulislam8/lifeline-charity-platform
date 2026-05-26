// ====================================
// DONATION CONTROLLER
// ====================================

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class DonationController {
    async createDonation(req, res) {
        try {
            const { caseId, campaignId, amount, paymentMethod, providerReference, isAnonymous, guestName, guestEmail } = req.body;
            const connection = await db.getConnection();

            try {
                const donationDate = new Date();
                const isAnon = !!isAnonymous || !req.user;

                // Resolve donor_id properly: DONORS.donor_id is the PK; map from authenticated user_id -> donor_id
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

                // Campaign donation path
                if (campaignId) {
                    const paymentId = uuidv4();
                    await connection.execute(
                        `INSERT INTO PAYMENTS (payment_id, campaign_id, donor_name, donor_email, amount, provider, provider_reference, status, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
                        [paymentId, campaignId, isAnon ? 'Anonymous' : (guestName || req.user?.username || null), isAnon ? '' : (guestEmail || req.user?.email || null), amount, paymentMethod || null, providerReference || null, donationDate]
                    );

                    await connection.execute(`UPDATE CAMPAIGNS SET collected_amount = collected_amount + ? WHERE campaign_id = ?`, [amount, campaignId]);

                    const [w] = await connection.execute('SELECT wallet_id FROM WALLETS WHERE campaign_id = ? LIMIT 1', [campaignId]);
                    if (w && w.length) {
                        await connection.execute('UPDATE WALLETS SET balance = balance + ? WHERE wallet_id = ?', [amount, w[0].wallet_id]);
                    } else {
                        const wid = uuidv4();
                        await connection.execute('INSERT INTO WALLETS (wallet_id, campaign_id, balance, created_at) VALUES (?, ?, ?, ?)', [wid, campaignId, amount, donationDate]);
                    }

                    const [rows] = await connection.execute('SELECT goal_amount, collected_amount FROM CAMPAIGNS WHERE campaign_id = ?', [campaignId]);
                    const campaign = rows[0] || null;

                    return res.status(201).json({
                        success: true,
                        message: 'Donation recorded for campaign',
                        paymentId,
                        data: {
                            campaignId,
                            amount,
                            collectedAmount: campaign ? Number(campaign.collected_amount) : null,
                            goalAmount: campaign ? Number(campaign.goal_amount) : null
                        }
                    });
                }

                // Fallback: legacy case donation flow
                const donationId = uuidv4();
                const transactionUk = uuidv4();

                await connection.execute(
                    `INSERT INTO DONATIONS 
                     (donation_id, case_id, donor_id, amount, payment_method, transaction_uk, donation_date, status, is_anonymous, guest_name, guest_email)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [donationId, caseId, donorId, amount, paymentMethod || null, transactionUk, donationDate, 'completed', isAnon ? 1 : 0, guestName || null, guestEmail || null]
                );

                // Update case collected amount
                await connection.execute(`UPDATE PATIENT_CASES SET collected_amount = collected_amount + ? WHERE case_id = ?`, [amount, caseId]);

                // Upsert wallet for case (patient wallet)
                const [wcase] = await connection.execute('SELECT wallet_id FROM WALLETS WHERE case_id = ? LIMIT 1', [caseId]);
                if (wcase && wcase.length) {
                    await connection.execute('UPDATE WALLETS SET balance = balance + ? WHERE wallet_id = ?', [amount, wcase[0].wallet_id]);
                } else {
                    const wid = uuidv4();
                    await connection.execute('INSERT INTO WALLETS (wallet_id, case_id, balance, created_at) VALUES (?, ?, ?, ?)', [wid, caseId, amount, donationDate]);
                }

                res.status(201).json({
                    success: true,
                    message: 'Donation created successfully',
                    donationId,
                    data: {
                        donationId,
                        caseId,
                        amount,
                        status: 'completed',
                        donationDate
                    }
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Create donation error:', error);
            res.status(500).json({ message: 'Failed to create donation', error: error.message });
        }
    }

    async getDonationsByCase(req, res) {
        try {
            const { caseId } = req.params;
            const { limit = 10, offset = 0 } = req.query;
            const connection = await db.getConnection();

            try {
                const [donations] = await connection.execute(
                    `SELECT d.donation_id, d.amount, d.donation_date, d.is_anonymous, d.guest_name,
                            COALESCE(u1.username, u2.username, d.guest_name, IF(d.is_anonymous, 'Anonymous', NULL)) AS donor_name
                     FROM DONATIONS d
                     LEFT JOIN DONORS dn ON dn.donor_id = d.donor_id
                     LEFT JOIN USERS u1 ON u1.user_id = dn.user_id
                     LEFT JOIN USERS u2 ON u2.user_id = d.donor_id
                     WHERE d.case_id = ? AND d.status = 'completed'
                     ORDER BY d.donation_date DESC
                     LIMIT ? OFFSET ?`,
                    [caseId, parseInt(limit), parseInt(offset)]
                );

                res.json({
                    success: true,
                    data: donations,
                    count: donations.length
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Get donations error:', error);
            res.status(500).json({ message: 'Failed to fetch donations', error: error.message });
        }
    }

    // Support query-based fetch used by patient dashboard: GET /api/donations?caseId=...
    async getDonationsForCase(req, res) {
        try {
            const caseId = req.query.caseId || req.params.caseId;
            if (!caseId) {
                return res.status(400).json({ success: false, message: 'caseId required' });
            }

            const connection = await db.getConnection();
            try {
                const [donations] = await connection.execute(
                    `SELECT d.donation_id, d.amount, d.donation_date, d.is_anonymous, d.guest_name, d.status,
                            COALESCE(u1.username, u2.username, d.guest_name, IF(d.is_anonymous, 'Anonymous', NULL)) AS donor_name
                     FROM DONATIONS d
                     LEFT JOIN DONORS dn ON dn.donor_id = d.donor_id
                     LEFT JOIN USERS u1 ON u1.user_id = dn.user_id
                     LEFT JOIN USERS u2 ON u2.user_id = d.donor_id
                     WHERE d.case_id = ? AND d.status IN ('completed','success','paid')
                     ORDER BY d.donation_date DESC`,
                    [caseId]
                );

                res.json({ success: true, data: donations });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Get donations for case error:', error);
            res.status(500).json({ message: 'Failed to fetch donations', error: error.message });
        }
    }

    // Allow patient to send a thank-you message to a donor for a donation
    async sendThankYouMessage(req, res) {
        try {
            const { donationId } = req.params;
            const { message } = req.body;
            const userId = req.user?.userId || req.user?.id;

            if (!userId) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }

            const connection = await db.getConnection();
            try {
                // Verify this donation belongs to a case owned by this patient
                const [donRows] = await connection.execute(`
                    SELECT d.donation_id, d.case_id, pc.patient_id, p.user_id
                    FROM DONATIONS d
                    JOIN PATIENT_CASES pc ON d.case_id = pc.case_id
                    JOIN PATIENTS p ON pc.patient_id = p.patient_id
                    WHERE d.donation_id = ?
                `, [donationId]);

                if (!donRows.length) {
                    return res.status(404).json({ success: false, message: 'Donation not found' });
                }

                if (donRows[0].user_id !== userId) {
                    return res.status(403).json({ success: false, message: 'Forbidden' });
                }

                // Optionally persist message to a THANK_YOU_MESSAGES table in future
                console.log(`Thank you message from patient ${userId} for donation ${donationId}: ${message}`);

                res.json({ success: true, message: 'Thank you message sent to donor!' });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Send thank you error:', error);
            res.status(500).json({ message: 'Failed to send thank you message', error: error.message });
        }
    }

    async getUserDonationHistory(req, res) {
        try {
            const { userId } = req.user;
            const connection = await db.getConnection();

            try {
                // Map user_id -> donor_id where applicable; return donations linked to this user
                const [donations] = await connection.execute(
                    `SELECT d.*, pc.case_title
                     FROM DONATIONS d
                     LEFT JOIN DONORS dn ON dn.donor_id = d.donor_id
                     WHERE dn.user_id = ? OR d.donor_id = ?
                     JOIN PATIENT_CASES pc ON d.case_id = pc.case_id
                     ORDER BY d.donation_date DESC`,
                    [userId, userId]
                );

                res.json({
                    success: true,
                    data: donations
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Get donation history error:', error);
            res.status(500).json({ message: 'Failed to fetch donation history', error: error.message });
        }
    }
}

module.exports = new DonationController();
