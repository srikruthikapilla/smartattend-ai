// src/types/attendance.ts

export interface AttendanceSession {
  sessionId: string;

  subject: string;

  facultyId: string;
  facultyName: string;

  branch: string;
  section: string;
  year: number;

  room: string;

  startTime: string;
  endTime: string;

  status: "active" | "ended";

  qrToken: string;

  currentRotationNumber: number;
  qrValiditySecs: number;

  radiusMeters: number;

  geofence: GeofenceConfig;
}

export interface AttendanceRecord {
  recordId: string;

  sessionId: string;

  studentId: string;
  studentName: string;
  hallTicketNo: string;

  facultyId: string;
  facultyName: string;

  branch: string;
  section: string;
  year: number;

  room: string;

  subject: string;

  markedAt: string;

  status: "present" | "late" | "absent";

  verificationMethod:
    | "qr_gps"
    | "manual"
    | "face";

  gpsDistanceMeters?: number;

  qrTokenUsed?: string;

  faceVerified?: boolean;

  confidenceScore?: number;
}

export interface GeofenceConfig {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface AuditLog {
  id: string;

  action: string;

  user: string;

  timestamp: string;

  details?: string;
}