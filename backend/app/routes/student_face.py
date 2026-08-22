import logging
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from typing import Dict, Any, List, Optional
from app.models.schemas import FaceEmbeddingPayload, FaceEnrollmentRequest
from app.database import supabase_client
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
        or (user_email and user_email.startswith(student_id_lower))
        or (user_email and student_id_lower in user_email)
    ):
        return

    raise HTTPException(
        status_code=403,
        detail="Forbidden: You can only register or update your own biometric face data."
    )


@router.post("/{student_id}/enroll-face")
@router.post("/{student_id}/face")
def enroll_student_face(
    student_id: str,
    payload: FaceEnrollmentRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
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

    now_iso = datetime.utcnow().isoformat() + "Z"
    ht = payload.hallTicketNo or student_id
    user_name = current_user.get("name") or current_user.get("user_metadata", {}).get("name")

    _cache_face_descriptor(student_id, payload.faceDescriptor, now_iso, ht, user_name)

    if supabase_client:
        try:
            lookup_clauses = [f"id.eq.{student_id}"]
            normalized_ht = _normalize_student_key(ht)
            if normalized_ht:
                lookup_clauses.append(f"hall_ticket_no.eq.{normalized_ht}")

            # 1. Update users profile
            supabase_client.table("users").update({
                "face_descriptor": payload.faceDescriptor,
                "face_enrollment_status": "enrolled",
                "face_enrolled_at": now_iso
            }).or_(",".join(lookup_clauses)).execute()

            # 2. Persist to student_face_embeddings table
            try:
                supabase_client.table("student_face_embeddings").upsert({
                    "hall_ticket_no": normalized_ht or student_id,
                    "embedding_vector": payload.faceDescriptor,
                    "embedding_dim": len(payload.faceDescriptor),
                    "algorithm": payload.algorithm or ("arcface_512" if len(payload.faceDescriptor) == 512 else "facenet_128"),
                    "student_consent": True,
                    "consent_timestamp": now_iso,
                    "enrolled_at": now_iso,
                    "updated_at": now_iso
                }, on_conflict="hall_ticket_no").execute()
            except Exception as emb_err:
                logger.warning(f"Note on student_face_embeddings upsert: {emb_err}")

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
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Student re-captures and updates their reference face embedding.
    Protected: Only the authenticated student or an admin can update enrollment.
    """
    verify_student_ownership(student_id, current_user)

    if not payload.faceDescriptor or len(payload.faceDescriptor) not in (128, 512):
        raise HTTPException(status_code=400, detail="A valid 128-D or 512-D faceDescriptor array is required.")

    now_iso = datetime.utcnow().isoformat() + "Z"
    ht = payload.hallTicketNo or student_id
    user_name = current_user.get("name") or current_user.get("user_metadata", {}).get("name")

    _cache_face_descriptor(student_id, payload.faceDescriptor, now_iso, ht, user_name)

    if supabase_client:
        try:
            lookup_clauses = [f"id.eq.{student_id}"]
            normalized_ht = _normalize_student_key(ht)
            if normalized_ht:
                lookup_clauses.append(f"hall_ticket_no.eq.{normalized_ht}")

            supabase_client.table("users").update({
                "face_descriptor": payload.faceDescriptor,
                "face_enrollment_status": "enrolled",
                "face_enrolled_at": now_iso
            }).or_(",".join(lookup_clauses)).execute()

            try:
                supabase_client.table("student_face_embeddings").upsert({
                    "hall_ticket_no": normalized_ht or student_id,
                    "embedding_vector": payload.faceDescriptor,
                    "embedding_dim": len(payload.faceDescriptor),
                    "algorithm": payload.algorithm or ("arcface_512" if len(payload.faceDescriptor) == 512 else "facenet_128"),
                    "student_consent": True,
                    "updated_at": now_iso
                }, on_conflict="hall_ticket_no").execute()
            except Exception:
                pass
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
    current_user: Dict[str, Any] = Depends(get_current_user)
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

    if supabase_client:
        try:
            lookup_clauses = [f"id.eq.{student_id}"]
            if norm_id:
                lookup_clauses.append(f"hall_ticket_no.eq.{norm_id}")

            supabase_client.table("users").update({
                "face_descriptor": None,
                "face_enrollment_status": "pending",
                "face_enrolled_at": None
            }).or_(",".join(lookup_clauses)).execute()

            try:
                supabase_client.table("student_face_embeddings").delete().eq("hall_ticket_no", norm_id).execute()
            except Exception:
                pass

            # Log to audit trail
            try:
                supabase_client.table("audit_logs").insert({
                    "action": "BIOMETRIC_DATA_REVOKED",
                    "performed_by": str(current_user.get("email") or student_id),
                    "performer_role": current_user.get("role", "student"),
                    "details": {"student_id": student_id, "reason": "User requested biometric erasure"}
                }).execute()
            except Exception:
                pass

        except Exception as e:
            logger.error(f"Failed to delete face descriptor for student {student_id}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Database failure: Could not delete face biometric.")

    return {
        "success": True,
        "message": "Face biometric embedding permanently deleted and revoked from all matching services.",
        "studentId": student_id
    }
