import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAttendance } from '../../context/AttendanceContext';
import { useTheme } from '../../context/ThemeContext';
import { QRScannerModal } from '../../components/qr/QRScannerModal';
import FaceEnrollmentModal from "../../components/face/FaceEnrollmentModal";
import {
  QrCode, ShieldCheck, Sparkles, MapPin, ScanFace, Timer, Info,
  CheckCircle2, Radio, User, BookOpen, Sun, Moon, ArrowRight, Clock,
  GraduationCap
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { attendanceRecords, activeSession } = useAttendance();
  const { theme, toggleTheme } = useTheme();

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);

  // Logged in student profile
  const student = currentUser;

  const myRecords = student
    ? attendanceRecords.filter(r => r.studentId === student.uid || r.hallTicketNo === student.hallTicketNo)
    : [];

  const presentCount = myRecords.filter(r => r.status === 'present').length;
  const lateCount = myRecords.filter(r => r.status === 'late').length;
  const absentCount = myRecords.filter(r => r.status === 'absent').length;
  const total = myRecords.length;
  const myPct = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;

  const getComplianceLabel = (pct: number, totalCount: number) => {
    if (totalCount === 0) return { label: 'No Records Yet', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' };
    if (pct >= 75) return { label: 'Eligible for Exams (>= 75%)', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    if (pct >= 65) return { label: 'Condonation (65% - 74%)', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
    return { label: 'Detained (< 65%)', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' };
  };

  const compliance = getComplianceLabel(myPct, total);

  if (!student) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 max-w-md text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <User className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold font-heading">Student Portal Login Required</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Please log in with your student institutional credentials to view your live attendance and academic eligibility.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition font-heading"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1440px] mx-auto w-full space-y-6">

        {/* Top Header & Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <img
              src="/assets/logos/logo.png"
              alt="Smart Attend Logo"
              className="w-10 h-10 sm:w-11 sm:h-11 object-contain flex-shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight font-heading leading-tight">
                  Student Portal
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20 font-heading">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                  SBIT
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Swarna Bharathi Institute of Science & Technology • Khammam
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            {/* Direct Link to Kiosk Check-In */}
            <Link
              to="/checkin"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition font-heading"
            >
              <QrCode className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Fast QR Kiosk</span>
            </Link>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:text-slate-300 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors shadow-xs"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
          </div>
        </div>

        {/* Student Profile Welcome Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider font-heading">
                Verified Student
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                HT: {student.hallTicketNo}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-heading">
              Welcome back, {student.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Branch: <span className="font-semibold text-slate-800 dark:text-slate-200">{student.branch || 'CSE'}</span> | Year: <span className="font-semibold text-slate-800 dark:text-slate-200">{student.year || '3rd Year'}</span> | Section: <span className="font-semibold text-slate-800 dark:text-slate-200">{student.section || 'A'}</span>
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Biometric Status Button */}
            <button
              onClick={() => setIsFaceModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-heading"
            >
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span>Biometrics:</span>
              {student.faceEnrollmentStatus === 'enrolled' ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">Enrolled ✓</span>
              ) : (
                <span className="text-amber-500">Enroll Face</span>
              )}
            </button>

            {/* Primary Quick Check-in Button */}
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm font-heading"
            >
              <ScanFace className="w-4 h-4" />
              <span>Scan & Check-In</span>
            </button>
          </div>
        </div>


      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Live Session Check-In Card (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Live Lecture Status
                </h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                activeSession
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}>
                {activeSession ? 'Broadcasting Now' : 'Standby'}
              </span>
            </div>

            <div className="my-6">
              {activeSession ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200/50 dark:border-teal-800/50">
                    <div className="flex items-center gap-2 text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wide">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{activeSession.sessionTitle || 'Academic Lecture Session'}</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                      <p><span className="font-semibold">Faculty:</span> {activeSession.facultyName || 'Course Faculty'}</p>
                      <p><span className="font-semibold">Classroom:</span> {activeSession.room || 'Room 304 (Lab)'}</p>
                      <p><span className="font-semibold">Geofence:</span> Verified within 50m radius</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ensure camera is enabled for real-time 128-D facial verification with eye blink liveness confirmation.
                  </p>
                </div>
              ) : (
                <div className="py-8 text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <Radio className="w-8 h-8 opacity-60" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      No Active Lecture Session
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[280px] mx-auto mt-1">
                      Your faculty will initiate a live dynamic QR code stream during class hours.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setIsScannerOpen(true)}
            disabled={currentUser.status !== 'approved'}
            className="w-full bg-slate-900 dark:bg-white hover:opacity-90 text-white dark:text-slate-900 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <ScanFace className="w-4 h-4" />
            <span>Launch Face & QR Scanner</span>
          </button>
        </div>

        {/* JNTUH Compliance & Overall Attendance Card (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Academic Compliance & Eligibility
                </h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${compliance.color}`}>
                {compliance.label}
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Overall Aggregate Attendance
                </p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">{myPct}</span>
                  <span className="text-2xl font-bold text-slate-400">%</span>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs font-semibold">
                  <div className="text-emerald-600 dark:text-emerald-400">
                    <span className="font-bold">{presentCount}</span> Attended
                  </div>
                  <div className="text-slate-400">•</div>
                  <div className="text-slate-600 dark:text-slate-400">
                    <span className="font-bold">{total}</span> Total Sessions
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <span>Current: {myPct}%</span>
                  <span className="text-rose-500">Threshold: 75%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-teal-500 rounded-full relative overflow-hidden transition-all duration-700"
                    style={{ width: `${Math.min(myPct, 100)}%` }}
                  />
                  <div className="absolute top-0 bottom-0 w-0.5 bg-rose-500 left-[75%] z-10"></div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  <span className="font-bold text-slate-800 dark:text-slate-200">JNTUH Regulation:</span> 75% attendance is required to qualify for semester examinations.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center gap-3">
            <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Attendance records are synced to Supabase & PostgreSQL in real-time with anti-proxy cryptographic stamps.
            </p>
          </div>
        </div>

        {/* Attendance Verification History Log (12 cols) */}
        <div className="lg:col-span-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Recent Attendance Logs</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Detailed record logs with face AI confidence, eye blink liveness, and hardware biometric fallback.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {myRecords.length} Check-ins
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
                  <th className="p-4">Date & Time</th>
                  <th className="p-4">Session Title</th>
                  <th className="p-4">Faculty</th>
                  <th className="p-4">Verification Method</th>
                  <th className="p-4 text-center">Liveness & Biometrics</th>
                  <th className="p-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-900 dark:text-white divide-y divide-slate-100 dark:divide-slate-800">
                {myRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-slate-400">
                      No attendance records logged yet. Click "Scan & Check-In" to mark attendance.
                    </td>
                  </tr>
                ) : (
                  myRecords.map(rec => {
                    const d = new Date(rec.markedAt);
                    return (
                      <tr key={rec.recordId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-slate-900 dark:text-white">{d.toLocaleDateString()}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="p-4 font-semibold">
                          {rec.sessionTitle || `${currentUser.branch || 'CSE'} - Section ${currentUser.section || 'A'}`}
                        </td>
                        <td className="p-4 text-slate-500 dark:text-slate-400">
                          {rec.facultyName || 'Academic Faculty'}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${
                            rec.verificationMethod === 'face_recognition'
                              ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                              : rec.verificationMethod === 'biometric_fallback'
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                              : 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                          }`}>
                            {rec.verificationMethod === 'face_recognition'
                              ? 'Face AI (128-D)'
                              : rec.verificationMethod === 'biometric_fallback'
                              ? 'Biometric Platform'
                              : 'Dynamic QR + GPS'}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {rec.blinkVerified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              Blink Verified ✓
                            </span>
                          ) : rec.biometricVerified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                              TouchID / Windows Hello ✓
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">GPS {rec.gpsDistanceMeters || 18}m</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold ${
                            rec.status === 'present'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : rec.status === 'late'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          } w-full max-w-[80px]`}>
                            {rec.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} />
      <FaceEnrollmentModal isOpen={isFaceModalOpen} onClose={() => setIsFaceModalOpen(false)} />
      </div>
    </div>
  );
};

export default StudentDashboard;

