-- ============================================================
-- Migration: add a "Summer Leave" balance (5 days/year, same as
-- Service Incentive / Sick / Benevolence leave).
-- Run this ONCE against your EXISTING Neon database.
--
-- Neon dashboard -> SQL Editor -> paste this -> Run
-- ============================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS summer_leave_balance DECIMAL(4,1) DEFAULT 5;

-- Give existing employees their 5 days right away instead of waiting for
-- the next school-year auto-reset.
UPDATE users SET summer_leave_balance = 5 WHERE role = 'employee' AND summer_leave_balance IS NULL;
