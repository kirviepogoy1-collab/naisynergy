-- ============================================================
-- Migration: add government ID numbers + emergency contact fields
-- (matches the Nissi Academy Employee Profile form)
-- Run this ONCE against your EXISTING Neon database.
--
-- Neon dashboard -> SQL Editor -> paste this -> Run
-- ============================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS tin_no VARCHAR(50) NULL,
    ADD COLUMN IF NOT EXISTS sss_no VARCHAR(50) NULL,
    ADD COLUMN IF NOT EXISTS philhealth_no VARCHAR(50) NULL,
    ADD COLUMN IF NOT EXISTS pagibig_no VARCHAR(50) NULL,
    ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(150) NULL,
    ADD COLUMN IF NOT EXISTS emergency_contact_address VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS emergency_contact_mobile VARCHAR(50) NULL;
