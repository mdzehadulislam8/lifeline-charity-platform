// ====================================
// ADMIN CONTROLLER
// ====================================

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

class AdminController {
    // Get all doctor-approved submissions awaiting admin review
    async getPendingApprovals(req, res) {
        try {
            const connection = await db.getConnection();
            try {
                const [submissions] = await connection.execute(
                    `SELECT 
                        ps.submission_id,
                        ps.patient_id,
                        ps.case_id,
                        ps.submission_date,
                        ps.doctor_reviewed_at,
                        ps.admin_status,
                        p.first_name,
                        p.last_name,
                        p.nid,
                        p.phone_number,
                        p.medical_condition,
                        u.email,
                        pc.case_title,
                        pc.category,
                        pc.goal_amount
                    FROM PATIENT_SUBMISSIONS ps
                    JOIN PATIENTS p ON ps.patient_id = p.patient_id
                    JOIN USERS u ON p.user_id = u.user_id
                    LEFT JOIN PATIENT_CASES pc ON ps.case_id = pc.case_id
                    WHERE ps.doctor_status = 'approved' AND ps.admin_status = 'pending'
                    ORDER BY ps.doctor_reviewed_at ASC`
                );

                res.json(submissions);
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Get pending approvals error:', error);
            res.status(500).json({ message: 'Failed to retrieve approvals', error: error.message });
        }
    }

    // Get submission details for admin review
    async getSubmissionDetails(req, res) {
        try {
            const { submissionId } = req.params;
            const connection = await db.getConnection();
            try {
                const [submission] = await connection.execute(
                    `SELECT 
                        ps.*,
                        p.first_name,
                        p.last_name,
                        p.phone_number,
                        p.nid,
                        p.age,
                        p.address,
                        p.medical_condition,
                        p.photo_path,
                        u.email,
                        pc.case_id,
                        pc.case_title,
                        pc.category,
                        pc.goal_amount,
                        pc.full_description
                    FROM PATIENT_SUBMISSIONS ps
                    JOIN PATIENTS p ON ps.patient_id = p.patient_id
                    JOIN USERS u ON p.user_id = u.user_id
                    LEFT JOIN PATIENT_CASES pc ON ps.case_id = pc.case_id
                    WHERE ps.submission_id = ?`,
                    [submissionId]
                );

                if (submission.length === 0) {
                    return res.status(404).json({ message: 'Submission not found' });
                }

                res.json(submission[0]);
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Get submission details error:', error);
            res.status(500).json({ message: 'Failed to retrieve submission', error: error.message });
        }
    }

    // Approve patient by admin (publish to home page)
    async approvePatient(req, res) {
        try {
            const { submissionId } = req.params;
            const { notes } = req.body;
            const adminUserId = req.user.userId;

            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();

                // Get admin ID
                const [admin] = await connection.execute(
                    'SELECT admin_id FROM ADMINS WHERE user_id = ?',
                    [adminUserId]
                );

                if (admin.length === 0) {
                    await connection.rollback();
                    return res.status(404).json({ message: 'Admin not found' });
                }

                const adminId = admin[0].admin_id;

                // Get submission details
                const [submission] = await connection.execute(
                    'SELECT patient_id, case_id FROM PATIENT_SUBMISSIONS WHERE submission_id = ?',
                    [submissionId]
                );

                if (submission.length === 0) {
                    await connection.rollback();
                    return res.status(404).json({ message: 'Submission not found' });
                }

                // Update submission
                await connection.execute(
                    `UPDATE PATIENT_SUBMISSIONS 
                     SET admin_status = 'approved', admin_id = ?, admin_reviewed_at = ?, admin_notes = ?
                     WHERE submission_id = ?`,
                    [adminId, new Date(), notes || null, submissionId]
                );

                // Update patient case to approved
                await connection.execute(
                    `UPDATE PATIENT_CASES 
                     SET status = 'approved', admin_approved_at = ?, admin_notes = ?, show_on_home = 1
                     WHERE case_id = ?`,
                    [new Date(), notes || null, submission[0].case_id]
                );

                // Update patient status
                await connection.execute(
                    'UPDATE PATIENTS SET admin_status = ? WHERE patient_id = ?',
                    ['approved', submission[0].patient_id]
                );

                await connection.commit();

                res.json({ 
                    message: 'Patient approved and published successfully',
                    caseId: submission[0].case_id
                });
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Approve patient error:', error);
            res.status(500).json({ message: 'Failed to approve patient', error: error.message });
        }
    }

    // Reject patient submission
    async rejectPatient(req, res) {
        try {
            const { submissionId } = req.params;
            const { notes } = req.body;
            const adminUserId = req.user.userId;

            const connection = await db.getConnection();
            try {
                // Get admin ID
                const [admin] = await connection.execute(
                    'SELECT admin_id FROM ADMINS WHERE user_id = ?',
                    [adminUserId]
                );

                if (admin.length === 0) {
                    return res.status(404).json({ message: 'Admin not found' });
                }

                const adminId = admin[0].admin_id;

                // Update submission
                await connection.execute(
                    `UPDATE PATIENT_SUBMISSIONS 
                     SET admin_status = 'rejected', admin_id = ?, admin_reviewed_at = ?, admin_notes = ?
                     WHERE submission_id = ?`,
                    [adminId, new Date(), notes || null, submissionId]
                );

                res.json({ message: 'Patient rejected successfully' });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Reject patient error:', error);
            res.status(500).json({ message: 'Failed to reject patient', error: error.message });
        }
    }

    // Update patient details (after approval)
    async updatePatientDetails(req, res) {
        try {
            const { patientId } = req.params;
            const { firstName, lastName, phone, address, age, currentCondition, photoPath } = req.body;

            const connection = await db.getConnection();
            try {
                await connection.execute(
                    `UPDATE PATIENTS 
                     SET first_name = ?, last_name = ?, phone_number = ?, address = ?, 
                         age = ?, current_condition = ?, photo_path = ?
                     WHERE patient_id = ?`,
                    [firstName, lastName, phone, address, age, currentCondition, photoPath, patientId]
                );

                res.json({ message: 'Patient details updated successfully' });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Update patient error:', error);
            res.status(500).json({ message: 'Failed to update patient', error: error.message });
        }
    }

    // Get all approved patients (published cases)
    async getApprovedPatients(req, res) {
        try {
            const connection = await db.getConnection();
            try {
                const [patients] = await connection.execute(
                    `SELECT 
                        p.patient_id,
                        p.first_name,
                        p.last_name,
                        p.phone_number,
                        p.nid,
                        p.age,
                        p.address,
                        p.medical_condition,
                        p.current_condition,
                        p.photo_path,
                        u.email,
                        pc.case_id,
                        pc.case_title,
                        pc.category,
                        pc.goal_amount,
                        pc.collected_amount,
                        pc.status,
                        pc.full_description,
                        pc.admin_approved_at,
                        COALESCE(pc.show_on_home, 0) AS show_on_home,
                        COALESCE(pc.is_featured, 0) AS is_featured
                    FROM PATIENTS p
                    JOIN USERS u ON p.user_id = u.user_id
                    LEFT JOIN PATIENT_CASES pc ON p.patient_id = pc.patient_id
                    WHERE p.admin_status = 'approved' AND pc.status = 'approved'
                    ORDER BY pc.admin_approved_at DESC`
                );

                res.json(patients);
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Get approved patients error:', error);
            res.status(500).json({ message: 'Failed to retrieve patients', error: error.message });
        }
    }

    // Get all patient cases (including pending/draft) for admin management
    async getAllCases(req, res) {
        try {
            const connection = await db.getConnection();
            try {
                const [cases] = await connection.execute(
                    `SELECT 
                        p.patient_id,
                        p.first_name,
                        p.last_name,
                        p.phone_number,
                        p.age,
                        p.address,
                        p.medical_condition,
                        p.current_condition,
                        p.photo_path,
                        p.admin_status,
                        u.email,
                        pc.case_id,
                        pc.case_title,
                        pc.category,
                        pc.goal_amount,
                        pc.collected_amount,
                        pc.status,
                        pc.full_description,
                        pc.created_at,
                        pc.admin_approved_at,
                        COALESCE(pc.show_on_home, 0) AS show_on_home,
                        COALESCE(pc.is_featured, 0) AS is_featured
                    FROM PATIENTS p
                    JOIN USERS u ON p.user_id = u.user_id
                    LEFT JOIN PATIENT_CASES pc ON p.patient_id = pc.patient_id
                    WHERE pc.case_id IS NOT NULL AND pc.status = 'approved'
                    ORDER BY pc.created_at DESC`
                );

                res.json(cases);
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Get all cases error:', error);
            res.status(500).json({ message: 'Failed to retrieve cases', error: error.message });
        }
    }

    // Update case homepage settings (show_on_home, is_featured)
    async updateCaseHomeSettings(req, res) {
        try {
            const { caseId } = req.params;
            const { showOnHome, isFeatured } = req.body;
            const connection = await db.getConnection();

            try {
                // Normalize values
                const showVal = (typeof showOnHome === 'boolean') ? showOnHome : (showOnHome === 'true');
                const featVal = (typeof isFeatured === 'boolean') ? isFeatured : (isFeatured === 'true');

                await connection.execute(
                    `UPDATE PATIENT_CASES SET show_on_home = ?, is_featured = ? WHERE case_id = ?`,
                    [showVal ? 1 : 0, featVal ? 1 : 0, caseId]
                );

                res.json({ message: 'Case homepage settings updated', caseId, showOnHome: showVal, isFeatured: featVal });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Update case home settings error:', error);
            res.status(500).json({ message: 'Failed to update case settings', error: error.message });
        }
    }

    // Approve blood donation request (remove donor from available list)
    async approveBloodRequest(req, res) {
        try {
            const { donationId } = req.params;
            const { notes } = req.body;
            const adminUserId = req.user.userId;

            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();

                // Get admin ID
                const [admin] = await connection.execute(
                    'SELECT admin_id FROM ADMINS WHERE user_id = ?',
                    [adminUserId]
                );

                if (admin.length === 0) {
                    await connection.rollback();
                    return res.status(404).json({ message: 'Admin not found' });
                }

                const adminId = admin[0].admin_id;

                // Update blood donation status
                try {
                    await connection.execute(
                        `UPDATE BLOOD_DONATIONS 
                         SET status = 'approved', admin_id = ?, admin_reviewed_at = ?
                         WHERE donation_id = ?`,
                        [adminId, new Date(), donationId]
                    );
                } catch (updateErr) {
                    // Try alternative column names if those don't exist
                    if (updateErr.message.includes('Unknown column')) {
                        console.warn('Using alternative column names for blood donation update');
                        await connection.execute(
                            `UPDATE BLOOD_DONATIONS 
                             SET status = 'approved'
                             WHERE donation_id = ?`,
                            [donationId]
                        );
                    } else {
                        throw updateErr;
                    }
                }

                // Get donation info to find patient/donor
                const [donation] = await connection.execute(
                    'SELECT * FROM BLOOD_DONATIONS WHERE donation_id = ?',
                    [donationId]
                );

                if (donation.length > 0 && donation[0].donor_id) {
                    // Mark donor as unavailable (remove from list)
                    try {
                        const [donorBlood] = await connection.execute(
                            `SELECT blood_donor_id FROM BLOOD_DONORS 
                             WHERE donor_id = ?`,
                            [donation[0].donor_id]
                        );

                        if (donorBlood.length > 0) {
                            await connection.execute(
                                `UPDATE BLOOD_DONORS 
                                 SET is_available = FALSE
                                 WHERE blood_donor_id = ?`,
                                [donorBlood[0].blood_donor_id]
                            );
                        }
                    } catch (donorErr) {
                        console.warn('Could not update donor availability:', donorErr.message);
                        // Don't fail the transaction for this
                    }
                }

                await connection.commit();

                res.json({ 
                    success: true,
                    message: 'Blood request approved successfully'
                });
            } catch (error) {
                try {
                    await connection.rollback();
                } catch (rbErr) {
                    console.error('Rollback error:', rbErr);
                }
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Approve blood request error:', error);
            res.status(500).json({ message: 'Failed to approve blood request', error: error.message });
        }
    }

    // Reject blood donation request
    async rejectBloodRequest(req, res) {
        try {
            const { donationId } = req.params;
            const { notes } = req.body;
            const adminUserId = req.user.userId;

            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();
                
                // Get admin ID
                const [admin] = await connection.execute(
                    'SELECT admin_id FROM ADMINS WHERE user_id = ?',
                    [adminUserId]
                );

                if (admin.length === 0) {
                    await connection.rollback();
                    return res.status(404).json({ message: 'Admin not found' });
                }

                const adminId = admin[0].admin_id;

                // Update blood donation status
                try {
                    await connection.execute(
                        `UPDATE BLOOD_DONATIONS 
                         SET status = 'rejected'
                         WHERE donation_id = ?`,
                        [donationId]
                    );
                } catch (updateErr) {
                    // Try alternative column names if those don't exist
                    if (updateErr.message.includes('Unknown column')) {
                        console.warn('Using alternative column names for blood donation update');
                        await connection.execute(
                            `UPDATE BLOOD_DONATIONS 
                             SET status = 'rejected'
                             WHERE donation_id = ?`,
                            [donationId]
                        );
                    } else {
                        throw updateErr;
                    }
                }

                await connection.commit();

                res.json({ 
                    success: true,
                    message: 'Blood request rejected successfully' 
                });
            } catch (error) {
                try {
                    await connection.rollback();
                } catch (rbErr) {
                    console.error('Rollback error:', rbErr);
                }
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Reject blood request error:', error);
            res.status(500).json({ message: 'Failed to reject blood request', error: error.message });
        }
    }

    // Get pending blood requests
    async getPendingBloodRequests(req, res) {
        try {
            const connection = await db.getConnection();
            try {
                const [requests] = await connection.execute(
                    `SELECT 
                        bd.donation_id,
                        bd.donor_id,
                        bd.recipient_id,
                        bd.blood_type,
                        bd.rh_factor,
                        bd.units_donated,
                        bd.donation_date,
                        d.user_id as donor_user_id,
                        u1.email as donor_email,
                        u2.email as recipient_email,
                        p.first_name as recipient_first_name,
                        p.last_name as recipient_last_name
                    FROM BLOOD_DONATIONS bd
                    JOIN DONORS d ON bd.donor_id = d.donor_id
                    JOIN USERS u1 ON d.user_id = u1.user_id
                    LEFT JOIN PATIENTS p ON bd.recipient_id = p.patient_id
                    LEFT JOIN USERS u2 ON p.user_id = u2.user_id
                    WHERE bd.admin_status = 'pending'
                    ORDER BY bd.donation_date DESC`
                );

                res.json(requests);
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Get pending blood requests error:', error);
            res.status(500).json({ message: 'Failed to retrieve blood requests', error: error.message });
        }
    }

    // Permanently delete a patient case (and cascades) or hide from home
    async deleteCase(req, res) {
        const { caseId } = req.params;
        console.log('=== DELETE CASE START ===');
        console.log('Delete case request for caseId:', caseId);
        
        const connection = await db.getConnection();

        try {
            // Verify case exists first
            const [rows] = await connection.execute(
                'SELECT case_id FROM PATIENT_CASES WHERE case_id = ?', 
                [caseId]
            );
            
            if (rows.length === 0) {
                console.log('CASE NOT FOUND:', caseId);
                connection.release();
                return res.status(404).json({ 
                    success: false,
                    message: 'Case not found - may have been already deleted' 
                });
            }

            console.log('Case exists, proceeding with deletion...');

            // Delete donations
            try {
                const [donRes] = await connection.execute('DELETE FROM DONATIONS WHERE case_id = ?', [caseId]);
                console.log(`Deleted ${donRes.affectedRows} donations for case:`, caseId);
            } catch (donErr) {
                console.warn('Warning: Could not delete donations:', donErr.message);
            }

            // Delete medical documents
            try {
                const [docs] = await connection.execute(
                    'SELECT file_path FROM MEDICAL_DOCUMENTS WHERE case_id = ?', 
                    [caseId]
                );
                console.log('Found', docs.length, 'medical documents to delete');
                
                for (const d of docs) {
                    if (d.file_path) {
                        const fp = path.join(__dirname, '..', 'public', d.file_path.replace(/\\/g, '/'));
                        try { 
                            fs.unlinkSync(fp);
                            console.log('Deleted file:', fp);
                        } catch (e) { 
                            console.warn('Could not delete file:', fp);
                        }
                    }
                }
                const [delRes] = await connection.execute('DELETE FROM MEDICAL_DOCUMENTS WHERE case_id = ?', [caseId]);
                console.log(`Deleted ${delRes.affectedRows} medical document records for case:`, caseId);
            } catch (docErr) {
                console.warn('Warning: Medical documents issue:', docErr.message);
            }

            // Delete submissions
            try {
                const [subRes] = await connection.execute('DELETE FROM PATIENT_SUBMISSIONS WHERE case_id = ?', [caseId]);
                console.log(`Deleted ${subRes.affectedRows} submissions for case:`, caseId);
            } catch (subErr) {
                console.warn('Warning: Could not delete submissions:', subErr.message);
            }

            // Delete the case
            const [caseDelRes] = await connection.execute(
                'DELETE FROM PATIENT_CASES WHERE case_id = ?', 
                [caseId]
            );
            
            console.log(`Deleted ${caseDelRes.affectedRows} case records for caseId:`, caseId);
            console.log('=== DELETE CASE SUCCESS ===');
            
            connection.release();

            res.json({ 
                success: true, 
                message: 'Case deleted successfully', 
                caseId: caseId,
                affectedRows: caseDelRes.affectedRows
            });
        } catch (error) {
            connection.release();
            console.error('=== DELETE CASE ERROR ===', error);
            res.status(500).json({ 
                success: false,
                message: 'Failed to delete case', 
                error: error.message,
                caseId: caseId
            });
        }
    }

    // Update case details (admin only)
    async updateCase(req, res) {
        try {
            const { caseId } = req.params;
            const { caseTitle, category, goalAmount, description } = req.body;

            const connection = await db.getConnection();
            try {
                // Build update query dynamically
                const updates = [];
                const values = [];

                if (caseTitle !== undefined) {
                    updates.push('case_title = ?');
                    values.push(caseTitle);
                }
                if (category !== undefined) {
                    updates.push('category = ?');
                    values.push(category);
                }
                if (goalAmount !== undefined) {
                    updates.push('goal_amount = ?');
                    values.push(goalAmount);
                }
                if (description !== undefined) {
                    updates.push('full_description = ?');
                    values.push(description);
                }

                if (updates.length === 0) {
                    return res.status(400).json({ message: 'No fields to update' });
                }

                values.push(caseId); // for WHERE clause

                const query = `UPDATE PATIENT_CASES SET ${updates.join(', ')} WHERE case_id = ?`;
                await connection.execute(query, values);

                res.json({ success: true, message: 'Case updated successfully', caseId });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Update case error:', error);
            res.status(500).json({ message: 'Failed to update case', error: error.message });
        }
    }

    // Get all users with their profile information
    async getAllUsers(req, res) {
        try {
            const connection = await db.getConnection();
            try {
                const [users] = await connection.execute(
                    `SELECT 
                        u.user_id,
                        u.email,
                        u.user_type,
                        u.username,
                        u.phone_number,
                        u.created_at,
                        u.is_active,
                        COALESCE(p.first_name, d.doctor_name, '') as first_name,
                        COALESCE(p.photo_path, d.photo_path, '') as photo_path,
                        CASE 
                            WHEN p.patient_id IS NOT NULL THEN 'patient'
                            WHEN d.doctor_id IS NOT NULL THEN 'doctor'
                            ELSE 'user'
                        END as profile_type
                    FROM USERS u
                    LEFT JOIN PATIENTS p ON u.user_id = p.user_id
                    LEFT JOIN DOCTORS d ON u.user_id = d.user_id
                    ORDER BY u.created_at DESC`
                );

                res.json(users);
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Get all users error:', error);
            res.status(500).json({ message: 'Failed to retrieve users', error: error.message });
        }
    }
}

module.exports = new AdminController();
