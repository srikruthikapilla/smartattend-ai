"""
Smart Attend — Admin Portal Routes
====================================
All queries run against PostgreSQL via SQLAlchemy.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Dict, Any

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.schemas import GeofenceUpdatePayload
from app.models.db_models import Admin, Faculty, Student, AttendanceSession, AttendanceRecord, GeofenceConfig
from app.utils.geofence import current_geofence, update_geofence
from app.database import get_db
from app.dependencies.auth import get_current_user, require_role

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin",
    tags=["Admin Portal"]
)

@router.get("/stats", dependencies=[Depends(require_role("admin"))])
def get_admin_stats(db: Session = Depends(get_db)):
    """
    Retrieve platform status & stats for Admin dashboard from PostgreSQL.
    Requires Admin authorization.
    """
    try:
        total_students = db.query(func.count(Student.id)).scalar() or 0
        total_faculty = db.query(func.count(Faculty.id)).scalar() or 0
        total_admins = db.query(func.count(Admin.id)).scalar() or 0
        total_users = total_students + total_faculty + total_admins

        pending_student_approvals = db.query(func.count(Student.id)).filter(Student.status == "pending").scalar() or 0
        pending_faculty_approvals = db.query(func.count(Faculty.id)).filter(Faculty.status == "pending").scalar() or 0
        pending_approvals = pending_student_approvals + pending_faculty_approvals

        total_sessions = db.query(func.count(AttendanceSession.id)).scalar() or 0
        total_records = db.query(func.count(AttendanceRecord.id)).scalar() or 0
    except Exception as e:
        logger.error(f"PostgreSQL stats query error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error loading database statistics.")

    return {
        "totalUsers": total_users,
        "totalStudents": total_students,
        "totalFaculty": total_faculty,
        "totalAdmins": total_admins,
        "pendingApprovals": pending_approvals,
        "totalSessions": total_sessions,
        "totalRecords": total_records,
        "serverTime": datetime.now(timezone.utc).isoformat() + "Z"
    }

@router.get("/geofence")
def get_geofence(db: Session = Depends(get_db)):
    """
    Read current campus center point + allowed radius from PostgreSQL.
    Publicly accessible so any client device (student, faculty, projector)
    reads the admin's configured college location.
    """
    try:
        cfg = db.query(GeofenceConfig).filter_by(id=1).first()
        if cfg:
            update_geofence(cfg.center_lat, cfg.center_lng, cfg.radius_m)
            current_geofence["enabled"] = cfg.enabled
            current_geofence["address"] = cfg.address
    except Exception as e:
        logger.warning(f"Failed to query geofence config from DB: {e}")

    return {
        "success": True,
        "geofence": current_geofence
    }

@router.put("/geofence")
def update_geofence_config(
    payload: GeofenceUpdatePayload,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update campus center point + allowed radius in PostgreSQL.
    Requires Admin (or Faculty) authorization.
    Persists master college location and broadcasts real-time to all connected devices.
    """
    role = current_user.get("role", "").lower()
    if role not in ("admin", "faculty"):
        raise HTTPException(
            status_code=403,
            detail="Access denied: Only administrators or faculty can configure the campus geofence."
        )

    radius_m_int = int(round(payload.radius_m))
    update_geofence(payload.center_lat, payload.center_lng, radius_m_int)
    if payload.enabled is not None:
        current_geofence["enabled"] = payload.enabled
    if payload.address is not None:
        current_geofence["address"] = payload.address

    try:
        cfg = db.query(GeofenceConfig).filter_by(id=1).first()
        if cfg:
            cfg.center_lat = payload.center_lat
            cfg.center_lng = payload.center_lng
            cfg.radius_m = radius_m_int
            if payload.enabled is not None:
                cfg.enabled = payload.enabled
            if payload.address is not None:
                cfg.address = payload.address
            cfg.updated_at = datetime.now(timezone.utc)
        else:
            cfg = GeofenceConfig(
                id=1,
                center_lat=payload.center_lat,
                center_lng=payload.center_lng,
                radius_m=radius_m_int,
                enabled=payload.enabled if payload.enabled is not None else True,
                address=payload.address or "SBIT Campus, Pakabanda Street, Khammam, Telangana 507002"
            )
            db.add(cfg)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to persist geofence update: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database failure: unable to update geofence configuration.")

    # Update any active live session in memory so students currently scanning immediately match
    try:
        from app.routes import qr_session
        if qr_session.current_session:
            qr_session.current_session["faculty_lat"] = payload.center_lat
            qr_session.current_session["faculty_lng"] = payload.center_lng
            qr_session.current_session["radius_meters"] = payload.radius_m
            if "geofence" in qr_session.current_session and isinstance(qr_session.current_session["geofence"], dict):
                qr_session.current_session["geofence"]["lat"] = payload.center_lat
                qr_session.current_session["geofence"]["lng"] = payload.center_lng
                qr_session.current_session["geofence"]["radiusMeters"] = payload.radius_m
    except Exception as err:
        logger.warning(f"Active session geofence sync note: {err}")

    # Broadcast real-time update to all connected devices via Socket.io
    try:
        from app.services.redis_queue import enqueue_socketio_broadcast
        enqueue_socketio_broadcast("geofence:update", current_geofence)
    except Exception as err:
        logger.warning(f"Failed to broadcast geofence update: {err}")

    return {
        "success": True,
        "message": "Campus geofence updated and synchronized across all devices.",
        "geofence": current_geofence
    }


# ---------------------------------------------------------------------------
# System Diagnostics & SMTP / Redis Testing (Admin Only)
# ---------------------------------------------------------------------------

from pydantic import BaseModel
from typing import Optional

class TestSmtpPayload(BaseModel):
    recipient_email: Optional[str] = None


@router.get("/system/diagnostics", dependencies=[Depends(require_role("admin"))])
def get_system_diagnostics(db: Session = Depends(get_db)):
    """
    Comprehensive diagnostic report for Admin / Coolify monitoring:
    - PostgreSQL query latency and connection status
    - Redis connectivity, latency, and cache status
    - SMTP configuration and server handshake test
    """
    from app.utils.redis_client import test_redis_connection
    from app.utils.email_service import get_smtp_status, test_smtp_connection
    from sqlalchemy import text

    db_ok = False
    db_error = None
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        db_error = str(e)

    redis_diag = test_redis_connection()
    smtp_diag = test_smtp_connection()
    smtp_status = get_smtp_status()

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": {
            "connected": db_ok,
            "error": db_error
        },
        "redis": redis_diag,
        "smtp": {
            "status": smtp_status,
            "test_handshake": smtp_diag
        }
    }


@router.post("/system/test-smtp", dependencies=[Depends(require_role("admin"))])
def test_admin_smtp(payload: TestSmtpPayload):
    """
    Test Brevo SMTP credentials and send a live verification test email.
    Provides actionable error messages if port is blocked or credentials fail.
    """
    from app.utils.email_service import test_smtp_connection
    result = test_smtp_connection(test_recipient=payload.recipient_email)
    if not result.get("success"):
        raise HTTPException(
            status_code=400 if result.get("configured") else 422,
            detail=result
        )
    return result


