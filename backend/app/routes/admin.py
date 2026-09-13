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

@router.get("/geofence", dependencies=[Depends(get_current_user)])
def get_geofence(db: Session = Depends(get_db)):
    """
    Read current campus center point + allowed radius from PostgreSQL.
    """
    try:
        cfg = db.query(GeofenceConfig).filter_by(id=1).first()
        if cfg:
            update_geofence(cfg.center_lat, cfg.center_lng, cfg.radius_m)
    except Exception as e:
        logger.warning(f"Failed to query geofence config from DB: {e}")

    return {
        "success": True,
        "geofence": current_geofence
    }

@router.put("/geofence", dependencies=[Depends(require_role("admin"))])
def update_geofence_config(payload: GeofenceUpdatePayload, db: Session = Depends(get_db)):
    """
    Update campus center point + allowed radius in PostgreSQL.
    Requires Admin authorization.
    """
    update_geofence(payload.center_lat, payload.center_lng, payload.radius_m)

    try:
        cfg = db.query(GeofenceConfig).filter_by(id=1).first()
        if cfg:
            cfg.center_lat = payload.center_lat
            cfg.center_lng = payload.center_lng
            cfg.radius_m = payload.radius_m
            cfg.updated_at = datetime.now(timezone.utc)
        else:
            cfg = GeofenceConfig(
                id=1,
                center_lat=payload.center_lat,
                center_lng=payload.center_lng,
                radius_m=payload.radius_m,
            )
            db.add(cfg)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to persist geofence update: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database failure: unable to update geofence configuration.")

    return {
        "success": True,
        "message": "Geofencing parameters updated successfully.",
        "geofence": current_geofence
    }
