-- ============================================================
-- Migration: add two-factor authentication support
-- Run this ONCE against your EXISTING Neon database.
--
-- Neon dashboard -> SQL Editor -> paste this -> Run
-- ============================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS two_factor_enabled SMALLINT DEFAULT 0;
