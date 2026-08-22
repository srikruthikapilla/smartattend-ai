import uuid
import logging
from fastapi import APIRouter, HTTPException, Body, Depends
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from app.models.schemas import (
    VerifyFaceDirectPayload,
    AttendanceCaptureRequest,
    AttendanceOverrideRequest
)
from app.utils.face_matcher import compare_face_embeddings
from app.services.face_recognition_service import face_service
from app.database import supabase_client
from app.dependencies.auth import get_current_user, get_optional_current_user, require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/attendance", tags=["Attendance Records"])

# Global Socket.io reference
sio_server = None

def set_sio_server(sio):
    global sio_server
    sio_server = sio

def get_or_create_valid_session_id(preferred_session_id: Optional[str] = None, branch: str = "CSM", section: str = "A") -> str:
    """
    Ensures a valid UUID exists in attendance_sessions table to satisfy PostgreSQL foreign keys.
    """
    if not supabase_client:
        return str(uuid.uuid4())

    # 1. If preferred ID is given, check if it exists in DB
    if preferred_session_id:
        try:
            uuid.UUID(str(preferred_session_id))
            chk = supabase_client.table("attendance_sessions").select("id").eq("id", str(preferred_session_id)).execute()
            if chk.data and len(chk.data) > 0:
                return str(preferred_session_id)
        except Exception:
            pass

    # 2. Check for any active session
    try:
        act = supabase_client.table("attendance_sessions").select("id").eq("status", "active").order("created_at", desc=True).limit(1).execute()
        if act.data and len(act.data) > 0:
            return act.data[0]["id"]
    except Exception:
        pass

    # 3. Create a valid active session
    new_id = str(uuid.uuid4())
    try:
        now_iso = datetime.utcnow().isoformat() + "Z"
        end_iso = (datetime.utcnow() + timedelta(hours=24)).isoformat() + "Z"
        supabase_client.table("attendance_sessions").insert([{
            "id": new_id,
            "session_title": "SBIT Real-Time Academic Session",
            "faculty_id": "faculty_101",
            "faculty_name": "Faculty Incharge",
            "branch": branch,
            "section": section,
            "room": "Innovation Centre Lab",
            "start_time": now_iso,
            "end_time": end_iso,
            "status": "active",
            "qr_token": str(uuid.uuid4()),
            "radius_meters": 150
        }]).execute()
        return new_id
    except Exception as e:
        logger.warning(f"Auto-create session note: {e}")
        return new_id

@router.get("/records")
def get_all_attendance_records():
    """
    Retrieve all attendance records from PostgreSQL / Supabase for live roster and dashboard sync.
    Public/Staff accessible.
    """
    records = []
    if supabase_client:
        try:
            res = supabase_client.table("attendance_records")\
                .select("*")\
                .order("marked_at", desc=True)\
                .limit(500)\
                .execute()
            if res.data:
                records = res.data
        except Exception as e:
            logger.warning(f"Error fetching attendance records from DB: {e}")

    return {
        "success": True,
        "count": len(records),
        "records": records
    }

