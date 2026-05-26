-- Migration: Add homepage control flags to PATIENT_CASES

ALTER TABLE PATIENT_CASES
    ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS show_on_home BOOLEAN DEFAULT TRUE;

-- End migration
