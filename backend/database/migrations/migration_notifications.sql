-- ============================================================
-- Migration: add notifications table
-- Run this ONCE against your EXISTING Neon database (do not run
-- the full schema.sql again - that would drop your existing data).
--
-- Neon dashboard -> SQL Editor -> paste this -> Run
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message VARCHAR(255) NOT NULL,
    link VARCHAR(255) NULL,
    is_read SMALLINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
