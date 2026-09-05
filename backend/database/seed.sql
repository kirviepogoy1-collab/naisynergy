-- ============================================================
-- Seed data — one account per role (Postgres / Neon version)
-- Default password for ALL seeded accounts: Password123!
-- (change these after first login)
--
-- Run this AFTER schema.sql, in the Neon SQL Editor or via:
--   psql "$DATABASE_URL" -f backend/database/seed.sql
-- ============================================================

INSERT INTO users (username, email, password, name, role, is_hired, employee_number, current_position)
VALUES
('superadmin', 'superadmin@naisynergy.local', '$2b$10$Jfu.zR8YbkaT0CkTBqY46e24PiJM62rOx.bZP1cASAEVoO2vD1aYq', 'Super Admin', 'superadmin', 1, NULL, NULL),
('hrstaff', 'hrstaff@naisynergy.local', '$2b$10$Jfu.zR8YbkaT0CkTBqY46e24PiJM62rOx.bZP1cASAEVoO2vD1aYq', 'HR Staff', 'hr_staff', 1, NULL, NULL),
('inventorystaff', 'inventorystaff@naisynergy.local', '$2b$10$Jfu.zR8YbkaT0CkTBqY46e24PiJM62rOx.bZP1cASAEVoO2vD1aYq', 'Inventory Staff', 'inventory_staff', 1, NULL, NULL),
('employee1', 'employee1@naisynergy.local', '$2b$10$Jfu.zR8YbkaT0CkTBqY46e24PiJM62rOx.bZP1cASAEVoO2vD1aYq', 'Juan Dela Cruz', 'employee', 1, 'EMP-0001', 'High School Teacher');

-- Rooms across the 4 fixed buildings (room_code style matches the original docs, e.g. EEB101)
INSERT INTO rooms (room_code, room_name, building) VALUES
('EEB101', 'Room 101', 'Edna & Edgar Building'),
('EEB102', 'Room 102', 'Edna & Edgar Building'),
('MB101', 'Room 101', 'Memorial Building'),
('MB102', 'Room 102', 'Memorial Building'),
('SB101', 'Room 101', 'Sussana Building'),
('SB102', 'Room 102', 'Sussana Building'),
('NAI01', 'Business Office', 'NAI Offices'),
('NAI02', 'Library', 'NAI Offices'),
('NAI03', 'IT Office', 'NAI Offices'),
('NAI04', 'Guidance Office', 'NAI Offices');

-- Sample personnel (area matches a room_code exactly, same as the original app)
INSERT INTO personnel (area, personnel_name, contact_number) VALUES
('EEB101', 'Maria Santos', '09171234567'),
('MB101', 'Pedro Reyes', '09181234567'),
('NAI01', 'Grace Lim', '09191234567');

-- Sample inventory assets
INSERT INTO inventory (room_code, asset_code, asset_name, description, purchase_date, purchase_price, working, for_repair, non_working, salvage)
VALUES
('EEB101', 'AST-0001', 'Office Chair', 'Standard swivel chair', '2024-06-01', 1500.00, 5, 1, 0, 0),
('MB101', 'AST-0002', 'Projector', 'Epson classroom projector', '2023-08-15', 25000.00, 1, 0, 0, 0),
('EEB101', 'AST-0002', 'Projector', 'Epson classroom projector', '2023-08-15', 25000.00, 1, 0, 0, 0);

-- Sample purchase record
INSERT INTO records (item_name, quantity, purchase_date, purchase_price, supplier, category)
VALUES
('Office Chair', 6, '2024-06-01', 1500.00, 'ABC Office Supplies', 'Furniture');
