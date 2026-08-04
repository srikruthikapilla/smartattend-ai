import React, { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { useAttendance } from "../../context/AttendanceContext";
import {
  RefreshCw,
  Clock,
  Users,
  ShieldCheck,
} from "lucide-react";

export const QRGenerator: React.FC = () => {
  const {
    activeSession,
    qrToken,
    rotationCountdown,
    sessionCountdown,
    attendanceRecords,
    geofence,
  } = useAttendance();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !qrToken) return;

    QRCode.toCanvas(
      canvasRef.current,
      qrToken,
      {
        width: 280,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      },
      (err) => {
        if (err) console.error(err);
      }
    );
  }, [qrToken]);

  if (!activeSession) {
    return (
      <div className="glass-panel p-8 text-center">
        <div className="p-4 rounded-full bg-slate-800 w-16 h-16 mx-auto flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-slate-500" />
        </div>

        <h3 className="text-xl font-bold text-white light:text-slate-900">
          No Active Attendance Session
        </h3>

        <p className="text-sm text-slate-400 mt-3">
          Start a QR Session to begin attendance.
        </p>
      </div>
    );
  }

  const sessionRecords = attendanceRecords.filter(
    (r) => r.sessionId === activeSession.sessionId
  );

  const presentCount = sessionRecords.filter(
    (r) => r.status === "present"
  ).length;

  const lateCount = sessionRecords.filter(
    (r) => r.status === "late"
  ).length;

  const rotationProgress =
    (rotationCountdown / 30) * 100;

  const mins = Math.floor(sessionCountdown / 60);
  const secs = sessionCountdown % 60;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

      {/* QR Section */}

      <div className="lg:col-span-6 glass-panel p-6 flex flex-col items-center">

        <div className="flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-blue-900/20 border border-blue-500/30">

          <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />

          <span className="text-xs text-blue-300 font-semibold">
            Dynamic QR • Refreshes Every 30 Seconds
          </span>

        </div>

        <div className="bg-white p-5 rounded-2xl shadow-lg">
          <canvas ref={canvasRef} />
        </div>

        <div className="w-full mt-6">

          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>QR Rotation</span>
            <span>{rotationCountdown}s</span>
          </div>

          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">

            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-1000"
              style={{
                width: `${rotationProgress}%`,
              }}
            />

          </div>

        </div>

        <div className="mt-6 flex items-center gap-2 text-xs text-emerald-400">

          <ShieldCheck className="w-4 h-4" />

          Anti Screenshot Protected QR

        </div>

      </div>

      {/* Session Details */}

      <div className="lg:col-span-6 space-y-6">

        <div className="glass-panel p-6">

          <div className="flex justify-between">

            <div>

              <div className="text-xs text-blue-400 font-semibold uppercase">
                {activeSession.branch} • Year {activeSession.year} • Section{" "}
                {activeSession.section}
              </div>

              <h2 className="text-2xl font-bold mt-2 text-white">
                {activeSession.subject}
              </h2>

              <p className="text-slate-400 text-sm mt-1">
                Faculty : {activeSession.facultyName}
              </p>

              <p className="text-slate-400 text-sm">
                Room : {activeSession.room}
              </p>

            </div>

            <div className="text-right">

              <div className="text-3xl font-mono text-amber-400">

                {mins.toString().padStart(2, "0")}:
                {secs.toString().padStart(2, "0")}

              </div>

              <div className="text-xs text-slate-400">
                Time Remaining
              </div>

            </div>

          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">

            <div className="bg-slate-800 rounded-xl p-4 text-center">

              <div className="text-2xl font-bold text-emerald-400">
                {presentCount}
              </div>

              <div className="text-xs text-slate-400">
                Present
              </div>

            </div>

            <div className="bg-slate-800 rounded-xl p-4 text-center">

              <div className="text-2xl font-bold text-amber-400">
                {lateCount}
              </div>

              <div className="text-xs text-slate-400">
                Late
              </div>

            </div>

            <div className="bg-slate-800 rounded-xl p-4 text-center">

              <div className="text-2xl font-bold text-blue-400">
                {geofence.radiusMeters}m
              </div>

              <div className="text-xs text-slate-400">
                GPS Radius
              </div>

            </div>

          </div>

        </div>

        {/* Attendance List */}

        <div className="glass-panel p-6">

          <div className="flex items-center gap-2 mb-4">

            <Users className="w-5 h-5 text-blue-400" />

            <h3 className="font-bold text-white">
              Live Attendance ({sessionRecords.length})
            </h3>

          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto">

            {sessionRecords.length === 0 ? (

              <div className="text-center text-slate-500 py-8">
                Waiting for Students...
              </div>

            ) : (

              sessionRecords.map((student) => (

                <div
                  key={student.recordId}
                  className="flex justify-between items-center bg-slate-800 rounded-xl p-3"
                >

                  <div>

                    <div className="font-semibold text-white">
                      {student.studentName}
                    </div>

                    <div className="text-xs text-slate-400">
                      {student.hallTicketNo}
                    </div>

                  </div>

                  <div className="text-right">

                    <div
                      className={`text-xs px-3 py-1 rounded-full font-semibold ${
                        student.status === "present"
                          ? "bg-emerald-700 text-white"
                          : student.status === "late"
                          ? "bg-amber-600 text-white"
                          : "bg-red-700 text-white"
                      }`}
                    >
                      {student.status.toUpperCase()}
                    </div>

                    <div className="text-[11px] text-slate-400 mt-1">
                      {new Date(student.markedAt).toLocaleTimeString()}
                    </div>

                  </div>

                </div>

              ))

            )}

          </div>

        </div>

      </div>

    </div>
  );
};