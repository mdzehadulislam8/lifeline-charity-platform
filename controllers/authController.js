// ====================================
// AUTHENTICATION CONTROLLER
// ====================================

const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

class AuthController {
    async register(req, res) {
        try {
            const { firstName, lastName, email, phone, password, userType, username, bloodType, specialty, licenseNumber, nid } = req.body;

            // Validation
            if (!firstName || !lastName || !email || !password) {
                return res.status(400).json({ message: 'Missing required fields' });
            }

            // Admin registration disabled
            if (userType === 'admin') {
                return res.status(400).json({ message: 'Admin registration is disabled' });
            }

            if (userType === 'blood_donor' && !bloodType) {
                return res.status(400).json({ message: 'Blood donor must provide blood type' });
            }

            const connection = await db.getConnection();

            console.log('Registration request body:', req.body);

            try {
                // Start transaction so we don't leave partial data on failure
                await connection.beginTransaction();
                // Check if user already exists
                const [existingUser] = await connection.execute(
                    'SELECT user_id FROM USERS WHERE email = ?',
                    [email]
                );

                if (existingUser.length > 0) {
                    return res.status(400).json({ message: 'Email already registered' });
                }

                // Hash password
                const salt = await bcrypt.genSalt(10);
                const passwordHash = await bcrypt.hash(password, salt);

                // Create user
                const userId = uuidv4();
                const createdAt = new Date();

                await connection.execute(
                    `INSERT INTO USERS (user_id, email, password_hash, user_type, username, phone_number, created_at, is_active)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [userId, email, passwordHash, userType || 'donor', username || email.split('@')[0], phone, createdAt, true]
                );

                // Handle profile photo upload if provided
                let photoPath = null;
                if (req.files && req.files.profilePhoto) {
                    try {
                        const profilePhoto = req.files.profilePhoto;
                        const uploadDir = path.join(__dirname, '../public/uploads');
                        
                        // Create uploads directory if it doesn't exist
                        if (!fs.existsSync(uploadDir)) {
                            fs.mkdirSync(uploadDir, { recursive: true });
                        }

                        const ext = path.extname(profilePhoto.name);
                        const filename = `profile_${userId}${ext}`;
                        const filepath = path.join(uploadDir, filename);
                        
                        await profilePhoto.mv(filepath);
                        photoPath = `/uploads/${filename}`;
                    } catch (photoErr) {
                        console.error('Profile photo upload error:', photoErr);
                        // Don't fail registration if photo upload fails, just skip it
                    }
                }

                // Create role-specific entry
                if (userType === 'doctor') {
                    const doctorId = uuidv4();
                    await connection.execute(
                        `INSERT INTO DOCTORS (doctor_id, user_id, specialty, license_number, is_verified, assigned_date, photo_path)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [doctorId, userId, specialty || null, licenseNumber || null, false, new Date(), photoPath]
                    );
                } else if (userType === 'blood_donor') {
                    const bloodDonorId = uuidv4();
                    const donorId = uuidv4();

                    // Create DONORS entry
                    await connection.execute(
                        `INSERT INTO DONORS (donor_id, user_id, is_verified, photo_path)
                         VALUES (?, ?, ?, ?)`,
                        [donorId, userId, false, photoPath]
                    );

                    // Create BLOOD_DONORS entry
                    await connection.execute(
                        `INSERT INTO BLOOD_DONORS (blood_donor_id, donor_id, blood_type, rh_factor, is_available)
                         VALUES (?, ?, ?, ?, ?)`,
                        [bloodDonorId, donorId, bloodType?.substring(0, bloodType.length - 1) || 'O', 
                         bloodType?.slice(-1) || '+', true]
                    );
                } else if (userType === 'patient') {
                    const patientId = uuidv4();
                    await connection.execute(
                        `INSERT INTO PATIENTS (patient_id, user_id, first_name, last_name, phone_number, registration_date, photo_path)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [patientId, userId, firstName, lastName, phone, new Date(), photoPath]
                    );
                } else if (userType === 'donor') {
                    const donorId = uuidv4();
                    await connection.execute(
                        `INSERT INTO DONORS (donor_id, user_id, is_verified, photo_path)
                         VALUES (?, ?, ?, ?)`,
                        [donorId, userId, false, photoPath]
                    );
                }

                // Commit transaction after all inserts succeed
                await connection.commit();

                // Generate JWT token
                const token = jwt.sign(
                    { userId, email, userType },
                    process.env.JWT_SECRET || 'your_secret_key',
                    { expiresIn: process.env.JWT_EXPIRATION || '7d' }
                );

                res.status(201).json({
                    message: 'User registered successfully',
                    user: {
                        userId,
                        email,
                        firstName,
                        lastName,
                        username: username || email.split('@')[0],
                        userType,
                        photoPath: photoPath
                    },
                    token
                });

            } catch (innerErr) {
                // Rollback if any step failed
                try {
                    await connection.rollback();
                } catch (rbErr) {
                    console.error('Rollback error:', rbErr);
                }
                console.error('Registration inner error:', innerErr);
                return res.status(400).json({ message: innerErr.message || 'Registration failed during processing' });
            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ message: 'Registration failed', error: error.message });
        }
    }

    async login(req, res) {
        try {
            const { email, password, expectedRole } = req.body;

            if (!email || !password) {
                return res.status(400).json({ message: 'Email and password required' });
            }

            const connection = await db.getConnection();

            try {
                // Get user
                const [users] = await connection.execute(
                    'SELECT user_id, email, password_hash, user_type, username FROM USERS WHERE email = ?',
                    [email]
                );

                if (users.length === 0) {
                    return res.status(401).json({ message: 'Invalid email or password' });
                }

                const user = users[0];

                // Check password
                const isPasswordValid = await bcrypt.compare(password, user.password_hash);
                if (!isPasswordValid) {
                    return res.status(401).json({ message: 'Invalid email or password' });
                }

                // If frontend provided an expectedRole, validate it against stored user_type
                if (expectedRole && expectedRole !== user.user_type) {
                    return res.status(403).json({ message: `Account role mismatch. Please login as ${user.user_type}.` });
                }

                // Generate token
                const token = jwt.sign(
                    { userId: user.user_id, email: user.email, userType: user.user_type },
                    process.env.JWT_SECRET || 'your_secret_key',
                    { expiresIn: process.env.JWT_EXPIRATION || '7d' }
                );

                // Update last login
                await connection.execute(
                    'UPDATE USERS SET last_login = ? WHERE user_id = ?',
                    [new Date(), user.user_id]
                );

                // Get photo_path from role-specific table
                let photoPath = null;
                try {
                    if (user.user_type === 'doctor') {
                        const [doctors] = await connection.execute(
                            'SELECT photo_path FROM DOCTORS WHERE user_id = ?',
                            [user.user_id]
                        );
                        if (doctors.length > 0) photoPath = doctors[0].photo_path;
                    } else if (user.user_type === 'patient') {
                        const [patients] = await connection.execute(
                            'SELECT photo_path FROM PATIENTS WHERE user_id = ?',
                            [user.user_id]
                        );
                        if (patients.length > 0) photoPath = patients[0].photo_path;
                    } else if (user.user_type === 'donor' || user.user_type === 'blood_donor') {
                        const [donors] = await connection.execute(
                            'SELECT photo_path FROM DONORS WHERE user_id = ?',
                            [user.user_id]
                        );
                        if (donors.length > 0) photoPath = donors[0].photo_path;
                    }
                } catch (photoErr) {
                    console.warn('Could not fetch photo path:', photoErr.message);
                }

                res.json({
                    message: 'Login successful',
                    user: {
                        userId: user.user_id,
                        email: user.email,
                        username: user.username,
                        userType: user.user_type,
                        photoPath: photoPath
                    },
                    token
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ message: 'Login failed', error: error.message });
        }
    }

    async logout(req, res) {
        try {
            res.json({ message: 'Logout successful' });
        } catch (error) {
            res.status(500).json({ message: 'Logout failed', error: error.message });
        }
    }

    async updateProfile(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ message: 'Not authenticated' });
            }

            const { firstName, lastName, phone, password } = req.body;
            const connection = await db.getConnection();

            try {
                await connection.beginTransaction();

                // Get current user
                const [users] = await connection.execute(
                    'SELECT user_id, user_type, password_hash FROM USERS WHERE user_id = ?',
                    [userId]
                );

                if (users.length === 0) {
                    return res.status(404).json({ message: 'User not found' });
                }

                const user = users[0];
                let updateFields = [];
                let updateValues = [];

                // Update phone if provided
                if (phone) {
                    updateFields.push('phone_number = ?');
                    updateValues.push(phone);
                }

                // Update password if provided
                if (password) {
                    const salt = await bcrypt.genSalt(10);
                    const passwordHash = await bcrypt.hash(password, salt);
                    updateFields.push('password_hash = ?');
                    updateValues.push(passwordHash);
                }

                if (updateFields.length > 0) {
                    updateValues.push(userId);
                    await connection.execute(
                        `UPDATE USERS SET ${updateFields.join(', ')} WHERE user_id = ?`,
                        updateValues
                    );
                }

                // Handle profile photo upload if provided
                let photoPath = null;
                if (req.files && req.files.profilePhoto) {
                    try {
                        const profilePhoto = req.files.profilePhoto;
                        const uploadDir = path.join(__dirname, '../public/uploads');
                        
                        if (!fs.existsSync(uploadDir)) {
                            fs.mkdirSync(uploadDir, { recursive: true });
                        }

                        const ext = path.extname(profilePhoto.name);
                        const filename = `profile_${userId}${ext}`;
                        const filepath = path.join(uploadDir, filename);
                        
                        // Delete old photo if it exists
                        if (fs.existsSync(filepath)) {
                            fs.unlinkSync(filepath);
                        }
                        
                        await profilePhoto.mv(filepath);
                        photoPath = `/uploads/${filename}`;
                    } catch (photoErr) {
                        console.error('Profile photo upload error:', photoErr);
                        // Don't fail profile update if photo upload fails
                    }
                }

                // Update role-specific fields and photo
                if (user.user_type === 'doctor') {
                    if (firstName || lastName || photoPath) {
                        let docFields = [];
                        let docValues = [];

                        if (firstName) {
                            docFields.push('first_name = ?');
                            docValues.push(firstName);
                        }
                        if (lastName) {
                            docFields.push('last_name = ?');
                            docValues.push(lastName);
                        }
                        if (photoPath) {
                            docFields.push('photo_path = ?');
                            docValues.push(photoPath);
                        }

                        if (docFields.length > 0) {
                            docValues.push(userId);
                            await connection.execute(
                                `UPDATE DOCTORS SET ${docFields.join(', ')} WHERE user_id = ?`,
                                docValues
                            );
                        }
                    }
                } else if (user.user_type === 'patient') {
                    if (firstName || lastName || photoPath) {
                        let patFields = [];
                        let patValues = [];

                        if (firstName) {
                            patFields.push('first_name = ?');
                            patValues.push(firstName);
                        }
                        if (lastName) {
                            patFields.push('last_name = ?');
                            patValues.push(lastName);
                        }
                        if (photoPath) {
                            patFields.push('photo_path = ?');
                            patValues.push(photoPath);
                        }

                        if (patFields.length > 0) {
                            patValues.push(userId);
                            await connection.execute(
                                `UPDATE PATIENTS SET ${patFields.join(', ')} WHERE user_id = ?`,
                                patValues
                            );
                        }
                    }
                } else if (user.user_type === 'donor' || user.user_type === 'blood_donor') {
                    if (photoPath) {
                        await connection.execute(
                            `UPDATE DONORS SET photo_path = ? WHERE user_id = ?`,
                            [photoPath, userId]
                        );
                    }
                }

                await connection.commit();

                // Return updated user
                const [updatedUsers] = await connection.execute(
                    'SELECT user_id, email, user_type, username, phone_number FROM USERS WHERE user_id = ?',
                    [userId]
                );

                if (updatedUsers.length > 0) {
                    const updatedUser = updatedUsers[0];
                    res.json({
                        message: 'Profile updated successfully',
                        user: {
                            userId: updatedUser.user_id,
                            email: updatedUser.email,
                            userType: updatedUser.user_type,
                            username: updatedUser.username,
                            phone: updatedUser.phone_number,
                            photoPath
                        }
                    });
                } else {
                    res.status(404).json({ message: 'User not found after update' });
                }

            } catch (innerErr) {
                try {
                    await connection.rollback();
                } catch (rbErr) {
                    console.error('Rollback error:', rbErr);
                }
                console.error('Profile update error:', innerErr);
                res.status(400).json({ message: innerErr.message || 'Profile update failed' });
            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Profile update error:', error);
            res.status(500).json({ message: 'Profile update failed', error: error.message });
        }
    }
}

module.exports = new AuthController();
