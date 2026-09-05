-- ============================================================
-- Migration: add chat messages + push subscriptions
-- Run this ONCE against your EXISTING Neon database.
--
-- Neon dashboard -> SQL Editor -> paste this -> Run
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read_by_employee SMALLINT DEFAULT 0,
    is_read_by_hr SMALLINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(500) UNIQUE NOT NULL,
    p256dh VARCHAR(255) NOT NULL,
    auth VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_employee ON chat_messages(employee_id);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
