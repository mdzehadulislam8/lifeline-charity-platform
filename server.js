// ====================================
// MAIN SERVER FILE - server.js
// ====================================

const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
require('dotenv').config();

// Stripe for webhooks (only initialize when key provided)
const stripeLib = require('stripe');
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
    stripe = stripeLib(process.env.STRIPE_SECRET_KEY);
} else {
    console.warn('STRIPE_SECRET_KEY not set — Stripe webhook handling disabled. Set STRIPE_SECRET_KEY to enable Stripe.');
}

// Import routes
const authRoutes = require('./routes/authRoutes');
const caseRoutes = require('./routes/caseRoutes');
const donationRoutes = require('./routes/donationRoutes');
const bloodRoutes = require('./routes/bloodRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const paymentsRoutes = require('./routes/paymentsRoutes');
const billRoutes = require('./routes/billRoutes');
const payoutRoutes = require('./routes/payoutRoutes');
const statsRoutes = require('./routes/statsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const platformRoutes = require('./routes/platformRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Initialize Express
const app = express();

// Middleware
app.use(cors());

// NOTE: Stripe/webhook support removed for local MySQL-only flow.
// Payment confirmations are processed via internal endpoints (admin or donor confirmation).

app.use(express.json());
app.use(fileUpload());

// Quick handler for a historically-missing default image to avoid repeated 404 overhead
app.get('/images/default-patient.jpg', (req, res) => {
    // Return No Content; clients won't repeatedly fetch a resource that returns 204 quickly
    res.status(204).end();
});

app.use(express.static('public'));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/blood', bloodRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running' });
});

// TEST ENDPOINT: Create test data for debugging
app.get('/api/test/create-sample-data', async (req, res) => {
    try {
        const db = require('./config/database');
        const { v4: uuidv4 } = require('uuid');
        const connection = await db.getConnection();
        
        try {
            // Start transaction
            await connection.beginTransaction();
            
            // 1. Create test patient user
            const patientUserId = uuidv4();
            await connection.execute(
                `INSERT INTO USERS (user_id, email, password_hash, user_type, phone_number, created_at, is_active) 
                 VALUES (?, ?, MD5(?), 'patient', ?, NOW(), TRUE) 
                 ON DUPLICATE KEY UPDATE user_id=user_id`,
                [patientUserId, 'testpatient@example.com', 'test123', '01700000001']
            );
            
            // 2. Create patient profile
            const patientId = uuidv4();
            await connection.execute(
                `INSERT INTO PATIENTS (patient_id, user_id, first_name, last_name, phone_number, nid, medical_condition, registration_date) 
                 VALUES (?, ?, 'Test', 'Patient', '01700000001', '123456789012', 'Test Medical Condition', NOW())`,
                [patientId, patientUserId]
            );
            
            // 3. Create test doctor user
            const doctorUserId = uuidv4();
            await connection.execute(
                `INSERT INTO USERS (user_id, email, password_hash, user_type, phone_number, created_at, is_active) 
                 VALUES (?, ?, MD5(?), 'doctor', ?, NOW(), TRUE) 
                 ON DUPLICATE KEY UPDATE user_id=user_id`,
                [doctorUserId, 'testdoctor@example.com', 'test123', '01800000001']
            );
            
            // 4. Create doctor profile
            const doctorId = uuidv4();
            await connection.execute(
                `INSERT INTO DOCTORS (doctor_id, user_id, assigned_date) 
                 VALUES (?, ?, NOW())`,
                [doctorId, doctorUserId]
            );
            
            // 5. Create test case
            const caseId = uuidv4();
            await connection.execute(
                `INSERT INTO PATIENT_CASES (case_id, patient_id, case_title, category, medical_condition, full_description, goal_amount, status, created_at) 
                 VALUES (?, ?, 'Test Case', 'Medical', 'Test Medical Condition', 'This is a test case for debugging', 50000, 'pending', NOW())`,
                [caseId, patientId]
            );
            
            // 6. Create test submission
            const submissionId = uuidv4();
            await connection.execute(
                `INSERT INTO PATIENT_SUBMISSIONS (submission_id, patient_id, case_id, prescription_file_path, current_condition, submission_date, doctor_status) 
                 VALUES (?, ?, ?, ?, ?, NOW(), 'pending')`,
                [submissionId, patientId, caseId, '/uploads/test_prescription.pdf', 'Test current condition']
            );
            
            // Commit transaction
            await connection.commit();
            connection.release();
            
            res.json({ 
                message: 'Test data created successfully',
                data: {
                    patientUser: { email: 'testpatient@example.com', password: 'test123' },
                    doctorUser: { email: 'testdoctor@example.com', password: 'test123' },
                    testSubmission: { submissionId, caseId, patientId, doctorId }
                }
            });
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    } catch (error) {
        console.error('Test data creation error:', error);
        res.status(500).json({ 
            message: 'Failed to create test data', 
            error: error.message 
        });
    }
});

// Serve home page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Fallback: serve submission.html for /submission route
app.get('/submission.html', (req, res) => {
    res.sendFile(__dirname + '/public/submission.html');
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server with automatic fallback if port is in use
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;

function startServer(port, attempt = 0, maxAttempts = 5) {
    const server = app.listen(port, () => {
        console.log(`\n========================================`);
        console.log(`Lifeline Charity Platform`);
        console.log(`Server running at http://localhost:${port}`);
        console.log(`Frontend: http://localhost:${port}`);
        console.log(`API: http://localhost:${port}/api`);
        console.log(`========================================\n`);
    });

    server.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
            if (attempt < maxAttempts) {
                const nextPort = port + 1;
                console.warn(`Port ${port} is in use — trying ${nextPort}...`);
                // small delay before retrying
                setTimeout(() => startServer(nextPort, attempt + 1, maxAttempts), 250);
                return;
            }
            console.error(`Port ${port} is in use and no fallback ports available. Exiting.`);
            process.exit(1);
        }
        console.error('Server error:', err);
        process.exit(1);
    });

    return server;
}

startServer(DEFAULT_PORT);

module.exports = app;
