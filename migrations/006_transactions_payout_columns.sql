-- 006_transactions_payout_columns.sql
-- Add missing columns to TRANSACTIONS table for payout tracking

ALTER TABLE TRANSACTIONS
ADD COLUMN IF NOT EXISTS payout_id CHAR(36),
ADD COLUMN IF NOT EXISTS case_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_transactions_payout ON TRANSACTIONS(payout_id);
CREATE INDEX IF NOT EXISTS idx_transactions_case ON TRANSACTIONS(case_id);
