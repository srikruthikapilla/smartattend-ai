"""
Smart Attend — Authentication & User Management Routes
========================================================
All user data is stored in and queried from PostgreSQL.
Supabase is used ONLY for Auth operations (sign-in, sign-up, password reset).
"""

import os
import random
import time
import uuid
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
from app.database import get_db, supabase_auth
from app.dependencies.auth import get_current_user, get_optional_current_user, require_role
from app.models.db_models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication & Password Management"])

# In-memory OTP store with 10-minute expiration for institutional verification
otp_store: Dict[str, dict] = {}


# ── Request / Response Schemas ──────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: Optional[str] = None
    role: Optional[str] = None

class RequestResetRequest(BaseModel):
    email: str

class VerifyAndResetRequest(BaseModel):
    email: str
    otp: str
    new_password: str

class AdminDirectResetRequest(BaseModel):
    email: str
    new_password: str

class RegisterUserRequest(BaseModel):
    email: str
    name: str
    role: str = "student"
    password: Optional[str] = None
    phone: Optional[str] = None
    college: Optional[str] = "Swarna Bharathi Institute of Science and Technology (SBIT)"
    designation: Optional[str] = None
    department: Optional[str] = None
    assigned_branch: Optional[str] = None
    assigned_sections: Optional[list] = []
    hall_ticket_no: Optional[str] = None
    branch: Optional[str] = None
    section: Optional[str] = None
    year: Optional[str] = "1"
    semester: Optional[str] = "1"
    status: Optional[str] = "approved"

class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    assigned_branch: Optional[str] = None
    assigned_sections: Optional[list] = None
    hall_ticket_no: Optional[str] = None
    branch: Optional[str] = None
    section: Optional[str] = None
    year: Optional[str] = None
    semester: Optional[str] = None
    college: Optional[str] = None

class BulkStudentItem(BaseModel):
    email: str
    name: str
    hall_ticket_no: Optional[str] = None
    branch: Optional[str] = None
    section: Optional[str] = None
    year: Optional[str] = None
    semester: Optional[str] = None
    college: Optional[str] = None
    status: Optional[str] = "approved"

class BulkUpsertRequest(BaseModel):
    students: List[BulkStudentItem]


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/users")
def get_all_users(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch all users from PostgreSQL for frontend synchronization.
    Requires an authenticated user session.
    """
    users = db.query(User).all()
    return {
        "success": True,
        "users": [u.to_dict() for u in users]
    }


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user via Supabase Auth (password verification) +
    PostgreSQL database (user profile, role, status), and return a JWT.
    """
    clean_email = payload.email.strip().lower()
    auth_verified = False
    auth_user_id = None

    # 1. Attempt Supabase Auth password verification
    if supabase_auth and payload.password:
        try:
            auth_res = supabase_auth.auth.sign_in_with_password({
                "email": clean_email,
                "password": payload.password
            })
            if auth_res and auth_res.user:
                auth_user_id = auth_res.user.id
                auth_verified = True
        except Exception as e:
            logger.info(f"Supabase auth attempt for {clean_email}: {e}")

    # 2. Look up user in PostgreSQL
    user = db.query(User).filter(func.lower(User.email) == clean_email).first()

    # Fail closed: reject if credentials could not be verified by Supabase Auth
    if not auth_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if not user and not auth_user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found. Please check your email or contact the administrator."
        )

    if not user and auth_user_id:
        # Authenticated via Supabase but no DB profile — build minimal one
        user_data = {
            "id": auth_user_id,
            "email": clean_email,
            "name": clean_email.split("@")[0].capitalize(),
            "role": payload.role or "faculty",
            "status": "approved"
        }
    else:
        user_data = user.to_dict() if user else None

    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found."
        )

    # 3. Enforce role & status checks
    user_role = user_data.get("role") or payload.role or "faculty"
    user_status = user_data.get("status", "approved")

    if payload.role and user_role.lower() != payload.role.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is registered as '{user_role.upper()}', not '{payload.role.upper()}'."
        )

    if user_role == "student" and user_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your student registration is '{user_status}'. An administrator must approve it first."
        )

    # 4. Generate JWT token
    import jwt as pyjwt
    from app.config import JWT_SECRET

    user_id = str(user_data.get("id") or auth_user_id or clean_email)
    token_payload = {
        "sub": user_id,
        "id": user_id,
        "email": clean_email,
        "name": user_data.get("name", clean_email.split("@")[0]),
        "role": user_role,
        "exp": int(time.time()) + (30 * 24 * 3600)
    }
    access_token = pyjwt.encode(token_payload, JWT_SECRET, algorithm="HS256")

    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "uid": user_id,
            "email": clean_email,
            "name": user_data.get("name", clean_email.split("@")[0]),
            "phone": user_data.get("phone", ""),
            "role": user_role,
            "college": user_data.get("college", "Swarna Bharathi Institute of Science and Technology (SBIT)"),
            "designation": user_data.get("designation") or ("Administrator" if user_role == "admin" else "Faculty Member"),
            "department": user_data.get("department", "Computer Science & Engineering"),
            "assignedBranch": user_data.get("assigned_branch", "CSE"),
            "assignedSections": user_data.get("assigned_sections", ["A", "B"]),
            "hallTicketNo": user_data.get("hall_ticket_no"),
            "branch": user_data.get("branch"),
            "section": user_data.get("section"),
            "status": user_status,
            "createdAt": user_data.get("created_at") or datetime.now(timezone.utc).isoformat()
        }
    }


