-- 005_add_caseid_to_payments.sql
-- Add `case_id` column to PAYMENTS table so legacy case donations can be recorded

ALTER TABLE PAYMENTS
  ADD COLUMN case_id VARCHAR(255) NULL;

-- Optionally add foreign key if PATIENT_CASES table exists
-- ALTER TABLE PAYMENTS
--   ADD CONSTRAINT fk_payments_case FOREIGN KEY (case_id) REFERENCES PATIENT_CASES(case_id) ON DELETE SET NULL;
