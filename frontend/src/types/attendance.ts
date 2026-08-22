// src/types/attendance.ts

export type AttendanceStatus = "present" | "late" | "absent";

export type VerificationMethod = "face_recognition" | "biometric_fallback" | "biometric_platform" | "qr_gps" | "manual";

export interface AttendanceSession {
  sessionId: string;
  id?: string;
  sessionTitle?: string;
  facultyId?: string;
  facultyName?: string;
  branch: string;
  section: string;
  year: number;
  room?: string;
  startTime: string;
  endTime: string;
  status: "active" | "ended";
  qrToken?: string;
  currentRotationNumber?: number;
  currentRotationToken?: string;
  qrValiditySecs?: number;
  radiusMeters?: number;
  geofence?: GeofenceConfig;
}

export interface AttendanceRecord {
  recordId: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  hallTicketNo: string;
  facultyId?: string;
  facultyName?: string;
  branch: string;
  section: string;
  year: number;
  semester?: string;
  room?: string;
  sessionTitle?: string;
  markedAt: string;
  status: AttendanceStatus;
  verificationMethod: VerificationMethod;
  gpsDistanceMeters?: number;
  studentLat?: number;
  studentLng?: number;
  qrTokenUsed?: string;
  faceVerified?: boolean;
  faceMatchConfidence?: number;
  faceDistance?: number;
  blinkVerified?: boolean;
  biometricVerified?: boolean;
  manualReason?: string;
  markedBy?: string;
}

export interface GeofenceConfig {
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  radiusMeters: number;
  enabled?: boolean;
}

export interface AuditLog {
  id?: string;
  logId?: string;
  action: string;
  user?: string;
  performedBy?: string;
  performerRole?: string;
  timestamp: string;
  details?: any;
}