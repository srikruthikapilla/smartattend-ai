import os
import uuid
import secrets
from app.database import get_db
from app.models.db_models import Admin, Faculty, Student, AuditLog
from app.utils.security import credential_version
import jwt
from typing import Optional, List, Union, Dict, Any
from fastapi import Header, HTTPException, Depends, Security, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import JWT_SECRET, EDGE_API_KEY, COOKIE_NAME

security_scheme = HTTPBearer(auto_error=False)

def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
    authorization: Optional[str] = Header(None),
    db = Depends(get_db)
) -> Dict[str, Any]:
    """
    Validates JWT token from either:
    1. HTTP Authorization header (Bearer token) - for backward compatibility
    2. httpOnly cookie (sbit_auth_token) - new secure method
    Decodes and verifies native JWT tokens signed with JWT_SECRET (HS256).
    Fails closed: Any missing, expired, or invalid token raises HTTP 401.
    """
    token = None
    
    # Try Authorization header first (backward compatibility)
    if credentials and hasattr(credentials, "credentials") and credentials.credentials:
        token = credentials.credentials
    elif authorization and isinstance(authorization, str) and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
    
    # Fall back to cookie
    if not token and hasattr(request, "cookies"):
        token = request.cookies.get(COOKIE_NAME)

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not JWT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Server authentication configuration error: JWT_SECRET not configured."
        )

    try:
        decoded_payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_signature": True, "require": ["exp", "sub", "role", "type", "jti", "credential_version"]}
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Authentication token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail="Invalid or unverified authentication token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Enforce purpose / type separation: Reject enrollment tokens or non-session tokens
    token_type = decoded_payload.get("type")
    if token_type != "access":
        raise HTTPException(
            status_code=401,
            detail="Invalid token type for session authentication.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user_id = decoded_payload["sub"]
    role = decoded_payload["role"]
    model = {"admin": Admin, "faculty": Faculty, "student": Student}.get(role)
    try:
        account_id = uuid.UUID(user_id)
        session_id = uuid.UUID(decoded_payload["jti"])
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(401, "Invalid account identity.")
    if model is None:
        raise HTTPException(401, "Invalid account role.")
    account = db.query(model).filter(model.id == account_id).first()
    if not account or account.status != "approved":
        raise HTTPException(401, "Account is unavailable or no longer approved.")

    expected_version = credential_version(getattr(account, "password_hash", "") or "")
    if not secrets.compare_digest(str(decoded_payload["credential_version"]), expected_version):
        raise HTTPException(401, "Credentials changed. Please sign in again.")
    if db.get(AuditLog, session_id) is not None:
        raise HTTPException(401, "This session has been logged out.")

    return {
        "id": user_id,
        "sub": user_id,
        "email": account.email,
        "name": account.name,
        "role": role,
        "hall_ticket_no": getattr(account, "hall_ticket_no", None),
        "payload": decoded_payload
    }

def get_optional_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
    authorization: Optional[str] = Header(None),
    db = Depends(get_db)
) -> Optional[Dict[str, Any]]:
    """Returns the authenticated user dict if valid token is provided, else None."""
    try:
        return get_current_user(request, credentials, authorization, db)
    except HTTPException as exc:
        if exc.status_code != 401:
            raise
        return None

def require_role(allowed_roles: Union[str, List[str]]):
    """
    Enforces role-based authorization (e.g. 'admin' or ['faculty', 'admin']).
    """
    if isinstance(allowed_roles, str):
        roles_list = [allowed_roles]
    else:
        roles_list = allowed_roles

    def role_checker(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_role = user.get("role", "student").lower()
        if user_role not in [r.lower() for r in roles_list]:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: Required role '{','.join(roles_list)}', but current user is '{user_role}'."
            )
        return user

    return role_checker

def verify_edge_key(x_api_key: Optional[str] = Header(None)) -> bool:
    """
    Validates dedicated X-API-Key for offline Edge AI PC sync endpoints.
    """
    if not EDGE_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Edge service API key not configured on backend."
        )

    if not x_api_key or not secrets.compare_digest(x_api_key, EDGE_API_KEY):
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing edge device key (X-API-Key)."
        )

    return True


def require_student_report(hall_ticket: str, request: Request,
                           caller=Depends(get_optional_current_user)):
    if caller and caller["role"] in ("admin", "faculty"):
        return caller
    report_token = request.headers.get("x-student-report-token", "")
    try:
        claims = jwt.decode(report_token, JWT_SECRET, algorithms=["HS256"],
                            options={"require": ["exp", "type", "ht"]})
        if claims["type"] != "attendance_report" or claims["ht"] != hall_ticket.strip().upper():
            raise ValueError("Wrong report identity")
    except Exception:
        raise HTTPException(401, "Verify your email to view your attendance report.")
    return claims
