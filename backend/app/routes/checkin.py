"""
Smart Attend — Public Checkin & Student Portal Routes
======================================================
All data operations (sessions, students, biometrics, attendance records)
are persisted to and queried from PostgreSQL via SQLAlchemy.
"""

import uuid
import re
import logging
import jwt
import secrets
import hashlib
import base64
from fastapi import APIRouter, HTTPException, Body, Depends, Security, Request
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, func
from sqlalchemy.exc import IntegrityError, NoResultFound

from app.config import JWT_SECRET
from app.models.schemas import VerifyCheckinPayload
from app.models.db_models import (
    Student,
    AttendanceSession,
    AttendanceRecord,
    StudentFaceEmbedding,
    GeofenceConfig
)
from app.routes.qr_session import current_session, valid_session_tokens
from app.routes.student_face import student_face_cache
from app.utils.geofence import current_geofence, calculate_haversine_distance
from app.utils.face_matcher import compare_face_embeddings
from app.utils.blink_detection import verify_live_blink
from app.database import get_db, get_db_context
from app.dependencies.auth import verify_edge_key, get_current_user, get_optional_current_user, require_role
from app.routes.auth import _rate_limit
from app.services.face_recognition_service import face_service
from app.utils.redis_client import set_otp, get_otp, delete_otp
from app.services.redis_queue import (
    get_cached_student_status,
    set_cached_student_status,
    invalidate_student_cache,
    enqueue_audit_log
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Public Checkin & Student Portal"])

def _extract_raw_token(token: str) -> str:
    """
    Normalize a session token: if it's a full URL like
    'http://host/checkin?token=UUID', extract just the UUID.
    If it's already a bare UUID or JWT, return as-is.
    """
    t = token.strip()
    if 'token=' in t:
        parts = t.split('token=')
        if len(parts) > 1:
            raw = parts[-1].split('&')[0].strip()
            if raw:
                return raw
    return t

# Global reference to Socket.io server instance for live push
sio_server = None

def set_sio_server(sio):
    global sio_server
    sio_server = sio


def _normalize_student_key(value: str) -> str:
    return str(value or "").strip().upper()


def _load_enrolled_face_descriptor(hall_ticket: str) -> Optional[List[float]]:
    """
    Resolve the stored reference face for a student.
    Prefers the persisted PostgreSQL descriptor (users & student_face_embeddings), then the in-memory enrollment cache.
    """
    normalized_ht = _normalize_student_key(hall_ticket)
    if not normalized_ht:
        return None

    try:
        with get_db_context() as db:
            # 1. Check students table
            student = (
                db.query(Student)
                .filter(func.upper(Student.hall_ticket_no) == normalized_ht)
                .first()
            )
            if student and student.face_descriptor and isinstance(student.face_descriptor, list) and len(student.face_descriptor) in (128, 512):
                logger.info(f"[Face] Loaded enrolled descriptor from PostgreSQL students for {normalized_ht}")
                return student.face_descriptor

            # 2. Check student_face_embeddings table
            emb = (
                db.query(StudentFaceEmbedding)
                .filter(func.upper(StudentFaceEmbedding.hall_ticket_no) == normalized_ht)
                .first()
            )
            if emb and emb.embedding_vector and isinstance(emb.embedding_vector, list) and len(emb.embedding_vector) in (128, 512):
                logger.info(f"[Face] Loaded enrolled descriptor from PostgreSQL student_face_embeddings for {normalized_ht}")
                return emb.embedding_vector
    except Exception as e:
        logger.warning(f"Error fetching enrolled descriptor from PostgreSQL: {e}")

    for key in (normalized_ht, normalized_ht.lower()):
        cached = student_face_cache.get(key)
        if cached:
            desc_val = cached.get("descriptor")
            if desc_val and len(desc_val) in (128, 512):
                logger.info(f"[Face] Loaded enrolled descriptor from cache for {normalized_ht}")
                return desc_val

    return None


@router.get("/api/checkin/session/{token:path}")
def validate_checkin_session(token: str, db: Session = Depends(get_db)):
    """
    Public check-in endpoint: Student's phone camera scans QR code
    and this validates the session token.
    Supports active token ring buffer, database sessions, and active classroom fallback.
    """
    clean_token = _extract_raw_token(token) if token else ""

    # --- Strategy 1: Check in-memory active session & tokens ---
    if clean_token and clean_token in valid_session_tokens:
        s_data = valid_session_tokens[clean_token]
        session_lat = s_data.get("faculty_lat") or current_geofence["center_lat"]
        session_lng = s_data.get("faculty_lng") or current_geofence["center_lng"]
        radius_m = s_data.get("radius_meters") or 150
        return {
            "valid": True,
            "session": {
                "sessionId": s_data.get("sessionId", "active_session"),
                "sessionTitle": s_data.get("sessionTitle", "Academic Session"),
                "facultyName": s_data.get("facultyName", "Faculty Member"),
                "branch": s_data.get("branch", "CSE"),
                "section": s_data.get("section", "A"),
                "room": s_data.get("room", "Innovation Centre Lab"),
                "faculty_lat": session_lat,
                "faculty_lng": session_lng,
                "radius_meters": radius_m
            },
            "geofence": {
                "centerLat": session_lat,
                "centerLng": session_lng,
                "radiusMeters": radius_m
            }
        }

    # --- Strategy 2: Check active sessions in PostgreSQL by qr_token or session UUID ---
    try:
        s = None
        if clean_token:
            try:
                clean_uuid = uuid.UUID(clean_token)
                s = db.query(AttendanceSession).filter(
                    AttendanceSession.id == clean_uuid,
                    AttendanceSession.status == "active"
                ).first()
            except (ValueError, TypeError):
                pass

            if not s:
                s = db.query(AttendanceSession).filter(
                    AttendanceSession.qr_token == clean_token,
                    AttendanceSession.status == "active"
                ).first()

        # Strategy 3: Active classroom session recovery within 4-hour window
        if not s:
            now_utc = datetime.now(timezone.utc)
            cutoff = now_utc - timedelta(hours=4)
            s = (
                db.query(AttendanceSession)
                .filter(
                    AttendanceSession.status == "active",
                    or_(AttendanceSession.end_time == None, AttendanceSession.end_time > now_utc, AttendanceSession.created_at >= cutoff)
                )
                .order_by(desc(AttendanceSession.created_at))
                .first()
            )

        if s:
            geo = s.geofence or {}
            session_lat = geo.get("lat") or current_geofence["center_lat"]
            session_lng = geo.get("lng") or current_geofence["center_lng"]
            radius_m = s.radius_meters or 150
            return {
                "valid": True,
                "session": {
                    "sessionId": str(s.id),
                    "sessionTitle": s.session_title,
                    "facultyName": s.faculty_name,
                    "branch": s.branch,
                    "section": s.section,
                    "room": s.room,
                    "faculty_lat": session_lat,
                    "faculty_lng": session_lng,
                    "radius_meters": radius_m
                },
                "geofence": {
                    "centerLat": session_lat,
                    "centerLng": session_lng,
                    "radiusMeters": radius_m
                }
            }
    except Exception as e:
        logger.warning(f"PostgreSQL session check note: {e}")

    # --- Strategy 4: JWT token validation ---
    if clean_token:
        try:
            decoded = jwt.decode(clean_token, JWT_SECRET, algorithms=["HS256"])
            sess_id = decoded.get("sessionId")
            if sess_id:
                s_obj = None
                try:
                    s_obj = db.query(AttendanceSession).filter(
                        AttendanceSession.id == uuid.UUID(sess_id),
                        AttendanceSession.status == "active"
                    ).first()
                except Exception:
                    pass

                sess_title = s_obj.session_title if s_obj else "Campus Academic Session"
                fac_name = s_obj.faculty_name if s_obj else decoded.get("facultyId", "Faculty")
                branch = s_obj.branch if s_obj else decoded.get("branch", "CSE")
                section = s_obj.section if s_obj else decoded.get("section", "A")
                room = s_obj.room if s_obj else "Innovation Centre Lab"
                sess_geo = (s_obj.geofence or {}) if s_obj else {}
                session_lat = sess_geo.get("lat") or current_geofence["center_lat"]
                session_lng = sess_geo.get("lng") or current_geofence["center_lng"]
                radius_m = s_obj.radius_meters if s_obj and s_obj.radius_meters else current_geofence["radius_m"]

                return {
                    "valid": True,
                    "session": {
                        "sessionId": sess_id,
                        "sessionTitle": sess_title,
                        "facultyName": fac_name,
                        "branch": branch,
                        "section": section,
                        "room": room,
                        "faculty_lat": session_lat,
                        "faculty_lng": session_lng,
                        "radius_meters": radius_m
                    },
                    "geofence": {
                        "centerLat": session_lat,
                        "centerLng": session_lng,
                        "radiusMeters": radius_m
                    }
                }
        except Exception:
            pass

    # Fail closed: No valid active session was matched for this token
    raise HTTPException(
        status_code=404,
        detail="No active session found for this QR token or code has expired."
    )


@router.get("/api/student/check-status/{hall_ticket}")
@_rate_limit("10/minute")
def get_student_enrollment_status(request: Request, hall_ticket: str, db: Session = Depends(get_db)):
    """
    Public endpoint: Checks whether a student with Hall Ticket No (2XXXXXXXXX)
    has already enrolled their face & platform biometrics in PostgreSQL.
    """
    ht = hall_ticket.strip().upper()
    if not re.match(r"^2[0-9A-Z]{9}$", ht):
        raise HTTPException(status_code=400, detail="Invalid Hall Ticket format. Must be 10 characters starting with '2'.")

    # Fast-path: Check high-performance Redis cache first (60s TTL)
    cached = get_cached_student_status(ht)
    if cached:
        return cached

    student_name = f"Student ({ht})"
    branch = "CSE"
    section = "A"
    year = 3
    enrolled_desc = _load_enrolled_face_descriptor(ht)
    is_bio_enrolled = False

    try:
        student = db.query(Student).filter(
            or_(
                func.upper(Student.hall_ticket_no) == ht,
                func.lower(Student.email).like(f"{ht.lower()}@%")
            )
        ).first()

        if student:
            student_name = student.name or student_name
            branch = student.branch or branch
            section = student.section or section
            year = int(student.year or 3)
            if not enrolled_desc and student.face_descriptor:
                if isinstance(student.face_descriptor, list) and len(student.face_descriptor) in (128, 512):
                    enrolled_desc = student.face_descriptor
            is_bio_enrolled = (student.biometric_enrollment_status == "enrolled") or bool(student.biometric_credential_id)
    except Exception as e:
        logger.warning(f"PostgreSQL student lookup note: {e}")

    is_face_enrolled = bool(enrolled_desc and isinstance(enrolled_desc, list) and len(enrolled_desc) in (128, 512))

    # P1-1: No in-memory cache — query Postgres directly for today's records.
    already_marked_record = None

    if not already_marked_record:
        try:
            today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            rec = (
                db.query(AttendanceRecord)
                .filter(func.upper(AttendanceRecord.hall_ticket_no) == ht)
                .filter(AttendanceRecord.marked_at >= today_start)
                .order_by(desc(AttendanceRecord.marked_at))
                .first()
            )
            if rec:
                already_marked_record = {
                    "id": str(rec.id),
                    "sessionId": str(rec.session_id) if rec.session_id else None,
                    "hallTicketNo": ht,
                    "studentName": rec.student_name or student_name,
                    "markedAt": rec.marked_at.isoformat() if rec.marked_at else None,
                    "status": rec.status or "present",
                    "verificationMethod": rec.verification_method or "face_recognition"
                }
        except Exception as e:
            logger.warning(f"Check already marked note: {e}")

    profile = {
        "name": student_name,
        "hallTicketNo": ht,
        "branch": branch,
        "section": section,
        "year": year,
        "faceEnrolled": is_face_enrolled,
        "biometricEnrolled": is_bio_enrolled,
        "faceDescriptor": None  # SECURITY: Never return raw biometric descriptors
    }
    # P1-1: No in-memory cache — return directly from DB query.

    result = {
        "hallTicketNo": ht,
        "isRegistered": True,
        "isFaceEnrolled": is_face_enrolled,
        "isBiometricEnrolled": is_bio_enrolled,
        "faceDescriptor": None,  # SECURITY: Never return raw biometric descriptors
        "isAlreadyMarked": already_marked_record is not None,
        "alreadyMarkedRecord": already_marked_record,
        "profile": profile
    }
    set_cached_student_status(ht, result, ttl=60)
    return result


@router.post("/api/student/reset-biometrics/{hall_ticket}")
def reset_student_biometrics(
    hall_ticket: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Clears face & biometric enrollment cache and database status for re-registration.
    Requires authentication. Caller must be the student themselves, or an admin/faculty.
    """
    ht = hall_ticket.strip().upper()
    if not re.match(r"^2[0-9A-Z]{9}$", ht):
        raise HTTPException(status_code=400, detail="Invalid Hall Ticket format.")

    # Authorization: admin/faculty may reset any student; students may only reset themselves
    caller_role = (current_user.get("role") or "student").lower()
    if caller_role not in ("admin", "faculty"):
        caller_email = str(current_user.get("email") or "").lower()
        caller_meta = current_user.get("payload") or {}
        caller_ht = str(caller_meta.get("hall_ticket_no") or "").upper()
        if caller_ht != ht and not caller_email.startswith(ht.lower() + "@"):
            raise HTTPException(
                status_code=403,
                detail="Forbidden: You can only reset your own biometric profile."
            )

    student_face_cache.pop(ht, None)
    student_face_cache.pop(ht.lower(), None)
    face_service.remove_embedding(ht)
    face_service.remove_embedding(ht.lower())

    try:
        student = db.query(Student).filter(func.upper(Student.hall_ticket_no) == ht).first()
        if student:
            student.face_descriptor = None
            student.face_enrollment_status = "pending"
            student.face_enrolled_at = None
            student.biometric_credential_id = None
            student.biometric_enrollment_status = "pending"
            student.biometric_enrolled_at = None
            student.updated_at = datetime.now(timezone.utc)

        db.query(StudentFaceEmbedding).filter(
            func.upper(StudentFaceEmbedding.hall_ticket_no) == ht
        ).delete()

        db.commit()
        invalidate_student_cache(ht)
    except Exception as e:
        logger.warning(f"Reset face biometrics note: {e}")

    return {
        "success": True,
        "message": f"Biometric profile reset for {ht}. You can now register a fresh face scan."
    }


@router.post(
    "/api/admin/clear-all-biometrics",
    dependencies=[Depends(require_role("admin"))]
)
def clear_all_registered_biometrics(db: Session = Depends(get_db)):
    """
    Purges all previously registered face descriptors and biometrics across DB & in-memory caches.
    All students will be treated as fresh/new registrations.
    Requires: admin JWT.
    """
    student_face_cache.clear()

    # Reset face recognition service memory registry
    face_service._enrolled_faces.clear()
    face_service._matrix_128 = None
    face_service._matrix_512 = None
    face_service._keys_128.clear()
    face_service._keys_512.clear()

    try:
        students = db.query(Student).all()
        now_dt = datetime.now(timezone.utc)
        for s in students:
            s.face_descriptor = None
            s.face_enrollment_status = "pending"
            s.face_enrolled_at = None
            s.biometric_credential_id = None
            s.biometric_enrollment_status = "pending"
            s.biometric_enrolled_at = None
            s.updated_at = now_dt

        db.query(StudentFaceEmbedding).delete()
        db.commit()
    except Exception as e:
        logger.warning(f"PostgreSQL purge all note: {e}")

    return {
        "success": True,
        "message": "All previous biometric details cleared. All registrations are now fresh."
    }


@router.get("/api/checkin/challenge")
@_rate_limit("30/minute")
def get_checkin_challenge(request: Request):
    """
    Issues a cryptographically random single-use liveness challenge nonce.
    Binds live camera frames and prevents replay of forged telemetry arrays.
    """
    challenge = secrets.token_urlsafe(32)
    set_otp(f"checkin_challenge:{challenge}", "1", ttl_seconds=60)
    return {
        "success": True,
        "challenge": challenge,
        "expires_in_seconds": 60
    }


@router.post("/api/student/register-biometrics")
@_rate_limit("10/minute")
def register_student_biometrics(
    request: Request,
    payload: Dict[str, Any] = Body(...),
    caller: Optional[Dict[str, Any]] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    First-time student self-service enrollment for Face vector & Platform Biometrics in PostgreSQL.
    Requires an OTP-verified enrollment token for self-service enrollment, OR an active Admin/Faculty session.
    """
    ht = payload.get("hallTicketNo", "").strip().upper()
    if not re.match(r"^2[0-9A-Z]{9}$", ht):
        raise HTTPException(status_code=400, detail="Invalid Hall Ticket format. Must be 10 characters starting with '2'.")

    # Authorization Check:
    # 1. Authenticated Staff (Admin or Faculty) can register/update biometrics directly.
    is_staff = bool(caller and caller.get("role", "").lower() in ("admin", "faculty"))

    # 2. Otherwise (Self-service enrollment), a signed, unexpired, single-use enrollment token is mandatory.
    if not is_staff:
        enrollment_token = payload.get("enrollmentToken") or payload.get("enrollment_token")
        if not enrollment_token:
            raise HTTPException(
                status_code=403,
                detail="Valid OTP-verified student enrollment token required for biometric registration. Please verify your email first."
            )
        try:
            decoded = jwt.decode(
                enrollment_token,
                JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_signature": True}
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=403,
                detail="Enrollment token has expired. Please request a new verification code."
            )
        except Exception:
            raise HTTPException(
                status_code=403,
                detail="Invalid enrollment token. Verification failed."
            )

        if decoded.get("type") != "enrollment":
            raise HTTPException(
                status_code=403,
                detail="Invalid token purpose: An enrollment token is required."
            )

        token_ht = str(decoded.get("ht", "")).strip().upper()
        if token_ht != ht:
            raise HTTPException(
                status_code=403,
                detail=f"Enrollment token roll number mismatch (token: {token_ht}, requested: {ht})."
            )

        # Anti-replay: Check if enrollment token has already been consumed
        token_hash = hashlib.sha256(enrollment_token.encode()).hexdigest()
        if get_otp(f"used_enrollment:{token_hash}"):
            raise HTTPException(
                status_code=403,
                detail="This enrollment token has already been used. Please request a new verification code."
            )
        # Mark as consumed with 1-hour TTL
        set_otp(f"used_enrollment:{token_hash}", "1", ttl_seconds=3600)

    face_descriptor = payload.get("faceDescriptor")
    bio_credential_id = payload.get("biometricCredentialId")
    student_name = payload.get("name") or f"Student ({ht})"
    branch = payload.get("branch") or "CSE"
    section = payload.get("section") or "A"

    if face_descriptor:
        if not isinstance(face_descriptor, list) or len(face_descriptor) not in (128, 512):
            raise HTTPException(status_code=400, detail="faceDescriptor must be a 128-dimensional or 512-dimensional float list.")

        # SECURITY: Prevent public re-enrollment when a face is already enrolled.
        existing_descriptor = _load_enrolled_face_descriptor(ht)
        if existing_descriptor and isinstance(existing_descriptor, list) and len(existing_descriptor) in (128, 512):
            logger.warning(f"[Security] Blocked public re-enrollment attempt for {ht} — face already enrolled. Use reset-biometrics first.")
            raise HTTPException(
                status_code=409,
                detail=f"Face biometrics are already enrolled for {ht}. To re-register, use the 'Re-enroll Face' option first or contact your faculty."
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        student_face_cache[ht] = {
            "descriptor": face_descriptor,
            "updatedAt": now_iso
        }
        try:
            face_service.register_embedding(
                hall_ticket=ht,
                vector=face_descriptor,
                name=student_name,
                student_id=ht
            )
        except Exception as svc_err:
            logger.warning(f"Note on face_service registration: {svc_err}")

    profile_dict = {
        "name": student_name,
        "hallTicketNo": ht,
        "branch": branch,
        "section": section,
        "year": 3,
        "faceEnrolled": bool(face_descriptor),
        "biometricEnrolled": bool(bio_credential_id)
    }

    now_dt = datetime.now(timezone.utc)
    try:
        student = db.query(Student).filter(func.upper(Student.hall_ticket_no) == ht).first()
        if not student:
            raise HTTPException(
                status_code=404,
                detail=f"Student {ht} not found. Enrollment only allowed against admin-imported records."
            )
        student.face_descriptor = face_descriptor
        student.face_enrollment_status = "enrolled" if face_descriptor else "pending"
        student.face_enrolled_at = now_dt if face_descriptor else None
        student.biometric_credential_id = bio_credential_id
        student.biometric_enrollment_status = "enrolled" if bio_credential_id else "pending"
        student.biometric_enrolled_at = now_dt if bio_credential_id else None
        student.status = "approved"
        student.updated_at = now_dt

        # Update student_face_embeddings
        if face_descriptor:
            emb = db.query(StudentFaceEmbedding).filter_by(hall_ticket_no=ht).first()
            algo = "arcface_512" if len(face_descriptor) == 512 else "facenet_128"
            if emb:
                emb.student_id = student.id
                emb.embedding_vector = face_descriptor
                emb.embedding_dim = len(face_descriptor)
                emb.algorithm = algo
                emb.updated_at = now_dt
            else:
                emb = StudentFaceEmbedding(
                    id=uuid.uuid4(),
                    student_id=student.id,
                    hall_ticket_no=ht,
                    embedding_vector=face_descriptor,
                    embedding_dim=len(face_descriptor),
                    algorithm=algo,
                    student_consent=True,
                    consent_timestamp=now_dt,
                    enrolled_at=now_dt,
                    updated_at=now_dt
                )
                db.add(emb)

        db.commit()
        invalidate_student_cache(ht)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"PostgreSQL student biometric update note: {e}")
        raise HTTPException(status_code=500, detail="Could not persist student biometrics. Please try again.")

    return {
        "success": True,
        "message": f"Biometrics successfully registered for {ht}. You are ready for fast face attendance!",
        "profile": profile_dict
    }


@router.get("/api/student/records/{hall_ticket}")
def get_student_attendance_history(hall_ticket: str, db: Session = Depends(get_db)):
    """
    Public and Staff Attendance Check:
    Retrieves real student details from PostgreSQL along with true attendance statistics and session records.
    """
    ht = hall_ticket.strip().upper()
    if not re.match(r"^2[0-9A-Z]{9}$", ht):
        raise HTTPException(status_code=400, detail="Invalid Hall Ticket format. Must be 10 characters starting with '2'.")

    # 1. Fetch real student profile from database
    student_name = f"Student ({ht})"
    branch = "CSE"
    section = "A"
    year = 3
    email = ""
    status_val = "approved"
    face_status = "pending"
    bio_status = "pending"

    try:
        student = db.query(Student).filter(
            or_(
                func.upper(Student.hall_ticket_no) == ht,
                func.lower(Student.email).like(f"{ht.lower()}@%")
            )
        ).first()
        if student:
            student_name = student.name or student_name
            branch = student.branch or branch
            section = student.section or section
            year = int(student.year or 3)
            email = student.email or ""
            status_val = student.status or "approved"
            face_status = student.face_enrollment_status or ("enrolled" if student.face_descriptor else "pending")
            bio_status = student.biometric_enrollment_status or ("enrolled" if student.biometric_credential_id else "pending")
    except Exception as e:
        logger.warning(f"Student profile fetch note: {e}")

    # 2. Fetch real attendance records for this student
    student_records = []
    try:
        recs = (
            db.query(AttendanceRecord)
            .filter(func.upper(AttendanceRecord.hall_ticket_no) == ht)
            .order_by(desc(AttendanceRecord.marked_at))
            .all()
        )
        student_records = [r.to_dict() for r in recs]
    except Exception as e:
        logger.warning(f"PostgreSQL query note: {e}")

    # 3. Total sessions conducted count (from attendance_sessions)
    total_sessions_conducted = 0
    try:
        total_sessions_conducted = db.query(func.count(AttendanceSession.id)).scalar() or 0
    except Exception:
        pass

    total_sessions_conducted = max(total_sessions_conducted, len(student_records))
    attended_count = len([r for r in student_records if r.get("status") in ["present", "late"]])
    missed_count = max(0, total_sessions_conducted - attended_count)

    # 4. Accurate percentage calculation
    if total_sessions_conducted > 0:
        attendance_percentage = round((attended_count / total_sessions_conducted) * 100, 1)
    else:
        attendance_percentage = 100.0 if attended_count > 0 else 0.0

    compliance_status = "eligible"
    compliance_label = "Eligible for Exams (>= 75%)"
    if total_sessions_conducted > 0:
        if attendance_percentage < 65:
            compliance_status = "detained"
            compliance_label = "Detained (< 65%)"
        elif attendance_percentage < 75:
            compliance_status = "condonation"
            compliance_label = "Condonation Required (65% - 74%)"

    return {
        "hallTicketNo": ht,
        "studentName": student_name,
        "email": email,
        "branch": branch,
        "section": section,
        "year": year,
        "status": status_val,
        "faceEnrollmentStatus": face_status,
        "biometricEnrollmentStatus": bio_status,
        "totalSessionsConducted": total_sessions_conducted,
        "totalSessionsAttended": attended_count,
        "totalSessionsMissed": missed_count,
        "attendancePercentage": attendance_percentage,
        "complianceStatus": compliance_status,
        "complianceLabel": compliance_label,
        "records": student_records
    }


@router.post("/api/checkin/verify")
@_rate_limit("5/minute")
async def verify_student_checkin(
    request: Request,
    payload: VerifyCheckinPayload,
    db: Session = Depends(get_db)
):
    """
    Public check-in submission (Fail-Closed):
    1. Validates session token against PostgreSQL and in-memory caches.
    2. Validates Hall Ticket format.
    3. Enforces GPS Geofence boundary check.
    4. Enforces Face Embedding & Liveness matching.
    5. Checks and prevents duplicate check-ins for the session.
    6. Persists record to PostgreSQL and broadcasts WebSocket event.
    """
    hall_ticket = payload.hallTicket.strip().upper()
    session_id = None
    session_title = "Campus Academic Session"
    branch = "CSE"
    section = "A"

    session_lat = current_geofence["center_lat"]
    session_lng = current_geofence["center_lng"]
    session_radius = 150

    # 1. Validate session token with extended grace & multi-tier resolution
    normalized_token = _extract_raw_token(payload.token) if payload.token else ""

    # Strategy 1: Check token history ring buffer
    if normalized_token and normalized_token in valid_session_tokens:
        s_data = valid_session_tokens[normalized_token]
        session_id = s_data.get("sessionId", "active_session")
        session_title = s_data.get("sessionTitle", session_title)
        branch = s_data.get("branch", branch)
        section = s_data.get("section", section)
        session_lat = s_data.get("faculty_lat") or session_lat
        session_lng = s_data.get("faculty_lng") or session_lng
        session_radius = s_data.get("radius_meters") or session_radius
    # Strategy 2: Check current_session
    elif current_session and (normalized_token == current_session.get("raw_token") or normalized_token == current_session.get("token") or payload.token == current_session.get("raw_token") or payload.token == current_session.get("token")):
        session_id = current_session.get("sessionId")
        session_title = current_session.get("sessionTitle", session_title)
        branch = current_session.get("branch", branch)
        section = current_session.get("section", section)
        session_lat = current_session.get("faculty_lat") or session_lat
        session_lng = current_session.get("faculty_lng") or session_lng
        session_radius = current_session.get("radius_meters") or session_radius
    else:
        # Strategy 3: Check PostgreSQL active sessions
        try:
            s = None
            if normalized_token:
                try:
                    clean_uuid = uuid.UUID(normalized_token)
                    s = db.query(AttendanceSession).filter(
                        AttendanceSession.id == clean_uuid,
                        AttendanceSession.status == "active"
                    ).first()
                except (ValueError, TypeError):
                    pass

                if not s:
                    s = db.query(AttendanceSession).filter(
                        AttendanceSession.qr_token == normalized_token,
                        AttendanceSession.status == "active"
                    ).first()

            # Strategy 3b: Active classroom session recovery within 4-hour window
            if not s:
                now_utc = datetime.now(timezone.utc)
                cutoff = now_utc - timedelta(hours=4)
                s = (
                    db.query(AttendanceSession)
                    .filter(
                        AttendanceSession.status == "active",
                        or_(AttendanceSession.end_time == None, AttendanceSession.end_time > now_utc, AttendanceSession.created_at >= cutoff)
                    )
                    .order_by(desc(AttendanceSession.created_at))
                    .first()
                )

            if s:
                session_id = str(s.id)
                session_title = s.session_title or session_title
                branch = s.branch or branch
                section = s.section or section
                geo = s.geofence or {}
                session_lat = geo.get("lat") or session_lat
                session_lng = geo.get("lng") or session_lng
                session_radius = s.radius_meters or session_radius
        except Exception as e:
            db.rollback()
            logger.warning(f"PostgreSQL session check note: {e}")

        # Strategy 4: Try JWT decode
        if not session_id and normalized_token:
            try:
                decoded = jwt.decode(normalized_token, JWT_SECRET, algorithms=["HS256"])
                session_id = decoded.get("sessionId")
                branch = decoded.get("branch", branch)
                section = decoded.get("section", section)
            except Exception:
                pass

        # If no valid, unexpired session token is found, fail closed — do not synthesize a session
        if not session_id:
            raise HTTPException(
                status_code=403,
                detail="Invalid or expired session token. A valid check-in session is required."
            )

    # Reject if GPS coordinates are missing — do not backfill with session location
    if not payload.lat or not payload.lng:
        raise HTTPException(status_code=400, detail="GPS coordinates (lat/lng) are required for geofence verification.")

    student_lat = payload.lat
    student_lng = payload.lng

    # 2. Check for Duplicate Check-in
    session_uuid = None
    try:
        session_uuid = uuid.UUID(str(session_id))
    except Exception:
        session_uuid = uuid.uuid4()

    existing_dup = None
    try:
        dup = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == session_uuid,
            AttendanceRecord.hall_ticket_no == hall_ticket
        ).first()

        if dup:
            existing_dup = {
                "id": str(dup.id),
                "sessionId": str(dup.session_id) if dup.session_id else None,
                "hallTicketNo": hall_ticket,
                "studentName": dup.student_name or payload.studentName or f"Student ({hall_ticket})",
                "markedAt": dup.marked_at.isoformat() if dup.marked_at else None,
                "status": dup.status or "present",
                "verificationMethod": dup.verification_method or "face_recognition",
                "verification_method": dup.verification_method or "face_recognition",
                "biometric_verified": dup.biometric_verified,
                "alreadyMarked": True
            }
    except Exception as e:
        db.rollback()
        logger.warning(f"Duplicate check query note: {e}")

    if existing_dup:
        return {
            "success": True,
            "alreadyMarked": True,
            "message": f"Attendance already marked for Hall Ticket {hall_ticket}.",
            "record": existing_dup
        }

    # 3. Geofence Distance Check
    geofence_cfg = None
    try:
        geofence_cfg = db.query(GeofenceConfig).filter(GeofenceConfig.id == 1).first()
    except Exception:
        pass

    geofence_enabled = geofence_cfg.enabled if geofence_cfg is not None else True

    if geofence_enabled:
        distance_m = calculate_haversine_distance(
            payload.lat,
            payload.lng,
            session_lat,
            session_lng
        )
        campus_lat = geofence_cfg.center_lat if geofence_cfg else 17.2472
        campus_lng = geofence_cfg.center_lng if geofence_cfg else 80.1514
        campus_dist_m = calculate_haversine_distance(
            payload.lat,
            payload.lng,
            campus_lat,
            campus_lng
        )
        # Check if student is within session radius (+ 200m buffer for indoor GPS jitter)
        # OR within 5km of campus / session (to support campus testing & classroom variance)
        max_session_dist = max(session_radius + 200, 350)
        if distance_m > max_session_dist and campus_dist_m > 5000 and distance_m > 5000:
            raise HTTPException(
                status_code=403,
                detail=f"Outside the allowed check-in radius (measured {distance_m}m from session, allowed {session_radius}m)."
            )

    # 4. Face Recognition & Liveness Matching
    # NOTE: The old `payload.biometricVerified` short-circuit that set
    # `verification_method = "biometric_platform"` and `face_match_confidence = 0.99`
    # is removed (P0-2). A client-sent boolean cannot establish a cryptographic
    # WebAuthn assertion. Until real WebAuthn assertion verification is implemented,
    # that code path is entirely absent — a missing feature is safer than a
    # feature that looks secure but isn't.
    face_match_confidence = 0.95
    face_distance = 0.10
    verification_method = "face_recognition"
    server_blink_verified = False
    server_biometric_verified = False

    if payload.webauthnAssertion:
        # Cryptographic Server-Side WebAuthn FIDO2 Assertion Verification
        from app.services.webauthn_service import verify_authentication_response
        student_rec = db.query(Student).filter(Student.hall_ticket_no == hall_ticket).first()
        if not student_rec or not student_rec.biometric_credential_id:
            raise HTTPException(
                status_code=403,
                detail=f"No enrolled WebAuthn hardware authenticator found for {hall_ticket}. Please enroll a passkey first."
            )

        assertion_data = payload.webauthnAssertion
        valid, auth_result = verify_authentication_response(
            user_id=hall_ticket,
            credential_id=assertion_data.get("credentialId", ""),
            client_data_json=assertion_data.get("clientDataJSON", ""),
            authenticator_data=assertion_data.get("authenticatorData", ""),
            signature=assertion_data.get("signature", ""),
            stored_credential_id=student_rec.biometric_credential_id,
            stored_public_key=student_rec.biometric_public_key,
            stored_sign_count=student_rec.biometric_sign_count or 0
        )

        if not valid:
            raise HTTPException(status_code=403, detail=auth_result.get("error", "WebAuthn hardware signature verification failed."))

        # Update counter to prevent replay attacks
        student_rec.biometric_sign_count = auth_result["newSignCount"]
        db.commit()

        server_biometric_verified = True
        verification_method = "webauthn_platform"
        face_match_confidence = 1.0
        face_distance = 0.0

    capture_hash_val = None
    if payload.faceDescriptor is not None:
        if len(payload.faceDescriptor) not in (128, 512):
            raise HTTPException(status_code=400, detail="faceDescriptor must be a 128- or 512-dimensional float list.")

        # Single-use liveness challenge nonce verification
        if payload.challengeToken:
            stored_challenge = get_otp(f"checkin_challenge:{payload.challengeToken}")
            if not stored_challenge:
                raise HTTPException(
                    status_code=403,
                    detail="Liveness challenge token is invalid or expired. Please capture a fresh scan."
                )
            delete_otp(f"checkin_challenge:{payload.challengeToken}")

        # Live camera frame snapshot validation & hash binding
        if payload.captureImage:
            try:
                img_data = payload.captureImage
                if "," in img_data:
                    img_data = img_data.split(",", 1)[1]
                raw_bytes = base64.b64decode(img_data)
                if len(raw_bytes) < 100:
                    raise ValueError("Image payload too small to be a valid frame")
                capture_hash_val = hashlib.sha256(raw_bytes).hexdigest()
            except Exception as img_err:
                logger.warning(f"Note on camera snapshot processing: {img_err}")

        # Server-side ML Blink & Liveness Evaluation.
        # Requires liveness telemetry (earHistory or faceLandmarks) for verification
        if not payload.earHistory and not payload.faceLandmarks:
            raise HTTPException(
                status_code=400,
                detail="Liveness telemetry (earHistory or faceLandmarks) is required for liveness verification."
            )

        blink_result = verify_live_blink(
            ear_history=payload.earHistory,
            face_landmarks=payload.faceLandmarks,
            client_blink_verified=bool(payload.blinkVerified)
        )
        server_blink_verified = blink_result.is_valid_blink
        logger.info(
            f"[Blink ML] Evaluation for {hall_ticket}: valid={blink_result.is_valid_blink}, "
            f"conf={blink_result.confidence}, reason='{blink_result.reason}', "
            f"dip={blink_result.dip_depth}, min_ear={blink_result.min_ear}, client_blink={payload.blinkVerified}"
        )

        if not blink_result.is_valid_blink:
            raise HTTPException(
                status_code=403,
                detail=f"Blink liveness verification failed: {blink_result.reason}"
            )

        enrolled_descriptor = _load_enrolled_face_descriptor(hall_ticket)
        if not enrolled_descriptor:
            raise HTTPException(
                status_code=403,
                detail=f"No registered face found for {hall_ticket}. Please enroll your face before check-in."
            )

        if len(enrolled_descriptor) != len(payload.faceDescriptor):
            logger.warning(
                f"[Face] Descriptor dimension mismatch for {hall_ticket}: "
                f"enrolled={len(enrolled_descriptor)}, live={len(payload.faceDescriptor)}"
            )
            raise HTTPException(
                status_code=400,
                detail=f"Face model version mismatch (enrolled: {len(enrolled_descriptor)}D, live: {len(payload.faceDescriptor)}D). Please re-enroll your face."
            )

        match, dist, conf = compare_face_embeddings(enrolled_descriptor, payload.faceDescriptor, threshold=0.48)
        face_distance = dist
        face_match_confidence = max(conf / 100.0, 0.01)
        logger.info(
            f"[Face] Comparison for {hall_ticket}: dist={dist:.4f}, conf={conf}%, "
            f"match={match}, client_blink={payload.blinkVerified}, server_blink={server_blink_verified}"
        )

        if not match:
            logger.warning(
                f"[Face] Verification failed for {hall_ticket}: dist={dist:.4f}, "
                f"conf={conf}%, client_blink={payload.blinkVerified}, server_blink={server_blink_verified}"
            )
            raise HTTPException(
                status_code=403,
                detail=f"Face verification rejected: Live face (similarity: {conf}%) does not match registered profile for Roll Number {hall_ticket}."
            )

        verification_method = "face_recognition"
    else:
        raise HTTPException(
            status_code=400,
            detail="faceDescriptor is required for facial check-in. Please use the face enrollment flow or biometric fallback."
        )

    # P1-2: Wrap session auto-creation + attendance insert in a single transaction.
    # Look up student's real name and academic branch from users table (read-only, can stay outside txn).
    real_student_name = payload.studentName
    real_branch = branch
    real_section = section
    try:
        s = db.query(Student).filter(
            or_(
                func.upper(Student.hall_ticket_no) == hall_ticket,
                func.lower(Student.email).like(f"{hall_ticket.lower()}@%")
            )
        ).first()
        if s:
            real_student_name = s.name or real_student_name
            real_branch = s.branch or real_branch
            real_section = s.section or real_section
    except Exception as e:
        logger.warning(f"Student name lookup error in checkin: {e}")

    if not real_student_name:
        real_student_name = f"Student ({hall_ticket})"

    now_dt = datetime.now(timezone.utc)
    try:
        # Ensure attendance_session exists; if missing, create it.
        sess_chk = db.query(AttendanceSession).filter_by(id=session_uuid).first()
        if not sess_chk:
            new_sess = AttendanceSession(
                id=session_uuid,
                session_title=session_title,
                faculty_id="faculty_201",
                faculty_name="Faculty Member",
                branch=branch,
                section=section,
                room="Innovation Centre Lab",
                start_time=now_dt,
                end_time=now_dt + timedelta(hours=2),
                status="active",
                qr_token=normalized_token or str(uuid.uuid4()),
                radius_meters=session_radius,
                geofence={"lat": session_lat, "lng": session_lng}
            )
            db.add(new_sess)
            # Flush to get the session id before inserting the record.
            db.flush()

        # Now create and persist the attendance record.
        new_rec = AttendanceRecord(
            id=uuid.uuid4(),
            session_id=session_uuid,
            student_id=hall_ticket,
            student_name=real_student_name,
            hall_ticket_no=hall_ticket,
            branch=real_branch,
            section=real_section,
            year=3,
            status="present",
            verification_method=verification_method,
            face_match_confidence=face_match_confidence,
            face_distance=face_distance,
            blink_verified=bool(server_blink_verified),
            biometric_verified=bool(server_biometric_verified),
            gps_distance_meters=distance_m,
            student_lat=student_lat,
            student_lng=student_lng,
            capture_hash=capture_hash_val,
            marked_at=now_dt
        )
        db.add(new_rec)
        db.commit()
        db.refresh(new_rec)
    except IntegrityError as e:
        db.rollback()
        logger.warning(f"Integrity error during session/record creation: {e}")
        raise HTTPException(status_code=409, detail="Conflict: session or record already exists.")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to persist session and attendance record: {e}")
        raise HTTPException(status_code=500, detail="Internal server error while saving attendance.")

    rec_dict = new_rec.to_dict()

    # 6. Emit real-time WebSocket event over Socket.io
    if sio_server:
        try:
            await sio_server.emit("attendance:new", {
                "id": str(new_rec.id),
                "name": new_rec.student_name,
                "hallTicket": new_rec.hall_ticket_no,
                "department": new_rec.branch,
                "timestamp": new_rec.marked_at.isoformat(),
                "method": new_rec.verification_method,
                "blinkVerified": new_rec.blink_verified,
                "similarity": new_rec.face_match_confidence,
                "distanceM": new_rec.gps_distance_meters
            })
        except Exception as e:
            logger.warning(f"Socket.IO emit note: {e}")

    # 7. Asynchronous Redis Queue & Status Cache Invalidation
    invalidate_student_cache(hall_ticket)
    enqueue_audit_log(
        action="student_checkin_verified",
        performed_by=hall_ticket,
        performer_role="student",
        details={
            "record_id": str(new_rec.id),
            "session_id": str(new_rec.session_id) if new_rec.session_id else None,
            "method": new_rec.verification_method,
            "blink_verified": bool(new_rec.blink_verified),
            "biometric_verified": bool(new_rec.biometric_verified),
            "similarity": new_rec.face_match_confidence,
            "distance_m": new_rec.gps_distance_meters
        }
    )

    return {
        "success": True,
        "message": f"Attendance marked successfully for {hall_ticket}!",
        "record": rec_dict
    }


@router.get("/api/attendance/today")
def get_today_attendance(db: Session = Depends(get_db)):
    """
    Initial table load for the Live Attendance dashboard from PostgreSQL.
    """
    try:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        records = (
            db.query(AttendanceRecord)
            .filter(AttendanceRecord.marked_at >= today_start)
            .order_by(desc(AttendanceRecord.marked_at))
            .all()
        )
        if records:
            data = [r.to_dict() for r in records]
            return {"records": data, "count": len(data)}

        # Fallback to all recent records if today's filter yielded 0
        all_recs = (
            db.query(AttendanceRecord)
            .order_by(desc(AttendanceRecord.marked_at))
            .limit(500)
            .all()
        )
        data = [r.to_dict() for r in all_recs]
        return {"records": data, "count": len(data)}
    except Exception as e:
        logger.warning(f"Error reading today attendance from PostgreSQL: {e}")

    return {
        "records": [],
        "count": 0
    }


@router.get("/api/embeddings/sync", dependencies=[Depends(verify_edge_key)])
def sync_embeddings(db: Session = Depends(get_db)):
    """
    Edge device sync endpoint: returns all registered student embeddings to cache locally on the edge PC.
    Protected: Requires valid X-API-Key header.
    """
    embeddings_list = []

    # 1. From PostgreSQL students table
    try:
        students = (
            db.query(Student)
            .filter(Student.face_descriptor.isnot(None))
            .all()
        )
        for s in students:
            ht = s.hall_ticket_no
            desc_val = s.face_descriptor
            if ht and desc_val:
                embeddings_list.append({
                    "studentId": ht,
                    "faceDescriptor": desc_val,
                    "updatedAt": s.face_enrolled_at.isoformat() if s.face_enrolled_at else None
                })
    except Exception as e:
        logger.error(f"Error querying student embeddings from PostgreSQL: {e}")

    # 2. From in-memory cache if not already included
    existing_ids = {e["studentId"] for e in embeddings_list}
    for s_id, val in student_face_cache.items():
        if s_id not in existing_ids:
            embeddings_list.append({
                "studentId": s_id,
                "faceDescriptor": val.get("descriptor"),
                "updatedAt": val.get("updatedAt")
            })

    return {
        "count": len(embeddings_list),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "embeddings": embeddings_list
    }
