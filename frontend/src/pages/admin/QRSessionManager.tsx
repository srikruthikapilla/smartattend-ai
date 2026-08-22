import React, { useState } from "react";
import { useAttendance } from "../../context/AttendanceContext";
import { QRGenerator } from "../../components/qr/QRGenerator";
import { Play, StopCircle, Radio, Clock, MapPin, Layers, BookOpen, Building2 } from "lucide-react";

export const QRSessionManager: React.FC = () => {
  const { startSession, activeSession, terminateSession, geofence } = useAttendance();

  const [sessionTitle, setSessionTitle] = useState("Daily Academic Lecture Session");
  const [branch, setBranch] = useState("CSE");
  const [section, setSection] = useState("A");
  const [year, setYear] = useState(3);
  const [room, setRoom] = useState("Lab-201");
  const [duration, setDuration] = useState(60);

  const handleStart = () => {
    startSession({
      sessionTitle,
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
    <div className="max-w-[1440px] mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white tracking-tight">
            Dynamic QR Session Manager
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Generate and broadcast time-bound, cryptographically encrypted QR codes for classroom attendance.
          </p>
        </div>
        {activeSession && (
          <button
            onClick={terminateSession}
            className="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm"
          >
            <StopCircle className="w-4 h-4" />
            End Active Session
          </button>
        )}
      </div>

      {activeSession ? (
        <div className="space-y-6">
          {/* Active Banner */}
          <div className="bg-white dark:bg-slate-900 border border-teal-500/30 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-4 h-4">
                <div className="absolute inset-0 bg-teal-500 rounded-full"></div>
                <div className="absolute inset-0 bg-teal-500 rounded-full animate-ping"></div>
              </div>
              <div>
                <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
                  Session Broadcasting Live
                </span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{activeSession.sessionTitle || `${activeSession.branch} Session`}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activeSession.branch} • Section {activeSession.section} • Year {activeSession.year} • {activeSession.room || "Campus Hall"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-teal-500" /> Geofence: {geofence.radiusMeters}m
              </span>
            </div>
          </div>

          {/* QR Generator Component */}
          <QRGenerator />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Configuration Form (7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
              <Radio className="w-5 h-5 text-slate-900 dark:text-white" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Session Setup & Parameters</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Session Title / Topic
                </label>
                <div className="relative">
                  <BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:border-slate-900 dark:focus:border-white focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10 outline-none transition-all"
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    placeholder="e.g. Daily Morning Academic Session"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Branch / Dept
                  </label>
                  <select
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:border-slate-900 dark:focus:border-white outline-none transition-all"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  >
                    <option value="CSE">CSE</option>
                    <option value="ECE">ECE</option>
                    <option value="EEE">EEE</option>
                    <option value="MECH">MECH</option>
                    <option value="CIVIL">CIVIL</option>
                    <option value="IT">IT</option>
                    <option value="AIML">AIML</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Academic Year
                  </label>
                  <select
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:border-slate-900 dark:focus:border-white outline-none transition-all"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  >
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Section
                  </label>
                  <select
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:border-slate-900 dark:focus:border-white outline-none transition-all"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                  >
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                    <option value="D">Section D</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Room / Lab Location
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:border-slate-900 dark:focus:border-white outline-none transition-all"
                      value={room}
                      onChange={(e) => setRoom(e.target.value)}
                      placeholder="e.g. Lab-201, Seminar Hall B"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Session Duration (Mins)
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="number"
                      min={10}
                      max={180}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:border-slate-900 dark:focus:border-white outline-none transition-all"
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleStart}
                className="w-full py-3.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-sm mt-4"
              >
                <Play className="w-4 h-4 fill-current" />
                Launch Live QR Attendance Broadcast
              </button>
            </div>
          </div>

          {/* Security & Protocol Info (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Anti-Proxy Security Enforcement
              </h3>
              <ul className="space-y-3 text-xs text-slate-500 dark:text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 flex-shrink-0"></span>
                  <span><strong>30-Second Dynamic Refresh:</strong> QR payloads auto-regenerate with HMAC signatures to defeat screenshots and screen shares.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 flex-shrink-0"></span>
                  <span><strong>Geofenced GPS Validation:</strong> Student check-ins are restricted to a {geofence.radiusMeters}m radius around campus.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 flex-shrink-0"></span>
                  <span><strong>Projector Kiosk Mode:</strong> Fullscreen mode with live anti-proxy watermarks and real-time attendance counter.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};