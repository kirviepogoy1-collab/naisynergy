-- ============================================================
-- Migration: add per-account login lockout (5 failed attempts locks
-- the account for 30 minutes), on top of the existing per-IP rate
-- limiter. This closes the gap where someone spreads login attempts
-- against one specific account across many different IPs.
-- Run this ONCE against your EXISTING Neon database.
--
-- Neon dashboard -> SQL Editor -> paste this -> Run
-- ============================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP NULL;
