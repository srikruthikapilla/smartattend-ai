"""
Smart Attend — Student Face Biometrics Routes
==============================================
All face vectors and DPDP biometric consent records are stored in PostgreSQL.
"""

import uuid
import logging
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.models.schemas import FaceEmbeddingPayload, FaceEnrollmentRequest
from app.models.db_models import User, StudentFaceEmbedding, AuditLog
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.services.face_recognition_service import face_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/students", tags=["Student Face Biometrics"])

# In-memory fast cache for student embeddings: { student_id: { descriptor, updated_at } }
student_face_cache: Dict[str, Dict[str, Any]] = {}


def _normalize_student_key(value: str) -> str:
    return str(value or "").strip().upper()


def _cache_face_descriptor(
    student_id: str,
    descriptor: List[float],
    updated_at: str,
    hall_ticket_no: Optional[str] = None,
    name: Optional[str] = None
) -> None:
    entry = {
        "descriptor": descriptor,
        "updatedAt": updated_at
    }

    raw_key = str(student_id or "").strip()
    if raw_key:
        student_face_cache[raw_key] = entry

    normalized_key = _normalize_student_key(student_id)
    if normalized_key:
        student_face_cache[normalized_key] = entry

    normalized_hall_ticket = _normalize_student_key(hall_ticket_no)
    if normalized_hall_ticket:
        student_face_cache[normalized_hall_ticket] = entry
        # Also register in global vectorized face service
        try:
            face_service.register_embedding(
                hall_ticket=normalized_hall_ticket,
                vector=descriptor,
                name=name or f"Student ({normalized_hall_ticket})",
                student_id=student_id
            )
        except Exception as e:
            logger.warning(f"Error registering vector in face_service: {e}")


def verify_student_ownership(student_id: str, current_user: Dict[str, Any]):
    """
    Ensures that the calling user can only modify their own profile unless they are an admin/faculty.
    """
    user_id = str(current_user.get("id") or current_user.get("sub", ""))
    user_role = current_user.get("role", "student")

    if user_role in ["admin", "faculty"]:
        return

    user_email = str(current_user.get("email", "")).lower()
    user_meta = current_user.get("user_metadata") or {}
    user_meta_ht = str(user_meta.get("hall_ticket_no", "")).lower()
    student_id_lower = student_id.lower().strip()

    # Check match against UUID, Hall Ticket Number, or email prefix
    if (
        user_id.lower() == student_id_lower
        or (user_meta_ht and user_meta_ht == student_id_lower)
        or (user_email and user_email.startswith(student_id_lower + "@"))
    ):
        return

    raise HTTPException(
        status_code=403,
        detail="Forbidden: You can only register or update your own biometric face data."
    )


def _find_user(db: Session, student_id: str, normalized_ht: Optional[str] = None) -> Optional[User]:
    """Helper to locate user by UUID or hall ticket in PostgreSQL."""
    try:
        uid = uuid.UUID(student_id)
        user = db.query(User).filter(User.id == uid).first()
        if user:
            return user
    except Exception:
        pass

    if normalized_ht:
        user = db.query(User).filter(func.upper(User.hall_ticket_no) == normalized_ht).first()
        if user:
            return user

    return db.query(User).filter(func.upper(User.hall_ticket_no) == _normalize_student_key(student_id)).first()


