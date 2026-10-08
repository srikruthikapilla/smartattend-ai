from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
import re
from app.utils.face_matcher import valid_face_vector

class FaceDataModel(BaseModel):
    @field_validator("faceDescriptor", "descriptor", "liveDescriptor", "enrolledDescriptor", check_fields=False)
    @classmethod
    def validate_descriptor(cls, value):
        if value is not None and not valid_face_vector(value):
            raise ValueError("Face descriptor must contain 128 or 512 finite values and have nonzero magnitude.")
        return value


class HallTicketModel(BaseModel):
    hall_ticket_no: str = Field(..., description="9 or 10 alphanumeric characters starting with 2")

    @field_validator("hall_ticket_no")
    @classmethod
    def validate_hall_ticket(cls, v: str) -> str:
        v = v.strip().upper()
        if not re.match(r"^2[0-9A-Z]{8,9}$", v):
            raise ValueError("Hall Ticket must be 9 or 10 alphanumeric characters starting with '2'.")
        return v

class FaceEmbeddingPayload(FaceDataModel):
    faceDescriptor: List[float] = Field(..., description="128-D or 512-D float vector")
    hallTicketNo: Optional[str] = None
    studentConsent: Optional[bool] = True
    algorithm: Optional[str] = "facenet_128"

class FaceEnrollmentRequest(FaceDataModel):
    faceDescriptor: List[float] = Field(..., description="128-D or 512-D float vector")
    hallTicketNo: Optional[str] = None
    studentConsent: bool = Field(default=True, description="Direct student biometric consent declaration")
    algorithm: Optional[str] = Field(default="facenet_128", description="facenet_128 or arcface_512")

class DetectedFaceItem(FaceDataModel):
    descriptor: List[float] = Field(..., description="128-D or 512-D vector")
    boundingBox: Optional[Dict[str, float]] = None
    livenessScore: Optional[float] = 1.0

class AttendanceCaptureRequest(FaceDataModel):
    source: str = Field(default="kiosk_webrtc", description="kiosk_webrtc, classroom_group_scan, edge_camera")
    sessionId: Optional[str] = None
    hallTicketNo: Optional[str] = None
    liveDescriptor: Optional[List[float]] = None
    blinkVerified: Optional[bool] = False
    detectedFaces: Optional[List[DetectedFaceItem]] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

class AttendanceOverrideRequest(BaseModel):
    status: str = Field(..., description="present, late, or absent")
    reason: Optional[str] = Field(default="Teacher Manual Override", description="Audit justification for override")
    reviewedBy: Optional[str] = None

class QRSessionStartPayload(BaseModel):
    durationMinutes: int = Field(default=90, ge=1, le=240)
    sessionId: Optional[str] = None
    rawToken: Optional[str] = None
    facultyId: Optional[str] = "faculty_201"
    facultyName: Optional[str] = "Faculty Member"
    sessionTitle: Optional[str] = "Campus Academic Session"
    branch: Optional[str] = "CSE"
    section: Optional[str] = "A"
    room: Optional[str] = "Room 304"
    latitude: Optional[float] = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180, allow_inf_nan=False)
    radiusMeters: int = Field(default=150, ge=1, le=5000)

class VerifyCheckinPayload(FaceDataModel):
    token: str = Field(..., description="Session token")
    hallTicket: str = Field(..., description="9 or 10 alphanumeric characters starting with 2")
    studentName: Optional[str] = None
    lat: float = Field(..., ge=-90, le=90, allow_inf_nan=False)
    lng: float = Field(..., ge=-180, le=180, allow_inf_nan=False)
    faceDescriptor: Optional[List[float]] = None
    faceLandmarks: Optional[List[List[float]]] = None
    earHistory: Optional[List[float]] = None
    blinkVerified: Optional[bool] = False
    biometricVerified: Optional[bool] = False
    webauthnAssertion: Optional[Dict[str, Any]] = None
    challengeToken: Optional[str] = None
    captureImage: Optional[str] = None

    @field_validator("hallTicket")
    @classmethod
    def validate_hall_ticket(cls, v: str) -> str:
        v = v.strip().upper()
        if not re.match(r"^2[0-9A-Z]{8,9}$", v):
            raise ValueError("Hall Ticket must be 9 or 10 alphanumeric characters starting with '2'.")
        return v

class GeofenceUpdatePayload(BaseModel):
    center_lat: float
    center_lng: float
    radius_m: float
    enabled: Optional[bool] = True
    address: Optional[str] = None

class VerifyFaceDirectPayload(FaceDataModel):
    enrolledDescriptor: List[float]
    liveDescriptor: List[float]
    faceLandmarks: Optional[List[List[float]]] = None
    earHistory: Optional[List[float]] = None
    blinkVerified: Optional[bool] = False


