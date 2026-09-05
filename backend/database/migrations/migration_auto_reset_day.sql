-- ============================================================
-- Migration: let each leave type auto-reset on any day of the
-- month, not just the 1st (adds leave_types.auto_reset_day).
--
-- NOT required to run by hand - backend/utils/leaveBalance.js
-- already does this same ALTER TABLE automatically on startup.
-- Only run this if you'd rather apply it yourself first.
--
-- Neon dashboard -> SQL Editor -> paste this -> Run
-- ============================================================

ALTER TABLE leave_types
    ADD COLUMN IF NOT EXISTS auto_reset_day SMALLINT NULL CHECK (auto_reset_day BETWEEN 1 AND 31);

-- Anyone with an existing auto_reset_month had an implicit "always the 1st"
-- reset day - backfill that explicitly so their schedule doesn't change.
UPDATE leave_types SET auto_reset_day = 1 WHERE auto_reset_month IS NOT NULL AND auto_reset_day IS NULL;
