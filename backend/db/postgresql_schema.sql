-- ============================================================================
-- Smart Attend - Standalone PostgreSQL Database Schema
-- Dedicated Tables for Admins, Faculty, and Students
-- (Authentication enabled ONLY for Admins and Faculty)
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Drop all legacy and existing tables to remove old data and outdated structures
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS attendance_capture_logs CASCADE;
DROP TABLE IF EXISTS attendance_records CASCADE;
DROP TABLE IF EXISTS attendance_sessions CASCADE;
DROP TABLE IF EXISTS student_face_embeddings CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS faculty CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
DROP TABLE IF EXISTS geofence_config CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- ============================================================================
-- 3. ADMINS TABLE (Authentication Enabled)
-- ============================================================================
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    designation VARCHAR(100) DEFAULT 'System Administrator',
    college VARCHAR(255) DEFAULT 'Swarna Bharathi Institute of Science and Technology (SBIT)',
    status VARCHAR(50) NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. FACULTY TABLE (Authentication Enabled)
-- ============================================================================
CREATE TABLE IF NOT EXISTS faculty (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(50) NOT NULL DEFAULT 'faculty',
    designation VARCHAR(100) DEFAULT 'Assistant Professor',
    department VARCHAR(100) DEFAULT 'Computer Science & Engineering',
    assigned_branch VARCHAR(50) DEFAULT 'CSM',
    assigned_sections JSONB DEFAULT '["A", "B"]'::jsonb,
    college VARCHAR(255) DEFAULT 'Swarna Bharathi Institute of Science and Technology (SBIT)',
    status VARCHAR(50) NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. STUDENTS TABLE (Roster & Biometrics ONLY - NO Password Auth)
-- ============================================================================
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hall_ticket_no VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(50) NOT NULL DEFAULT 'student',
    branch VARCHAR(50) DEFAULT 'CSM',
    section VARCHAR(10) DEFAULT 'A',
    year VARCHAR(10) DEFAULT '3',
    semester VARCHAR(10) DEFAULT '1',
    college VARCHAR(255) DEFAULT 'Swarna Bharathi Institute of Science and Technology (SBIT)',
    status VARCHAR(50) NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    
    -- Face Recognition AI 128-D Vector
    face_descriptor JSONB,
    face_enrollment_status VARCHAR(50) DEFAULT 'pending' CHECK (face_enrollment_status IN ('pending', 'enrolled')),
    face_enrolled_at TIMESTAMP WITH TIME ZONE,
    
    -- WebAuthn / Passkey Biometric Fallback
    biometric_credential_id TEXT,
    biometric_public_key TEXT,
    biometric_enrollment_status VARCHAR(50) DEFAULT 'pending' CHECK (biometric_enrollment_status IN ('pending', 'enrolled')),
    biometric_enrolled_at TIMESTAMP WITH TIME ZONE,

    -- Trusted Hardware Device Binding
    trusted_device_id VARCHAR(255),
    trusted_device_name VARCHAR(255),
    trusted_device_registered_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Case-insensitive index on students hall_ticket_no
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_hall_ticket_upper ON students (UPPER(hall_ticket_no));

-- ============================================================================
-- 5. STUDENT FACE EMBEDDINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_face_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    hall_ticket_no VARCHAR(20) UNIQUE NOT NULL,
    embedding_vector JSONB NOT NULL,
    embedding_dim INT NOT NULL DEFAULT 128,
    algorithm VARCHAR(50) DEFAULT 'facenet_128',
    student_consent BOOLEAN DEFAULT TRUE,
    consent_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. ATTENDANCE SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_title VARCHAR(255) NOT NULL DEFAULT 'General Attendance Session',
    faculty_id VARCHAR(255) NOT NULL,
    faculty_name VARCHAR(255) NOT NULL,
    branch VARCHAR(50) NOT NULL,
    section VARCHAR(10) NOT NULL,
    year INT NOT NULL DEFAULT 3,
    room VARCHAR(100) DEFAULT 'Innovation Centre Lab',
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    qr_token TEXT,
    radius_meters INT DEFAULT 150,
    geofence JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 7. ATTENDANCE RECORDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id VARCHAR(255) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    hall_ticket_no VARCHAR(50) NOT NULL,
    branch VARCHAR(50) NOT NULL,
    section VARCHAR(10) NOT NULL,
    year INT NOT NULL DEFAULT 3,
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent')),
    verification_method VARCHAR(50) DEFAULT 'face_recognition' CHECK (verification_method IN ('face_recognition', 'biometric_fallback', 'qr_gps', 'manual')),
    face_match_confidence FLOAT,
    face_distance FLOAT,
    blink_verified BOOLEAN DEFAULT FALSE,
    biometric_verified BOOLEAN DEFAULT FALSE,
    gps_distance_meters FLOAT,
    student_lat FLOAT,
    student_lng FLOAT,
    capture_hash VARCHAR(64),
    manual_reason TEXT,
    marked_by VARCHAR(255),
    CONSTRAINT unique_session_checkin UNIQUE (session_id, hall_ticket_no)
);

-- ============================================================================
-- 8. GEOFENCE CONFIG TABLE (SBIT Campus Coordinates)
-- ============================================================================
CREATE TABLE IF NOT EXISTS geofence_config (
    id INT PRIMARY KEY DEFAULT 1,
    center_lat DOUBLE PRECISION NOT NULL DEFAULT 17.2472,
    center_lng DOUBLE PRECISION NOT NULL DEFAULT 80.1514,
    radius_m INT NOT NULL DEFAULT 150,
    address TEXT DEFAULT 'SBIT Campus, Pakabanda Street, Khammam, Telangana 507002',
    enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT single_row_geofence CHECK (id = 1)
);

-- ============================================================================
-- 9. AUDIT LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(255) NOT NULL,
    performed_by VARCHAR(255) NOT NULL,
    performer_role VARCHAR(50),
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 10. SYSTEM SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 11. ATTENDANCE CAPTURE LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS attendance_capture_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES attendance_sessions(id) ON DELETE SET NULL,
    student_id VARCHAR(255),
    hall_ticket_no VARCHAR(20) NOT NULL,
    capture_source VARCHAR(50) DEFAULT 'kiosk_webrtc',
    confidence_score FLOAT NOT NULL,
    liveness_score FLOAT DEFAULT 1.0,
    bounding_box JSONB,
    reviewed_by_teacher BOOLEAN DEFAULT FALSE,
    teacher_override_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
