"""
Smart Attend — Authentication & User Management Routes
========================================================
Dedicated authentication for Faculty and Administrators using native bcrypt.
Password reset OTPs generated with Redis TTL expiration and dispatched via Brevo SMTP.
Student accounts are passwordless roster records.
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
import jwt as pyjwt

from app.config import JWT_SECRET
from app.database import get_db
from app.dependencies.auth import get_current_user, get_optional_current_user, require_role
from app.models.db_models import Admin, Faculty, Student
from app.utils.security import hash_password, verify_password
from app.utils.redis_client import set_otp, get_otp, delete_otp
from app.utils.email_service import send_otp_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication & Password Management"])


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
    year: Optional[str] = "3"
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

class BulkFacultyItem(BaseModel):
    name: str
    email: str
    password: Optional[str] = "faculty@123"
    phone: Optional[str] = None
    department: Optional[str] = "Computer Science & Engineering"
    designation: Optional[str] = "Assistant Professor"
    assigned_branch: Optional[str] = "CSE"
    assigned_sections: Optional[List[str]] = ["A", "B"]
    college: Optional[str] = "Swarna Bharathi Institute of Science and Technology (SBIT)"
    status: Optional[str] = "approved"

class BulkFacultyRequest(BaseModel):
    faculty: List[BulkFacultyItem]


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/users")
def get_all_users(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch all users across Admins, Faculty, and Students for frontend synchronization.
    Requires an authenticated user session.
    """
    admins = db.query(Admin).all()
    faculty = db.query(Faculty).all()
    students = db.query(Student).all()

    unified_list = (
        [a.to_dict() for a in admins] +
        [f.to_dict() for f in faculty] +
        [s.to_dict() for s in students]
    )

    return {
        "success": True,
        "users": unified_list,
        "counts": {
            "admins": len(admins),
            "faculty": len(faculty),
            "students": len(students),
            "total": len(unified_list)
        }
    }


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user against PostgreSQL:
    - Authentication is strictly enabled for Admins and Faculty only.
    - Rejects students with informative guidance (students use Face AI / Kiosk).
    """
    clean_email = payload.email.strip().lower()

    if not payload.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Password is required."
        )

    # 1. Check Administrator Account
    admin = db.query(Admin).filter(func.lower(Admin.email) == clean_email).first()
    if admin:
        if not verify_password(payload.password, admin.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password."
            )
        if payload.role and payload.role.lower() != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account is registered as 'ADMIN', not '{payload.role.upper()}'."
            )

        user_id = str(admin.id)
        token_payload = {
            "sub": user_id,
            "id": user_id,
            "email": admin.email,
            "name": admin.name,
            "role": "admin",
            "exp": int(time.time()) + (30 * 24 * 3600)
        }
        access_token = pyjwt.encode(token_payload, JWT_SECRET, algorithm="HS256")
        return {
            "success": True,
            "access_token": access_token,
            "token_type": "bearer",
            "user": admin.to_dict()
        }

    # 2. Check Faculty Account
    faculty = db.query(Faculty).filter(func.lower(Faculty.email) == clean_email).first()
    if faculty:
        if not verify_password(payload.password, faculty.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password."
            )
        if payload.role and payload.role.lower() != "faculty":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account is registered as 'FACULTY', not '{payload.role.upper()}'."
            )
        if faculty.status != "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Faculty account status is '{faculty.status}'. Please contact the administrator."
            )

        user_id = str(faculty.id)
        token_payload = {
            "sub": user_id,
            "id": user_id,
            "email": faculty.email,
            "name": faculty.name,
            "role": "faculty",
            "exp": int(time.time()) + (30 * 24 * 3600)
        }
        access_token = pyjwt.encode(token_payload, JWT_SECRET, algorithm="HS256")
        return {
            "success": True,
            "access_token": access_token,
            "token_type": "bearer",
            "user": faculty.to_dict()
        }

    # 3. Check Student Account (Students do not use password login)
    student = db.query(Student).filter(
        (func.lower(Student.email) == clean_email) |
        (func.upper(Student.hall_ticket_no) == clean_email.upper())
    ).first()
    if student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student password login is disabled. Attendance is recorded via Face AI verification or Faculty QR check-in."
        )

    # 4. Fail closed
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password."
    )


@router.post("/register")
def register_user(
    payload: RegisterUserRequest,
    caller: Optional[Dict[str, Any]] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Register a user into the appropriate table:
    - role='admin': Inserts into admins table with bcrypt hash (admin caller required).
    - role='faculty': Inserts into faculty table with bcrypt hash (admin caller required).
    - role='student': Inserts into students table without password (public or admin).
    """
    clean_email = payload.email.strip().lower()
    clean_ht = payload.hall_ticket_no.strip().upper() if payload.hall_ticket_no else None
    is_admin = bool(caller and caller.get("role", "").lower() == "admin")

    target_role = payload.role.lower() if payload.role else "student"

    if target_role in ["admin", "faculty"] and not is_admin:
        admin_count = db.query(Admin).count()
        if target_role == "admin" and admin_count == 0:
            pass  # Allow initial bootstrap admin creation
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Only an authenticated Administrator can register '{target_role}' accounts. Please log in as an administrator first."
            )

    # 1. Admin Registration
    if target_role == "admin":
        existing = db.query(Admin).filter(func.lower(Admin.email) == clean_email).first()
        if existing:
            if payload.password:
                existing.password_hash = hash_password(payload.password)
            existing.name = payload.name
            existing.phone = payload.phone
            existing.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(existing)
            return {"success": True, "user": existing.to_dict(), "action": "updated"}

        if not payload.password:
            raise HTTPException(status_code=400, detail="Password is required for Admin account.")

        new_admin = Admin(
            id=uuid.uuid4(),
            email=clean_email,
            password_hash=hash_password(payload.password),
            name=payload.name,
            phone=payload.phone,
            college=payload.college or "Swarna Bharathi Institute of Science and Technology (SBIT)",
            designation=payload.designation or "System Administrator",
            status="approved"
        )
        db.add(new_admin)
        db.commit()
        db.refresh(new_admin)
        return {"success": True, "user": new_admin.to_dict(), "action": "created"}

    # 2. Faculty Registration
    elif target_role == "faculty":
        existing = db.query(Faculty).filter(func.lower(Faculty.email) == clean_email).first()
        if existing:
            if payload.password:
                existing.password_hash = hash_password(payload.password)
            existing.name = payload.name
            existing.phone = payload.phone
            existing.department = payload.department
            existing.designation = payload.designation
            existing.assigned_branch = payload.assigned_branch
            existing.assigned_sections = payload.assigned_sections or []
            existing.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(existing)
            return {"success": True, "user": existing.to_dict(), "action": "updated"}

        if not payload.password:
            raise HTTPException(status_code=400, detail="Password is required for Faculty account.")

        new_faculty = Faculty(
            id=uuid.uuid4(),
            email=clean_email,
            password_hash=hash_password(payload.password),
            name=payload.name,
            phone=payload.phone,
            department=payload.department or "Computer Science & Engineering",
            designation=payload.designation or "Assistant Professor",
            assigned_branch=payload.assigned_branch or "CSM",
            assigned_sections=payload.assigned_sections or ["A", "B"],
            college=payload.college or "Swarna Bharathi Institute of Science and Technology (SBIT)",
            status=payload.status or "approved"
        )
        db.add(new_faculty)
        db.commit()
        db.refresh(new_faculty)
        return {"success": True, "user": new_faculty.to_dict(), "action": "created"}

    # 3. Student Registration (Passwordless Roster Record)
    else:
        if not clean_ht:
            raise HTTPException(status_code=400, detail="Hall ticket number is required for student registration.")

        existing = db.query(Student).filter(
            (func.upper(Student.hall_ticket_no) == clean_ht) |
            (func.lower(Student.email) == clean_email)
        ).first()

        if existing:
            if not is_admin:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Student account '{clean_ht}' already exists."
                )
            existing.name = payload.name
            existing.phone = payload.phone
            existing.branch = payload.branch or existing.branch
            existing.section = payload.section or existing.section
            existing.year = payload.year or existing.year
            existing.semester = payload.semester or existing.semester
            existing.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(existing)
            return {"success": True, "user": existing.to_dict(), "action": "updated"}

        new_student = Student(
            id=uuid.uuid4(),
            hall_ticket_no=clean_ht,
            email=clean_email,
            name=payload.name,
            phone=payload.phone,
            branch=payload.branch or "CSM",
            section=payload.section or "A",
            year=payload.year or "3",
            semester=payload.semester or "1",
            college=payload.college or "Swarna Bharathi Institute of Science and Technology (SBIT)",
            status=payload.status if is_admin else "pending"
        )
        db.add(new_student)
        db.commit()
        db.refresh(new_student)
        return {"success": True, "user": new_student.to_dict(), "action": "created"}


