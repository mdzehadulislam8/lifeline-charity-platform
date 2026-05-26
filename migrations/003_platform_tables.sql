-- 003_platform_tables.sql
-- Add organizers, payouts, kyc_documents, transactions for platform features

CREATE TABLE IF NOT EXISTS ORGANIZERS (
  organizer_id CHAR(36) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  org_name VARCHAR(255),
  contact_phone VARCHAR(50),
  bank_account VARCHAR(255),
  bank_name VARCHAR(255),
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS PAYOUTS (
  payout_id CHAR(36) PRIMARY KEY,
  organizer_id CHAR(36) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  fee DECIMAL(12,2) DEFAULT 0,
  method VARCHAR(50),
  provider_reference VARCHAR(255),
  status ENUM('requested','approved','paid','rejected') DEFAULT 'requested',
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  FOREIGN KEY (organizer_id) REFERENCES ORGANIZERS(organizer_id)
);

CREATE TABLE IF NOT EXISTS KYC_DOCUMENTS (
  doc_id CHAR(36) PRIMARY KEY,
  organizer_id CHAR(36) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  doc_type VARCHAR(100) NOT NULL,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_by VARCHAR(255),
  reviewed_at DATETIME NULL,
  FOREIGN KEY (organizer_id) REFERENCES ORGANIZERS(organizer_id)
);

CREATE TABLE IF NOT EXISTS TRANSACTIONS (
  tx_id CHAR(36) PRIMARY KEY,
  payment_id CHAR(36),
  related_id VARCHAR(255),
  type VARCHAR(50),
  amount DECIMAL(12,2),
  currency VARCHAR(10) DEFAULT 'BDT',
  status VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ensure PAYMENTS has provider & status columns (should already exist), add indexes
-- NOTE: Some MySQL versions do not support `IF EXISTS` / `IF NOT EXISTS` in ALTER statements.
-- Use a plain ALTER TABLE here. If your database already has these columns, this statement
-- will fail; in that case apply this migration only once or remove the lines for already-existing columns.
ALTER TABLE PAYMENTS
  ADD COLUMN provider VARCHAR(50),
  ADD COLUMN status VARCHAR(50) DEFAULT 'pending';

-- Replace <ID> with the id you see in the request (caseId or campaignId)
SELECT campaign_id FROM CAMPAIGNS WHERE campaign_id = '<ID>';
SELECT case_id FROM PATIENT_CASES WHERE case_id = '<ID>';
