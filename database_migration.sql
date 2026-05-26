-- ===================================
-- LIFELINE CHARITY PLATFORM - DATABASE MIGRATION
-- ===================================
-- Run this file to update your existing database with new columns

-- Add columns to PATIENTS table if they don't exist
ALTER TABLE PATIENTS ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE PATIENTS ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE PATIENTS ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
ALTER TABLE PATIENTS ADD COLUMN IF NOT EXISTS nid VARCHAR(50);
ALTER TABLE PATIENTS ADD COLUMN IF NOT EXISTS age INT;
ALTER TABLE PATIENTS ADD COLUMN IF NOT EXISTS medical_condition VARCHAR(255);
ALTER TABLE PATIENTS ADD COLUMN IF NOT EXISTS current_condition TEXT;
ALTER TABLE PATIENTS ADD COLUMN IF NOT EXISTS photo_path VARCHAR(255);
ALTER TABLE PATIENTS ADD COLUMN IF NOT EXISTS doctor_id VARCHAR(255);
ALTER TABLE PATIENTS ADD COLUMN IF NOT EXISTS doctor_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE PATIENTS ADD COLUMN IF NOT EXISTS admin_status VARCHAR(50) DEFAULT 'pending';

-- Add DOCTORS table if it doesn't exist
CREATE TABLE IF NOT EXISTS DOCTORS (
    doctor_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    specialty VARCHAR(100),
    license_number VARCHAR(255) UNIQUE,
    photo_path VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    assigned_date DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
);

-- Add photo_path to DONORS table if it doesn't exist
ALTER TABLE DONORS ADD COLUMN IF NOT EXISTS photo_path VARCHAR(255);

-- Add ADMINS table if it doesn't exist
CREATE TABLE IF NOT EXISTS ADMINS (
    admin_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,

    nid VARCHAR(50),
    is_verified BOOLEAN DEFAULT FALSE,
    assigned_date DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
);

-- Add columns to PATIENT_CASES table
ALTER TABLE PATIENT_CASES ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE PATIENT_CASES ADD COLUMN IF NOT EXISTS doctor_approved_at DATETIME;
ALTER TABLE PATIENT_CASES ADD COLUMN IF NOT EXISTS admin_approved_at DATETIME;
ALTER TABLE PATIENT_CASES ADD COLUMN IF NOT EXISTS doctor_notes TEXT;

-- Rename approved_at to match new schema if needed
ALTER TABLE PATIENT_CASES CHANGE COLUMN `approved_at` `admin_approved_at` DATETIME;

-- Add PATIENT_SUBMISSIONS table if it doesn't exist
CREATE TABLE IF NOT EXISTS PATIENT_SUBMISSIONS (
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

-- Update BLOOD_DONATIONS table
ALTER TABLE BLOOD_DONATIONS ADD COLUMN IF NOT EXISTS request_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE BLOOD_DONATIONS ADD COLUMN IF NOT EXISTS admin_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE BLOOD_DONATIONS ADD COLUMN IF NOT EXISTS admin_id VARCHAR(255);
ALTER TABLE BLOOD_DONATIONS ADD COLUMN IF NOT EXISTS admin_reviewed_at DATETIME;
ALTER TABLE BLOOD_DONATIONS ADD FOREIGN KEY (admin_id) REFERENCES ADMINS(admin_id) ON DELETE SET NULL;

-- ===================================
-- MIGRATION COMPLETE
-- ===================================
