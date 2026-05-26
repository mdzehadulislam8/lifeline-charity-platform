-- Migration: Add representative case image path to PATIENT_CASES
-- Run this migration after previous migrations

ALTER TABLE PATIENT_CASES
    ADD COLUMN IF NOT EXISTS case_image_path VARCHAR(255) NULL;

-- End migration
