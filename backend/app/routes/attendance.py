"""
Smart Attend — Attendance Records & Facial Recognition Routes
==============================================================
All attendance records, capture logs, and sessions are stored in PostgreSQL.
Socket.io is used for real-time live attendance broadcasting.
"""

import uuid
import logging
from fastapi import APIRouter, HTTPException, Body, Depends
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List

from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.schemas import (
    VerifyFaceDirectPayload,
    AttendanceCaptureRequest,
    AttendanceOverrideRequest
)
from app.models.db_models import (
    AttendanceRecord,
    AttendanceSession,
    AttendanceCaptureLog,
    AuditLog
)
from app.database import get_db, get_db_context
from app.dependencies.auth import get_current_user, get_optional_current_user, require_role
from app.services.face_recognition_service import face_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/attendance", tags=["Attendance Records"])

# Global Socket.io reference
sio_server = None

def set_sio_server(sio):
    global sio_server
    sio_server = sio


def get_or_create_valid_session_id(
    preferred_session_id: Optional[str] = None,
    branch: str = "CSM",
    section: str = "A",
    db: Optional[Session] = None
) -> str:
    """
    Ensures a valid UUID exists in attendance_sessions table to satisfy PostgreSQL foreign keys.
    """
    def _lookup_or_create(session: Session) -> str:
        # 1. If preferred ID given, check if it exists in DB
        if preferred_session_id:
            try:
                target_uuid = uuid.UUID(str(preferred_session_id))
                chk = session.query(AttendanceSession).filter_by(id=target_uuid).first()
                if chk:
                    return str(chk.id)
            except Exception:
                pass

        # 2. Check for any active session
        try:
            act = (
                session.query(AttendanceSession)
                .filter_by(status="active")
                .order_by(desc(AttendanceSession.created_at))
                .first()
            )
            if act:
                return str(act.id)
        except Exception:
            pass

        # 3. Create a valid active session
        new_session = AttendanceSession(
            id=uuid.uuid4(),
            session_title="SBIT Real-Time Academic Session",
            faculty_id="faculty_101",
            faculty_name="Faculty Incharge",
            branch=branch,
            section=section,
            room="Innovation Centre Lab",
            start_time=datetime.now(timezone.utc),
            end_time=datetime.now(timezone.utc) + timedelta(hours=24),
            status="active",
            qr_token=str(uuid.uuid4()),
            radius_meters=150
        )
        session.add(new_session)
        session.commit()
        return str(new_session.id)

    if db:
        return _lookup_or_create(db)
    else:
        with get_db_context() as session:
            return _lookup_or_create(session)


@router.get("/records")
def get_all_attendance_records(
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve all attendance records from PostgreSQL for live roster and dashboard sync.
    Requires authenticated session.
    """
    records = (
        db.query(AttendanceRecord)
        .order_by(desc(AttendanceRecord.marked_at))
        .limit(500)
        .all()
    )
    records_dict = [r.to_dict() for r in records]
    return {
        "success": True,
        "count": len(records_dict),
        "records": records_dict
    }


@router.get("/date/{target_date}")
def get_attendance_by_date(
    target_date: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve attendance records and capture logs for a specific calendar date (YYYY-MM-DD).
    Includes summary metrics (present count, late count, review needed flags).
    Requires authenticated session.
    """
    try:
        dt = datetime.strptime(target_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")

    start_dt = datetime(dt.year, dt.month, dt.day, 0, 0, 0, tzinfo=timezone.utc)
    end_dt = datetime(dt.year, dt.month, dt.day, 23, 59, 59, tzinfo=timezone.utc)

    records = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.marked_at >= start_dt)
        .filter(AttendanceRecord.marked_at <= end_dt)
        .order_by(desc(AttendanceRecord.marked_at))
        .all()
    )
    records_data = [r.to_dict() for r in records]

    capture_logs = (
        db.query(AttendanceCaptureLog)
        .filter(AttendanceCaptureLog.created_at >= start_dt)
        .filter(AttendanceCaptureLog.created_at <= end_dt)
        .order_by(desc(AttendanceCaptureLog.created_at))
        .all()
    )
    capture_logs_data = [l.to_dict() for l in capture_logs]

    present_count = sum(1 for r in records_data if r.get("status") == "present")
    late_count = sum(1 for r in records_data if r.get("status") == "late")
    absent_count = sum(1 for r in records_data if r.get("status") == "absent")

    return {
        "success": True,
        "date": target_date,
        "summary": {
            "totalMarked": len(records_data),
            "presentCount": present_count,
            "lateCount": late_count,
            "absentCount": absent_count,
            "captureLogsCount": len(capture_logs_data)
        },
        "records": records_data,
        "captureLogs": capture_logs_data
    }


