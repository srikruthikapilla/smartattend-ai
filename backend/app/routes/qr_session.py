"""Server-issued QR capabilities; the database controls session lifetime."""
import time
import uuid
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.config import JWT_SECRET
from app.database import get_db
from app.dependencies.auth import require_role
from app.models.db_models import AttendanceSession
from app.models.schemas import QRSessionStartPayload
from app.routes.auth import _rate_limit
from app.utils.geofence import current_geofence

router = APIRouter(prefix="/api/qr-session", tags=["Dynamic QR Session"])


def generate_signed_token(session_id, faculty_id, branch, section):
    # Stable within a rotation interval, with a short scan/submission grace period.
    interval = int(time.time()) // 60 * 60
    return jwt.encode({"type": "qr", "sessionId": session_id,
                       "iat": interval, "exp": interval + 120}, JWT_SECRET, algorithm="HS256")


def resolve_session(token, db):
    try:
        claims = jwt.decode(token, JWT_SECRET, algorithms=["HS256"],
                            options={"require": ["exp", "iat", "type", "sessionId"]})
        if claims["type"] != "qr":
            raise ValueError("Wrong token purpose")
        session_id = uuid.UUID(claims["sessionId"])
    except (jwt.PyJWTError, ValueError, TypeError, KeyError):
        raise HTTPException(403, "Invalid or expired QR token. Scan the current QR code.")
    session = db.query(AttendanceSession).filter(
        AttendanceSession.id == session_id,
        AttendanceSession.status == "active",
        AttendanceSession.end_time > datetime.now(timezone.utc)
    ).first()
    if not session:
        raise HTTPException(403, "Attendance session has ended or expired.")
    return session


def session_response(session):
    token = generate_signed_token(str(session.id), session.faculty_id, session.branch, session.section)
    remaining = max(0, int(session.end_time.timestamp() - time.time()))
    return {"success": True, "active": True, "secondsRemaining": remaining,
            "rotationRemaining": 60 - int(time.time()) % 60,
            "checkinUrl": f"/checkin?token={token}", "session": {
                "sessionId": str(session.id), "facultyId": session.faculty_id,
                "facultyName": session.faculty_name, "sessionTitle": session.session_title,
                "branch": session.branch, "section": session.section, "room": session.room,
                "token": token, "raw_token": token, "radius_meters": session.radius_meters,
                "createdAt": session.start_time.isoformat(),
                "expiresAt": int(session.end_time.timestamp() * 1000)}}


@router.post("/start")
def start_qr_session(payload: QRSessionStartPayload,
                     current_user=Depends(require_role(["faculty", "admin"])),
                     db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    if payload.latitude is None or payload.longitude is None:
        raise HTTPException(400, "Current admin or faculty GPS coordinates are required to start a session.")
    session = AttendanceSession(
        id=uuid.uuid4(), faculty_id=current_user["id"], faculty_name=current_user["name"],
        session_title=payload.sessionTitle, branch=payload.branch, section=payload.section,
        room=payload.room, start_time=now,
        end_time=now + timedelta(minutes=payload.durationMinutes), status="active",
        radius_meters=200,
        geofence={"lat": payload.latitude, "lng": payload.longitude})
    db.add(session)
    db.commit()
    db.refresh(session)
    return session_response(session)


@router.get("/current")
@_rate_limit("30/minute")
def get_current_qr_session(request: Request,
                           current_user=Depends(require_role(["faculty", "admin"])),
                           db: Session = Depends(get_db)):
    query = db.query(AttendanceSession).filter(
        AttendanceSession.status == "active",
        AttendanceSession.end_time > datetime.now(timezone.utc))
    if current_user["role"] != "admin":
        query = query.filter(AttendanceSession.faculty_id == current_user["id"])
    session = query.order_by(AttendanceSession.created_at.desc()).first()
    if not session:
        raise HTTPException(404, "No active session.")
    return session_response(session)


@router.post("/{session_id}/end")
def end_session(session_id: uuid.UUID,
                current_user=Depends(require_role(["faculty", "admin"])),
                db: Session = Depends(get_db)):
    session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Session not found.")
    if current_user["role"] != "admin" and session.faculty_id != current_user["id"]:
        raise HTTPException(403, "You can only end your own session.")
    session.status = "ended"
    session.end_time = datetime.now(timezone.utc)
    db.commit()
    return {"success": True}
