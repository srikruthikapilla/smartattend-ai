"""
Smart Attend — WebAuthn FIDO2 Biometric Routes
================================================
Hardware-backed passkey & platform biometric endpoints for SBIT students.
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.db_models import Student
from app.services.webauthn_service import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response
)
from app.routes.auth import _rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/biometrics/webauthn", tags=["WebAuthn Hardware Biometrics"])


class RegisterOptionsRequest(BaseModel):
    hallTicketNo: str
    name: Optional[str] = None
    email: Optional[str] = None


class RegisterVerifyRequest(BaseModel):
    hallTicketNo: str
    credentialId: str
    rawId: str
    clientDataJSON: str
    attestationObject: Optional[str] = ""


class AuthOptionsRequest(BaseModel):
    hallTicketNo: str


class AuthVerifyRequest(BaseModel):
    hallTicketNo: str
    credentialId: str
    clientDataJSON: str
    authenticatorData: str
    signature: str


@router.post("/register-options")
@_rate_limit("10/minute")
def get_register_options(
    request: Request,
    payload: RegisterOptionsRequest,
    db: Session = Depends(get_db)
):
    """Generate W3C WebAuthn challenge for registering a hardware passkey / fingerprint."""
    ht = payload.hallTicketNo.strip().upper()
    student = db.query(Student).filter(Student.hall_ticket_no == ht).first()
    
    student_name = payload.name or (student.name if student else f"Student ({ht})")
    student_email = payload.email or (student.email if student and student.email else f"{ht.lower()}@sbit.ac.in")

    origin = request.headers.get("origin") or str(request.base_url)
    options = generate_registration_options(
        user_id=ht,
        user_name=student_name,
        user_email=student_email,
        origin=origin
    )
    return {"success": True, "options": options}


@router.post("/register-verify")
@_rate_limit("10/minute")
def verify_registration(
    request: Request,
    payload: RegisterVerifyRequest,
    db: Session = Depends(get_db)
):
    """Verify hardware attestation response and persist credential to PostgreSQL."""
    ht = payload.hallTicketNo.strip().upper()
    origin = request.headers.get("origin") or str(request.base_url)

    valid, result = verify_registration_response(
        user_id=ht,
        credential_id=payload.credentialId,
        raw_id=payload.rawId,
        client_data_json=payload.clientDataJSON,
        attestation_object=payload.attestationObject or "",
        origin=origin
    )

    if not valid:
        raise HTTPException(status_code=400, detail=result.get("error", "WebAuthn registration failed."))

    student = db.query(Student).filter(Student.hall_ticket_no == ht).first()
    if not student:
        # Create student record if not existing yet
        student = Student(
            hall_ticket_no=ht,
            name=f"Student ({ht})",
            email=f"{ht.lower()}@sbit.ac.in",
            branch="CSE",
            section="A"
        )
        db.add(student)

    student.biometric_credential_id = result["credentialId"]
    student.biometric_public_key = result["publicKey"]
    student.biometric_sign_count = result["signCount"]
    student.biometric_enrollment_status = "enrolled"
    student.biometric_enrolled_at = datetime.now(timezone.utc)
    db.commit()

    logger.info(f"[WebAuthn] Successfully enrolled hardware passkey for {ht}")
    return {
        "success": True,
        "message": f"Hardware passkey registered successfully for {ht}.",
        "credentialId": result["credentialId"]
    }


@router.post("/auth-options")
@_rate_limit("10/minute")
def get_auth_options(
    request: Request,
    payload: AuthOptionsRequest,
    db: Session = Depends(get_db)
):
    """Generate W3C WebAuthn assertion challenge for student biometric check-in."""
    ht = payload.hallTicketNo.strip().upper()
    student = db.query(Student).filter(Student.hall_ticket_no == ht).first()

    credential_id = student.biometric_credential_id if student else None
    origin = request.headers.get("origin") or str(request.base_url)

    options = generate_authentication_options(
        user_id=ht,
        credential_id=credential_id,
        origin=origin
    )
    return {"success": True, "options": options}


@router.post("/auth-verify")
@_rate_limit("10/minute")
def verify_authentication(
    request: Request,
    payload: AuthVerifyRequest,
    db: Session = Depends(get_db)
):
    """Cryptographically verify student's hardware signature and anti-replay counter."""
    ht = payload.hallTicketNo.strip().upper()
    student = db.query(Student).filter(Student.hall_ticket_no == ht).first()

    if not student or not student.biometric_credential_id:
        raise HTTPException(
            status_code=403,
            detail=f"No hardware biometric credential found for {ht}. Please register your device first."
        )

    valid, result = verify_authentication_response(
        user_id=ht,
        credential_id=payload.credentialId,
        client_data_json=payload.clientDataJSON,
        authenticator_data=payload.authenticatorData,
        signature=payload.signature,
        stored_credential_id=student.biometric_credential_id,
        stored_public_key=student.biometric_public_key,
        stored_sign_count=student.biometric_sign_count or 0
    )

    if not valid:
        raise HTTPException(status_code=403, detail=result.get("error", "Biometric signature verification failed."))

    # Update anti-replay counter
    student.biometric_sign_count = result["newSignCount"]
    db.commit()

    logger.info(f"[WebAuthn] Cryptographically verified hardware biometric for {ht}")
    return {
        "success": True,
        "verified": True,
        "message": f"Hardware biometric authentication confirmed for {ht}."
    }
