from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
import re

class HallTicketModel(BaseModel):
    hall_ticket_no: str = Field(..., description="10 alphanumeric characters starting with 2")

    @field_validator("hall_ticket_no")
    @classmethod
    def validate_hall_ticket(cls, v: str) -> str:
        v = v.strip().upper()
        if not re.match(r"^2[0-9A-Z]{9}$", v):
            raise ValueError("Hall Ticket must be exactly 10 characters starting with '2' (e.g. 21SBIT0501).")
        return v

class FaceEmbeddingPayload(BaseModel):
    faceDescriptor: List[float] = Field(..., description="128-D or 512-D float vector")
    hallTicketNo: Optional[str] = None
    studentConsent: Optional[bool] = True
    algorithm: Optional[str] = "facenet_128"

class FaceEnrollmentRequest(BaseModel):
    faceDescriptor: List[float] = Field(..., description="128-D or 512-D float vector")
    hallTicketNo: Optional[str] = None
    studentConsent: bool = Field(default=True, description="Direct student biometric consent declaration")
    algorithm: Optional[str] = Field(default="facenet_128", description="facenet_128 or arcface_512")

class DetectedFaceItem(BaseModel):
    descriptor: List[float] = Field(..., description="128-D or 512-D vector")
    boundingBox: Optional[Dict[str, float]] = None
    livenessScore: Optional[float] = 1.0

class AttendanceCaptureRequest(BaseModel):
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
    sessionId: Optional[str] = None
    rawToken: Optional[str] = None
    facultyId: Optional[str] = "faculty_201"
    facultyName: Optional[str] = "Faculty Member"
    sessionTitle: Optional[str] = "Campus Academic Session"
    branch: Optional[str] = "CSE"
    section: Optional[str] = "A"
    room: Optional[str] = "Room 304"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radiusMeters: Optional[int] = 150

class VerifyCheckinPayload(BaseModel):
    token: str = Field(..., description="Session token")
    hallTicket: str = Field(..., description="10 alphanumeric characters starting with 2")
    studentName: Optional[str] = None
    lat: float = Field(..., description="GPS Latitude, mandatory for geofence verification")
    lng: float = Field(..., description="GPS Longitude, mandatory for geofence verification")
    faceDescriptor: Optional[List[float]] = None
    faceLandmarks: Optional[List[List[float]]] = None
    earHistory: Optional[List[float]] = None
    blinkVerified: Optional[bool] = False
    biometricVerified: Optional[bool] = False
    webauthnAssertion: Optional[Dict[str, Any]] = None

    @field_validator("hallTicket")
    @classmethod
    def validate_hall_ticket(cls, v: str) -> str:
        v = v.strip().upper()
        if not re.match(r"^2[0-9A-Z]{9}$", v):
            raise ValueError("Hall Ticket must be exactly 10 characters starting with '2' (e.g. 21SBIT0501).")
        return v

class GeofenceUpdatePayload(BaseModel):
    center_lat: float
    center_lng: float
    radius_m: int

class VerifyFaceDirectPayload(BaseModel):
    enrolledDescriptor: List[float]
    liveDescriptor: List[float]
    faceLandmarks: Optional[List[List[float]]] = None
    earHistory: Optional[List[float]] = None
    blinkVerified: Optional[bool] = False


