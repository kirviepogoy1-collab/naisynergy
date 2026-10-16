-- OPTIONAL but recommended: makes ILIKE '%text%' searches fast instead of
-- scanning every row. Run once in the Neon SQL editor. Safe to re-run.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_users_name_trgm      ON users     USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_username_trgm  ON users     USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_email_trgm     ON users     USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_name_trgm  ON inventory USING gin (asset_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_code_trgm  ON inventory USING gin (asset_code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_records_item_trgm    ON records   USING gin (item_name gin_trgm_ops);
