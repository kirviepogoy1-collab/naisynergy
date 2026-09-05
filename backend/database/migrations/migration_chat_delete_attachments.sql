-- ============================================================
-- Migration: chat "delete conversation" (per-side, like Messenger)
-- + file/image attachments in chat
-- Run this ONCE against your EXISTING database (Neon SQL editor).
-- ============================================================

-- Attachments: a message can carry an uploaded file/image instead of
-- (or alongside) text. attachment_type is 'image' or 'file' so the
-- frontend knows whether to render an <img> preview or a download link.
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(10);
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- Now that a message can be attachment-only, "message" no longer has to be
-- filled in for every row.
ALTER TABLE chat_messages ALTER COLUMN message DROP NOT NULL;

-- Per-side "delete conversation" (Messenger-style): each side can clear
-- their own view of a thread without affecting the other side's view or
-- deleting anything for real. Storing a cutoff timestamp per employee/side
-- is simpler than soft-deleting every row, and means the thread comes back
-- automatically (from the clearer's point of view) as soon as a new
-- message arrives after that cutoff.
CREATE TABLE IF NOT EXISTS chat_thread_state (
    employee_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    employee_cleared_at TIMESTAMP NULL,
    hr_cleared_at TIMESTAMP NULL
);