@router.put("/users/{user_id}")
def update_user(
    user_id: str,
    payload: UpdateUserRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update profile in the appropriate table (Admin, Faculty, or Student)."""
    caller_id = str(current_user.get("id") or current_user.get("sub", ""))
    caller_role = current_user.get("role", "").lower()
    is_admin = caller_role == "admin"

    clean_id = user_id.strip()
    target_uuid = None
    try:
        target_uuid = uuid.UUID(clean_id)
    except Exception:
        pass

    # 1. Try Admin
    admin = db.query(Admin).filter(Admin.id == target_uuid).first() if target_uuid else db.query(Admin).filter(func.lower(Admin.email) == clean_id.lower()).first()
    if admin:
        if not is_admin and caller_id != str(admin.id):
            raise HTTPException(status_code=403, detail="Access denied.")
        update_data = payload.dict(exclude_unset=True)
        for field in ["name", "phone", "designation"]:
            if field in update_data and update_data[field] is not None:
                setattr(admin, field, update_data[field])
        admin.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(admin)
        return {"success": True, "user": admin.to_dict()}

    # 2. Try Faculty
    faculty = db.query(Faculty).filter(Faculty.id == target_uuid).first() if target_uuid else db.query(Faculty).filter(func.lower(Faculty.email) == clean_id.lower()).first()
    if faculty:
        if not is_admin and caller_id != str(faculty.id):
            raise HTTPException(status_code=403, detail="Access denied.")
        update_data = payload.dict(exclude_unset=True)
        for field in ["name", "phone", "designation", "department", "assigned_branch", "assigned_sections"]:
            if field in update_data and update_data[field] is not None:
                setattr(faculty, field, update_data[field])
        if is_admin and "status" in update_data and update_data["status"]:
            faculty.status = update_data["status"]
        faculty.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(faculty)
        return {"success": True, "user": faculty.to_dict()}

    # 3. Try Student
    student = db.query(Student).filter(Student.id == target_uuid).first() if target_uuid else db.query(Student).filter(
        (func.lower(Student.email) == clean_id.lower()) |
        (func.upper(Student.hall_ticket_no) == clean_id.upper())
    ).first()
    if student:
        update_data = payload.dict(exclude_unset=True)
        for field in ["name", "phone", "branch", "section", "year", "semester"]:
            if field in update_data and update_data[field] is not None:
                setattr(student, field, update_data[field])
        if is_admin and "status" in update_data and update_data["status"]:
            student.status = update_data["status"]
        student.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(student)
        return {"success": True, "user": student.to_dict()}

    raise HTTPException(status_code=404, detail=f"User '{clean_id}' not found.")


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    current_user: Dict[str, Any] = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Delete a user from the appropriate table. Requires Admin authorization."""
    clean_id = user_id.strip()
    target_uuid = None
    try:
        target_uuid = uuid.UUID(clean_id)
    except Exception:
        pass

    for model in [Admin, Faculty, Student]:
        if target_uuid:
            entity = db.query(model).filter(model.id == target_uuid).first()
        else:
            entity = db.query(model).filter(func.lower(model.email) == clean_id.lower()).first()

        if entity:
            if model == Admin:
                admin_count = db.query(Admin).count()
                if admin_count <= 1:
                    raise HTTPException(
                        status_code=400,
                        detail="Cannot delete the only remaining administrator account. Please add another administrator before removing this account."
                    )
            db.delete(entity)
            db.commit()
            return {"success": True, "message": f"{model.__name__} {clean_id} deleted."}

    raise HTTPException(status_code=404, detail=f"User '{clean_id}' not found.")


@router.post("/users/bulk")
def bulk_upsert_users(
    payload: BulkUpsertRequest,
    current_user: Dict[str, Any] = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Bulk upsert student roster into students table. Requires Admin authorization."""
    success_count = 0
    now_dt = datetime.now(timezone.utc)

    for st in payload.students:
        clean_email = st.email.strip().lower()
        clean_ht = st.hall_ticket_no.strip().upper() if st.hall_ticket_no else None

        if not clean_ht:
            continue

        existing = db.query(Student).filter(
            (func.upper(Student.hall_ticket_no) == clean_ht) |
            (func.lower(Student.email) == clean_email)
        ).first()

        if existing:
            existing.name = st.name
            existing.hall_ticket_no = clean_ht
            existing.branch = st.branch or existing.branch
            existing.section = st.section or existing.section
            existing.year = st.year or existing.year
            existing.semester = st.semester or existing.semester
            existing.status = st.status or existing.status
            existing.updated_at = now_dt
        else:
            new_student = Student(
                id=uuid.uuid4(),
                hall_ticket_no=clean_ht,
                email=clean_email,
                name=st.name,
                branch=st.branch or "CSM",
                section=st.section or "A",
                year=st.year or "3",
                semester=st.semester or "1",
                college=st.college or "Swarna Bharathi Institute of Science and Technology (SBIT)",
                status=st.status or "approved",
                created_at=now_dt,
                updated_at=now_dt
            )
            db.add(new_student)
        success_count += 1

    db.commit()
    return {"success": True, "count": success_count}


@router.post("/faculty/bulk")
def bulk_upsert_faculty(
    payload: BulkFacultyRequest,
    current_user: Dict[str, Any] = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Bulk upsert faculty records into faculty table from Excel. Requires Admin authorization."""
    success_count = 0
    now_dt = datetime.now(timezone.utc)

    for f in payload.faculty:
        clean_email = f.email.strip().lower()
        if not clean_email or not f.name:
            continue

        existing = db.query(Faculty).filter(func.lower(Faculty.email) == clean_email).first()
        pwd = f.password if f.password else "faculty@123"
        pwd_hash = hash_password(pwd)

        if existing:
            existing.name = f.name
            existing.phone = f.phone or existing.phone
            existing.department = f.department or existing.department
            existing.designation = f.designation or existing.designation
            existing.assigned_branch = f.assigned_branch or existing.assigned_branch
            if f.assigned_sections:
                existing.assigned_sections = f.assigned_sections
            existing.updated_at = now_dt
        else:
            new_faculty = Faculty(
                id=uuid.uuid4(),
                email=clean_email,
                password_hash=pwd_hash,
                name=f.name,
                phone=f.phone,
                department=f.department or "Computer Science & Engineering",
                designation=f.designation or "Assistant Professor",
                assigned_branch=f.assigned_branch or "CSE",
                assigned_sections=f.assigned_sections or ["A", "B"],
                college=f.college or "Swarna Bharathi Institute of Science and Technology (SBIT)",
                status=f.status or "approved",
                created_at=now_dt,
                updated_at=now_dt
            )
            db.add(new_faculty)
        success_count += 1

    db.commit()
    return {"success": True, "count": success_count}


# ── Password Reset Flow (Faculty & Admin Only, with Redis TTL & Brevo SMTP) ──

@router.post("/request-reset")
def request_password_reset(payload: RequestResetRequest, db: Session = Depends(get_db)):
    """
    Initiate password reset for Faculty or Admin:
    1. Look up user in Admins or Faculty.
    2. Reject student requests (students don't use passwords).
    3. Generate 6-digit OTP and store in Redis with 10-minute TTL.
    4. Dispatch email via Brevo SMTP.
    """
    clean_email = payload.email.strip().lower()

    # Look up in Admin or Faculty
    user = (
        db.query(Admin).filter(func.lower(Admin.email) == clean_email).first() or
        db.query(Faculty).filter(func.lower(Faculty.email) == clean_email).first()
    )

    # Check if student requested
    student = db.query(Student).filter(func.lower(Student.email) == clean_email).first()
    if student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset is not applicable to student accounts. Students check in via Face AI or Kiosk."
        )

    if not user:
        # Return generic message to prevent email enumeration
        return {
            "success": True,
            "message": "If an administrator or faculty account exists with this email, a verification code has been dispatched.",
            "email": clean_email,
            "expires_in_seconds": 600
        }

    # Generate 6-digit OTP
    otp_code = f"{random.randint(100000, 999999)}"

    # Store in Redis with 10-minute (600s) TTL
    set_otp(clean_email, otp_code, ttl_seconds=600)

    # Send email via Brevo SMTP
    send_otp_email(clean_email, user.name, otp_code)

    return {
        "success": True,
        "message": "Password reset verification code generated and dispatched via Brevo SMTP.",
        "email": clean_email,
        "expires_in_seconds": 600
    }


@router.post("/reset-password")
def reset_password(payload: VerifyAndResetRequest, db: Session = Depends(get_db)):
    """
    Verify 6-digit OTP against Redis and update password in Admins or Faculty table.
    """
    clean_email = payload.email.strip().lower()
    stored_otp = get_otp(clean_email)

    if not stored_otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active password reset request found or verification code has expired. Please request a new code."
        )

    if str(payload.otp).strip() != str(stored_otp).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code."
        )

    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    user = (
        db.query(Admin).filter(func.lower(Admin.email) == clean_email).first() or
        db.query(Faculty).filter(func.lower(Faculty.email) == clean_email).first()
    )

    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")

    user.password_hash = hash_password(payload.new_password)
    user.updated_at = datetime.now(timezone.utc)
    db.commit()

    # Delete OTP from Redis
    delete_otp(clean_email)

    return {
        "success": True,
        "message": "Password successfully updated! You can now log in with your new password."
    }


@router.post("/admin-direct-reset")
def admin_direct_reset(
    payload: AdminDirectResetRequest,
    current_user: Dict[str, Any] = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Administrative direct password override for Faculty or Admin. Requires Admin authorization."""
    clean_email = payload.email.strip().lower()
    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    user = (
        db.query(Admin).filter(func.lower(Admin.email) == clean_email).first() or
        db.query(Faculty).filter(func.lower(Faculty.email) == clean_email).first()
    )

    if not user:
        raise HTTPException(status_code=404, detail=f"Account {clean_email} not found.")

    user.password_hash = hash_password(payload.new_password)
    user.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "success": True,
        "message": f"Password for {clean_email} updated successfully."
    }
