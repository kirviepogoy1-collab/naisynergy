-- ============================================================
-- Migration: add "Forgot Password" support - a hashed reset token
-- and its expiry, per user.
-- Run this ONCE against your EXISTING Neon database.
--
-- Neon dashboard -> SQL Editor -> paste this -> Run
-- ============================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP NULL;
