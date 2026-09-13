"""
Smart Attend — Dynamic QR Session Routes
==========================================
Active classroom attendance sessions are stored and tracked in PostgreSQL.
"""

import time
import uuid
import logging
import jwt
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.config import JWT_SECRET
from app.models.schemas import QRSessionStartPayload
from app.models.db_models import AttendanceSession
from app.database import get_db
from app.dependencies.auth import require_role
from app.routes.auth import _rate_limit

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
        "exp": datetime.now(timezone.utc) + timedelta(hours=2)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

@router.post("/start")
def start_qr_session(
    payload: QRSessionStartPayload,
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Faculty starts/refreshes the live session; issues an extended valid token.
    Requires Faculty or Admin authentication.
    """
    global current_session
    faculty_id = str(current_user.get("id") or current_user.get("sub", "faculty_201"))
    faculty_name = payload.facultyName or current_user.get("user_metadata", {}).get("name") or "Faculty Member"

    db_session_id = uuid.uuid4()
    session_id_str = str(db_session_id)
    raw_token_id = str(uuid.uuid4())
    token = generate_signed_token(
        session_id_str,
        faculty_id,
        payload.branch or "CSE",
        payload.section or "A"
    )

    now_dt = datetime.now(timezone.utc)
    end_dt = now_dt + timedelta(hours=2)

    current_session = {
        "sessionId": session_id_str,
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
        "expiresAt": int(time.time() * 1000) + (120 * 60 * 1000),  # 2 hours
        "createdAt": now_dt.isoformat()
    }

    # Store token in active history buffer
    valid_session_tokens[raw_token_id] = current_session
    valid_session_tokens[token] = current_session

    # Persist session to PostgreSQL
    try:
        new_sess = AttendanceSession(
            id=db_session_id,
            session_title=current_session["sessionTitle"],
            faculty_id=faculty_id,
            faculty_name=faculty_name,
            branch=current_session["branch"],
            section=current_session["section"],
            room=current_session["room"],
            start_time=now_dt,
            end_time=end_dt,
            status="active",
            qr_token=raw_token_id,
            radius_meters=payload.radiusMeters or 150,
            geofence={
                "lat": payload.latitude or 17.2472,
                "lng": payload.longitude or 80.1514
            }
        )
        db.add(new_sess)
        db.commit()
    except Exception as e:
        logger.warning(f"Note: attendance_sessions PostgreSQL sync: {e}")

    return {
        "success": True,
        "session": current_session,
        "checkinUrl": f"/checkin?token={raw_token_id}"
    }

@router.get("/current")
@_rate_limit("10/minute")
def get_current_qr_session(request: Request, db: Session = Depends(get_db)):
    """
    Faculty dashboard polls this to render the current dynamic QR code.
    Publicly accessible to support classroom display screens.
    """
    global current_session

    if not current_session:
        # Check if there is an active session in PostgreSQL
        try:
            now_dt = datetime.now(timezone.utc)
            s = (
                db.query(AttendanceSession)
                .filter(AttendanceSession.status == "active")
                .filter(AttendanceSession.end_time > now_dt)
                .order_by(desc(AttendanceSession.created_at))
                .first()
            )
            if s:
                raw_tok = s.qr_token or str(uuid.uuid4())
                current_session = {
                    "sessionId": str(s.id),
                    "facultyId": s.faculty_id or "faculty_201",
                    "facultyName": s.faculty_name or "Faculty Member",
                    "sessionTitle": s.session_title or "Active Academic Session",
                    "branch": s.branch or "CSE",
                    "section": s.section or "A",
                    "room": s.room or "Innovation Centre Lab",
                    "token": "",
                    "raw_token": raw_tok,
                    "expiresAt": int(s.end_time.timestamp() * 1000) if s.end_time else (int(time.time() * 1000) + (120 * 60 * 1000)),
                    "createdAt": s.created_at.isoformat() if s.created_at else datetime.now(timezone.utc).isoformat()
                }
                valid_session_tokens[raw_tok] = current_session
        except Exception as e:
            logger.warning(f"Could not load active session from PostgreSQL: {e}")

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