@router.post("/register")
def register_user(
    payload: RegisterUserRequest,
    caller: Optional[Dict[str, Any]] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Register a new user in PostgreSQL. Optionally create Supabase Auth account.
    - Admins can create or update any user with any role and status.
    - Public / non-admin callers can only self-register as a student with pending status.
    """
    clean_email = payload.email.strip().lower()
    clean_ht = payload.hall_ticket_no.strip().upper() if payload.hall_ticket_no else None
    is_admin = bool(caller and caller.get("role", "").lower() == "admin")

    target_role = payload.role if is_admin else "student"
    target_status = payload.status if is_admin else "pending"

    existing = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if existing:
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address already exists. Please log in or contact an administrator."
            )
        # Verify hall ticket is not assigned to another user
        if clean_ht:
            ht_conflict = db.query(User).filter(
                func.upper(User.hall_ticket_no) == clean_ht,
                User.id != existing.id
            ).first()
            if ht_conflict:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Hall ticket number '{clean_ht}' is already registered to another user ({ht_conflict.email})."
                )
        # Update existing user (Admin only)
        for field in ["name", "phone", "role", "status", "designation", "department",
                      "assigned_branch", "assigned_sections", "branch",
                      "section", "year", "semester", "college"]:
            val = getattr(payload, field, None)
            if val is not None:
                setattr(existing, field, val)
        if clean_ht is not None:
            existing.hall_ticket_no = clean_ht
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return {"success": True, "user": existing.to_dict(), "action": "updated"}

    # Ensure hall ticket number is unique for new registrations
    if clean_ht:
        ht_conflict = db.query(User).filter(func.upper(User.hall_ticket_no) == clean_ht).first()
        if ht_conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Hall ticket number '{clean_ht}' is already registered to another user ({ht_conflict.email})."
            )

    new_user = User(
        id=uuid.uuid4(),
        email=clean_email,
        name=payload.name,
        role=target_role,
        phone=payload.phone,
        college=payload.college,
        status=target_status,
        designation=payload.designation if is_admin else None,
        department=payload.department if is_admin else None,
        assigned_branch=payload.assigned_branch if is_admin else None,
        assigned_sections=payload.assigned_sections or [] if is_admin else [],
        hall_ticket_no=clean_ht,
        branch=payload.branch,
        section=payload.section,
        year=payload.year,
        semester=payload.semester,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Optionally create Supabase Auth account
    if supabase_auth and payload.password:
        try:
            supabase_auth.auth.admin.create_user({
                "email": clean_email,
                "password": payload.password,
                "email_confirm": True
            })
        except Exception as e:
            logger.warning(f"Supabase auth account creation notice: {e}")

    return {"success": True, "user": new_user.to_dict(), "action": "created"}


@router.put("/users/{user_id}")
def update_user(
    user_id: str,
    payload: UpdateUserRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a user's profile in PostgreSQL.
    Admins can update any profile and elevate roles/statuses.
    Regular users may only update their own profile and cannot change role or status.
    """
    caller_id = str(current_user.get("id") or current_user.get("sub", ""))
    caller_role = current_user.get("role", "student").lower()
    is_admin = caller_role == "admin"

    if not is_admin and caller_id != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You can only update your own profile."
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    update_data = payload.dict(exclude_unset=True)
    if not is_admin:
        update_data.pop("role", None)
        update_data.pop("status", None)

    if "hall_ticket_no" in update_data and update_data["hall_ticket_no"]:
        clean_ht = update_data["hall_ticket_no"].strip().upper()
        ht_conflict = db.query(User).filter(
            func.upper(User.hall_ticket_no) == clean_ht,
            User.id != user.id
        ).first()
        if ht_conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Hall ticket number '{clean_ht}' is already registered to another user ({ht_conflict.email})."
            )
        update_data["hall_ticket_no"] = clean_ht

    for field, val in update_data.items():
        if val is not None:
            setattr(user, field, val)
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return {"success": True, "user": user.to_dict()}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    current_user: Dict[str, Any] = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Delete a user from PostgreSQL. Requires Admin authorization."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    db.delete(user)
    db.commit()
    return {"success": True, "message": f"User {user_id} deleted."}


