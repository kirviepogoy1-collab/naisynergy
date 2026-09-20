

ALTER TABLE leave_types
    ADD COLUMN IF NOT EXISTS auto_reset_day SMALLINT NULL CHECK (auto_reset_day BETWEEN 1 AND 31);

-- Anyone with an existing auto_reset_month had an implicit "always the 1st"
-- reset day - backfill that explicitly so their schedule doesn't change.
UPDATE leave_types SET auto_reset_day = 1 WHERE auto_reset_month IS NOT NULL AND auto_reset_day IS NULL;