@router.get("/date/{target_date}")
def get_attendance_by_date(target_date: str):
    """
    Retrieve attendance records and capture logs for a specific calendar date (YYYY-MM-DD).
    Includes summary metrics (present count, late count, review needed flags).
    """
    records = []
    capture_logs = []
    try:
        # Validate format
        datetime.strptime(target_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")

    start_iso = f"{target_date}T00:00:00Z"
    end_iso = f"{target_date}T23:59:59Z"

    if supabase_client:
        try:
            res = supabase_client.table("attendance_records")\
                .select("*")\
                .gte("marked_at", start_iso)\
                .lte("marked_at", end_iso)\
                .order("marked_at", desc=True)\
                .execute()
            if res.data:
                records = res.data
        except Exception as e:
            logger.warning(f"Error fetching records by date: {e}")

        try:
            log_res = supabase_client.table("attendance_capture_logs")\
                .select("*")\
                .gte("created_at", start_iso)\
                .lte("created_at", end_iso)\
                .order("created_at", desc=True)\
                .execute()
            if log_res.data:
                capture_logs = log_res.data
        except Exception as e:
            logger.warning(f"Error fetching capture logs by date: {e}")

    present_count = sum(1 for r in records if r.get("status") == "present")
    late_count = sum(1 for r in records if r.get("status") == "late")
    absent_count = sum(1 for r in records if r.get("status") == "absent")

    return {
        "success": True,
        "date": target_date,
        "summary": {
            "totalMarked": len(records),
            "presentCount": present_count,
            "lateCount": late_count,
            "absentCount": absent_count,
            "captureLogsCount": len(capture_logs)
        },
        "records": records,
        "captureLogs": capture_logs
    }

@router.post("/capture")
async def capture_attendance(
    payload: AttendanceCaptureRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    """
    Unified Facial Recognition Capture Endpoint.
    Supports:
    1. Single-student Kiosk WebRTC capture (with EAR blink liveness).
    2. Multi-face Classroom Group Scan (detects all students in classroom image, matches against enrolled database).
    """
    session_id = get_or_create_valid_session_id(payload.sessionId, "CSE", "A")
    now_iso = datetime.utcnow().isoformat() + "Z"
    performer = current_user.get("email") if current_user else "kiosk_system"

    # --- Mode 1: Multi-face Classroom Group Scan ---
    if payload.detectedFaces and len(payload.detectedFaces) > 0:
        face_items = [f.model_dump() for f in payload.detectedFaces]
        match_results = face_service.match_classroom_group_faces(face_items, threshold=0.44)
        
        marked_records = []
        newly_present = []

        for item in match_results:
            ht = item.get("hallTicket")
            conf = item.get("confidencePct", 0)
            is_matched = item.get("matched", False)
            status = item.get("status", "unmatched")
            box = item.get("boundingBox")

            # 1. Write to attendance_capture_logs for auditing
            log_entry = {
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "student_id": item.get("studentId") or ht or "UNKNOWN",
                "hall_ticket_no": ht or "UNKNOWN",
                "capture_source": payload.source or "classroom_group_scan",
                "confidence_score": conf / 100.0,
                "liveness_score": item.get("livenessScore", 1.0),
                "bounding_box": box,
                "reviewed_by_teacher": not item.get("needsReview", False),
                "created_at": now_iso
            }

            if supabase_client:
                try:
                    supabase_client.table("attendance_capture_logs").insert([log_entry]).execute()
                except Exception as log_err:
                    logger.warning(f"Error logging capture log: {log_err}")

            # 2. If matched and verified, mark attendance
            if is_matched and ht and status == "present":
                rec = {
                    "id": str(uuid.uuid4()),
                    "session_id": session_id,
                    "student_id": item.get("studentId") or ht,
                    "student_name": item.get("studentName", f"Student ({ht})"),
                    "hall_ticket_no": ht,
                    "branch": "CSE",
                    "section": "A",
                    "year": 3,
                    "status": "present",
                    "verification_method": "face_recognition",
                    "face_match_confidence": round(conf / 100.0, 4),
                    "face_distance": item.get("distance", 0.1),
                    "blink_verified": True,
                    "biometric_verified": True,
                    "gps_distance_meters": 5,
                    "student_lat": payload.lat or 17.2472,
                    "student_lng": payload.lng or 80.1514,
                    "marked_at": now_iso,
                    "manual_reason": f"Classroom Group Scan ({conf}% match)",
                    "marked_by": performer
                }

                if supabase_client:
                    try:
                        # Clear existing record for this student and insert new
                        supabase_client.table("attendance_records").delete().eq("hall_ticket_no", ht).execute()
                        supabase_client.table("attendance_records").insert([rec]).execute()
                    except Exception as db_e:
                        logger.error(f"Error inserting group scan record: {db_e}")

                marked_records.append(rec)
                newly_present.append({
                    "id": rec["id"],
                    "name": rec["student_name"],
                    "hallTicket": ht,
                    "department": "CSE",
                    "status": "present",
                    "timestamp": now_iso,
                    "method": "face_recognition",
                    "confidence": conf
                })

        # Broadcast live updates to faculty dashboard
        if sio_server and newly_present:
            try:
                for np_rec in newly_present:
                    await sio_server.emit("attendance:new", np_rec)
                await sio_server.emit("attendance:group_scan", {
                    "totalFaces": len(payload.detectedFaces),
                    "matchedCount": len(marked_records),
                    "results": match_results
                })
            except Exception:
                pass

        return {
            "success": True,
            "mode": "classroom_group_scan",
            "totalDetectedFaces": len(payload.detectedFaces),
            "matchedCount": len(marked_records),
            "results": match_results,
            "markedRecords": marked_records
        }

    # --- Mode 2: Single-Student Kiosk Capture ---
    if payload.liveDescriptor and len(payload.liveDescriptor) in (128, 512):
        match_res = face_service.match_single_vector(
            payload.liveDescriptor,
            target_hall_ticket=payload.hallTicketNo,
            threshold=0.44
        )

        ht = match_res.get("hallTicket") or payload.hallTicketNo
        conf = match_res.get("confidencePct", 0)
        is_matched = match_res.get("matched", False)

        if not is_matched:
            raise HTTPException(
                status_code=403,
                detail=f"Face matching failed ({conf}% similarity). Live face does not match enrolled profile."
            )

        rec = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "student_id": match_res.get("studentId") or ht,
            "student_name": match_res.get("studentName") or f"Student ({ht})",
            "hall_ticket_no": ht,
            "branch": "CSE",
            "section": "A",
            "year": 3,
            "status": "present",
            "verification_method": "face_recognition",
            "face_match_confidence": round(conf / 100.0, 4),
            "face_distance": match_res.get("distance", 0.1),
            "blink_verified": bool(payload.blinkVerified),
            "biometric_verified": True,
            "gps_distance_meters": 5,
            "student_lat": payload.lat or 17.2472,
            "student_lng": payload.lng or 80.1514,
            "marked_at": now_iso,
            "manual_reason": f"Kiosk WebRTC Scan ({conf}% match)",
            "marked_by": performer
        }

        if supabase_client:
            try:
                supabase_client.table("attendance_records").delete().eq("hall_ticket_no", ht).execute()
                supabase_client.table("attendance_records").insert([rec]).execute()
            except Exception as e:
                logger.error(f"Error persisting kiosk check-in: {e}")

        if sio_server:
            try:
                await sio_server.emit("attendance:new", {
                    "id": rec["id"],
                    "name": rec["student_name"],
                    "hallTicket": ht,
                    "department": "CSE",
                    "status": "present",
                    "timestamp": now_iso,
                    "method": "face_recognition"
                })
            except Exception:
                pass

        return {
            "success": True,
            "mode": "kiosk_single",
            "matched": True,
            "confidencePct": conf,
            "hallTicket": ht,
            "record": rec
        }

    raise HTTPException(status_code=400, detail="Either detectedFaces or liveDescriptor must be provided.")

@router.patch("/{record_id}/override")
@router.patch("/override/{record_id}")
async def override_attendance_record(
    record_id: str,
    payload: AttendanceOverrideRequest,
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))
):
    """
    Teacher/Admin Manual Override for Attendance Match Correction.
    Allows changing status (present/late/absent) with an audit justification.
    Broadcasts real-time update to all active dashboards.
    """
    target_status = payload.status.lower()
    if target_status not in ["present", "late", "absent"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be present, late, or absent.")

    performer = str(current_user.get("email") or current_user.get("id") or "faculty")

    updated_record = None

    if supabase_client:
        try:
            # 1. Update record in database
            res = supabase_client.table("attendance_records")\
                .update({
                    "status": target_status,
                    "manual_reason": f"Teacher Override: {payload.reason}",
                    "marked_by": performer,
                    "verification_method": "manual"
                })\
                .eq("id", record_id)\
                .execute()

            if res.data and len(res.data) > 0:
                updated_record = res.data[0]
        except Exception as e:
            logger.error(f"Database error during override: {e}")
            raise HTTPException(status_code=500, detail="Database failure during override update.")

    # 2. Emit WebSocket event
    if sio_server and updated_record:
        try:
            await sio_server.emit("attendance:update", {
                "id": record_id,
                "hallTicket": updated_record.get("hall_ticket_no"),
                "status": target_status,
                "manualReason": payload.reason,
                "performer": performer
            })
        except Exception:
            pass

    return {
        "success": True,
        "message": f"Attendance record successfully updated to {target_status.upper()}.",
        "recordId": record_id,
        "status": target_status,
        "overrideReason": payload.reason
    }

@router.post("/toggle")
async def toggle_student_attendance(payload: Dict[str, Any] = Body(...)):
    """
    Inline toggle attendance endpoint (Present / Late / Absent).
    Directly updates PostgreSQL / Supabase and emits live WebSocket event.
    """
    student_id = payload.get("studentId") or payload.get("hallTicketNo") or ""
    hall_ticket = (payload.get("hallTicketNo") or student_id).strip().upper()
    target_status = payload.get("status", "present").lower()
    student_name = payload.get("name") or payload.get("studentName") or f"Student ({hall_ticket})"
    branch = payload.get("branch") or "CSM"
    section = payload.get("section") or "A"
    year = int(payload.get("year") or 3)
    session_id = payload.get("sessionId")

    session_uuid = get_or_create_valid_session_id(session_id, branch, section)
    now_iso = datetime.utcnow().isoformat() + "Z"

    if target_status == "absent":
        if supabase_client:
            try:
                supabase_client.table("attendance_records")\
                    .delete()\
                    .eq("hall_ticket_no", hall_ticket)\
                    .execute()
            except Exception as e:
                logger.warning(f"Error deleting record: {e}")

        if sio_server:
            try:
                await sio_server.emit("attendance:delete", {
                    "hallTicket": hall_ticket,
                    "studentId": student_id
                })
            except Exception:
                pass

        return {
            "success": True,
            "message": f"Marked {hall_ticket} as ABSENT.",
            "status": "absent",
            "hallTicket": hall_ticket
        }
    else:
        record_id = str(uuid.uuid4())
        record = {
            "id": record_id,
            "session_id": session_uuid,
            "student_id": student_id,
            "student_name": student_name,
            "hall_ticket_no": hall_ticket,
            "branch": branch,
            "section": section,
            "year": year,
            "status": target_status,
            "verification_method": "manual",
            "face_match_confidence": 1.0,
            "face_distance": 0.0,
            "blink_verified": True,
            "biometric_verified": True,
            "gps_distance_meters": 5,
            "student_lat": 17.2472,
            "student_lng": 80.1514,
            "marked_at": now_iso,
            "manual_reason": "Inline Roster Toggle"
        }

        if supabase_client:
            try:
                supabase_client.table("attendance_records").delete().eq("hall_ticket_no", hall_ticket).execute()
                supabase_client.table("attendance_records").insert([record]).execute()
            except Exception as e:
                logger.error(f"Error upserting attendance record: {e}")

        if sio_server:
            try:
                await sio_server.emit("attendance:new", {
                    "id": record["id"],
                    "name": record["student_name"],
                    "hallTicket": record["hall_ticket_no"],
                    "department": record["branch"],
                    "status": target_status,
                    "timestamp": record["marked_at"],
                    "method": "manual"
                })
            except Exception:
                pass

        return {
            "success": True,
            "message": f"Marked {hall_ticket} as {target_status.upper()}.",
            "record": record
        }

@router.post("/bulk")
async def bulk_mark_attendance(payload: Dict[str, Any] = Body(...)):
    """
    Bulk mark attendance for an array of students.
    """
    students = payload.get("students", [])
    target_status = payload.get("status", "present").lower()
    session_uuid = get_or_create_valid_session_id(payload.get("sessionId"), "CSM", "A")

    for s in students:
        ht = (s.get("hallTicketNo") or s.get("uid") or "").strip().upper()
        if not ht:
            continue
        if target_status == "absent":
            if supabase_client:
                try:
                    supabase_client.table("attendance_records").delete().eq("hall_ticket_no", ht).execute()
                except Exception:
                    pass
        else:
            rec = {
                "id": str(uuid.uuid4()),
                "session_id": session_uuid,
                "student_id": s.get("uid") or ht,
                "student_name": s.get("name", f"Student ({ht})"),
                "hall_ticket_no": ht,
                "branch": s.get("branch", "CSM"),
                "section": s.get("section", "A"),
                "year": int(s.get("year") or 3),
                "status": target_status,
                "verification_method": "manual",
                "marked_at": datetime.utcnow().isoformat() + "Z"
            }
            if supabase_client:
                try:
                    supabase_client.table("attendance_records").delete().eq("hall_ticket_no", ht).execute()
                    supabase_client.table("attendance_records").insert([rec]).execute()
                except Exception:
                    pass

    return {
        "success": True,
        "message": f"Bulk marked {len(students)} students as {target_status.upper()}."
    }

@router.post("/mark")
def mark_attendance_direct(
    payload: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))
):
    """
    Direct attendance marking endpoint for manual overrides / faculty attendance.
    Requires Faculty or Admin authorization.
    """
    student_id = payload.get("studentId")
    session_id = payload.get("sessionId")

    if not student_id or not session_id:
        raise HTTPException(status_code=400, detail="Missing required parameters: studentId and sessionId")

    hall_ticket = payload.get("hallTicketNo", student_id).strip().upper()
    performer_id = str(current_user.get("id") or current_user.get("sub", "faculty"))

    new_record = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "student_id": student_id,
        "student_name": payload.get("studentName", "Student"),
        "hall_ticket_no": hall_ticket,
        "branch": payload.get("branch", "CSE"),
        "section": payload.get("section", "A"),
        "year": payload.get("year", 3),
        "marked_at": datetime.utcnow().isoformat() + "Z",
        "status": payload.get("status", "present"),
        "verification_method": payload.get("verificationMethod", "manual"),
        "face_match_confidence": payload.get("faceMatchConfidence", 0.95),
        "face_distance": payload.get("faceDistance", 0.28),
        "blink_verified": bool(payload.get("blinkVerified", False)),
        "biometric_verified": bool(payload.get("biometricVerified", False)),
        "gps_distance_meters": 15,
        "student_lat": payload.get("studentLat", 17.2472),
        "student_lng": payload.get("studentLng", 80.1514),
        "manual_reason": payload.get("manualReason", "Faculty override"),
        "marked_by": performer_id
    }

    if supabase_client:
        try:
            supabase_client.table("attendance_records").insert([new_record]).execute()
            supabase_client.table("audit_logs").insert([{
                "action": "MANUAL_ATTENDANCE_MARKED",
                "performed_by": performer_id,
                "performer_role": current_user.get("role", "faculty"),
                "details": new_record
            }]).execute()
        except Exception as e:
            logger.error(f"Failed to persist manual attendance record: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Database failure: Could not record attendance.")

    return {
        "success": True,
        "message": f"Attendance recorded via {new_record['verification_method']}",
        "record": new_record
    }

@router.post("/verify-face")
def verify_face_direct(
    payload: VerifyFaceDirectPayload,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Real-time Face Vector Verification Endpoint using native NumPy distance calculator.
    Protected: Requires valid authenticated user session.
    """
    if len(payload.enrolledDescriptor) not in (128, 512) or len(payload.liveDescriptor) not in (128, 512):
        raise HTTPException(status_code=400, detail="Descriptors must be 128-D or 512-D float arrays.")

    match, distance, confidence_pct = face_service.compare_two_vectors(
        payload.enrolledDescriptor,
        payload.liveDescriptor,
        threshold=0.44
    )

    return {
        "match": match,
        "distance": distance,
        "confidencePct": confidence_pct,
        "blinkVerified": bool(payload.blinkVerified),
        "message": (
            f"Face verified with {confidence_pct}% confidence"
            f"{' and confirmed Eye Blink liveness' if payload.blinkVerified else ''}."
            if match
            else f"Face verification failed ({confidence_pct}% confidence)."
        )
    }
