-- 009_platform_fund.sql
-- Create tables for platform-wide donations and allocations

CREATE TABLE IF NOT EXISTS PLATFORM_DONATIONS (
  platform_donation_id CHAR(36) PRIMARY KEY,
  donor_id CHAR(36),
  amount DECIMAL(14,2) NOT NULL,
  payment_method VARCHAR(50),
  provider_reference VARCHAR(255),
  donation_date DATETIME NOT NULL,
  status VARCHAR(50) DEFAULT 'completed',
  is_anonymous TINYINT(1) DEFAULT 0,
  guest_name VARCHAR(255),
  guest_email VARCHAR(255),
  message TEXT
);

CREATE TABLE IF NOT EXISTS PLATFORM_ALLOCATIONS (
  allocation_id CHAR(36) PRIMARY KEY,
  case_id VARCHAR(255) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  allocated_by VARCHAR(255),
  allocated_at DATETIME NOT NULL,
  comment TEXT,
  FOREIGN KEY (case_id) REFERENCES PATIENT_CASES(case_id) ON DELETE CASCADE
);

-- Optional indexes
CREATE INDEX IF NOT EXISTS idx_platform_donations_status ON PLATFORM_DONATIONS(status);
CREATE INDEX IF NOT EXISTS idx_platform_allocations_case ON PLATFORM_ALLOCATIONS(case_id);