@router.post("/{student_id}/enroll-face")
@router.post("/{student_id}/face")
def enroll_student_face(
    student_id: str,
    payload: FaceEnrollmentRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Student captures & registers their reference 128-D / 512-D face embedding vector
    along with direct digital student consent declaration.
    Protected: Only the authenticated student or an admin/faculty can perform enrollment.
    """
    verify_student_ownership(student_id, current_user)

    if not payload.faceDescriptor or len(payload.faceDescriptor) not in (128, 512):
        raise HTTPException(
            status_code=400,
            detail="A valid 128-dimensional or 512-dimensional faceDescriptor array is required."
        )

    if not payload.studentConsent:
        raise HTTPException(
            status_code=400,
            detail="Student biometric consent declaration is required for enrollment."
        )

    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.isoformat()
    ht = payload.hallTicketNo or student_id
    normalized_ht = _normalize_student_key(ht)
    user_name = current_user.get("name") or current_user.get("user_metadata", {}).get("name")

    _cache_face_descriptor(student_id, payload.faceDescriptor, now_iso, ht, user_name)

    try:
        # 1. Update user profile in PostgreSQL
        user = _find_user(db, student_id, normalized_ht)
        if user:
            user.face_descriptor = payload.faceDescriptor
            user.face_enrollment_status = "enrolled"
            user.face_enrolled_at = now_dt
            user.updated_at = now_dt
            if not user.hall_ticket_no and normalized_ht:
                user.hall_ticket_no = normalized_ht

        # 2. Persist to student_face_embeddings table
        ht_key = normalized_ht or student_id
        emb_record = db.query(StudentFaceEmbedding).filter_by(hall_ticket_no=ht_key).first()
        algo = payload.algorithm or ("arcface_512" if len(payload.faceDescriptor) == 512 else "facenet_128")

        if emb_record:
            emb_record.embedding_vector = payload.faceDescriptor
            emb_record.embedding_dim = len(payload.faceDescriptor)
            emb_record.algorithm = algo
            emb_record.student_consent = True
            emb_record.consent_timestamp = now_dt
            emb_record.updated_at = now_dt
            if user:
                emb_record.user_id = user.id
        else:
            new_emb = StudentFaceEmbedding(
                id=uuid.uuid4(),
                user_id=user.id if user else None,
                hall_ticket_no=ht_key,
                embedding_vector=payload.faceDescriptor,
                embedding_dim=len(payload.faceDescriptor),
                algorithm=algo,
                student_consent=True,
                consent_timestamp=now_dt,
                enrolled_at=now_dt,
                updated_at=now_dt
            )
            db.add(new_emb)

        db.commit()

    except Exception as e:
        logger.error(f"Failed to save face descriptor for student {student_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database failure: Could not persist face biometric.")

    return {
        "success": True,
        "message": "Face embedding registered successfully with verified student biometric consent.",
        "studentId": student_id,
        "hallTicketNo": ht,
        "embeddingDim": len(payload.faceDescriptor),
        "faceEnrolledAt": now_iso
    }


@router.put("/{student_id}/face")
def update_student_face(
    student_id: str,
    payload: FaceEmbeddingPayload,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Student re-captures and updates their reference face embedding.
    Protected: Only the authenticated student or an admin can update enrollment.
    """
    verify_student_ownership(student_id, current_user)

    if not payload.faceDescriptor or len(payload.faceDescriptor) not in (128, 512):
        raise HTTPException(status_code=400, detail="A valid 128-D or 512-D faceDescriptor array is required.")

    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.isoformat()
    ht = payload.hallTicketNo or student_id
    normalized_ht = _normalize_student_key(ht)
    user_name = current_user.get("name") or current_user.get("user_metadata", {}).get("name")

    _cache_face_descriptor(student_id, payload.faceDescriptor, now_iso, ht, user_name)

    try:
        user = _find_user(db, student_id, normalized_ht)
        if user:
            user.face_descriptor = payload.faceDescriptor
            user.face_enrollment_status = "enrolled"
            user.face_enrolled_at = now_dt
            user.updated_at = now_dt

        ht_key = normalized_ht or student_id
        emb_record = db.query(StudentFaceEmbedding).filter_by(hall_ticket_no=ht_key).first()
        algo = payload.algorithm or ("arcface_512" if len(payload.faceDescriptor) == 512 else "facenet_128")

        if emb_record:
            emb_record.embedding_vector = payload.faceDescriptor
            emb_record.embedding_dim = len(payload.faceDescriptor)
            emb_record.algorithm = algo
            emb_record.student_consent = True
            emb_record.updated_at = now_dt
        else:
            new_emb = StudentFaceEmbedding(
                id=uuid.uuid4(),
                user_id=user.id if user else None,
                hall_ticket_no=ht_key,
                embedding_vector=payload.faceDescriptor,
                embedding_dim=len(payload.faceDescriptor),
                algorithm=algo,
                student_consent=True,
                consent_timestamp=now_dt,
                enrolled_at=now_dt,
                updated_at=now_dt
            )
            db.add(new_emb)

        db.commit()

    except Exception as e:
        logger.error(f"Failed to update face descriptor for student {student_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database failure: Could not update face biometric.")

    return {
        "success": True,
        "message": "Face embedding updated successfully.",
        "studentId": student_id,
        "faceEnrolledAt": now_iso
    }


@router.delete("/{student_id}/revoke-face-data")
@router.delete("/{student_id}/face")
def revoke_student_face_data(
    student_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Student exercises Right-to-Erasure (DPDP Act) and removes their stored face biometric embedding.
    Protected: Only the authenticated student or an admin can delete enrollment.
    """
    verify_student_ownership(student_id, current_user)

    norm_id = _normalize_student_key(student_id)
    student_face_cache.pop(student_id, None)
    student_face_cache.pop(norm_id, None)
    face_service.remove_embedding(student_id)
    if norm_id:
        face_service.remove_embedding(norm_id)

    try:
        now_dt = datetime.now(timezone.utc)
        user = _find_user(db, student_id, norm_id)
        if user:
            user.face_descriptor = None
            user.face_enrollment_status = "pending"
            user.face_enrolled_at = None
            user.updated_at = now_dt

        # Delete embeddings
        db.query(StudentFaceEmbedding).filter(
            or_(
                StudentFaceEmbedding.hall_ticket_no == norm_id,
                StudentFaceEmbedding.hall_ticket_no == student_id
            )
        ).delete(synchronize_session=False)

        # Log to audit trail
        audit = AuditLog(
            id=uuid.uuid4(),
            action="BIOMETRIC_DATA_REVOKED",
            performed_by=str(current_user.get("email") or student_id),
            performer_role=current_user.get("role", "student"),
            details={"student_id": student_id, "reason": "User requested biometric erasure"},
            timestamp=now_dt
        )
        db.add(audit)
        db.commit()

    except Exception as e:
        logger.error(f"Failed to delete face descriptor for student {student_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database failure: Could not delete face biometric.")

    return {
        "success": True,
        "message": "Face biometric embedding permanently deleted and revoked from all matching services.",
        "studentId": student_id
    }
