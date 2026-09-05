-- ============================================================
-- Migration: add reviewer tracking + HR signature support
-- Run this ONCE against your EXISTING Neon database.
--
-- Neon dashboard -> SQL Editor -> paste this -> Run
-- ============================================================

ALTER TABLE leaves
    ADD COLUMN IF NOT EXISTS reviewed_by INT NULL REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS hr_signature_path VARCHAR(255) NULL;
