-- ============================================================
-- NAI SYNERGY - Combined HR Management + Inventory System
-- Postgres / Neon version - full setup (tables + starter data)
--
-- WARNING: this file starts with DROP TABLE for every table. Running it
-- will WIPE all existing data and recreate everything empty, then reseed
-- only the 4 default accounts. Only run this for a fresh start - use the
-- migration_*.sql files instead to update an existing database in place.
--
-- HOW TO USE:
-- Paste this whole file into the Neon SQL Editor
-- and run it in ONE go - do not run it in pieces.
-- ============================================================

-- ============================================================
-- NAI SYNERGY - Combined HR Management + Inventory System
-- Database schema (Postgres / Neon version)
--
-- Run this in the Neon SQL Editor (Dashboard -> SQL Editor -> New query),
-- or via psql:
--   psql "$DATABASE_URL" -f backend/database/schema.sql
--
-- NOTE: unlike MySQL, you don't CREATE DATABASE here - your Neon
-- project already gives you one Postgres database. This just creates
-- the tables inside it (in the default "public" schema).
-- ============================================================

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS user_activity;
DROP TABLE IF EXISTS records;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS leaves;
DROP TABLE IF EXISTS employee_documents;
DROP TABLE IF EXISTS personnel;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS buildings;
DROP TABLE IF EXISTS users;

-- ============================================================
-- USERS (single table for all 4 roles)
-- role: superadmin | hr_staff | inventory_staff | employee
--
-- MySQL ENUM columns become TEXT + CHECK constraints below -
-- functionally identical, and easier to extend later (just
-- update the CHECK instead of ALTER TYPE).
-- ============================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'employee'
        CHECK (role IN ('superadmin','hr_staff','inventory_staff','employee')),

    -- presence tracking (kept as 0/1 SMALLINT, same convention the app already uses)
    is_online SMALLINT DEFAULT 0,
    last_login TIMESTAMP NULL,

    -- HR / employee profile fields
    employee_number VARCHAR(50) NULL,
    is_hired SMALLINT DEFAULT 0,
    first_name VARCHAR(100) NULL,
    middle_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NULL,
    gender VARCHAR(10) NULL CHECK (gender IN ('Male','Female')),
    civil_status VARCHAR(10) NULL CHECK (civil_status IN ('Single','Married')),
    current_address VARCHAR(255) NULL,
    home_number VARCHAR(50) NULL,
    mobile_number VARCHAR(50) NULL,
    dob DATE NULL,
    pob VARCHAR(150) NULL,
    mother_maiden_name VARCHAR(150) NULL,
    spouse_name VARCHAR(150) NULL,
    current_position VARCHAR(150) NULL,
    date_employment DATE NULL,
    profile_pic VARCHAR(255) NULL,
    hr_signature_path VARCHAR(255) NULL,

    -- leave balances (reset yearly on school-year boundary, June 1)
    service_leave_balance DECIMAL(4,1) DEFAULT 5,
    sick_leave_balance DECIMAL(4,1) DEFAULT 5,
    benevolence_leave_balance DECIMAL(4,1) DEFAULT 5,
    maternity_paternity_balance DECIMAL(4,1) DEFAULT 0,
    others_balance DECIMAL(4,1) DEFAULT 0,
    last_reset TIMESTAMP NULL,

    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- EMPLOYEE DOCUMENTS (HR module)
-- ============================================================
CREATE TABLE employee_documents (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(150) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    status VARCHAR(10) DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected','NA')),
    uploaded_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, document_type)
);

