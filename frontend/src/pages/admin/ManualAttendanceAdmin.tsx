import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAttendance } from '../../context/AttendanceContext';
import { AttendanceStatus } from '../../types/attendance';
import { Edit3, CheckCircle2, ShieldCheck, History } from 'lucide-react';

export const ManualAttendanceAdmin: React.FC = () => {
  const { approvedStudents, currentUser } = useAuth();
  const { recordManualAttendance, auditLogs } = useAttendance();

  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [reason, setReason] = useState('Camera hardware malfunction on student mobile device');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const student = approvedStudents.find(s => s.uid === selectedStudentId);
    if (!student) return;

    recordManualAttendance(student.uid, status, reason, currentUser.name, student);

    setSuccessMsg(`Successfully recorded manual attendance override for ${student.name} (${student.hallTicketNo}) as ${status.toUpperCase()}.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="max-w-[1440px] mx-auto w-full space-y-6">
      
      {/* Banner */}
      <div className="card-elevation p-6">
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent-muted border border-accent/20 text-accent font-heading">
          Administrator Override
        </span>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-1.5 tracking-tight font-heading">Manual Attendance Override Center</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Provides manual override fallback for browser, camera, GPS, or connectivity exceptions. All actions generate immutable audit logs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Override Form (5 cols) */}
        <div className="lg:col-span-5 card-elevation p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-white/[0.06] pb-3 font-heading">
            <Edit3 className="w-4 h-4 text-accent" />
            Record Manual Entry
          </h3>

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-accent-muted border border-accent/30 text-accent text-xs font-semibold flex items-center gap-2 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleManualSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Select Approved Student</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                required
                className="input-premium text-xs"
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
              <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Attendance Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
                className="input-premium text-xs"
              >
                <option value="present">PRESENT</option>
                <option value="late">LATE</option>
                <option value="absent">ABSENT</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Audit Reason for Manual Override</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={3}
                className="input-premium text-xs focus:ring-accent"
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full justify-center py-2.5 shadow-sm hover:shadow-md transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Commit Manual Override</span>
            </button>
          </form>
        </div>

        {/* Audit Log (7 cols) */}
        <div className="lg:col-span-7 card-elevation p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <History className="w-4 h-4 text-slate-500" />
            Audit Trail
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[550px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Overridden By</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No manual overrides recorded in this session.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log, idx) => (
                    <tr key={log.logId || log.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                        {log.details?.studentName || log.user || 'Student'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                          {log.details?.status || log.action || 'MODIFIED'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 text-[11px] max-w-[150px] truncate" title={log.details?.reason || log.action}>
                        {log.details?.reason || log.action}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{log.performedBy || 'Admin'}</td>
                      <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};
