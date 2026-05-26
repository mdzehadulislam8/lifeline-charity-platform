-- 004_wallets_bills.sql
-- Add wallets and bills tables for Ketto-style flow

CREATE TABLE IF NOT EXISTS WALLETS (
  wallet_id CHAR(36) PRIMARY KEY,
  case_id VARCHAR(255),
  campaign_id VARCHAR(255),
  balance DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'BDT',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS BILLS (
  bill_id CHAR(36) PRIMARY KEY,
  case_id VARCHAR(255) NOT NULL,
  hospital_name VARCHAR(255),
  amount DECIMAL(14,2) NOT NULL,
  bill_date DATETIME,
  description TEXT,
  status ENUM('pending','verified','rejected') DEFAULT 'pending',
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  uploaded_by VARCHAR(255),
  verified_at DATETIME NULL,
  verified_by VARCHAR(255),
  comment TEXT,
  FOREIGN KEY (case_id) REFERENCES PATIENT_CASES(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PAYOUTS (
  payout_id CHAR(36) PRIMARY KEY,
  case_id VARCHAR(255) NOT NULL,
  bill_id CHAR(36),
  amount DECIMAL(14,2) NOT NULL,
  hospital_name VARCHAR(255),
  status ENUM('requested','paid','confirmed','rejected') DEFAULT 'requested',
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME NULL,
  paid_at DATETIME NULL,
  confirmed_at DATETIME NULL,
  approved_by VARCHAR(255),
  rejected_at DATETIME NULL,
  rejected_by VARCHAR(255),
  rejection_reason TEXT,
  receipt_number VARCHAR(255),
  confirmed_comment TEXT,
  FOREIGN KEY (case_id) REFERENCES PATIENT_CASES(case_id) ON DELETE CASCADE,
  FOREIGN KEY (bill_id) REFERENCES BILLS(bill_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_wallet_case ON WALLETS(case_id);
CREATE INDEX IF NOT EXISTS idx_wallet_campaign ON WALLETS(campaign_id);
CREATE INDEX IF NOT EXISTS idx_bills_case ON BILLS(case_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON BILLS(status);
CREATE INDEX IF NOT EXISTS idx_payouts_case ON PAYOUTS(case_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON PAYOUTS(status);
