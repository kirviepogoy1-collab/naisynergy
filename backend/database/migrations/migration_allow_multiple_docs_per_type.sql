-- ============================================================
-- Migration: allow multiple documents of the same type per employee
-- (e.g. employee uploads a certificate, HR later asks for a grade
-- slip too — both should be able to sit under the same document type
-- instead of the second upload being rejected).
-- Run this ONCE against your EXISTING Neon database.
--
-- Neon dashboard -> SQL Editor -> paste this -> Run
-- ============================================================

ALTER TABLE employee_documents
    DROP CONSTRAINT IF EXISTS employee_documents_user_id_document_type_key;
