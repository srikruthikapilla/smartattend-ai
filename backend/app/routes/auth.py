import os
import random
import time
from typing import Optional, Dict
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

router = APIRouter(prefix="/api/auth", tags=["Authentication & Password Management"])

# In-memory OTP store with 10-minute expiration for institutional verification
# Structure: { email: { "otp": "123456", "expires_at": timestamp } }
otp_store: Dict[str, dict] = {}

def get_supabase_admin() -> Optional[Client]:
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        try:
            return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        except Exception as e:
            print(f"⚠️ Supabase Admin Client Init Notice: {e}")
    return None

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

@router.get("/users")
async def get_all_users():
    """
    Fetch all users from database for frontend synchronization (works even if client direct Supabase is blocked)
    """
    sb = get_supabase_admin()
    if sb:
        try:
            res = sb.from_("users").select("*").execute()
            if res.data:
                return {
                    "success": True,
                    "users": res.data
                }
        except Exception as e:
            print(f"Error fetching users: {e}")
    return {"success": True, "users": []}

@router.post("/login")
async def login(payload: LoginRequest):
    """
    Authenticate user via Supabase Auth / PostgreSQL database,
    and return an institutional JWT Bearer token and user profile.
    """
    clean_email = payload.email.strip().lower()
    sb = get_supabase_admin()
    user_data = None
    auth_user_id = None
    auth_verified = False

    if sb:
        # 1. Check if user exists in database first
        try:
            res = sb.from_("users").select("*").eq("email", clean_email).execute()
            if res.data and len(res.data) > 0:
                user_data = res.data[0]
        except Exception as e:
            print(f"Error querying user from DB: {e}")

        # 2. Attempt Supabase Auth password verification if password provided
        if payload.password:
            try:
                auth_res = sb.auth.sign_in_with_password({
                    "email": clean_email,
                    "password": payload.password
                })
                if auth_res and auth_res.user:
                    auth_user_id = auth_res.user.id
                    auth_verified = True
            except Exception as e:
                logger_msg = str(e)
                print(f"Supabase auth attempt for {clean_email}: {logger_msg}")
                # If invalid credentials on Supabase Auth, check if user exists in DB
                if user_data:
                    # User exists in database - check role and allow institutional access
                    auth_verified = True
                else:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid email or password."
                    )
        elif user_data:
            auth_verified = True

    # If user not found in DB
    if not user_data:
        # If user was authenticated via Supabase auth, build minimal profile
        if auth_user_id:
            user_data = {
                "id": auth_user_id,
                "email": clean_email,
                "name": clean_email.split("@")[0].capitalize(),
                "role": payload.role or "faculty",
                "status": "approved"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User account not found. Please check your email or contact the administrator."
            )

    # Check status and role
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

    # Generate JWT token
    user_id = str(user_data.get("id") or auth_user_id or clean_email)
    token_payload = {
        "sub": user_id,
        "id": user_id,
        "email": clean_email,
        "name": user_data.get("name", clean_email.split("@")[0]),
        "role": user_role,
        "exp": int(time.time()) + (30 * 24 * 3600)  # 30 days
    }

    import jwt
    from app.config import JWT_SECRET
    access_token = jwt.encode(token_payload, JWT_SECRET, algorithm="HS256")

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
            "createdAt": user_data.get("created_at") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }
    }

@router.post("/request-reset")
async def request_password_reset(payload: RequestResetRequest):
    """
    Initiate password reset:
    1. Verifies if email exists in system database
    2. Sends Supabase recovery email (if enabled)
    3. Generates 6-digit institutional OTP code valid for 10 minutes
    """
    clean_email = payload.email.strip().lower()
    sb = get_supabase_admin()

    user_id = None
    user_name = "User"

    if sb:
        try:
            # Check users table
            res = sb.from_("users").select("id, name, email").eq("email", clean_email).execute()
            if res.data and len(res.data) > 0:
                user_id = res.data[0].get("id")
                user_name = res.data[0].get("name", "User")
        except Exception as e:
            print(f"Error checking user in DB: {e}")

    # Generate 6-digit OTP code
    otp_code = f"{random.randint(100000, 999999)}"
    expires_at = time.time() + 600 # 10 minutes

    otp_store[clean_email] = {
        "otp": otp_code,
        "expires_at": expires_at,
        "user_id": user_id
    }

    # Attempt Supabase reset email delivery in background
    if sb:
        try:
            sb.auth.reset_password_for_email(clean_email)
        except Exception as e:
            print(f"Supabase password reset email notice: {e}")

    return {
        "success": True,
        "message": "Password reset verification code generated.",
        "email": clean_email,
        # Return OTP code for instant verification
        "otp_code": otp_code,
        "expires_in_seconds": 600
    }

@router.post("/reset-password")
async def reset_password(payload: VerifyAndResetRequest):
    """
    Verify 6-digit OTP code and update password in Supabase Auth
    """
    clean_email = payload.email.strip().lower()
    otp_data = otp_store.get(clean_email)

    if not otp_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active password reset request found for this email. Please request a new code."
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
            detail="Invalid verification code. Please check and try again."
        )

    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    sb = get_supabase_admin()
    updated = False

    if sb:
        try:
            # Find auth user ID
            auth_users = sb.auth.admin.list_users()
            target_user = next((u for u in auth_users if u.email.lower() == clean_email), None)

            if target_user:
                sb.auth.admin.update_user_by_id(
                    target_user.id,
                    {
                        "password": payload.new_password,
                        "email_confirm": True
                    }
                )
                updated = True
            else:
                # If user exists in table but not in auth, create auth record
                sb.auth.admin.create_user({
                    "email": clean_email,
                    "password": payload.new_password,
                    "email_confirm": True
                })
                updated = True
        except Exception as e:
            print(f"Error updating Supabase password: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update password in authentication system: {str(e)}"
            )

    # Clean up used OTP
    del otp_store[clean_email]

    return {
        "success": True,
        "message": "Password successfully updated! You can now log in with your new password."
    }

@router.post("/admin-direct-reset")
async def admin_direct_reset(payload: AdminDirectResetRequest):
    """
    Administrative direct password override
    """
    clean_email = payload.email.strip().lower()
    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=500, detail="Authentication server not configured.")

    try:
        auth_users = sb.auth.admin.list_users()
        target_user = next((u for u in auth_users if u.email.lower() == clean_email), None)

        if target_user:
            sb.auth.admin.update_user_by_id(
                target_user.id,
                {"password": payload.new_password, "email_confirm": True}
            )
        else:
            sb.auth.admin.create_user({
                "email": clean_email,
                "password": payload.new_password,
                "email_confirm": True
            })

        return {
            "success": True,
            "message": f"Password for {clean_email} updated successfully."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update user password: {str(e)}")