@router.post("/users/bulk")
def bulk_upsert_users(
    payload: BulkUpsertRequest,
    current_user: Dict[str, Any] = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Bulk upsert student roster into PostgreSQL. Requires Admin authorization."""
    success_count = 0
    for st in payload.students:
        clean_email = st.email.strip().lower()
        clean_ht = st.hall_ticket_no.strip().upper() if st.hall_ticket_no else None

        # Match by email OR by hall_ticket_no to prevent duplicates
        query_filters = [func.lower(User.email) == clean_email]
        if clean_ht:
            query_filters.append(func.upper(User.hall_ticket_no) == clean_ht)
        existing = db.query(User).filter(or_(*query_filters)).first()

        if existing:
            for field in ["name", "branch", "section", "year", "semester", "college", "status"]:
                val = getattr(st, field, None)
                if val is not None:
                    setattr(existing, field, val)
            if clean_ht:
                existing.hall_ticket_no = clean_ht
            existing.role = "student"
            existing.updated_at = datetime.now(timezone.utc)
        else:
            new_user = User(
                id=uuid.uuid4(),
                email=clean_email,
                name=st.name,
                role="student",
                status=st.status or "approved",
                hall_ticket_no=clean_ht,
                branch=st.branch,
                section=st.section,
                year=st.year,
                semester=st.semester,
                college=st.college or "Swarna Bharathi Institute of Science and Technology (SBIT)",
            )
            db.add(new_user)
        success_count += 1
    db.commit()
    return {"success": True, "count": success_count}


@router.post("/request-reset")
def request_password_reset(payload: RequestResetRequest, db: Session = Depends(get_db)):
    """
    Initiate password reset:
    1. Verifies if email exists in PostgreSQL
    2. Sends Supabase recovery email (if enabled)
    3. Generates 6-digit OTP valid for 10 minutes
    """
    clean_email = payload.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == clean_email).first()

    user_id = str(user.id) if user else None
    user_name = user.name if user else "User"

    # Generate 6-digit OTP
    otp_code = f"{random.randint(100000, 999999)}"
    expires_at = time.time() + 600

    otp_store[clean_email] = {
        "otp": otp_code,
        "expires_at": expires_at,
        "user_id": user_id
    }

    # Attempt Supabase reset email delivery
    if supabase_auth:
        try:
            supabase_auth.auth.reset_password_for_email(clean_email)
        except Exception as e:
            logger.info(f"Supabase password reset email notice: {e}")

    return {
        "success": True,
        "message": "Password reset verification code generated and sent to registered address.",
        "email": clean_email,
        "expires_in_seconds": 600
    }


@router.post("/reset-password")
def reset_password(payload: VerifyAndResetRequest):
    """
    Verify 6-digit OTP and update password in Supabase Auth.
    """
    clean_email = payload.email.strip().lower()
    otp_data = otp_store.get(clean_email)

    if not otp_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active password reset request found. Please request a new code."
        )

    if time.time() > otp_data["expires_at"]:
        del otp_store[clean_email]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code."
        )

    if str(payload.otp).strip() != str(otp_data["otp"]).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code."
        )

    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    if supabase_auth:
        try:
            auth_users = supabase_auth.auth.admin.list_users()
            target_user = next((u for u in auth_users if u.email.lower() == clean_email), None)

            if target_user:
                supabase_auth.auth.admin.update_user_by_id(
                    target_user.id,
                    {"password": payload.new_password, "email_confirm": True}
                )
            else:
                supabase_auth.auth.admin.create_user({
                    "email": clean_email,
                    "password": payload.new_password,
                    "email_confirm": True
                })
        except Exception as e:
            logger.error(f"Error updating Supabase password: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update password: {str(e)}"
            )

    del otp_store[clean_email]

    return {
        "success": True,
        "message": "Password successfully updated! You can now log in with your new password."
    }


@router.post("/admin-direct-reset")
def admin_direct_reset(
    payload: AdminDirectResetRequest,
    current_user: Dict[str, Any] = Depends(require_role("admin"))
):
    """Administrative direct password override via Supabase Auth. Requires Admin authorization."""
    clean_email = payload.email.strip().lower()
    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    if not supabase_auth:
        raise HTTPException(status_code=500, detail="Authentication server not configured.")

    try:
        auth_users = supabase_auth.auth.admin.list_users()
        target_user = next((u for u in auth_users if u.email.lower() == clean_email), None)

        if target_user:
            supabase_auth.auth.admin.update_user_by_id(
                target_user.id,
                {"password": payload.new_password, "email_confirm": True}
            )
        else:
            supabase_auth.auth.admin.create_user({
                "email": clean_email,
                "password": payload.new_password,
                "email_confirm": True
            })

        return {
            "success": True,
            "message": f"Password for {clean_email} updated successfully."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update password: {str(e)}")
