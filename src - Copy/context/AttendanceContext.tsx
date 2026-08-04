import React, {
  createContext,
  useContext,
  useEffect,
  useState
} from "react";

import {
  AttendanceSession,
  AttendanceRecord,
  GeofenceConfig,
  AuditLog
} from "../types/attendance";

interface AttendanceContextType {
  activeSession: AttendanceSession | null;

  attendanceRecords: AttendanceRecord[];

  geofence: GeofenceConfig;

  auditLogs: AuditLog[];

  qrToken: string;

  rotationCountdown: number;

  sessionCountdown: number;

  startSession: (data: {
    subject: string;
    facultyId: string;
    facultyName: string;

    branch: string;
    section: string;
    year: number;

    room: string;

    durationMinutes: number;

    radiusMeters: number;
  }) => void;

  terminateSession: () => void;

  updateGeofence: (geo: GeofenceConfig) => void;

  recordAttendanceQR: (studentId: string) => void;

  recordManualAttendance: (
    studentId: string,
    status: "present" | "late" | "absent"
  ) => void;
}

const AttendanceContext =
  createContext<AttendanceContextType | undefined>(undefined);

export const AttendanceProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {

  const [activeSession, setActiveSession] =
    useState<AttendanceSession | null>(null);

  const [attendanceRecords, setAttendanceRecords] =
    useState<AttendanceRecord[]>([
      {
        recordId: "rec1",
        sessionId: "sess_dsa_101",

        studentId: "student_301",
        studentName: "Rahul Kumar",
        hallTicketNo: "22A91A0501",

        branch: "CSE",
        section: "A",
        year: 2,

        subject: "Data Structures",

        markedAt: new Date().toISOString(),

        status: "present",

        verificationMethod: "qr_gps",

        gpsDistanceMeters: 120
      },

      {
        recordId: "rec2",
        sessionId: "sess_dsa_101",

        studentId: "student_302",
        studentName: "Sneha Reddy",
        hallTicketNo: "22A91A0502",

        branch: "CSE",
        section: "A",
        year: 2,

        subject: "Data Structures",

        markedAt: new Date().toISOString(),

        status: "late",

        verificationMethod: "qr_gps",

        gpsDistanceMeters: 230
      },

      {
        recordId: "rec3",
        sessionId: "sess_dsa_101",

        studentId: "student_303",
        studentName: "Arjun Kumar",
        hallTicketNo: "22A91A0503",

        branch: "CSE",
        section: "A",
        year: 2,

        subject: "Data Structures",

        markedAt: new Date().toISOString(),

        status: "present",

        verificationMethod: "manual"
      }
    ]);

  const [geofence, setGeofence] =
    useState<GeofenceConfig>({
      latitude: 17.2472,
      longitude: 80.1514,
      radiusMeters: 500
    });

  const [auditLogs, setAuditLogs] =
    useState<AuditLog[]>([]);

  const [qrToken, setQrToken] =
useState("");

  const [rotationCountdown, setRotationCountdown] =
    useState(30);

  const [sessionCountdown, setSessionCountdown] =
    useState(0);

  console.log("AttendanceProvider Rendered");
    // -------------------------------
  // Start a new attendance session
  // -------------------------------

  const startSession = (data: {
    subject: string;
    facultyId: string;
    facultyName: string;
    branch: string;
    section: string;
    year: number;
    room: string;
    durationMinutes: number;
    radiusMeters: number;
  }) => {

    const startTime = new Date();

    const endTime = new Date(
      startTime.getTime() +
      data.durationMinutes * 60 * 1000
    );

    const session: AttendanceSession = {

      sessionId: crypto.randomUUID(),

      subject: data.subject,

      facultyId: data.facultyId,
      facultyName: data.facultyName,

      branch: data.branch,
      section: data.section,
      year: data.year,

      room: data.room,

      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),

      status: "active",

      qrToken: crypto.randomUUID(),

      radiusMeters: data.radiusMeters

    };

    setActiveSession(session);

    setQrToken(session.qrToken);

    setRotationCountdown(30);

    setSessionCountdown(
      data.durationMinutes * 60
    );

    setAuditLogs(prev => [
      {
        id: crypto.randomUUID(),
        action: "SESSION_STARTED",
        user: session.facultyName,
        timestamp: new Date().toISOString()
      },
      ...prev
    ]);

  };

  // -------------------------------
  // End session
  // -------------------------------

  const terminateSession = () => {

    if (!activeSession) return;

    setAuditLogs(prev => [
      {
        id: crypto.randomUUID(),
        action: "SESSION_TERMINATED",
        user: activeSession.facultyName,
        timestamp: new Date().toISOString()
      },
      ...prev
    ]);

    setActiveSession(null);

    setQrToken("");

    setRotationCountdown(30);

    setSessionCountdown(0);

  };

  // -------------------------------
  // Update GPS
  // -------------------------------

  const updateGeofence = (
    geo: GeofenceConfig
  ) => {

    setGeofence(geo);

  };

  // -------------------------------
  // QR Attendance
  // -------------------------------

  const recordAttendanceQR = (
    studentId: string
  ) => {

    if (!activeSession) return;

    console.log(
      "Attendance marked for",
      studentId
    );

  };

  // -------------------------------
  // Manual Attendance
  // -------------------------------

  const recordManualAttendance = (
    studentId: string,
    status: "present" | "late" | "absent"
  ) => {

    console.log(
      "Manual Attendance",
      studentId,
      status
    );

  };

  // -------------------------------
  // QR Rotation Timer
  // -------------------------------

  useEffect(() => {

    if (!activeSession) return;

    const timer = setInterval(() => {

      setRotationCountdown(prev => {

        if (prev <= 1) {

          const token =
            crypto.randomUUID();

          setQrToken(token);

          setActiveSession(session =>

            session
              ? {
                  ...session,
                  qrToken: token
                }
              : null

          );

          return 30;

        }

        return prev - 1;

      });

    }, 1000);

    return () => clearInterval(timer);

  }, [activeSession]);

  // -------------------------------
  // Session Countdown
  // -------------------------------

  useEffect(() => {

    if (!activeSession) return;

    const timer = setInterval(() => {

      setSessionCountdown(prev => {

        if (prev <= 1) {

          terminateSession();

          return 0;

        }

        return prev - 1;

      });

    }, 1000);

    return () => clearInterval(timer);

  }, [activeSession]);
    return (
    <AttendanceContext.Provider
      value={{
        activeSession,
        attendanceRecords,
        geofence,
        auditLogs,
        qrToken,
        rotationCountdown,
        sessionCountdown,

        startSession,
        terminateSession,
        updateGeofence,

        recordAttendanceQR,
        recordManualAttendance
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendance = () => {
  const context = useContext(AttendanceContext);

  if (!context) {
    throw new Error(
      "useAttendance must be used within AttendanceProvider"
    );
  }

  return context;
};

export default AttendanceContext;