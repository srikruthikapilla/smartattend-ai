import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAttendance } from '../../context/AttendanceContext';
import { AttendanceStatus } from '../../types/attendance';
import { Edit3, Search, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';

export const ManualAttendanceAdmin: React.FC = () => {
  const { approvedStudents, currentUser } = useAuth();
  const { activeSession, recordManualAttendance, auditLogs } = useAttendance();

  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [reason, setReason] = useState('Camera hardware malfunction on student mobile device');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const student = approvedStudents.find(s => s.uid === selectedStudentId);
    if (!student) return;

    const sessionId = activeSession ? activeSession.sessionId : `sess_manual_${Date.now()}`;
    recordManualAttendance(student, sessionId, status, reason, currentUser);

    setSuccessMsg(`Successfully recorded manual attendance override for ${student.name} (${student.hallTicketNo}) as ${status.toUpperCase()}.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="glass-panel p-6">
        <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase">
          Administrator Override
        </span>
        <h2 className="text-2xl font-extrabold text-white mt-1">Manual Attendance Override Center</h2>
        <p className="text-xs text-slate-400">
          Provides manual override fallback for browser, camera, GPS, or connectivity exceptions. All actions generate immutable audit logs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Override Form */}
        <div className="lg:col-span-5 glass-panel p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-purple-400" />
            Record Manual Entry
          </h3>

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-700 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Select Approved Student</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none"
              >
                <option value="">-- Choose Student --</option>
                {approvedStudents.map(s => (
                  <option key={s.uid} value={s.uid}>
                    {s.name} ({s.hallTicketNo}) - {s.branch}-{s.section}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Attendance Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none"
              >
                <option value="present">PRESENT</option>
                <option value="late">LATE</option>
                <option value="absent">ABSENT</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Audit Reason for Manual Override</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:border-purple-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={!selectedStudentId}
              className="w-full py-3 rounded-xl font-bold text-white text-sm bg-purple-600 hover:bg-purple-500 disabled:opacity-50 shadow-lg shadow-purple-600/30 transition flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              Submit Manual Attendance Entry
            </button>
          </form>

        </div>

        {/* Audit Log Stream */}
        <div className="lg:col-span-7 glass-panel p-6 space-y-4">
          <h3 className="text-base font-bold text-white">System Audit & Exception Log</h3>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {auditLogs.map(log => (
              <div key={log.logId} className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-purple-300">{log.action}</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="text-white">{log.details}</div>
                <div className="text-[10px] text-slate-400">
                  Logged By: <span className="font-semibold text-slate-300">{log.performedBy} ({log.performerRole})</span>
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>

    </div>
  );
};
