-- ============================================================================
-- Smart Attend - Standalone PostgreSQL Database Schema
-- Designed for: Local PostgreSQL, Docker Compose, AWS RDS, Neon, etc.
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. USERS TABLE
-- Stores Faculty, Admin, and Student Profiles with Password Hash & Biometrics
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- For standalone bcrypt/argon2 auth
    role VARCHAR(50) NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'faculty', 'student')),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    college VARCHAR(255) DEFAULT 'Swarna Bharathi Institute of Science and Technology (SBIT)',
    status VARCHAR(50) NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    
    -- Student Academic Fields (Hall ticket format: 10 chars, unique per student)
    hall_ticket_no VARCHAR(10) UNIQUE CONSTRAINT check_hall_ticket_format CHECK (hall_ticket_no IS NULL OR hall_ticket_no ~* '^2[0-9A-Za-z]{9}$'),
    branch VARCHAR(50),
    section VARCHAR(10),
    year VARCHAR(10) DEFAULT '1',
    semester VARCHAR(10) DEFAULT '1',
    
    -- Faculty Fields
    designation VARCHAR(100),
    department VARCHAR(100),
    assigned_branch VARCHAR(50),
    assigned_sections JSONB DEFAULT '[]'::jsonb,

    -- Face Recognition AI 128-Dimensional Vector
    face_descriptor JSONB, -- Array of 128 float values [0.123, -0.456, ...]
    face_enrollment_status VARCHAR(50) DEFAULT 'pending' CHECK (face_enrollment_status IN ('pending', 'enrolled')),
    face_enrolled_at TIMESTAMP WITH TIME ZONE,
    
    -- WebAuthn / Passkey Biometric Fallback (Fingerprint / TouchID / Windows Hello)
    biometric_credential_id TEXT,
    biometric_public_key TEXT,
    biometric_enrollment_status VARCHAR(50) DEFAULT 'pending' CHECK (biometric_enrollment_status IN ('pending', 'enrolled')),
    biometric_enrolled_at TIMESTAMP WITH TIME ZONE,

    -- Trusted Hardware Device Binding (Zero Proxy Prevention)
    trusted_device_id VARCHAR(255),
    trusted_device_name VARCHAR(255),
    trusted_device_registered_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. ATTENDANCE SESSIONS TABLE
-- Dynamic Single Innovation Centre / Classroom Session Broadcasting
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
-- 4. ATTENDANCE RECORDS TABLE
-- Verified Attendance Records (Face AI, Biometric, GPS Geofenced, Manual)
-- ============================================================================
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id VARCHAR(255) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    hall_ticket_no VARCHAR(10) NOT NULL CONSTRAINT check_record_hall_ticket CHECK (hall_ticket_no ~* '^2[0-9A-Za-z]{9}$'),
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
    manual_reason TEXT,
    marked_by VARCHAR(255),
    CONSTRAINT unique_session_checkin UNIQUE (session_id, hall_ticket_no)
);

-- ============================================================================
-- 5. GEOFENCE CONFIG TABLE (SBIT Campus Geofence Coordinates)
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

-- Insert default SBIT campus geofence config
INSERT INTO geofence_config (id, center_lat, center_lng, radius_m, address, enabled)
VALUES (1, 17.2472, 80.1514, 150, 'SBIT Campus, Pakabanda Street, Khammam, Telangana 507002', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. AUDIT LOGS TABLE
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
-- 7. SYSTEM SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_hall_ticket_unique ON users(UPPER(hall_ticket_no)) WHERE hall_ticket_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_marked_at ON attendance_records(marked_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

-- ============================================================================
-- 10. STUDENT FACE EMBEDDINGS (128-D & 512-D VECTOR REGISTRY)
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_face_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    hall_ticket_no VARCHAR(20) NOT NULL UNIQUE,
    embedding_vector JSONB NOT NULL,
    embedding_dim INT NOT NULL DEFAULT 128,
    algorithm VARCHAR(50) DEFAULT 'facenet_128',
    student_consent BOOLEAN DEFAULT TRUE,
    consent_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_face_embeddings_ht ON student_face_embeddings(hall_ticket_no);
CREATE INDEX IF NOT EXISTS idx_face_embeddings_user ON student_face_embeddings(user_id);

-- ============================================================================
-- 11. ATTENDANCE CAPTURE & AUDIT LOGS (GROUP SCAN & KIOSK RECOGNITION)
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

CREATE INDEX IF NOT EXISTS idx_capture_logs_session ON attendance_capture_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_capture_logs_ht ON attendance_capture_logs(hall_ticket_no);
CREATE INDEX IF NOT EXISTS idx_capture_logs_created ON attendance_capture_logs(created_at);

