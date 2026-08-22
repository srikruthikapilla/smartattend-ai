import logging
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from typing import Dict, Any
from app.models.schemas import GeofenceUpdatePayload
from app.utils.geofence import current_geofence, update_geofence
from app.database import supabase_client
from app.dependencies.auth import require_role

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin",
    tags=["Admin Portal"],
    dependencies=[Depends(require_role("admin"))]
)

@router.get("/stats")
def get_admin_stats():
    """
    Retrieve platform status & stats for Admin dashboard.
    Requires Admin authorization.
    """
    total_users = 0
    total_students = 0
    total_faculty = 0
    pending_approvals = 0
    total_sessions = 0
    total_records = 0

    if supabase_client:
        try:
            users_res = supabase_client.table("users").select("*").execute()
            if users_res.data:
                total_users = len(users_res.data)
                total_students = len([u for u in users_res.data if u.get("role") == "student"])
                total_faculty = len([u for u in users_res.data if u.get("role") == "faculty"])
                pending_approvals = len([u for u in users_res.data if u.get("status") == "pending"])
            
            sessions_res = supabase_client.table("attendance_sessions").select("id").execute()
            if sessions_res.data:
                total_sessions = len(sessions_res.data)

            records_res = supabase_client.table("attendance_records").select("id").execute()
            if records_res.data:
                total_records = len(records_res.data)
        except Exception as e:
            logger.error(f"Supabase stats query error: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Error loading database statistics.")

    return {
        "totalUsers": total_users,
        "totalStudents": total_students,
        "totalFaculty": total_faculty,
        "pendingApprovals": pending_approvals,
        "totalSessions": total_sessions,
        "totalRecords": total_records,
        "serverTime": datetime.utcnow().isoformat() + "Z"
    }

@router.get("/geofence")
def get_geofence():
    """
    Read current campus center point + allowed radius.
    """
    if supabase_client:
        try:
            res = supabase_client.table("geofence_config").select("*").eq("id", 1).execute()
            if res.data and len(res.data) > 0:
                cfg = res.data[0]
                update_geofence(cfg["center_lat"], cfg["center_lng"], cfg["radius_m"])
        except Exception as e:
            logger.warning(f"Failed to query geofence config from DB: {e}")

    return {
        "success": True,
        "geofence": current_geofence
    }

@router.put("/geofence")
def update_geofence_config(payload: GeofenceUpdatePayload):
    """
    Update campus center point + allowed radius.
    Requires Admin authorization.
    """
    update_geofence(payload.center_lat, payload.center_lng, payload.radius_m)

    if supabase_client:
        try:
            supabase_client.table("geofence_config").upsert([{
                "id": 1,
                "center_lat": payload.center_lat,
                "center_lng": payload.center_lng,
                "radius_m": payload.radius_m,
                "updated_at": datetime.utcnow().isoformat() + "Z"
            }]).execute()
        except Exception as e:
            logger.error(f"Failed to persist geofence update to Supabase: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Database failure: unable to update geofence configuration.")

    return {
        "success": True,
        "message": "Geofencing parameters updated successfully.",
        "geofence": current_geofence
    }