-- ============================================================
-- LEAVES (HR module)
-- ============================================================
CREATE TABLE leaves (
    id SERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_type VARCHAR(150) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(4,1) NOT NULL DEFAULT 1,
    reason TEXT NULL,
    status VARCHAR(10) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    pay_status VARCHAR(50) NULL,
    hr_date TIMESTAMP NULL,
    leave_balance DECIMAL(4,1) NULL,
    reviewed_by INT NULL REFERENCES users(id) ON DELETE SET NULL,
    applied_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ROOMS / BUILDINGS (Inventory module)
-- ============================================================
CREATE TABLE buildings (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO buildings (name) VALUES
    ('Memorial Building'), ('Sussana Building'), ('Edna & Edgar Building'), ('NAI Offices')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    room_code VARCHAR(50) UNIQUE NOT NULL,
    room_name VARCHAR(150) NOT NULL,
    building VARCHAR(150) NOT NULL
);

-- ============================================================
-- INVENTORY / ASSETS (Inventory module)
-- ============================================================
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    room_code VARCHAR(50) NOT NULL REFERENCES rooms(room_code) ON DELETE CASCADE ON UPDATE CASCADE,
    asset_code VARCHAR(100) NOT NULL,
    asset_name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    purchase_date DATE NULL,
    purchase_price DECIMAL(12,2) DEFAULT 0,
    working INT DEFAULT 0,
    for_repair INT DEFAULT 0,
    non_working INT DEFAULT 0,
    salvage INT DEFAULT 0,
    total INT GENERATED ALWAYS AS (working + for_repair + non_working + salvage) STORED,
    repair_reason TEXT NULL,
    receipt_image VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    -- Soft delete: rows are never hard-deleted by normal use. deleted_at marks
    -- them as trashed (hidden from all normal views) and deleted_by records who
    -- did it; superadmin can restore within 30 days via /api/inventory/trash.
    deleted_at TIMESTAMP NULL,
    deleted_by INT NULL REFERENCES users(id) ON DELETE SET NULL,
    -- Repair aging: set the moment for_repair goes from 0 -> >0, cleared when
    -- it returns to 0. Powers the "in repair for N days" watch list.
    repair_flagged_at TIMESTAMP NULL
);

-- ============================================================
-- PERSONNEL (assigned to areas/rooms - Inventory module)
-- ============================================================
CREATE TABLE personnel (
    id SERIAL PRIMARY KEY,
    area VARCHAR(150) NOT NULL,
    personnel_name VARCHAR(150) NOT NULL,
    contact_number VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- PURCHASE RECORDS (procurement ledger, separate from room inventory)
-- ============================================================
CREATE TABLE records (
    id SERIAL PRIMARY KEY,
    item_name VARCHAR(200) NOT NULL,
    quantity INT DEFAULT 1,
    purchase_date DATE NULL,
    purchase_price DECIMAL(12,2) DEFAULT 0,
    supplier VARCHAR(150) NULL,
    category VARCHAR(100) NULL,
    receipt_path VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- USER ACTIVITY LOG (Inventory + general audit trail)
-- ============================================================
CREATE TABLE user_activity (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    target_user_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
    description VARCHAR(255) NULL,
    module VARCHAR(20) NOT NULL DEFAULT 'hr',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- SYSTEM SETTINGS (branding: logo, primary color, school name)
-- ============================================================
CREATE TABLE system_settings (
    id INT PRIMARY KEY DEFAULT 1,
    school_name VARCHAR(150) NOT NULL DEFAULT 'NAI Synergy',
    logo_url TEXT DEFAULT '/logo.png',
    primary_color VARCHAR(7) NOT NULL DEFAULT '#16a34a',
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO system_settings (id, school_name, logo_url, primary_color)
VALUES (1, 'NAI Synergy', '/logo.png', '#16a34a')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- NOTIFICATIONS (in-app alerts, e.g. HR notified on new leave application)
-- ============================================================
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message VARCHAR(255) NOT NULL,
    link VARCHAR(255) NULL,
    is_read SMALLINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Indexes for common lookups
-- ============================================================
CREATE INDEX idx_leaves_employee ON leaves(employee_id);
CREATE INDEX idx_docs_user ON employee_documents(user_id);
CREATE INDEX idx_inventory_room ON inventory(room_code);
CREATE INDEX idx_notifications_user ON notifications(user_id);
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
