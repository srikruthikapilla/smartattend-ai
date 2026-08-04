import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAttendance } from '../../context/AttendanceContext';
import { StatCard } from '../../components/common/StatCard';
import { QRScannerModal } from '../../components/qr/QRScannerModal';
import FaceEnrollmentModal from "../../components/face/FaceEnrollmentModal";
import { getBrowserFingerprint } from '../../utils/deviceFingerprint';
import { GraduationCap, QrCode, CheckCircle2, Clock, Percent, AlertTriangle, ShieldCheck, Sparkles, Smartphone, Scan } from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { attendanceRecords, activeSession } = useAttendance();

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);

  if (!currentUser) return null;

  const currentDevice = getBrowserFingerprint();

  const myRecords = attendanceRecords.filter(r => r.studentId === currentUser.uid);
  const presentCount = myRecords.filter(r => r.status === 'present').length;
  const lateCount = myRecords.filter(r => r.status === 'late').length;
  const total = myRecords.length;
  const myPct = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 100;

  return (
    <div className="space-y-6">
      
      {/* Student Header */}
      <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase">
              Student Workspace
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
              currentUser.status === 'approved' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
            }`}>
              Status: {currentUser.status}
            </span>
          </div>

          <h2 className="text-2xl font-extrabold text-white mt-2">
            {currentUser.name}
          </h2>
          <p className="text-xs text-slate-400">
            Hall Ticket: <span className="font-mono font-bold text-amber-400">{currentUser.hallTicketNo}</span> • Branch: {currentUser.branch} • Year {currentUser.year} • Sec {currentUser.section}
          </p>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsFaceModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white font-semibold text-xs border border-purple-800/40 transition flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            {currentUser.faceEnrollmentStatus === 'enrolled' ? 'Re-enroll Face Biometrics' : 'Enroll Face Biometrics'}
          </button>

          <button
            onClick={() => setIsScannerOpen(true)}
            disabled={currentUser.status !== 'approved'}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            Scan Attendance QR
          </button>
        </div>
      </div>

      {/* Security Status Cards (Face AI & Trusted Device) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Face AI Card */}
        <div className="glass-panel p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-800 text-purple-400">
              <Scan className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400">AI Face Recognition Status</div>
              <div className="text-sm font-bold text-white mt-0.5">
                {currentUser.faceEnrollmentStatus === 'enrolled' ? 'Enrolled (128-d Vector)' : 'Pending Facial Enrollment'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsFaceModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-purple-900/60 text-purple-300 text-xs font-bold hover:bg-purple-800 transition"
          >
            {currentUser.faceEnrollmentStatus === 'enrolled' ? 'Manage' : 'Enroll'}
          </button>
        </div>

        {/* Trusted Device Card */}
        <div className="glass-panel p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-xl bg-blue-950/60 border border-blue-800 text-blue-400">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400">Registered Trusted Device</div>
              <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5">
                {currentUser.trustedDeviceId || currentDevice.fingerprint}
              </div>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold uppercase">
            Active
          </span>
        </div>

      </div>

      {/* Pending Approval Warning */}
      {currentUser.status !== 'approved' && (
        <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-700 text-amber-200 text-xs flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-white text-sm">Account Approval Pending</h4>
            <p>
              Your student account must be approved by an SBIT Administrator before you can submit QR attendance scans.
            </p>
          </div>
        </div>
      )}

      {/* Active Session Notification Card */}
      {activeSession && activeSession.status === 'active' && (
        <div className="glass-panel p-5 border-l-4 border-l-emerald-500 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-xs font-bold text-emerald-400 uppercase">Live Session Active Now</span>
            </div>
            <h3 className="text-lg font-bold text-white mt-1">{activeSession.subject}</h3>
            <p className="text-xs text-slate-400">Faculty: {activeSession.facultyName} • Section {activeSession.section}</p>
          </div>

          <button
            onClick={() => setIsScannerOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition"
          >
            Mark Now
          </button>
        </div>
      )}

      {/* Personal Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Personal Attendance %"
          value={`${myPct}%`}
          subtitle="Target Criteria: >=75%"
          icon={Percent}
          color="emerald"
        />
        <StatCard
          title="Sessions Attended"
          value={presentCount}
          subtitle="Verified via QR + GPS + Face"
          icon={CheckCircle2}
          color="blue"
        />
        <StatCard
          title="Late Arrivals"
          value={lateCount}
          subtitle="After 15m Grace Period"
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Total Recorded"
          value={total}
          subtitle="Total Class Sessions"
          icon={GraduationCap}
          color="purple"
        />
      </div>

      {/* Attendance Log History Table */}
      <div className="glass-panel p-6 space-y-4">
        <h3 className="text-base font-bold text-white">My Attendance History</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Faculty</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Verification Method</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {myRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No attendance records found yet. Click 'Scan Attendance QR' when in class!
                  </td>
                </tr>
              ) : (
                myRecords.map(rec => (
                  <tr key={rec.recordId} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-semibold text-white">{rec.subject}</td>
                    <td className="py-3 px-4">{rec.facultyName}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(rec.markedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      {rec.verificationMethod === 'qr_gps' ? `QR + GPS + Face AI (${rec.gpsDistanceMeters || 0}m)` : 'Manual Override'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                        rec.status === 'present' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Scanner Camera Modal */}
      <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} />

      {/* Face Enrollment Modal */}
      <FaceEnrollmentModal isOpen={isFaceModalOpen} onClose={() => setIsFaceModalOpen(false)} />

    </div>
  );
};
