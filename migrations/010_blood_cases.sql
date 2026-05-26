-- Migration: Create BLOOD_CASES table for patient blood case submissions
-- Description: Allows patients to submit blood case requests that donors can respond to

CREATE TABLE IF NOT EXISTS BLOOD_CASES (
  case_id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  blood_type VARCHAR(3) NOT NULL,
  rh_factor VARCHAR(1) NOT NULL,
  units_needed INT NOT NULL,
  urgency_level ENUM('routine', 'urgent', 'critical') NOT NULL DEFAULT 'routine',
  hospital_name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  patient_name VARCHAR(255) NOT NULL,
  patient_phone VARCHAR(20) NOT NULL,
  date_needed_by DATETIME NOT NULL,
  doctor_recommendation TEXT,
  case_status ENUM('open', 'responded', 'completed', 'cancelled') NOT NULL DEFAULT 'open',
  matched_donor_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES PATIENTS(user_id) ON DELETE CASCADE,
  FOREIGN KEY (matched_donor_id) REFERENCES BLOOD_DONORS(donor_id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_case_status (case_status),
  INDEX idx_blood_type (blood_type),
  INDEX idx_created_at (created_at),
  INDEX idx_matched_donor_id (matched_donor_id)
);

-- Create table to track donors who are interested in a case
CREATE TABLE IF NOT EXISTS CASE_DONOR_RESPONSES (
  response_id VARCHAR(36) PRIMARY KEY,
  case_id VARCHAR(36) NOT NULL,
  donor_id VARCHAR(36) NOT NULL,
  response_status ENUM('interested', 'accepted', 'rejected', 'completed') NOT NULL DEFAULT 'interested',
  response_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES BLOOD_CASES(case_id) ON DELETE CASCADE,
  FOREIGN KEY (donor_id) REFERENCES BLOOD_DONORS(donor_id) ON DELETE CASCADE,
  UNIQUE KEY unique_case_donor (case_id, donor_id),
  INDEX idx_case_id (case_id),
  INDEX idx_donor_id (donor_id),
  INDEX idx_response_status (response_status)
);

-- Create table for case notifications
CREATE TABLE IF NOT EXISTS CASE_NOTIFICATIONS (
  notification_id VARCHAR(36) PRIMARY KEY,
  case_id VARCHAR(36) NOT NULL,
  donor_id VARCHAR(36) NOT NULL,
  notification_type ENUM('new_case', 'case_accepted', 'case_completed') NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES BLOOD_CASES(case_id) ON DELETE CASCADE,
  FOREIGN KEY (donor_id) REFERENCES BLOOD_DONORS(donor_id) ON DELETE CASCADE,
  INDEX idx_donor_id_unread (donor_id, is_read),
  INDEX idx_case_id (case_id)
);
