-- ===================================
-- LIFELINE CHARITY PLATFORM - DATABASE SETUP
-- ===================================
-- Import this file into your MySQL database
-- Or copy-paste into phpMyAdmin SQL tab

-- ===================================
-- 1. CREATE DATABASE
-- ===================================

DROP DATABASE IF EXISTS charity_platform;
CREATE DATABASE IF NOT EXISTS charity_platform;
USE charity_platform;

-- ===================================
-- 2. CORE USER TABLES
-- ===================================

-- USERS Table
CREATE TABLE USERS (
    user_id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    user_type VARCHAR(50) NOT NULL,
    username VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20),
    created_at DATETIME NOT NULL,
    last_login DATETIME,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    INDEX idx_email (email),
    INDEX idx_user_type (user_type)
);

-- USER_SESSIONS Table
CREATE TABLE USER_SESSIONS (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    created_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_token (token)
);

-- AUDIT_LOGS Table
CREATE TABLE AUDIT_LOGS (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255),
    new_values JSON,
    timestamp DATETIME NOT NULL,
    ip_address VARCHAR(45),
    FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_timestamp (timestamp)
);

-- NOTIFICATIONS Table
CREATE TABLE NOTIFICATIONS (
    notification_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    action_url VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

-- ===================================
-- 3. EXTENDED USER ROLES
-- ===================================

-- DOCTORS Table
CREATE TABLE DOCTORS (
    doctor_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    specialty VARCHAR(100),
    license_number VARCHAR(255) UNIQUE,
    is_verified BOOLEAN DEFAULT FALSE,
    assigned_date DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
);

-- ADMINS Table
CREATE TABLE ADMINS (
    admin_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL,
    permissions JSON,
    assigned_date DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
);

-- PATIENTS Table
CREATE TABLE PATIENTS (
    patient_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone_number VARCHAR(20),
    nid VARCHAR(50) UNIQUE,
    age INT,
    address TEXT,
    photo_path VARCHAR(255),
    medical_condition VARCHAR(255),
    current_condition TEXT,
    emergency_contact VARCHAR(255),
    relationship VARCHAR(50),
    contact_phone VARCHAR(20),
    medical_history TEXT,
    registration_date DATE NOT NULL,
    doctor_id VARCHAR(255),
    doctor_status VARCHAR(50) DEFAULT 'pending',
    admin_status VARCHAR(50) DEFAULT 'pending',
    FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES DOCTORS(doctor_id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_doctor_id (doctor_id)
);

-- DONORS Table
CREATE TABLE DONORS (
    donor_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    recipient_id VARCHAR(255),
    preferred_payment_method VARCHAR(100),
    total_donated_amount FLOAT DEFAULT 0,
    last_donation_date DATE,
    is_verified BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
);

-- BLOOD_DONORS Table
CREATE TABLE BLOOD_DONORS (
    blood_donor_id VARCHAR(255) PRIMARY KEY,
    donor_id VARCHAR(255) UNIQUE NOT NULL,
    blood_type VARCHAR(10) NOT NULL,
    rh_factor VARCHAR(10) NOT NULL,
    last_donation_date DATE,
    health_conditions TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    location VARCHAR(255),
    availability_start DATETIME,
    availability_end DATETIME,
    FOREIGN KEY (donor_id) REFERENCES DONORS(donor_id) ON DELETE CASCADE,
    INDEX idx_blood_type (blood_type),
    INDEX idx_location (location),
    INDEX idx_available (is_available)
);

-- ===================================
-- 4. CASE, DONATION, AND TRANSACTION TABLES
-- ===================================

-- PATIENT_SUBMISSIONS Table
CREATE TABLE PATIENT_SUBMISSIONS (
    submission_id VARCHAR(255) PRIMARY KEY,
    patient_id VARCHAR(255) NOT NULL,
    case_id VARCHAR(255),
    prescription_file_path VARCHAR(255) NOT NULL,
    nid_file_path VARCHAR(255),
    current_condition TEXT NOT NULL,
    submission_date DATETIME NOT NULL,
    doctor_status VARCHAR(50) DEFAULT 'pending',
    doctor_id VARCHAR(255),
    doctor_reviewed_at DATETIME,
    doctor_notes TEXT,
    admin_status VARCHAR(50) DEFAULT 'pending',
    admin_id VARCHAR(255),
    admin_reviewed_at DATETIME,
    admin_notes TEXT,
    FOREIGN KEY (patient_id) REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES PATIENT_CASES(case_id) ON DELETE SET NULL,
    FOREIGN KEY (doctor_id) REFERENCES DOCTORS(doctor_id) ON DELETE SET NULL,
    FOREIGN KEY (admin_id) REFERENCES ADMINS(admin_id) ON DELETE SET NULL,
    INDEX idx_patient_id (patient_id),
    INDEX idx_doctor_status (doctor_status),
    INDEX idx_admin_status (admin_status)
);

-- PATIENT_CASES Table
CREATE TABLE PATIENT_CASES (
    case_id VARCHAR(255) PRIMARY KEY,
    patient_id VARCHAR(255) NOT NULL,
    case_title VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    medical_condition TEXT NOT NULL,
    full_description TEXT,
    goal_amount FLOAT NOT NULL,
    collected_amount FLOAT DEFAULT 0,
    status VARCHAR(50) NOT NULL,
    created_at DATETIME NOT NULL,
    doctor_approved_at DATETIME,
    admin_approved_at DATETIME,
    admin_notes TEXT,
    doctor_notes TEXT,
    is_urgent BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (patient_id) REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    INDEX idx_patient_id (patient_id),
    INDEX idx_status (status),
    INDEX idx_category (category),
    INDEX idx_created_at (created_at)
);

-- BLOOD_DONATIONS Table
CREATE TABLE BLOOD_DONATIONS (
    donation_id VARCHAR(255) PRIMARY KEY,
    donor_id VARCHAR(255) NOT NULL,
    recipient_id VARCHAR(255),
    donation_date DATETIME NOT NULL,
    blood_type VARCHAR(10) NOT NULL,
    rh_factor VARCHAR(10) NOT NULL,
    units_donated FLOAT NOT NULL,
    status VARCHAR(50) NOT NULL,
    request_status VARCHAR(50) DEFAULT 'pending',
    admin_status VARCHAR(50) DEFAULT 'pending',
    admin_id VARCHAR(255),
    admin_reviewed_at DATETIME,
    notes TEXT,
    FOREIGN KEY (donor_id) REFERENCES DONORS(donor_id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES PATIENTS(patient_id) ON DELETE SET NULL,
    FOREIGN KEY (admin_id) REFERENCES ADMINS(admin_id) ON DELETE SET NULL,
    INDEX idx_donor_id (donor_id),
    INDEX idx_donation_date (donation_date),
    INDEX idx_status (status)
);

-- DONATIONS Table (Financial)
CREATE TABLE DONATIONS (
    donation_id VARCHAR(255) PRIMARY KEY,
    case_id VARCHAR(255) NOT NULL,
    donor_id VARCHAR(255),
    amount FLOAT NOT NULL,
    payment_method VARCHAR(100),
    transaction_uk VARCHAR(255) UNIQUE,
    donation_date DATETIME NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    is_anonymous BOOLEAN DEFAULT FALSE,
    guest_name VARCHAR(255),
    guest_email VARCHAR(255),
    FOREIGN KEY (case_id) REFERENCES PATIENT_CASES(case_id) ON DELETE CASCADE,
    FOREIGN KEY (donor_id) REFERENCES DONORS(donor_id) ON DELETE SET NULL,
    INDEX idx_case_id (case_id),
    INDEX idx_donor_id (donor_id),
    INDEX idx_donation_date (donation_date)
);

-- PAYMENT_TRANSACTIONS Table
CREATE TABLE PAYMENT_TRANSACTIONS (
    transaction_id VARCHAR(255) PRIMARY KEY,
    donation_id VARCHAR(255) UNIQUE NOT NULL,
    payment_gateway VARCHAR(100) NOT NULL,
    gateway_transaction_id VARCHAR(255) UNIQUE NOT NULL,
    amount FLOAT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(50) NOT NULL,
    processed_at DATETIME NOT NULL,
    gateway_response JSON,
    FOREIGN KEY (donation_id) REFERENCES DONATIONS(donation_id) ON DELETE CASCADE,
    INDEX idx_donation_id (donation_id),
    INDEX idx_gateway_transaction_id (gateway_transaction_id)
);

-- ===================================
-- 5. SUPPORT TABLES
-- ===================================

-- APPROVAL_QUEUE Table
CREATE TABLE APPROVAL_QUEUE (
    approval_id INT PRIMARY KEY AUTO_INCREMENT,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    submitted_at DATETIME NOT NULL,
    reviewed_at DATETIME,
    admin_id VARCHAR(255),
    review_notes TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    FOREIGN KEY (admin_id) REFERENCES ADMINS(admin_id) ON DELETE SET NULL,
    INDEX idx_entity_type (entity_type),
    INDEX idx_status (status)
);

-- MEDICAL_DOCUMENTS Table
CREATE TABLE MEDICAL_DOCUMENTS (
    document_id VARCHAR(255) PRIMARY KEY,
    case_id VARCHAR(255),
    document_type VARCHAR(100) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    uploaded_at DATETIME NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    blood_donation_id VARCHAR(255),
    FOREIGN KEY (case_id) REFERENCES PATIENT_CASES(case_id) ON DELETE CASCADE,
    FOREIGN KEY (blood_donation_id) REFERENCES BLOOD_DONATIONS(donation_id) ON DELETE CASCADE,
    INDEX idx_case_id (case_id)
);

-- ===================================
-- 6. INSERT SAMPLE DATA (Optional)
-- ===================================

-- Insert sample users
INSERT INTO USERS VALUES 
('user-1', 'patient1@example.com', '$2a$10$YmFzaWNfcGFzc3dvcmQ=', 'patient', 'patient1', '9876543210', NOW(), NULL, TRUE),
('user-2', 'donor1@example.com', '$2a$10$YmFzaWNfcGFzc3dvcmQ=', 'donor', 'donor1', '9876543211', NOW(), NULL, TRUE),
('user-3', 'blooddonor1@example.com', '$2a$10$YmFzaWNfcGFzc3dvcmQ=', 'blood_donor', 'blooddonor1', '9876543212', NOW(), NULL, TRUE);

-- Insert sample patients
INSERT INTO PATIENTS VALUES 
('patient-1', 'user-1', 'John Doe', 'Brother', '9876543210', 'No major health issues', '123 Medical Lane, Delhi', DATE(NOW()));

-- Insert sample donors
INSERT INTO DONORS VALUES 
('donor-1', 'user-2', NULL, 'card', 0, NULL, FALSE),
('donor-2', 'user-3', NULL, 'card', 0, NULL, FALSE);

-- Insert sample blood donors
INSERT INTO BLOOD_DONORS VALUES 
('blood-1', 'donor-2', 'O', '+', DATE(NOW()), NULL, TRUE, 'Delhi', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY));

-- Add patient satisfaction tracking columns
ALTER TABLE PATIENT_CASES ADD COLUMN IF NOT EXISTS patient_satisfied BOOLEAN DEFAULT FALSE;
ALTER TABLE PATIENT_CASES ADD COLUMN IF NOT EXISTS patient_review TEXT;
ALTER TABLE PATIENT_CASES ADD COLUMN IF NOT EXISTS patient_review_date DATETIME;
-- Representative case image path (added to support per-case images shown on homepage/cards)
ALTER TABLE PATIENT_CASES ADD COLUMN IF NOT EXISTS case_image_path VARCHAR(255);
-- Homepage control flags for cases
ALTER TABLE PATIENT_CASES ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE PATIENT_CASES ADD COLUMN IF NOT EXISTS show_on_home BOOLEAN DEFAULT TRUE;

-- Insert sample cases
INSERT INTO PATIENT_CASES VALUES 
('case-1', 'patient-1', 'Emergency Heart Surgery', 'Congenital Heart Disease', 'Help save a 5-year-old childs life', 500000, 350000, 'approved', NOW(), NOW(), 'Verified', TRUE, FALSE, NULL, NULL),
('case-2', 'patient-1', 'Cancer Treatment Fund', 'Advanced Cancer', 'Support aggressive cancer treatment', 750000, 520000, 'approved', DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_SUB(NOW(), INTERVAL 28 DAY), 'Verified', TRUE, FALSE, NULL, NULL);

-- ===================================
-- 7. CREATE INDEXES FOR PERFORMANCE
-- ===================================

ALTER TABLE USERS ADD INDEX idx_created_at (created_at);
ALTER TABLE DONATIONS ADD INDEX idx_status (status);
ALTER TABLE BLOOD_DONATIONS ADD INDEX idx_status (status);

-- ===================================
-- DATABASE SETUP COMPLETE
-- ===================================
-- You can now start using the Lifeline Charity Platform
-- Default test credentials:
-- Email: patient1@example.com (Patient)
-- Email: donor1@example.com (Donor)
-- Email: blooddonor1@example.com (Blood Donor)
-- Password: basic_password (hashed in database)
