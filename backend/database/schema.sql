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

DROP TABLE IF EXISTS push_subscriptions;
DROP TABLE IF EXISTS chat_thread_state;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS user_activity;
DROP TABLE IF EXISTS records;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS leaves;
DROP TABLE IF EXISTS employee_documents;
DROP TABLE IF EXISTS personnel;
DROP TABLE IF EXISTS rooms;
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
        CHECK (role IN ('superadmin','hr_staff','inventory_staff','inventory_viewer','employee')),

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
    is_active SMALLINT DEFAULT 1,
    tin_no VARCHAR(50) NULL,
    sss_no VARCHAR(50) NULL,
    philhealth_no VARCHAR(50) NULL,
    pagibig_no VARCHAR(50) NULL,
    emergency_contact_name VARCHAR(150) NULL,
    emergency_contact_address VARCHAR(255) NULL,
    emergency_contact_mobile VARCHAR(50) NULL,
    profile_pic VARCHAR(255) NULL,
    hr_signature_path VARCHAR(255) NULL,
    two_factor_secret VARCHAR(255) NULL,
    two_factor_enabled SMALLINT DEFAULT 0,
    reset_token_hash VARCHAR(255) NULL,
    reset_token_expires TIMESTAMP NULL,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP NULL,

    -- leave balances (reset yearly on school-year boundary, June 1)
    service_leave_balance DECIMAL(4,1) DEFAULT 5,
    sick_leave_balance DECIMAL(4,1) DEFAULT 5,
    benevolence_leave_balance DECIMAL(4,1) DEFAULT 5,
    summer_leave_balance DECIMAL(4,1) DEFAULT 5,
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
    uploaded_at TIMESTAMP DEFAULT NOW()
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
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- INVENTORY ITEM COMMENTS (left by inventory_staff, superadmin, or the
-- new "Viewer / Commentor" role - view-only accounts that can comment)
-- ============================================================
CREATE TABLE inventory_comments (
    id SERIAL PRIMARY KEY,
    item_id INT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_inventory_comments_item ON inventory_comments(item_id);

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
    created_at TIMESTAMP DEFAULT NOW()
);

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
-- CHAT MESSAGES (one thread per employee - any HR staff can reply)
-- ============================================================
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NULL,
    is_read_by_employee SMALLINT DEFAULT 0,
    is_read_by_hr SMALLINT DEFAULT 0,
    attachment_url TEXT NULL,
    attachment_type VARCHAR(10) NULL,
    attachment_name TEXT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Per-side "delete conversation" (Messenger-style): each side can clear
-- their own view of a thread without affecting the other side or deleting
-- anything for real - the thread reappears if a new message arrives after
-- the cutoff. See routes/chat.js.
CREATE TABLE chat_thread_state (
    employee_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    employee_cleared_at TIMESTAMP NULL,
    hr_cleared_at TIMESTAMP NULL
);

-- ============================================================
-- PUSH SUBSCRIPTIONS (browser push endpoints, for real phone/desktop alerts)
-- ============================================================
CREATE TABLE push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(500) UNIQUE NOT NULL,
    p256dh VARCHAR(255) NOT NULL,
    auth VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Indexes for common lookups
-- ============================================================
CREATE INDEX idx_leaves_employee ON leaves(employee_id);
CREATE INDEX idx_docs_user ON employee_documents(user_id);
CREATE INDEX idx_inventory_room ON inventory(room_code);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_chat_employee ON chat_messages(employee_id);
CREATE INDEX idx_push_user ON push_subscriptions(user_id);
