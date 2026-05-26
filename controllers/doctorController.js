// ====================================
// DOCTOR CONTROLLER
// ====================================

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const notificationController = require('./notificationController');

class DoctorController {
    // Get all pending patient submissions for doctor review
    async getPendingSubmissions(req, res) {
        try {
            const connection = await db.getConnection();
            try {
                const [submissions] = await connection.execute(
                    `SELECT 
                        ps.submission_id,
                        ps.patient_id,
                        ps.submission_date,
                        ps.current_condition,
                        ps.doctor_status,
                        ps.prescription_file_path,
                        ps.nid_file_path,
                        u.email,
                        u.phone_number,
                        p.first_name,
                        p.last_name,
                        p.nid,
                        p.medical_condition
                    FROM PATIENT_SUBMISSIONS ps
                    JOIN PATIENTS p ON ps.patient_id = p.patient_id
                    JOIN USERS u ON p.user_id = u.user_id
                    WHERE ps.doctor_status = 'pending'
                    ORDER BY ps.submission_date DESC`
                );

                res.json(submissions);
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Get submissions error:', error);
            res.status(500).json({ message: 'Failed to retrieve submissions', error: error.message });
        }
    }

    // Get specific submission details
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
                        u.email
                    FROM PATIENT_SUBMISSIONS ps
                    JOIN PATIENTS p ON ps.patient_id = p.patient_id
                    JOIN USERS u ON p.user_id = u.user_id
                    WHERE ps.submission_id = ?`,
                    [submissionId]
                );

                if (submission.length === 0) {
                    return res.status(404).json({ message: 'Submission not found' });
                }

                // Normalize file paths for compatibility with old database records
                const data = submission[0];
                data.prescription_file_path = normalizePath(data.prescription_file_path);
                data.nid_file_path = normalizePath(data.nid_file_path);

                res.json(data);
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Get submission details error:', error);
            res.status(500).json({ message: 'Failed to retrieve submission', error: error.message });
        }
    }

    // Approve patient submission
    async approveSubmission(req, res) {
        try {
            const { submissionId } = req.params;
            const { notes, caseTitle, category, goalAmount, description } = req.body;
            const doctorUserId = req.user.userId;

            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();

                // Get doctor ID from user ID
                const [doctor] = await connection.execute(
                    'SELECT doctor_id FROM DOCTORS WHERE user_id = ?',
                    [doctorUserId]
                );

                if (doctor.length === 0) {
                    await connection.rollback();
                    return res.status(404).json({ message: 'Doctor not found' });
                }

                const doctorId = doctor[0].doctor_id;

                // Get submission details
                const [submission] = await connection.execute(
                    'SELECT patient_id, case_id FROM PATIENT_SUBMISSIONS WHERE submission_id = ?',
                    [submissionId]
                );

                if (submission.length === 0) {
                    await connection.rollback();
                    return res.status(404).json({ message: 'Submission not found' });
                }

                const { patient_id, case_id } = submission[0];

                // Update submission status
                await connection.execute(
                    `UPDATE PATIENT_SUBMISSIONS 
                     SET doctor_status = 'approved', doctor_id = ?, doctor_reviewed_at = ?, doctor_notes = ?
                     WHERE submission_id = ?`,
                    [doctorId, new Date(), notes || null, submissionId]
                );

                // If no case exists, create one
                let caseIdToUse = case_id;
                if (!case_id) {
                    caseIdToUse = uuidv4();
                    await connection.execute(
                        `INSERT INTO PATIENT_CASES 
                            (case_id, patient_id, case_title, category, medical_condition, full_description, goal_amount, status, created_at, doctor_approved_at, doctor_notes, admin_approved_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?)`,
                            [caseIdToUse, patient_id, caseTitle || 'Medical Case', category || 'General', 
                            description || '', description || '', goalAmount || 0, new Date(), new Date(), notes || null, new Date()]
                    );

                    // Update submission with case ID
                    await connection.execute(
                        'UPDATE PATIENT_SUBMISSIONS SET case_id = ? WHERE submission_id = ?',
                        [caseIdToUse, submissionId]
                    );
                } else {
                    // Update existing case
                    await connection.execute(
                        `UPDATE PATIENT_CASES 
                         SET doctor_approved_at = ?, doctor_notes = ?, status = 'approved', admin_approved_at = ?
                         WHERE case_id = ?`,
                        [new Date(), notes || null, new Date(), case_id]
                    );
                }

                await connection.commit();

                // Get patient user ID to send notification
                try {
                    const [patientData] = await connection.execute(
                        'SELECT user_id FROM PATIENTS WHERE patient_id = ?',
                        [patient_id]
                    );
                    
                    if (patientData.length > 0) {
                        const patientUserId = patientData[0].user_id;
                        const finalCaseTitle = caseTitle || 'Your Medical Case';
                        await notificationController.notifyCaseStatusChange(patientUserId, caseIdToUse, finalCaseTitle, 'approved');
                    }
                } catch (e) {
                    console.warn('Failed to send approval notification:', e.message);
                }

                res.json({ 
                    message: 'Submission approved successfully',
                    caseId: caseIdToUse
                });
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Approve submission error:', error);
            res.status(500).json({ message: 'Failed to approve submission', error: error.message });
        }
    }

    // Reject patient submission
    async rejectSubmission(req, res) {
        try {
            const { submissionId } = req.params;
            const { notes, caseTitle } = req.body;
            const doctorUserId = req.user.userId;

            const connection = await db.getConnection();
            try {
                // Get doctor ID from user ID
                const [doctor] = await connection.execute(
                    'SELECT doctor_id FROM DOCTORS WHERE user_id = ?',
                    [doctorUserId]
                );

                if (doctor.length === 0) {
                    return res.status(404).json({ message: 'Doctor not found' });
                }

                const doctorId = doctor[0].doctor_id;

                // Get submission and patient details
                const [submission] = await connection.execute(
                    'SELECT patient_id, case_id FROM PATIENT_SUBMISSIONS WHERE submission_id = ?',
                    [submissionId]
                );

                const { patient_id, case_id } = submission[0];

                // Update submission status
                await connection.execute(
                    `UPDATE PATIENT_SUBMISSIONS 
                     SET doctor_status = 'rejected', doctor_id = ?, doctor_reviewed_at = ?, doctor_notes = ?
                     WHERE submission_id = ?`,
                    [doctorId, new Date(), notes || null, submissionId]
                );

                // Send rejection notification to patient
                try {
                    const [patientData] = await connection.execute(
                        'SELECT user_id FROM PATIENTS WHERE patient_id = ?',
                        [patient_id]
                    );
                    
                    if (patientData.length > 0) {
                        const patientUserId = patientData[0].user_id;
                        const finalCaseTitle = caseTitle || 'Your Medical Case';
                        await notificationController.notifyCaseStatusChange(patientUserId, case_id || 'unknown', finalCaseTitle, 'rejected');
                    }
                } catch (e) {
                    console.warn('Failed to send rejection notification:', e.message);
                }

                res.json({ message: 'Submission rejected successfully' });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Reject submission error:', error);
            res.status(500).json({ message: 'Failed to reject submission', error: error.message });
        }
    }

    // Get approved submissions waiting for admin review
    async getApprovedSubmissions(req, res) {
        try {
            const connection = await db.getConnection();
            try {
                const [submissions] = await connection.execute(
                    `SELECT 
                        ps.submission_id,
                        ps.patient_id,
                        ps.submission_date,
                        ps.doctor_reviewed_at,
                        ps.doctor_status,
                        ps.admin_status,
                        ps.prescription_file_path,
                        ps.nid_file_path,
                        p.first_name,
                        p.last_name,
                        u.email,
                        pc.case_id,
                        pc.case_title,
                        pc.category,
                        pc.full_description,
                        pc.goal_amount,
                        pc.collected_amount,
                        pc.status
                    FROM PATIENT_SUBMISSIONS ps
                    JOIN PATIENTS p ON ps.patient_id = p.patient_id
                    JOIN USERS u ON p.user_id = u.user_id
                    INNER JOIN PATIENT_CASES pc ON ps.case_id = pc.case_id
                    WHERE ps.doctor_status = 'approved' AND pc.case_id IS NOT NULL
                    ORDER BY ps.doctor_reviewed_at DESC`
                );

                res.json(submissions);
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Get approved submissions error:', error);
            res.status(500).json({ message: 'Failed to retrieve submissions', error: error.message });
        }
    }

    // Get all medical documents for a case
    async getMedicalDocuments(req, res) {
        try {
            const { caseId } = req.params;
            const connection = await db.getConnection();
            try {
                const [documents] = await connection.execute(
                    `SELECT 
                        document_id,
                        case_id,
                        document_type,
                        file_path,
                        file_name,
                        uploaded_at
                    FROM MEDICAL_DOCUMENTS
                    WHERE case_id = ?
                    ORDER BY uploaded_at DESC`,
                    [caseId]
                );

                // Normalize file paths: convert absolute paths to relative paths
                const normalizedDocs = documents.map(doc => ({
                    ...doc,
                    file_path: normalizePath(doc.file_path)
                }));

                res.json(normalizedDocs);
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Get medical documents error:', error);
            res.status(500).json({ message: 'Failed to retrieve documents', error: error.message });
        }
    }
}

// Helper function to normalize file paths - outside class to avoid 'this' binding issues
function normalizePath(filePath) {
    if (!filePath) return null;
    
    // If it's already a relative path starting with /uploads/, return as-is
    if (filePath.startsWith('/uploads/')) {
        return filePath;
    }
    
    // If it's an absolute path (Windows), extract just the filename and prepend /uploads/
    if (filePath.includes('uploads')) {
        // Handle both Windows backslashes and forward slashes
        const matches = filePath.match(/uploads[/\\](.+)$/i);
        if (matches && matches[1]) {
            const relativePath = '/uploads/' + matches[1].replace(/\\/g, '/');
            return relativePath;
        }
    }
    
    // If it starts with /, return as-is
    if (filePath.startsWith('/')) {
        return filePath;
    }
    
    // If it's just a filename, add /uploads/ prefix
    if (!filePath.includes('/') && !filePath.includes('\\')) {
        return '/uploads/' + filePath;
    }
    
    // For any other case, try to extract just the filename
    const lastSeparator = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    if (lastSeparator !== -1) {
        return '/uploads/' + filePath.substring(lastSeparator + 1);
    }
    
    // Fallback: return with /uploads/ prefix
    return '/uploads/' + filePath;
}

module.exports = new DoctorController();
