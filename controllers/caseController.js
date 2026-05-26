// ====================================
// CASE CONTROLLER
// ====================================

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const notificationController = require('./notificationController');

class CaseController {
    async getAllCases(req, res) {
        try {
            const { status, category, search, limit = 10, offset = 0, userType } = req.query;
            // Prefer authenticated role if present (doctor/admin should see all)
            const effectiveUserType = req.user?.userType || userType;
            const connection = await db.getConnection();

            try {
                // Check which optional columns exist to avoid SQL errors on older schemas
                const [schemaCols] = await connection.execute(
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PATIENT_CASES'"
                );
                const colSet = new Set(schemaCols.map(r => r.COLUMN_NAME));
                const hasIsFeatured = colSet.has('is_featured');
                const hasShowOnHome = colSet.has('show_on_home');
                const hasCaseImagePath = colSet.has('case_image_path');

                let query = `
                    SELECT 
                        pc.case_id,
                        pc.case_title,
                        pc.category,
                        pc.medical_condition,
                        p.current_condition,
                        pc.is_urgent,
                        pc.goal_amount,
                        COALESCE(pc.collected_amount, 0) AS collected_amount,
                        COALESCE((SELECT SUM(amount) FROM DONATIONS d WHERE d.case_id = pc.case_id AND d.status = 'completed'), 0) AS donated_total,
                        COALESCE((SELECT COUNT(*) FROM DONATIONS d2 WHERE d2.case_id = pc.case_id AND d2.status = 'completed'), 0) AS donor_count,
                        p.patient_id,
                        p.first_name,
                        p.last_name,
                        p.photo_path,
                        u.email,
                        pc.patient_satisfied,
                        ${hasIsFeatured ? 'pc.is_featured,' : ''}
                        ${hasShowOnHome ? 'pc.show_on_home,' : ''}
                        -- pick a representative image for this case (most recent photo uploaded)
                        (
                            SELECT md.file_path
                            FROM MEDICAL_DOCUMENTS md
                            WHERE md.case_id = pc.case_id AND md.document_type = 'photo'
                            ORDER BY md.uploaded_at DESC
                            LIMIT 1
                        ) AS case_image_path
                    FROM PATIENT_CASES pc
                    JOIN PATIENTS p ON pc.patient_id = p.patient_id
                    JOIN USERS u ON p.user_id = u.user_id
                `;
                const params = [];

                // If requesting patient-specific view, fetch cases owned by logged-in patient
                if (effectiveUserType === 'patient') {
                    const userId = req.user?.userId || req.user?.id;
                    if (!userId) {
                        return res.status(401).json({ success: false, message: 'Unauthorized' });
                    }

                    // restrict to cases for this patient (include all statuses)
                    query += ' WHERE p.user_id = ?';
                    params.push(userId);
                } else if (effectiveUserType === 'doctor' || effectiveUserType === 'admin') {
                    // Lifeline team: see all cases; optional status filter if provided
                    query += ' WHERE 1=1';
                    if (status) {
                        query += ' AND pc.status = ?';
                        params.push(status);
                    }
                } else {
                    // public listing only shows approved cases; if show_on_home exists, restrict to it
                    query += ' WHERE pc.status = "approved"';
                    if (hasShowOnHome) query += ' AND pc.show_on_home = TRUE';
                }

                if (category) {
                    query += ' AND pc.category = ?';
                    params.push(category);
                }

                if (search) {
                    query += ' AND (pc.case_title LIKE ? OR pc.medical_condition LIKE ?)';
                    params.push(`%${search}%`, `%${search}%`);
                }

                // Featured cases first (only if column exists), then by approval date
                if (hasIsFeatured) {
                    query += ' ORDER BY pc.is_featured DESC, pc.admin_approved_at DESC LIMIT ? OFFSET ?';
                } else {
                    query += ' ORDER BY pc.admin_approved_at DESC LIMIT ? OFFSET ?';
                }
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
            console.error('Get cases error:', error);
            res.status(500).json({ message: 'Failed to fetch cases', error: error.message });
        }
    }

    async getCaseById(req, res) {
        try {
            const { id } = req.params;
            const connection = await db.getConnection();

            try {
                const [cases] = await connection.execute(
                    `SELECT pc.*, p.patient_id, u.email, u.phone_number,
                        (
                            SELECT md.file_path
                            FROM MEDICAL_DOCUMENTS md
                            WHERE md.case_id = pc.case_id AND md.document_type = 'photo'
                            ORDER BY md.uploaded_at DESC
                            LIMIT 1
                        ) AS case_image_path
                     FROM PATIENT_CASES pc
                     JOIN PATIENTS p ON pc.patient_id = p.patient_id
                     JOIN USERS u ON p.user_id = u.user_id
                     WHERE pc.case_id = ? AND pc.status = 'approved'`,
                    [id]
                );

                if (cases.length === 0) {
                    return res.status(404).json({ message: 'Case not found' });
                }

                // Get donations count for this case (keep donor count, do not override collected_amount)
                const [donations] = await connection.execute(
                    `SELECT COUNT(*) as donor_count 
                     FROM DONATIONS WHERE case_id = ? AND status = 'completed'`,
                    [id]
                );

                const caseData = cases[0];
                // collected_amount comes from PATIENT_CASES (includes platform allocations and direct donations)
                caseData.donor_count = donations[0]?.donor_count || 0;

                res.json({
                    success: true,
                    data: caseData
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Get case by ID error:', error);
            res.status(500).json({ message: 'Failed to fetch case', error: error.message });
        }
    }

    async submitCase(req, res) {
        try {
            const { userId } = req.user;
            const { 
                firstName, lastName, phone, nid, age, address, permanentAddress, gender, relation,
                medicalCondition, currentCondition, medicalHistory, diagnosisName, doctorName, hospitalName, hospitalAddress, treatmentType, expectedDuration,
                caseTitle, category, description, goalAmount, isUrgent, howMoneyUsed, story
            } = req.body;

            // Check for required files: prescription, NID and at least one patient photo
            if (!req.files || !req.files.prescriptionFile || !req.files.nidFile || !req.files.photos) {
                return res.status(400).json({ message: 'Prescription, NID and at least one patient photo are required' });
            }

            // Profile photo is now optional (for updating navbar/profile only)

            const connection = await db.getConnection();

            try {
                await connection.beginTransaction();

                // Get patient ID
                const [patients] = await connection.execute(
                    'SELECT patient_id FROM PATIENTS WHERE user_id = ?',
                    [userId]
                );

                if (patients.length === 0) {
                    await connection.rollback();
                    return res.status(400).json({ message: 'User is not a patient' });
                }

                const patientId = patients[0].patient_id;

                // Save uploaded files
                const uploadsDir = path.join(__dirname, '../public/uploads');
                if (!fs.existsSync(uploadsDir)) {
                    fs.mkdirSync(uploadsDir, { recursive: true });
                }

                const prescriptionFile = req.files.prescriptionFile;
                const nidFileUpload = req.files.nidFile;
                const profilePhotoFile = req.files.profilePhoto; // removed from UI, still optional server-side

                const prescriptionPath = path.join(uploadsDir, `prescription-${uuidv4()}.pdf`);
                const nidExt = nidFileUpload.name.split('.').pop();
                const nidPath = path.join(uploadsDir, `nid-${uuidv4()}.${nidExt}`);
                let profilePhotoPath = null;
                if (profilePhotoFile) {
                    profilePhotoPath = path.join(uploadsDir, `profile-${uuidv4()}.${profilePhotoFile.name.split('.').pop()}`);
                    await profilePhotoFile.mv(profilePhotoPath);
                }

                await prescriptionFile.mv(prescriptionPath);
                await nidFileUpload.mv(nidPath);

                // Convert absolute paths to relative paths for storage in database
                const prescriptionRelativePath = '/uploads/' + path.basename(prescriptionPath);
                const nidRelativePath = '/uploads/' + path.basename(nidPath);
                const profilePhotoRelativePath = profilePhotoPath ? '/uploads/' + path.basename(profilePhotoPath) : null;

                // Save any additional uploaded files (medical reports, estimate, admission slip, doctor letter, bank cheque, mobile wallet screenshots, photos, video)
                const extraFiles = [];
                const addFile = async (file, type) => {
                    if (!file) return null;
                    const ext = (file.name && file.name.split('.').pop()) || 'dat';
                    const dest = path.join(uploadsDir, `${type}-${uuidv4()}.${ext}`);
                    await file.mv(dest);
                    // Store relative path for database (/uploads/filename format)
                    const relativePath = '/uploads/' + path.basename(dest);
                    extraFiles.push({ type, path: relativePath, name: file.name });
                    return dest;
                };

                // medicalReports may be multiple
                if (req.files.medicalReports) {
                    const reports = Array.isArray(req.files.medicalReports) ? req.files.medicalReports : [req.files.medicalReports];
                    for (const r of reports) {
                        await addFile(r, 'medicalReport');
                    }
                }

                await addFile(req.files.treatmentEstimateFile, 'treatmentEstimate');
                await addFile(req.files.admissionSlipFile, 'admissionSlip');
                await addFile(req.files.doctorLetterFile, 'doctorLetter');
                await addFile(req.files.bankChequeFile, 'bankCheque');
                await addFile(req.files.mobileWalletFile, 'mobileWallet');

                // Store photos: require at least one; save all photos into extraFiles so they are inserted into MEDICAL_DOCUMENTS
                let caseImagePath = null;
                if (req.files.photos) {
                    const photos = Array.isArray(req.files.photos) ? req.files.photos : [req.files.photos];
                    if (photos.length > 0) {
                        // Save first photo and record it as representative case image
                        const firstDest = await addFile(photos[0], 'photo');
                        // Convert to relative path for database storage
                        caseImagePath = '/uploads/' + path.basename(firstDest);
                    }
                    // Save remaining photos
                    for (let i = 1; i < photos.length; i++) {
                        await addFile(photos[i], 'photo');
                    }
                }

                await addFile(req.files.videoFile, 'video');

                // Update patient information - only update photo_path if profile photo was provided
                let patientUpdateQuery = `UPDATE PATIENTS 
                     SET first_name = ?, last_name = ?, phone_number = ?, nid = ?, age = ?, 
                         address = ?, medical_condition = ?, current_condition = ?`;
                let patientUpdateParams = [firstName, lastName, phone, nid, age, address, medicalCondition, currentCondition];
                
                if (profilePhotoRelativePath) {
                    patientUpdateQuery += `, photo_path = ?`;
                    patientUpdateParams.push(profilePhotoRelativePath);
                }
                
                patientUpdateQuery += `, medical_history = ?, relationship = ? WHERE patient_id = ?`;
                patientUpdateParams.push(medicalHistory || null, relation || null, patientId);
                
                await connection.execute(patientUpdateQuery, patientUpdateParams);

                // Create patient submission
                const submissionId = uuidv4();
                await connection.execute(
                    `INSERT INTO PATIENT_SUBMISSIONS 
                     (submission_id, patient_id, prescription_file_path, nid_file_path, 
                      current_condition, submission_date, doctor_status)
                     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
                    [submissionId, patientId, prescriptionRelativePath, nidRelativePath, currentCondition, new Date()]
                );

                // Create case with first photo as case image
                const caseId = uuidv4();
                
                await connection.execute(
                    `INSERT INTO PATIENT_CASES 
                     (case_id, patient_id, case_title, category, medical_condition, 
                      full_description, goal_amount, status, created_at, case_image_path)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
                    [caseId, patientId, caseTitle, category, medicalCondition, description, goalAmount, new Date(), caseImagePath]
                );

                // Update submission with case ID
                await connection.execute(
                    'UPDATE PATIENT_SUBMISSIONS SET case_id = ? WHERE submission_id = ?',
                    [caseId, submissionId]
                );

                await connection.commit();

                // Store extra structured data in PATIENT_SUBMISSIONS.extra_data (create column if missing)
                try {
                    await connection.execute(`ALTER TABLE PATIENT_SUBMISSIONS ADD COLUMN IF NOT EXISTS extra_data JSON NULL`);
                } catch (e) {
                    // Some MySQL versions may not support IF NOT EXISTS for ADD COLUMN; ignore if fails
                }

                const extraData = {
                    permanentAddress: permanentAddress || null,
                    gender: gender || null,
                    relation: relation || null,
                    diagnosisName: diagnosisName || null,
                    doctorName: doctorName || null,
                    hospitalName: hospitalName || null,
                    hospitalAddress: hospitalAddress || null,
                    treatmentType: treatmentType || null,
                    expectedDuration: expectedDuration || null,
                    howMoneyUsed: howMoneyUsed || null,
                    story: story || null,
                    uploadedFiles: extraFiles
                };

                try {
                    await connection.execute('UPDATE PATIENT_SUBMISSIONS SET extra_data = ? WHERE submission_id = ?', [JSON.stringify(extraData), submissionId]);
                } catch (e) {
                    console.warn('Failed to save extra_data on PATIENT_SUBMISSIONS:', e.message);
                }

                // Insert any extraFiles into MEDICAL_DOCUMENTS linked to the new case
                try {
                    for (const f of extraFiles) {
                        await connection.execute(
                            `INSERT INTO MEDICAL_DOCUMENTS (document_id, case_id, document_type, file_path, file_name, uploaded_at)
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [uuidv4(), caseId, f.type, f.path, f.name, new Date()]
                        );
                    }
                } catch (e) {
                    console.warn('Failed to insert MEDICAL_DOCUMENTS:', e.message);
                }

                // Notify Lifeline team about new case submission
                try {
                    await notificationController.notifyLifelineTeam(caseId, caseTitle, firstName);
                } catch (e) {
                    console.warn('Failed to send notification to lifeline team:', e.message);
                }

                res.status(201).json({
                    message: 'Case submitted successfully. Awaiting doctor review.',
                    submissionId,
                    caseId
                });

            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Submit case error:', error);
            res.status(500).json({ message: 'Failed to submit case', error: error.message });
        }
    }

    async createCase(req, res) {
        try {
            const { caseTitle, medicalCondition, fullDescription, goalAmount, isUrgent } = req.body;
            const { userId } = req.user;
            const connection = await db.getConnection();

            try {
                // Get patient ID for user
                const [patients] = await connection.execute(
                    'SELECT patient_id FROM PATIENTS WHERE user_id = ?',
                    [userId]
                );

                if (patients.length === 0) {
                    return res.status(400).json({ message: 'User is not a patient' });
                }

                const caseId = uuidv4();
                const createdAt = new Date();

                await connection.execute(
                    `INSERT INTO PATIENT_CASES 
                     (case_id, patient_id, case_title, medical_condition, full_description, goal_amount, collected_amount, status, created_at, is_urgent)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [caseId, patients[0].patient_id, caseTitle, medicalCondition, fullDescription, goalAmount, 0, 'pending', createdAt, isUrgent || false]
                );

                res.status(201).json({
                    message: 'Case created successfully',
                    caseId,
                    data: {
                        caseId,
                        patientId: patients[0].patient_id,
                        caseTitle,
                        status: 'pending',
                        createdAt
                    }
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Create case error:', error);
            res.status(500).json({ message: 'Failed to create case', error: error.message });
        }
    }

    async updateCase(req, res) {
        try {
            const { id } = req.params;
            const { caseTitle, goalAmount, status } = req.body;
            const { userId, userType } = req.user;
            const connection = await db.getConnection();

            try {
                // Check if user is the case owner or doctor/team member
                if (userType === 'doctor') {
                    // Doctors can edit any case
                    const [cases] = await connection.execute(
                        `SELECT pc.* FROM PATIENT_CASES pc WHERE pc.case_id = ?`,
                        [id]
                    );
                    if (cases.length === 0) {
                        return res.status(404).json({ message: 'Case not found' });
                    }
                } else {
                    // Patients can only edit their own cases
                    const [cases] = await connection.execute(
                        `SELECT pc.* FROM PATIENT_CASES pc
                         JOIN PATIENTS p ON pc.patient_id = p.patient_id
                         WHERE pc.case_id = ? AND p.user_id = ?`,
                        [id, userId]
                    );
                    if (cases.length === 0) {
                        return res.status(403).json({ message: 'Unauthorized' });
                    }
                }

                const updates = [];
                const params = [];

                if (caseTitle) {
                    updates.push('case_title = ?');
                    params.push(caseTitle);
                }
                if (goalAmount) {
                    updates.push('goal_amount = ?');
                    params.push(goalAmount);
                }
                if (status) {
                    updates.push('status = ?');
                    params.push(status);
                }

                if (updates.length === 0) {
                    return res.status(400).json({ message: 'No updates provided' });
                }

                params.push(id);

                await connection.execute(
                    `UPDATE PATIENT_CASES SET ${updates.join(', ')} WHERE case_id = ?`,
                    params
                );

                res.json({
                    message: 'Case updated successfully',
                    caseId: id
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Update case error:', error);
            res.status(500).json({ message: 'Failed to update case', error: error.message });
        }
    }

    async deleteCase(req, res) {
        try {
            const { id } = req.params;
            const { userId, userType } = req.user;
            const connection = await db.getConnection();

            try {
                // Check if user is the case owner or doctor/team member
                if (userType === 'doctor') {
                    // Doctors can delete any case
                    const [cases] = await connection.execute(
                        `SELECT pc.* FROM PATIENT_CASES pc WHERE pc.case_id = ?`,
                        [id]
                    );
                    if (cases.length === 0) {
                        return res.status(404).json({ message: 'Case not found' });
                    }
                } else {
                    // Patients can only delete their own cases
                    const [cases] = await connection.execute(
                        `SELECT pc.* FROM PATIENT_CASES pc
                         JOIN PATIENTS p ON pc.patient_id = p.patient_id
                         WHERE pc.case_id = ? AND p.user_id = ?`,
                        [id, userId]
                    );
                    if (cases.length === 0) {
                        return res.status(403).json({ message: 'Unauthorized' });
                    }
                }

                await connection.execute(
                    'DELETE FROM PATIENT_CASES WHERE case_id = ?',
                    [id]
                );

                res.json({
                    message: 'Case deleted successfully',
                    caseId: id
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Delete case error:', error);
            res.status(500).json({ message: 'Failed to delete case', error: error.message });
        }
    }
}

module.exports = new CaseController();