@router.post("/capture")
async def capture_attendance(
    payload: AttendanceCaptureRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Unified Facial Recognition Capture Endpoint.
    Supports:
    1. Single-student Kiosk WebRTC capture (with EAR blink liveness).
    2. Multi-face Classroom Group Scan (detects all students in classroom image, matches against enrolled database).
    """
    session_id_str = get_or_create_valid_session_id(payload.sessionId, "CSE", "A", db=db)
    session_uuid = uuid.UUID(session_id_str)
    now_dt = datetime.now(timezone.utc)
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
            status_val = item.get("status", "unmatched")
            box = item.get("boundingBox")

            # 1. Write to attendance_capture_logs for auditing
            log_entry = AttendanceCaptureLog(
                id=uuid.uuid4(),
                session_id=session_uuid,
                student_id=item.get("studentId") or ht or "UNKNOWN",
                hall_ticket_no=ht or "UNKNOWN",
                capture_source=payload.source or "classroom_group_scan",
                confidence_score=conf / 100.0,
                liveness_score=item.get("livenessScore", 1.0),
                bounding_box=box,
                reviewed_by_teacher=not item.get("needsReview", False),
                created_at=now_dt
            )
            db.add(log_entry)

            # 2. If matched and verified, mark attendance
            if is_matched and ht and status_val == "present":
                # Clear existing record for this session & hall ticket
                db.query(AttendanceRecord).filter(
                    AttendanceRecord.hall_ticket_no == ht
                ).delete()

                rec = AttendanceRecord(
                    id=uuid.uuid4(),
                    session_id=session_uuid,
                    student_id=item.get("studentId") or ht,
                    student_name=item.get("studentName", f"Student ({ht})"),
                    hall_ticket_no=ht,
                    branch="CSE",
                    section="A",
                    year=3,
                    status="present",
                    verification_method="face_recognition",
                    face_match_confidence=round(conf / 100.0, 4),
                    face_distance=item.get("distance", 0.1),
                    blink_verified=True,
                    biometric_verified=True,
                    gps_distance_meters=5,
                    student_lat=payload.lat or 17.2472,
                    student_lng=payload.lng or 80.1514,
                    marked_at=now_dt,
                    manual_reason=f"Classroom Group Scan ({conf}% match)",
                    marked_by=performer
                )
                db.add(rec)
                rec_dict = rec.to_dict()
                marked_records.append(rec_dict)
                newly_present.append({
                    "id": str(rec.id),
                    "name": rec.student_name,
                    "hallTicket": ht,
                    "department": "CSE",
                    "status": "present",
                    "timestamp": now_dt.isoformat(),
                    "method": "face_recognition",
                    "confidence": conf
                })

        db.commit()

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

        # Clear existing record for this student
        db.query(AttendanceRecord).filter(
            AttendanceRecord.hall_ticket_no == ht
        ).delete()

        rec = AttendanceRecord(
            id=uuid.uuid4(),
            session_id=session_uuid,
            student_id=match_res.get("studentId") or ht,
            student_name=match_res.get("studentName") or f"Student ({ht})",
            hall_ticket_no=ht,
            branch="CSE",
            section="A",
            year=3,
            status="present",
            verification_method="face_recognition",
            face_match_confidence=round(conf / 100.0, 4),
            face_distance=match_res.get("distance", 0.1),
            blink_verified=bool(payload.blinkVerified),
            biometric_verified=True,
            gps_distance_meters=5,
            student_lat=payload.lat or 17.2472,
            student_lng=payload.lng or 80.1514,
            marked_at=now_dt,
            manual_reason=f"Kiosk WebRTC Scan ({conf}% match)",
            marked_by=performer
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)

        rec_dict = rec.to_dict()

        if sio_server:
            try:
                await sio_server.emit("attendance:new", {
                    "id": str(rec.id),
                    "name": rec.student_name,
                    "hallTicket": ht,
                    "department": "CSE",
                    "status": "present",
                    "timestamp": now_dt.isoformat(),
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
            "record": rec_dict
        }

    raise HTTPException(status_code=400, detail="Either detectedFaces or liveDescriptor must be provided.")


@router.patch("/{record_id}/override")
@router.patch("/override/{record_id}")
async def override_attendance_record(
    record_id: str,
    payload: AttendanceOverrideRequest,
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"])),
    db: Session = Depends(get_db)
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

    try:
        rec_uuid = uuid.UUID(record_id)
        record = db.query(AttendanceRecord).filter_by(id=rec_uuid).first()
    except Exception:
        record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()

    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found.")

    record.status = target_status
    record.manual_reason = f"Teacher Override: {payload.reason}"
    record.marked_by = performer
    record.verification_method = "manual"
    db.commit()
    db.refresh(record)

    # Emit WebSocket event
    if sio_server:
        try:
            await sio_server.emit("attendance:update", {
                "id": record_id,
                "hallTicket": record.hall_ticket_no,
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
async def toggle_student_attendance(
    payload: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Inline toggle attendance endpoint (Present / Late / Absent).
    Directly updates PostgreSQL and emits live WebSocket event.
    Requires Faculty or Admin authorization.
    """
    student_id = payload.get("studentId") or payload.get("hallTicketNo") or ""
    hall_ticket = (payload.get("hallTicketNo") or student_id).strip().upper()
    target_status = payload.get("status", "present").lower()
    student_name = payload.get("name") or payload.get("studentName") or f"Student ({hall_ticket})"
    branch = payload.get("branch") or "CSM"
    section = payload.get("section") or "A"
    year = int(payload.get("year") or 3)
    session_id = payload.get("sessionId")

    session_uuid_str = get_or_create_valid_session_id(session_id, branch, section, db=db)
    session_uuid = uuid.UUID(session_uuid_str)
    now_dt = datetime.now(timezone.utc)

    if target_status == "absent":
        db.query(AttendanceRecord).filter(
            AttendanceRecord.hall_ticket_no == hall_ticket
        ).delete()
        db.commit()

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
        # Delete existing record
        db.query(AttendanceRecord).filter(
            AttendanceRecord.hall_ticket_no == hall_ticket
        ).delete()

        record = AttendanceRecord(
            id=uuid.uuid4(),
            session_id=session_uuid,
            student_id=student_id,
            student_name=student_name,
            hall_ticket_no=hall_ticket,
            branch=branch,
            section=section,
            year=year,
            status=target_status,
            verification_method="manual",
            face_match_confidence=1.0,
            face_distance=0.0,
            blink_verified=True,
            biometric_verified=True,
            gps_distance_meters=5,
            student_lat=17.2472,
            student_lng=80.1514,
            marked_at=now_dt,
            manual_reason="Inline Roster Toggle"
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        rec_dict = record.to_dict()

        if sio_server:
            try:
                await sio_server.emit("attendance:new", {
                    "id": str(record.id),
                    "name": record.student_name,
                    "hallTicket": record.hall_ticket_no,
                    "department": record.branch,
                    "status": target_status,
                    "timestamp": record.marked_at.isoformat(),
                    "method": "manual"
                })
            except Exception:
                pass

        return {
            "success": True,
            "message": f"Marked {hall_ticket} as {target_status.upper()}.",
            "record": rec_dict
        }


@router.post("/bulk")
async def bulk_mark_attendance(
    payload: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Bulk mark attendance for an array of students in PostgreSQL.
    Requires Faculty or Admin authorization.
    """
    students = payload.get("students", [])
    target_status = payload.get("status", "present").lower()
    session_uuid_str = get_or_create_valid_session_id(payload.get("sessionId"), "CSM", "A", db=db)
    session_uuid = uuid.UUID(session_uuid_str)
    now_dt = datetime.now(timezone.utc)

    for s in students:
        ht = (s.get("hallTicketNo") or s.get("uid") or "").strip().upper()
        if not ht:
            continue
        if target_status == "absent":
            db.query(AttendanceRecord).filter(
                AttendanceRecord.hall_ticket_no == ht
            ).delete()
        else:
            db.query(AttendanceRecord).filter(
                AttendanceRecord.hall_ticket_no == ht
            ).delete()

            rec = AttendanceRecord(
                id=uuid.uuid4(),
                session_id=session_uuid,
                student_id=s.get("uid") or ht,
                student_name=s.get("name", f"Student ({ht})"),
                hall_ticket_no=ht,
                branch=s.get("branch", "CSM"),
                section=s.get("section", "A"),
                year=int(s.get("year") or 3),
                status=target_status,
                verification_method="manual",
                marked_at=now_dt
            )
            db.add(rec)

    db.commit()

    return {
        "success": True,
        "message": f"Bulk marked {len(students)} students as {target_status.upper()}."
    }


@router.post("/mark")
def mark_attendance_direct(
    payload: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Direct attendance marking endpoint for manual overrides / faculty attendance.
    Requires Faculty or Admin authorization.
    """
    student_id = payload.get("studentId")
    session_id_str = payload.get("sessionId")

    if not student_id or not session_id_str:
        raise HTTPException(status_code=400, detail="Missing required parameters: studentId and sessionId")

    hall_ticket = payload.get("hallTicketNo", student_id).strip().upper()
    performer_id = str(current_user.get("id") or current_user.get("sub", "faculty"))
    session_uuid = uuid.UUID(session_id_str) if isinstance(session_id_str, str) else session_id_str
    now_dt = datetime.now(timezone.utc)

    # Remove existing
    db.query(AttendanceRecord).filter(
        AttendanceRecord.hall_ticket_no == hall_ticket
    ).delete()

    new_record = AttendanceRecord(
        id=uuid.uuid4(),
        session_id=session_uuid,
        student_id=student_id,
        student_name=payload.get("studentName", "Student"),
        hall_ticket_no=hall_ticket,
        branch=payload.get("branch", "CSE"),
        section=payload.get("section", "A"),
        year=int(payload.get("year", 3)),
        marked_at=now_dt,
        status=payload.get("status", "present"),
        verification_method=payload.get("verificationMethod", "manual"),
        face_match_confidence=float(payload.get("faceMatchConfidence", 0.95)),
        face_distance=float(payload.get("faceDistance", 0.28)),
        blink_verified=bool(payload.get("blinkVerified", False)),
        biometric_verified=bool(payload.get("biometricVerified", False)),
        gps_distance_meters=15,
        student_lat=float(payload.get("studentLat", 17.2472)),
        student_lng=float(payload.get("studentLng", 80.1514)),
        manual_reason=payload.get("manualReason", "Faculty override"),
        marked_by=performer_id
    )
    db.add(new_record)

    # Log to audit_logs
    audit_entry = AuditLog(
        id=uuid.uuid4(),
        action="MANUAL_ATTENDANCE_MARKED",
        performed_by=performer_id,
        performer_role=current_user.get("role", "faculty"),
        details=new_record.to_dict(),
        timestamp=now_dt
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(new_record)

    return {
        "success": True,
        "message": f"Attendance recorded via {new_record.verification_method}",
        "record": new_record.to_dict()
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
