
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_active SMALLINT DEFAULT 1;

-- Backfill: anyone HR had previously marked "not hired" (is_hired = 0)
-- starts out Inactive; everyone else starts Active.
UPDATE users SET is_active = COALESCE(is_hired, 1) WHERE role = 'employee';
