"""
Smart Attend — SQLAlchemy ORM Models
=====================================
Declarative models mapping to the PostgreSQL schema defined in
backend/db/postgresql_schema.sql.

All database tables are defined here. The Supabase Python SDK is NOT used
for table access anywhere in the codebase — only for Supabase Auth.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text,
    DateTime, ForeignKey, UniqueConstraint, CheckConstraint, Index, JSON
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=True)
    role = Column(String(50), nullable=False, default="student")
    name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    college = Column(String(255), default="Swarna Bharathi Institute of Science and Technology (SBIT)")
    status = Column(String(50), nullable=False, default="approved")

    # Student Academic Fields (Unique per student)
    hall_ticket_no = Column(String(10), unique=True, nullable=True)
    branch = Column(String(50), nullable=True)
    section = Column(String(10), nullable=True)
    year = Column(String(10), default="1")
    semester = Column(String(10), default="1")

    # Faculty Fields
    designation = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    assigned_branch = Column(String(50), nullable=True)
    assigned_sections = Column(JSONB, default=list)

    # Face Recognition AI 128-D Vector
    face_descriptor = Column(JSONB, nullable=True)
    face_enrollment_status = Column(String(50), default="pending")
    face_enrolled_at = Column(DateTime(timezone=True), nullable=True)

    # WebAuthn / Passkey Biometric Fallback
    biometric_credential_id = Column(Text, nullable=True)
    biometric_public_key = Column(Text, nullable=True)
    biometric_enrollment_status = Column(String(50), default="pending")
    biometric_enrolled_at = Column(DateTime(timezone=True), nullable=True)

    # Trusted Hardware Device Binding
    trusted_device_id = Column(String(255), nullable=True)
    trusted_device_name = Column(String(255), nullable=True)
    trusted_device_registered_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    face_embeddings = relationship("StudentFaceEmbedding", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": str(self.id),
            "email": self.email,
            "role": self.role,
            "name": self.name,
            "phone": self.phone,
            "college": self.college,
            "status": self.status,
            "hall_ticket_no": self.hall_ticket_no,
            "branch": self.branch,
            "section": self.section,
            "year": self.year,
            "semester": self.semester,
            "designation": self.designation,
            "department": self.department,
            "assigned_branch": self.assigned_branch,
            "assigned_sections": self.assigned_sections or [],
            "face_descriptor": self.face_descriptor,
            "face_enrollment_status": self.face_enrollment_status,
            "face_enrolled_at": self.face_enrolled_at.isoformat() if self.face_enrolled_at else None,
            "biometric_credential_id": self.biometric_credential_id,
            "biometric_public_key": self.biometric_public_key,
            "biometric_enrollment_status": self.biometric_enrollment_status,
            "biometric_enrolled_at": self.biometric_enrolled_at.isoformat() if self.biometric_enrolled_at else None,
            "trusted_device_id": self.trusted_device_id,
            "trusted_device_name": self.trusted_device_name,
            "trusted_device_registered_at": (
                self.trusted_device_registered_at.isoformat() if self.trusted_device_registered_at else None
            ),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_title = Column(String(255), nullable=False, default="General Attendance Session")
    faculty_id = Column(String(255), nullable=False)
    faculty_name = Column(String(255), nullable=False)
    branch = Column(String(50), nullable=False)
    section = Column(String(10), nullable=False)
    year = Column(Integer, nullable=False, default=3)
    room = Column(String(100), default="Innovation Centre Lab")
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(50), default="active")
    qr_token = Column(Text, nullable=True)
    radius_meters = Column(Integer, default=150)
    geofence = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    records = relationship("AttendanceRecord", back_populates="session", cascade="all, delete-orphan")
    capture_logs = relationship("AttendanceCaptureLog", back_populates="session")

    def to_dict(self):
        return {
            "id": str(self.id),
            "session_title": self.session_title,
            "faculty_id": self.faculty_id,
            "faculty_name": self.faculty_name,
            "branch": self.branch,
            "section": self.section,
            "year": self.year,
            "room": self.room,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "status": self.status,
            "qr_token": self.qr_token,
            "radius_meters": self.radius_meters,
            "geofence": self.geofence,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint("session_id", "hall_ticket_no", name="unique_session_checkin"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=True)
    student_id = Column(String(255), nullable=False)
    student_name = Column(String(255), nullable=False)
    hall_ticket_no = Column(String(10), nullable=False)
    branch = Column(String(50), nullable=False)
    section = Column(String(10), nullable=False)
    year = Column(Integer, nullable=False, default=3)
    marked_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    status = Column(String(50), nullable=False, default="present")
    verification_method = Column(String(50), default="face_recognition")
    face_match_confidence = Column(Float, nullable=True)
    face_distance = Column(Float, nullable=True)
    blink_verified = Column(Boolean, default=False)
    biometric_verified = Column(Boolean, default=False)
    gps_distance_meters = Column(Float, nullable=True)
    student_lat = Column(Float, nullable=True)
    student_lng = Column(Float, nullable=True)
    manual_reason = Column(Text, nullable=True)
    marked_by = Column(String(255), nullable=True)

    # Relationships
    session = relationship("AttendanceSession", back_populates="records")

    def to_dict(self):
        return {
            "id": str(self.id),
            "session_id": str(self.session_id) if self.session_id else None,
            "student_id": self.student_id,
            "student_name": self.student_name,
            "hall_ticket_no": self.hall_ticket_no,
            "branch": self.branch,
            "section": self.section,
            "year": self.year,
            "marked_at": self.marked_at.isoformat() if self.marked_at else None,
            "status": self.status,
            "verification_method": self.verification_method,
            "face_match_confidence": self.face_match_confidence,
            "face_distance": self.face_distance,
            "blink_verified": self.blink_verified,
            "biometric_verified": self.biometric_verified,
            "gps_distance_meters": self.gps_distance_meters,
            "student_lat": self.student_lat,
            "student_lng": self.student_lng,
            "manual_reason": self.manual_reason,
            "marked_by": self.marked_by,
        }


class GeofenceConfig(Base):
    __tablename__ = "geofence_config"
    __table_args__ = (
        CheckConstraint("id = 1", name="single_row_geofence"),
    )

    id = Column(Integer, primary_key=True, default=1)
    center_lat = Column(Float, nullable=False, default=17.2472)
    center_lng = Column(Float, nullable=False, default=80.1514)
    radius_m = Column(Integer, nullable=False, default=150)
    address = Column(Text, default="SBIT Campus, Pakabanda Street, Khammam, Telangana 507002")
    enabled = Column(Boolean, default=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "center_lat": self.center_lat,
            "center_lng": self.center_lng,
            "radius_m": self.radius_m,
            "address": self.address,
            "enabled": self.enabled,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action = Column(String(255), nullable=False)
    performed_by = Column(String(255), nullable=False)
    performer_role = Column(String(50), nullable=True)
    details = Column(JSONB, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "action": self.action,
            "performed_by": self.performed_by,
            "performer_role": self.performer_role,
            "details": self.details,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(100), primary_key=True)
    value = Column(JSONB, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


class StudentFaceEmbedding(Base):
    __tablename__ = "student_face_embeddings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    hall_ticket_no = Column(String(20), nullable=False, unique=True)
    embedding_vector = Column(JSONB, nullable=False)
    embedding_dim = Column(Integer, nullable=False, default=128)
    algorithm = Column(String(50), default="facenet_128")
    student_consent = Column(Boolean, default=True)
    consent_timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    enrolled_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="face_embeddings")

    def to_dict(self):
        return {
            "id": str(self.id),
            "user_id": str(self.user_id) if self.user_id else None,
            "hall_ticket_no": self.hall_ticket_no,
            "embedding_vector": self.embedding_vector,
            "embedding_dim": self.embedding_dim,
            "algorithm": self.algorithm,
            "student_consent": self.student_consent,
            "consent_timestamp": self.consent_timestamp.isoformat() if self.consent_timestamp else None,
            "enrolled_at": self.enrolled_at.isoformat() if self.enrolled_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class AttendanceCaptureLog(Base):
    __tablename__ = "attendance_capture_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("attendance_sessions.id", ondelete="SET NULL"), nullable=True)
    student_id = Column(String(255), nullable=True)
    hall_ticket_no = Column(String(20), nullable=False)
    capture_source = Column(String(50), default="kiosk_webrtc")
    confidence_score = Column(Float, nullable=False)
    liveness_score = Column(Float, default=1.0)
    bounding_box = Column(JSONB, nullable=True)
    reviewed_by_teacher = Column(Boolean, default=False)
    teacher_override_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    session = relationship("AttendanceSession", back_populates="capture_logs")

    def to_dict(self):
        return {
            "id": str(self.id),
            "session_id": str(self.session_id) if self.session_id else None,
            "student_id": self.student_id,
            "hall_ticket_no": self.hall_ticket_no,
            "capture_source": self.capture_source,
            "confidence_score": self.confidence_score,
            "liveness_score": self.liveness_score,
            "bounding_box": self.bounding_box,
            "reviewed_by_teacher": self.reviewed_by_teacher,
            "teacher_override_reason": self.teacher_override_reason,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
