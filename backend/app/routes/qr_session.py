import time
import uuid
import logging
import jwt
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from app.config import JWT_SECRET
from app.models.schemas import QRSessionStartPayload
from app.database import supabase_client
from app.dependencies.auth import require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/qr-session", tags=["Dynamic QR Session"])

current_session: Optional[Dict[str, Any]] = None
valid_session_tokens: Dict[str, Dict[str, Any]] = {}

def generate_signed_token(session_id: str, faculty_id: str, branch: str, section: str) -> str:
    # Extended 2-hour validity for classroom checkin grace window
    payload = {
        "sessionId": session_id,
        "facultyId": faculty_id,
        "branch": branch,
        "section": section,
        "exp": datetime.utcnow() + timedelta(hours=2)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

@router.post("/start")
def start_qr_session(
    payload: QRSessionStartPayload,
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))
):
    """
    Faculty starts/refreshes the live session; issues an extended valid token.
    Requires Faculty or Admin authentication.
    """
    global current_session
    faculty_id = str(current_user.get("id") or current_user.get("sub", "faculty_201"))
    faculty_name = payload.facultyName or current_user.get("user_metadata", {}).get("name") or "Faculty Member"
    
    session_id = f"session_{int(time.time())}"
    raw_token_id = str(uuid.uuid4())
    token = generate_signed_token(
        session_id,
        faculty_id,
        payload.branch or "CSE",
        payload.section or "A"
    )

    now_iso = datetime.utcnow().isoformat() + "Z"
    end_iso = (datetime.utcnow() + timedelta(hours=2)).isoformat() + "Z"

    current_session = {
        "sessionId": session_id,
        "facultyId": faculty_id,
        "facultyName": faculty_name,
        "sessionTitle": payload.sessionTitle or "Academic Session",
        "branch": payload.branch or "CSE",
        "section": payload.section or "A",
        "room": payload.room or "Innovation Centre Lab",
        "token": token,
        "raw_token": raw_token_id,
        "faculty_lat": payload.latitude or 17.2472,
        "faculty_lng": payload.longitude or 80.1514,
        "radius_meters": payload.radiusMeters or 500,
        "expiresAt": int(time.time() * 1000) + (120 * 60 * 1000), # 2 hours
        "createdAt": now_iso
    }

    # Store token in active history buffer
    valid_session_tokens[raw_token_id] = current_session
    valid_session_tokens[token] = current_session

    # Persist session to database
    if supabase_client:
        try:
            supabase_client.table("attendance_sessions").insert([{
                "id": str(uuid.uuid4()),
                "session_title": current_session["sessionTitle"],
                "faculty_id": faculty_id,
                "faculty_name": faculty_name,
                "branch": current_session["branch"],
                "section": current_session["section"],
                "room": current_session["room"],
                "start_time": now_iso,
                "end_time": end_iso,
                "status": "active",
                "qr_token": raw_token_id,
                "faculty_lat": payload.latitude,
                "faculty_lng": payload.longitude,
                "radius_meters": payload.radiusMeters or 150
            }]).execute()
        except Exception as e:
            logger.warning(f"Note: attendance_sessions DB sync: {e}")

    return {
        "success": True,
        "session": current_session,
        "checkinUrl": f"/checkin?token={raw_token_id}"
    }

@router.get("/current")
def get_current_qr_session():
    """
    Faculty dashboard polls this to render the current dynamic QR code.
    Publicly accessible to support classroom display screens.
    """
    global current_session

    if not current_session:
        # Check if there is an active session in DB
        if supabase_client:
            try:
                res = supabase_client.table("attendance_sessions")\
                    .select("*")\
                    .eq("status", "active")\
                    .order("created_at", desc=True)\
                    .limit(1)\
                    .execute()
                if res.data and len(res.data) > 0:
                    s = res.data[0]
                    raw_tok = s.get("qr_token") or str(uuid.uuid4())
                    current_session = {
                        "sessionId": s.get("id") or f"session_{int(time.time())}",
                        "facultyId": s.get("faculty_id", "faculty_201"),
                        "facultyName": s.get("faculty_name", "Faculty Member"),
                        "sessionTitle": s.get("session_title", "Active Academic Session"),
                        "branch": s.get("branch", "CSE"),
                        "section": s.get("section", "A"),
                        "room": s.get("room", "Innovation Centre Lab"),
                        "token": "",
                        "raw_token": raw_tok,
                        "expiresAt": int(time.time() * 1000) + (120 * 60 * 1000),
                        "createdAt": s.get("created_at", datetime.utcnow().isoformat() + "Z")
                    }
                    valid_session_tokens[raw_tok] = current_session
            except Exception as e:
                logger.warning(f"Could not load active session from DB: {e}")

    if not current_session:
        raise HTTPException(status_code=404, detail="No active QR session currently.")

    now_ms = int(time.time() * 1000)
    # Auto-refresh if expiring
    if now_ms > current_session["expiresAt"] - 5000:
        new_tok = generate_signed_token(
            current_session["sessionId"],
            current_session["facultyId"],
            current_session["branch"],
            current_session["section"]
        )
        current_session["token"] = new_tok
        current_session["expiresAt"] = now_ms + (120 * 60 * 1000)
        valid_session_tokens[new_tok] = current_session
        if current_session.get("raw_token"):
            valid_session_tokens[current_session["raw_token"]] = current_session

    seconds_remaining = max(30, int((current_session["expiresAt"] - now_ms) / 1000))

    return {
        "active": True,
        "session": current_session,
        "secondsRemaining": seconds_remaining,
        "checkinUrl": f"/checkin?token={current_session.get('raw_token', '')}"
    }
