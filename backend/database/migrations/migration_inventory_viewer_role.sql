-- ============================================================
-- Migration: add the "Viewer / Commentor" inventory role, and the
-- comments table it needs. This role can log in, view everything in
-- Inventory, and leave comments on items - but cannot add, edit, or
-- delete anything. Only Superadmin can create this account type
-- (same as every other Inventory account, going forward).
-- Run this ONCE against your EXISTING Neon database.
--
-- Neon dashboard -> SQL Editor -> paste this -> Run
-- ============================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('superadmin','hr_staff','inventory_staff','inventory_viewer','employee'));

CREATE TABLE IF NOT EXISTS inventory_comments (
    id SERIAL PRIMARY KEY,
    item_id INT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_comments_item ON inventory_comments(item_id);
