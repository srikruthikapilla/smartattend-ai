import React, { useState } from "react";
import { useAttendance } from "../../context/AttendanceContext";
import { QRGenerator } from "../../components/qr/QRGenerator";

export const QRSessionManager: React.FC = () => {
  const { startSession, activeSession, terminateSession, geofence } =
    useAttendance();

  const [subject, setSubject] = useState("Data Structures");
  const [branch, setBranch] = useState("CSE");
  const [section, setSection] = useState("A");
  const [year, setYear] = useState(2);
  const [room, setRoom] = useState("Lab-201");
  const [duration, setDuration] = useState(60);

  const handleStart = () => {
    startSession({
      subject,
      facultyId: "faculty_201",
      facultyName: "Dr. K. V. S. Rama Rao",

      branch,
      section,
      year,

      room,

      durationMinutes: duration,

      radiusMeters: geofence.radiusMeters,
    });
  };

  return (
    <div className="space-y-6">

      <div className="glass-panel p-6 rounded-xl">

        <h2 className="text-2xl font-bold mb-6">
          QR Session Manager
        </h2>

        {activeSession ? (
  <div className="space-y-6">

    <div className="flex justify-between items-center">

      <div>

        <div className="text-green-400 text-xl font-bold">
          Session Active
        </div>

        <p className="text-slate-400 mt-1">
          {activeSession.subject}
        </p>

      </div>

      <button
        onClick={terminateSession}
        className="px-5 py-2 rounded bg-red-600 hover:bg-red-700"
      >
        End Session
      </button>

    </div>

    {/* QR Generator */}

    <QRGenerator />

  </div>
) : (
          <div className="space-y-4">

            <input
              className="input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
            />

            <input
              className="input"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />

            <input
              className="input"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            />

            <input
              className="input"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            />

            <input
              type="number"
              className="input"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />

            <input
              type="number"
              className="input"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />

            <button
              onClick={handleStart}
              className="px-5 py-2 rounded bg-blue-600"
            >
              Start QR Session
            </button>

          </div>
        )}

      </div>

    </div>
  );
};