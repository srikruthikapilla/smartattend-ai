import os
import jwt
from typing import Optional, List, Union, Dict, Any
from fastapi import Header, HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import JWT_SECRET, EDGE_API_KEY

security_scheme = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
    authorization: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """
    Validates Bearer token from HTTP Authorization header.
    Decodes and verifies native JWT tokens signed with JWT_SECRET (HS256).
    Fails closed: Any missing, expired, or invalid token raises HTTP 401.
    """
    token = None
    if credentials:
        token = credentials.credentials
    elif authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header. Bearer token required.",
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
            options={"verify_signature": True}
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

    user_id = decoded_payload.get("sub") or decoded_payload.get("id") or decoded_payload.get("userId") or decoded_payload.get("email")
    role = decoded_payload.get("role") or decoded_payload.get("user_role") or "student"

    return {
        "id": user_id,
        "sub": user_id,
        "email": decoded_payload.get("email"),
        "name": decoded_payload.get("name"),
        "role": role,
        "payload": decoded_payload
    }

def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
    authorization: Optional[str] = Header(None)
) -> Optional[Dict[str, Any]]:
    """Returns the authenticated user dict if valid token is provided, else None."""
    try:
        return get_current_user(credentials, authorization)
    except HTTPException:
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

    if not x_api_key or x_api_key != EDGE_API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing edge device key (X-API-Key)."
        )

    return True
