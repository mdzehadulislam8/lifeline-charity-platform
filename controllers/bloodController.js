// ====================================
// BLOOD CONTROLLER
// ====================================

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class BloodController {
    async getOrCreatePatientByUser(connection, userId) {
        const [patients] = await connection.execute(
            'SELECT patient_id FROM PATIENTS WHERE user_id = ? LIMIT 1',
            [userId]
        );

        if (patients.length) {
            return patients[0].patient_id;
        }

        // Create a minimal patient profile so receivers can issue requests without extra forms
        const [users] = await connection.execute(
            'SELECT username, phone_number FROM USERS WHERE user_id = ? LIMIT 1',
            [userId]
        );

        if (!users.length) {
            throw new Error('User not found');
        }

        const patientId = uuidv4();
        const now = new Date();
        await connection.execute(
            `INSERT INTO PATIENTS (patient_id, user_id, first_name, phone_number, registration_date, doctor_status, admin_status)
             VALUES (?, ?, ?, ?, ?, 'pending', 'pending')`,
            [patientId, userId, users[0].username || null, users[0].phone_number || null, now]
        );

        return patientId;
    }

    async getDonorIdByUser(connection, userId) {
        const [donors] = await connection.execute(
            'SELECT donor_id FROM DONORS WHERE user_id = ? LIMIT 1',
            [userId]
        );
        return donors.length ? donors[0].donor_id : null;
    }

    async getAvailableDonors(req, res) {
        try {
            const { bloodType, location, limit = 10, offset = 0 } = req.query;
            const connection = await db.getConnection();

            try {
                let query = `
                    SELECT bd.blood_donor_id, bd.blood_type, bd.rh_factor,
                           CONCAT(bd.blood_type, bd.rh_factor) AS full_blood_group,
                           bd.last_donation_date, bd.location, bd.is_available,
                           u.username, u.phone_number
                    FROM BLOOD_DONORS bd
                    JOIN DONORS d ON bd.donor_id = d.donor_id
                    JOIN USERS u ON d.user_id = u.user_id
                    WHERE bd.is_available = true
                `;
                const params = [];

                if (bloodType) {
                    const rhMatch = /[+-]$/.test(bloodType) ? bloodType.slice(-1) : null;
                    const baseType = rhMatch ? bloodType.slice(0, -1) : bloodType;
                    query += ' AND bd.blood_type = ?';
                    params.push(baseType);
                    if (rhMatch) {
                        query += ' AND bd.rh_factor = ?';
                        params.push(rhMatch);
                    }
                }

                if (location) {
                    query += ' AND bd.location LIKE ?';
                    params.push(`%${location}%`);
                }

                query += ' LIMIT ? OFFSET ?';
                params.push(parseInt(limit), parseInt(offset));

                const [donors] = await connection.execute(query, params);

                res.json({
                    success: true,
                    data: donors,
                    count: donors.length
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Get blood donors error:', error);
            res.status(500).json({ message: 'Failed to fetch donors', error: error.message });
        }
    }

    async getDonorById(req, res) {
        try {
            const { id } = req.params;
            const connection = await db.getConnection();

            try {
                const [donors] = await connection.execute(
                    `SELECT bd.*, u.email, u.phone_number, u.username
                     FROM BLOOD_DONORS bd
                     JOIN DONORS d ON bd.donor_id = d.donor_id
                     JOIN USERS u ON d.user_id = u.user_id
                     WHERE bd.blood_donor_id = ?`,
                    [id]
                );

                if (donors.length === 0) {
                    return res.status(404).json({ message: 'Donor not found' });
                }

                res.json({
                    success: true,
                    data: donors[0]
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Get donor error:', error);
            res.status(500).json({ message: 'Failed to fetch donor', error: error.message });
        }
    }

    async registerBloodDonor(req, res) {
        try {
            const { bloodType, location, healthConditions } = req.body;
            const { userId } = req.user;
            const connection = await db.getConnection();

            try {
                // Get or create donor record
                const [donors] = await connection.execute(
                    'SELECT donor_id FROM DONORS WHERE user_id = ?',
                    [userId]
                );

                let donorId;
                if (donors.length === 0) {
                    donorId = uuidv4();
                    await connection.execute(
                        'INSERT INTO DONORS (donor_id, user_id, is_verified) VALUES (?, ?, ?)',
                        [donorId, userId, false]
                    );
                } else {
                    donorId = donors[0].donor_id;
                }

                // Create blood donor record
                const bloodDonorId = uuidv4();
                const [rh] = bloodType.match(/[+-]$/);
                const blood = bloodType.substring(0, bloodType.length - 1);

                await connection.execute(
                    `INSERT INTO BLOOD_DONORS 
                     (blood_donor_id, donor_id, blood_type, rh_factor, health_conditions, is_available, location)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [bloodDonorId, donorId, blood, rh, healthConditions || null, true, location]
                );

                res.status(201).json({
                    success: true,
                    message: 'Registered as blood donor',
                    bloodDonorId
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Register blood donor error:', error);
            res.status(500).json({ message: 'Failed to register as blood donor', error: error.message });
        }
    }

    async createBloodRequest(req, res) {
        try {
            const { bloodDonorId, donorId, recipientId, units = 1, urgency, message, bloodType, rhFactor } = req.body;
            const { userId } = req.user;
            const connection = await db.getConnection();

            try {
                await connection.beginTransaction();

                // Validate minimum required fields
                if (!bloodDonorId || !units) {
                    await connection.rollback();
                    return res.status(400).json({ 
                        success: false,
                        message: 'Missing required fields: bloodDonorId, units' 
                    });
                }

                // Verify donor exists and is available
                const [donorRows] = await connection.execute(
                    `SELECT bd.blood_donor_id, bd.donor_id, bd.blood_type, bd.rh_factor, bd.is_available, u.user_id AS donor_user_id
                     FROM BLOOD_DONORS bd
                     JOIN DONORS d ON bd.donor_id = d.donor_id
                     JOIN USERS u ON d.user_id = u.user_id
                     WHERE bd.blood_donor_id = ?
                     FOR UPDATE`,
                    [bloodDonorId]
                );

                if (!donorRows.length) {
                    await connection.rollback();
                    return res.status(404).json({ 
                        success: false,
                        message: 'Donor or blood donor post not found' 
                    });
                }

                const donor = donorRows[0];

                if (!donor.is_available) {
                    await connection.rollback();
                    return res.status(400).json({ 
                        success: false,
                        message: 'Donor is not currently available' 
                    });
                }

                if (donor.donor_user_id === userId) {
                    await connection.rollback();
                    return res.status(400).json({ 
                        success: false,
                        message: 'You cannot request your own donation post' 
                    });
                }

                // Auto-create or fetch recipient patient if not provided
                let finalRecipientId = recipientId;
                if (!recipientId) {
                    finalRecipientId = await this.getOrCreatePatientByUser(connection, userId);
                } else {
                    // Verify recipient patient exists
                    const [recipientCheck] = await connection.execute(
                        'SELECT patient_id FROM PATIENTS WHERE patient_id = ?',
                        [recipientId]
                    );
                    if (!recipientCheck.length) {
                        await connection.rollback();
                        return res.status(404).json({ 
                            success: false,
                            message: 'Recipient patient not found' 
                        });
                    }
                }

                // Use provided donor ID or use the one from blood donor record
                const finalDonorId = donorId || donor.donor_id;

                const requestId = uuidv4();
                const createdAt = new Date();
                const finalBloodType = bloodType || donor.blood_type;
                const finalRhFactor = rhFactor || donor.rh_factor;

                console.log('Creating blood request:', {
                    requestId,
                    bloodDonorId,
                    donorId: finalDonorId,
                    recipientId: finalRecipientId,
                    userId,
                    bloodType: finalBloodType,
                    rhFactor: finalRhFactor,
                    units
                });

                // Insert blood request/donation record
                await connection.execute(
                    `INSERT INTO BLOOD_DONATIONS 
                     (donation_id, donor_id, recipient_id, donation_date, blood_type, rh_factor, units_donated, status, request_status, notes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?)`
                    , [requestId, finalDonorId, finalRecipientId, createdAt, finalBloodType, finalRhFactor, units, message || urgency || null]
                );

                await connection.commit();

                res.status(201).json({
                    success: true,
                    message: 'Blood request created successfully',
                    requestId,
                    data: {
                        requestId,
                        donationId: requestId,
                        bloodDonorId,
                        donorId: finalDonorId,
                        recipientId: finalRecipientId,
                        bloodType: finalBloodType + finalRhFactor,
                        units,
                        status: 'pending',
                        requestStatus: 'pending',
                        createdAt
                    }
                });

            } catch (innerErr) {
                try {
                    await connection.rollback();
                } catch (rbErr) {
                    console.error('Rollback error:', rbErr);
                }
                console.error('Create blood request inner error:', innerErr);
                res.status(500).json({ message: innerErr.message || 'Failed to create blood request', error: innerErr.message });
            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Create blood request error:', error);
            res.status(500).json({ message: 'Failed to create blood request', error: error.message });
        }
    }

    async getUserBloodRequests(req, res) {
        try {
            const { userId } = req.params;
            const connection = await db.getConnection();

            try {
                const recipientId = await this.getOrCreatePatientByUser(connection, userId);

                const [requests] = await connection.execute(
                    `SELECT bd.donation_id, bd.donation_date, bd.blood_type, bd.rh_factor, bd.units_donated, bd.status, bd.request_status,
                            bd.notes,
                            d.donor_id, u.username AS donor_name, u.phone_number AS donor_phone, u.email AS donor_email,
                            bd_rec.blood_donor_id
                     FROM BLOOD_DONATIONS bd
                     JOIN DONORS d ON bd.donor_id = d.donor_id
                     JOIN USERS u ON d.user_id = u.user_id
                     LEFT JOIN BLOOD_DONORS bd_rec ON bd_rec.donor_id = d.donor_id
                     WHERE bd.recipient_id = ?
                     ORDER BY bd.donation_date DESC`,
                    [recipientId]
                );

                res.json({ success: true, data: requests });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Get blood requests error:', error);
            res.status(500).json({ message: 'Failed to fetch blood requests', error: error.message });
        }
    }

    async getIncomingRequests(req, res) {
        try {
            const { userId } = req.user;
            const connection = await db.getConnection();

            try {
                // Get donor ID - if user hasn't posted blood yet, they won't have requests
                let donorId = await this.getDonorIdByUser(connection, userId);
                
                console.log('getIncomingRequests - userId:', userId, 'donorId:', donorId);
                
                // If no donor record exists, create one (user might have registered but not posted yet)
                if (!donorId) {
                    donorId = uuidv4();
                    console.log('Creating new donor record for userId:', userId, 'donorId:', donorId);
                    try {
                        await connection.execute(
                            'INSERT INTO DONORS (donor_id, user_id, is_verified) VALUES (?, ?, ?)',
                            [donorId, userId, false]
                        );
                    } catch (insertErr) {
                        console.log('Donor insert error (might already exist):', insertErr.message);
                        // If insert fails (duplicate), try to get the existing one
                        const [existingDonors] = await connection.execute(
                            'SELECT donor_id FROM DONORS WHERE user_id = ? LIMIT 1',
                            [userId]
                        );
                        if (existingDonors.length) {
                            donorId = existingDonors[0].donor_id;
                            console.log('Using existing donor record:', donorId);
                        }
                    }
                }

                const [requests] = await connection.execute(
                    `SELECT bd.donation_id, bd.donation_date, bd.blood_type, bd.rh_factor, bd.units_donated, bd.status, bd.request_status, bd.notes,
                            p.patient_id, u.username AS receiver_name, u.phone_number AS receiver_phone, u.email AS receiver_email
                     FROM BLOOD_DONATIONS bd
                     LEFT JOIN PATIENTS p ON bd.recipient_id = p.patient_id
                     LEFT JOIN USERS u ON p.user_id = u.user_id
                     WHERE bd.donor_id = ?
                     ORDER BY bd.donation_date DESC`,
                    [donorId]
                );

                console.log('Found', requests.length, 'requests for donorId:', donorId);
                if (requests.length > 0) {
                    console.log('Requests data:', JSON.stringify(requests, null, 2));
                }

                res.json({ success: true, data: requests });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Get incoming requests error:', error);
            res.status(500).json({ message: 'Failed to fetch incoming requests', error: error.message });
        }
    }

    async acceptBloodRequest(req, res) {
        try {
            const { id } = req.params;
            const { userId } = req.user;
            const connection = await db.getConnection();

            try {
                await connection.beginTransaction();

                const donorId = await this.getDonorIdByUser(connection, userId);
                if (!donorId) {
                    await connection.rollback();
                    return res.status(403).json({ message: 'Not a donor account' });
                }

                const [rows] = await connection.execute(
                    'SELECT donation_id, donor_id, request_status FROM BLOOD_DONATIONS WHERE donation_id = ? FOR UPDATE',
                    [id]
                );

                if (!rows.length || rows[0].donor_id !== donorId) {
                    await connection.rollback();
                    return res.status(404).json({ message: 'Request not found for this donor' });
                }

                if (rows[0].request_status === 'accepted') {
                    await connection.rollback();
                    return res.status(400).json({ message: 'Request already accepted' });
                }

                await connection.execute(
                    `UPDATE BLOOD_DONATIONS
                     SET request_status = 'accepted', status = 'accepted', donation_date = COALESCE(donation_date, NOW())
                     WHERE donation_id = ?`,
                    [id]
                );

                // Reject other pending requests for this donor
                await connection.execute(
                    `UPDATE BLOOD_DONATIONS
                     SET request_status = 'rejected', status = 'rejected'
                     WHERE donor_id = ? AND donation_id <> ? AND request_status = 'pending'`,
                    [donorId, id]
                );

                // Make donor unavailable until they post again
                await connection.execute(
                    'UPDATE BLOOD_DONORS SET is_available = false WHERE donor_id = ?',
                    [donorId]
                );

                await connection.commit();
                res.json({ success: true, message: 'Request accepted and donor marked unavailable' });

            } catch (innerErr) {
                try { await connection.rollback(); } catch (rbErr) { console.error('Rollback error:', rbErr); }
                throw innerErr;
            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Accept blood request error:', error);
            res.status(500).json({ message: 'Failed to accept request', error: error.message });
        }
    }

    async rejectBloodRequest(req, res) {
        try {
            const { id } = req.params;
            const { userId } = req.user;
            const connection = await db.getConnection();

            try {
                await connection.beginTransaction();

                const donorId = await this.getDonorIdByUser(connection, userId);
                if (!donorId) {
                    await connection.rollback();
                    return res.status(403).json({ message: 'Not a donor account' });
                }

                const [rows] = await connection.execute(
                    'SELECT donation_id, donor_id FROM BLOOD_DONATIONS WHERE donation_id = ? FOR UPDATE',
                    [id]
                );

                if (!rows.length || rows[0].donor_id !== donorId) {
                    await connection.rollback();
                    return res.status(404).json({ message: 'Request not found for this donor' });
                }

                await connection.execute(
                    `UPDATE BLOOD_DONATIONS
                     SET request_status = 'rejected', status = 'rejected'
                     WHERE donation_id = ?`,
                    [id]
                );

                await connection.commit();
                res.json({ success: true, message: 'Request rejected' });

            } catch (innerErr) {
                try { await connection.rollback(); } catch (rbErr) { console.error('Rollback error:', rbErr); }
                throw innerErr;
            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Reject blood request error:', error);
            res.status(500).json({ message: 'Failed to reject request', error: error.message });
        }
    }

    async updateDonorAvailability(req, res) {
        try {
            const { id } = req.params;
            const { isAvailable } = req.body;
            const connection = await db.getConnection();

            try {
                await connection.execute(
                    'UPDATE BLOOD_DONORS SET is_available = ? WHERE blood_donor_id = ?',
                    [isAvailable, id]
                );

                res.json({
                    success: true,
                    message: 'Donor availability updated'
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Update donor availability error:', error);
            res.status(500).json({ message: 'Failed to update donor', error: error.message });
        }
    }

    // ====================================
    // BLOOD CASE MANAGEMENT (Patient initiated)
    // ====================================

    async submitBloodCase(req, res) {
        try {
            const userId = req.user.user_id;
            const {
                bloodType,
                rhFactor,
                unitsNeeded,
                urgencyLevel,
                hospitalName,
                location,
                patientName,
                patientPhone,
                dateNeededBy,
                doctorRecommendation
            } = req.body;

            // Validation
            if (!bloodType || !rhFactor || !unitsNeeded || !urgencyLevel || !hospitalName || !location || !patientName || !patientPhone || !dateNeededBy) {
                return res.status(400).json({ message: 'Missing required fields' });
            }

            if (!['O', 'A', 'B', 'AB'].includes(bloodType) || !['+', '-'].includes(rhFactor)) {
                return res.status(400).json({ message: 'Invalid blood type or RH factor' });
            }

            if (!['routine', 'urgent', 'critical'].includes(urgencyLevel)) {
                return res.status(400).json({ message: 'Invalid urgency level' });
            }

            if (unitsNeeded <= 0 || unitsNeeded > 10) {
                return res.status(400).json({ message: 'Units needed must be between 1 and 10' });
            }

            const connection = await db.getConnection();

            try {
                const caseId = uuidv4();
                const now = new Date();

                // Insert blood case
                await connection.execute(
                    `INSERT INTO BLOOD_CASES 
                    (case_id, user_id, blood_type, rh_factor, units_needed, urgency_level, hospital_name, location, patient_name, patient_phone, date_needed_by, doctor_recommendation, case_status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
                    [caseId, userId, bloodType, rhFactor, unitsNeeded, urgencyLevel, hospitalName, location, patientName, patientPhone, dateNeededBy, doctorRecommendation || null, now, now]
                );

                // Notify matching available donors
                await this.notifyMatchingDonors(connection, caseId, bloodType, rhFactor);

                res.status(201).json({
                    success: true,
                    message: 'Blood case submitted successfully. Matching donors have been notified.',
                    caseId: caseId
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Submit blood case error:', error);
            res.status(500).json({ message: 'Failed to submit blood case', error: error.message });
        }
    }

    async notifyMatchingDonors(connection, caseId, bloodType, rhFactor) {
        try {
            // Find donors with matching blood type
            const [donors] = await connection.execute(
                `SELECT bd.donor_id FROM BLOOD_DONORS bd
                 WHERE bd.blood_type = ? AND bd.rh_factor = ? AND bd.is_available = true`,
                [bloodType, rhFactor]
            );

            // Create notifications for each matching donor
            for (const donor of donors) {
                const notificationId = uuidv4();
                await connection.execute(
                    `INSERT INTO CASE_NOTIFICATIONS (notification_id, case_id, donor_id, notification_type, is_read, created_at)
                    VALUES (?, ?, ?, 'new_case', false, NOW())`,
                    [notificationId, caseId, donor.donor_id]
                );
            }
        } catch (error) {
            console.error('Notify matching donors error:', error);
            // Don't throw - let the case creation succeed even if notification fails
        }
    }

    async getBloodCases(req, res) {
        try {
            const { bloodType, urgency, location, limit = 10, offset = 0 } = req.query;
            const connection = await db.getConnection();

            try {
                let query = `
                    SELECT bc.case_id, bc.blood_type, bc.rh_factor,
                           CONCAT(bc.blood_type, bc.rh_factor) AS full_blood_group,
                           bc.units_needed, bc.urgency_level, bc.hospital_name, bc.location,
                           bc.patient_name, bc.patient_phone, bc.date_needed_by,
                           bc.case_status, bc.doctor_recommendation,
                           u.username, COUNT(cdr.response_id) AS matched_donors_count
                    FROM BLOOD_CASES bc
                    LEFT JOIN USERS u ON bc.user_id = u.user_id
                    LEFT JOIN CASE_DONOR_RESPONSES cdr ON bc.case_id = cdr.case_id AND cdr.response_status IN ('interested', 'accepted')
                    WHERE bc.case_status IN ('open', 'responded')
                `;
                const params = [];

                if (bloodType) {
                    const rhMatch = /[+-]$/.test(bloodType) ? bloodType.slice(-1) : null;
                    const baseType = rhMatch ? bloodType.slice(0, -1) : bloodType;
                    query += ' AND bc.blood_type = ?';
                    params.push(baseType);
                    if (rhMatch) {
                        query += ' AND bc.rh_factor = ?';
                        params.push(rhMatch);
                    }
                }

                if (urgency) {
                    query += ' AND bc.urgency_level = ?';
                    params.push(urgency);
                }

                if (location) {
                    query += ' AND bc.location LIKE ?';
                    params.push(`%${location}%`);
                }

                query += ' GROUP BY bc.case_id ORDER BY bc.urgency_level DESC, bc.created_at DESC LIMIT ? OFFSET ?';
                params.push(parseInt(limit), parseInt(offset));

                const [cases] = await connection.execute(query, params);

                res.json({
                    success: true,
                    data: cases,
                    count: cases.length
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Get blood cases error:', error);
            res.status(500).json({ message: 'Failed to fetch blood cases', error: error.message });
        }
    }

    async getBloodCaseDetails(req, res) {
        try {
            const { caseId } = req.params;
            const connection = await db.getConnection();

            try {
                const [cases] = await connection.execute(
                    `SELECT bc.*, u.username, u.phone_number
                    FROM BLOOD_CASES bc
                    JOIN USERS u ON bc.user_id = u.user_id
                    WHERE bc.case_id = ?`,
                    [caseId]
                );

                if (!cases.length) {
                    return res.status(404).json({ message: 'Blood case not found' });
                }

                const caseData = cases[0];

                // Get all donor responses
                const [responses] = await connection.execute(
                    `SELECT cdr.*, bd.blood_type, bd.rh_factor, bd.location, u.username, u.phone_number
                    FROM CASE_DONOR_RESPONSES cdr
                    JOIN BLOOD_DONORS bd ON cdr.donor_id = bd.donor_id
                    JOIN DONORS d ON bd.donor_id = d.donor_id
                    JOIN USERS u ON d.user_id = u.user_id
                    WHERE cdr.case_id = ?
                    ORDER BY cdr.created_at DESC`,
                    [caseId]
                );

                res.json({
                    success: true,
                    data: {
                        ...caseData,
                        responses: responses
                    }
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Get blood case details error:', error);
            res.status(500).json({ message: 'Failed to fetch case details', error: error.message });
        }
    }

    async respondToCase(req, res) {
        try {
            const userId = req.user.user_id;
            const { caseId } = req.params;
            const { responseMessage } = req.body;

            const connection = await db.getConnection();

            try {
                // Get donor ID from user
                const [donors] = await connection.execute(
                    'SELECT donor_id FROM DONORS WHERE user_id = ?',
                    [userId]
                );

                if (!donors.length) {
                    return res.status(400).json({ message: 'Donor profile not found' });
                }

                const donorId = donors[0].donor_id;

                // Get blood donor details
                const [bloodDonors] = await connection.execute(
                    'SELECT * FROM BLOOD_DONORS WHERE donor_id = ?',
                    [donorId]
                );

                if (!bloodDonors.length) {
                    return res.status(400).json({ message: 'Blood donor profile not complete' });
                }

                // Get case details
                const [cases] = await connection.execute(
                    'SELECT * FROM BLOOD_CASES WHERE case_id = ?',
                    [caseId]
                );

                if (!cases.length) {
                    return res.status(404).json({ message: 'Blood case not found' });
                }

                const caseData = cases[0];
                const bloodDonor = bloodDonors[0];

                // Check blood type match
                if (bloodDonor.blood_type !== caseData.blood_type || bloodDonor.rh_factor !== caseData.rh_factor) {
                    return res.status(400).json({ message: 'Your blood type does not match this case' });
                }

                // Check if already responded
                const [existing] = await connection.execute(
                    'SELECT response_id FROM CASE_DONOR_RESPONSES WHERE case_id = ? AND donor_id = ?',
                    [caseId, donorId]
                );

                let responseId;
                if (existing.length) {
                    responseId = existing[0].response_id;
                    // Update existing response
                    await connection.execute(
                        `UPDATE CASE_DONOR_RESPONSES 
                        SET response_status = 'interested', response_message = ?, updated_at = NOW()
                        WHERE response_id = ?`,
                        [responseMessage || null, responseId]
                    );
                } else {
                    responseId = uuidv4();
                    // Create new response
                    await connection.execute(
                        `INSERT INTO CASE_DONOR_RESPONSES (response_id, case_id, donor_id, response_status, response_message, created_at, updated_at)
                        VALUES (?, ?, ?, 'interested', ?, NOW(), NOW())`,
                        [responseId, caseId, donorId, responseMessage || null]
                    );
                }

                // Update case status if needed
                if (caseData.case_status === 'open') {
                    await connection.execute(
                        'UPDATE BLOOD_CASES SET case_status = ? WHERE case_id = ?',
                        ['responded', caseId]
                    );
                }

                res.json({
                    success: true,
                    message: 'Response submitted successfully',
                    responseId: responseId
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Respond to case error:', error);
            res.status(500).json({ message: 'Failed to respond to case', error: error.message });
        }
    }

    async getPatientCases(req, res) {
        try {
            const userId = req.user.user_id;
            const { status, limit = 10, offset = 0 } = req.query;
            const connection = await db.getConnection();

            try {
                let query = `
                    SELECT bc.case_id, bc.blood_type, bc.rh_factor,
                           CONCAT(bc.blood_type, bc.rh_factor) AS full_blood_group,
                           bc.units_needed, bc.urgency_level, bc.hospital_name, bc.location,
                           bc.patient_name, bc.case_status, bc.date_needed_by,
                           bc.created_at, bc.updated_at,
                           COUNT(cdr.response_id) AS total_responses,
                           SUM(CASE WHEN cdr.response_status = 'interested' THEN 1 ELSE 0 END) AS interested_count,
                           SUM(CASE WHEN cdr.response_status = 'accepted' THEN 1 ELSE 0 END) AS accepted_count
                    FROM BLOOD_CASES bc
                    LEFT JOIN CASE_DONOR_RESPONSES cdr ON bc.case_id = cdr.case_id
                    WHERE bc.user_id = ?
                `;
                const params = [userId];

                if (status) {
                    query += ' AND bc.case_status = ?';
                    params.push(status);
                }

                query += ' GROUP BY bc.case_id ORDER BY bc.created_at DESC LIMIT ? OFFSET ?';
                params.push(parseInt(limit), parseInt(offset));

                const [cases] = await connection.execute(query, params);

                // Get detailed responses for each case
                for (let i = 0; i < cases.length; i++) {
                    const [responses] = await connection.execute(
                        `SELECT cdr.response_id, cdr.donor_id, cdr.response_status, cdr.response_message, cdr.created_at,
                                bd.blood_type, bd.rh_factor, bd.location, u.username, u.phone_number
                        FROM CASE_DONOR_RESPONSES cdr
                        JOIN BLOOD_DONORS bd ON cdr.donor_id = bd.donor_id
                        JOIN DONORS d ON bd.donor_id = d.donor_id
                        JOIN USERS u ON d.user_id = u.user_id
                        WHERE cdr.case_id = ?
                        ORDER BY cdr.response_status DESC, cdr.created_at DESC`,
                        [cases[i].case_id]
                    );
                    cases[i].donor_responses = responses;
                }

                res.json({
                    success: true,
                    data: cases,
                    count: cases.length
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Get patient cases error:', error);
            res.status(500).json({ message: 'Failed to fetch patient cases', error: error.message });
        }
    }

    async getDonorCaseNotifications(req, res) {
        try {
            const userId = req.user.user_id;
            const connection = await db.getConnection();

            try {
                const [donors] = await connection.execute(
                    'SELECT donor_id FROM DONORS WHERE user_id = ?',
                    [userId]
                );

                if (!donors.length) {
                    return res.status(400).json({ message: 'Donor profile not found' });
                }

                const donorId = donors[0].donor_id;

                const [notifications] = await connection.execute(
                    `SELECT cn.notification_id, cn.case_id, cn.notification_type, cn.is_read, cn.created_at,
                            bc.blood_type, bc.rh_factor, bc.units_needed, bc.urgency_level, bc.hospital_name, bc.location, bc.case_status
                    FROM CASE_NOTIFICATIONS cn
                    JOIN BLOOD_CASES bc ON cn.case_id = bc.case_id
                    WHERE cn.donor_id = ?
                    ORDER BY cn.created_at DESC
                    LIMIT 50`,
                    [donorId]
                );

                res.json({
                    success: true,
                    data: notifications,
                    count: notifications.length,
                    unread_count: notifications.filter(n => !n.is_read).length
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Get notifications error:', error);
            res.status(500).json({ message: 'Failed to fetch notifications', error: error.message });
        }
    }

    async markNotificationsAsRead(req, res) {
        try {
            const userId = req.user.user_id;
            const { notificationIds } = req.body;

            if (!notificationIds || !Array.isArray(notificationIds)) {
                return res.status(400).json({ message: 'Invalid notification IDs' });
            }

            const connection = await db.getConnection();

            try {
                const placeholders = notificationIds.map(() => '?').join(',');
                await connection.execute(
                    `UPDATE CASE_NOTIFICATIONS SET is_read = true WHERE notification_id IN (${placeholders})`,
                    notificationIds
                );

                res.json({
                    success: true,
                    message: 'Notifications marked as read'
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Mark notifications error:', error);
            res.status(500).json({ message: 'Failed to mark notifications', error: error.message });
        }
    }
}

module.exports = new BloodController();
