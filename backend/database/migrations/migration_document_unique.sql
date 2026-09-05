-- ============================================================
-- Migration: prevent duplicate document types per employee
-- Run this ONCE against your EXISTING Neon database.
--
-- Neon dashboard -> SQL Editor -> paste this -> Run
-- ============================================================

-- Safety check first: this will error out (on purpose) if any employee
-- already has more than one row for the same document_type - in that
-- case, review/delete the duplicates in Table Editor before re-running
-- the ALTER TABLE below.
DO $$
DECLARE
    dup_count INT;
BEGIN
    SELECT COUNT(*) INTO dup_count FROM (
        SELECT user_id, document_type
        FROM employee_documents
        GROUP BY user_id, document_type
        HAVING COUNT(*) > 1
    ) dupes;

    IF dup_count > 0 THEN
        RAISE EXCEPTION 'Found % employee/document_type combination(s) with duplicates - resolve them in Table Editor before running the ALTER TABLE below.', dup_count;
    END IF;
END $$;

ALTER TABLE employee_documents
    ADD CONSTRAINT employee_documents_user_id_document_type_key UNIQUE (user_id, document_type);
