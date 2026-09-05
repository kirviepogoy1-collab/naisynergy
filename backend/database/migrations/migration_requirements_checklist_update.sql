-- ============================================================
-- Migration: rename document_type values to match the school's
-- actual pre-employment checklist (Nissi Academy Inc.), so any
-- documents already uploaded under the old labels stay matched
-- to the correct requirement instead of showing as "not uploaded".
-- Run this ONCE against your EXISTING Neon database.
--
-- Neon dashboard -> SQL Editor -> paste this -> Run
-- ============================================================

UPDATE employee_documents SET document_type = 'Transcript of Records' WHERE document_type = 'Transcript of Record';
UPDATE employee_documents SET document_type = 'Professional License (ID)/Board Rating/Certificate of Passing' WHERE document_type = 'Professional License/Board Rating/Certificate of Passing';
UPDATE employee_documents SET document_type = 'BIR Form (W-2/2316/1902/2305)' WHERE document_type = 'BIR Form';
UPDATE employee_documents SET document_type = 'SSS (E1/E4/SSS ID/UMID/Static Info)' WHERE document_type = 'SSS';
UPDATE employee_documents SET document_type = 'PhilHealth ID/Updated MDR' WHERE document_type = 'PhilHealth';
UPDATE employee_documents SET document_type = 'Pag-Ibig (Loyalty ID/HDMF Form/Verification Slip)' WHERE document_type = 'Pag-Ibig';
UPDATE employee_documents SET document_type = 'Certificates of Trainings, Seminars, Conferences/Conventions Attended' WHERE document_type = 'Certificates of Trainings/Seminars';
UPDATE employee_documents SET document_type = 'Marriage Certificate/Contract (if married)' WHERE document_type = 'Marriage Certificate/Contract';
UPDATE employee_documents SET document_type = '2x2 Picture (4 pcs, colored, white background)' WHERE document_type = '2x2 Picture';
