import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import {
  Radio, Users, ShieldCheck, Clock, MapPin, Eye, Fingerprint,
  Sparkles, CheckCircle2, Search, ArrowUpRight, UserCheck, RefreshCw, UserX
} from 'lucide-react';
import { StudentAttendanceLookupModal } from '../components/attendance/StudentAttendanceLookupModal';

interface AttendanceRow {
  id: string;
  name: string;
  hallTicket: string;
  department: string;
  timestamp: string;
  method: string;
  status: string;
  blinkVerified?: boolean;
  similarity?: number;
  distanceM?: number;
  isNew?: boolean;
}

export const LiveAttendance: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [search, setSearch] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedStudentHt, setSelectedStudentHt] = useState<string | null>(null);

  const fetchRecords = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch('/api/attendance/records');
      if (res.ok) {
        const data = await res.json();
        if (data.records) {
          const mapped: AttendanceRow[] = data.records.map((r: any) => ({
            id: r.id,
            name: r.student_name || r.studentName || r.name || `Student (${r.hall_ticket_no || r.hallTicketNo || 'N/A'})`,
            hallTicket: (r.hall_ticket_no || r.hallTicketNo || r.hallTicket || r.student_id || 'N/A').toUpperCase(),
            department: r.branch || r.department || 'CSM',
            timestamp: r.marked_at || r.markedAt || r.timestamp || new Date().toISOString(),
            method: r.verification_method || r.verificationMethod || r.method || 'face_recognition',
            status: (r.status || 'present').toLowerCase(),
            blinkVerified: r.blink_verified ?? r.blinkVerified ?? false,
            similarity: r.face_match_confidence ?? r.faceMatchConfidence ?? r.similarity ?? 0.98,
            distanceM: r.gps_distance_meters ?? r.distanceM ?? 5
          }));
          setRecords(mapped);
        }
      }
    } catch (err) {
      console.warn('Attendance records fetch note:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 1. Initial Load & Socket.io setup
  useEffect(() => {
    fetchRecords();

    // Connect to Socket.io WebSocket
    const socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // On new attendance event from edge / checkin / faculty dashboard
    socket.on('attendance:new', (entry: any) => {
      const ht = (entry.hallTicket || entry.hall_ticket_no || entry.studentId || '').toUpperCase();
      const newRow: AttendanceRow = {
        id: entry.id || `rec_${Date.now()}`,
        name: entry.name || entry.student_name || entry.studentName || `Student (${ht})`,
        hallTicket: ht || 'N/A',
        department: entry.department || entry.branch || 'CSM',
        timestamp: entry.timestamp || entry.marked_at || entry.markedAt || new Date().toISOString(),
        method: entry.method || entry.verification_method || entry.verificationMethod || 'face_recognition',
        status: (entry.status || 'present').toLowerCase(),
        blinkVerified: entry.blinkVerified ?? entry.blink_verified ?? false,
        similarity: entry.similarity ?? entry.face_match_confidence ?? 0.98,
        distanceM: entry.distanceM ?? entry.gps_distance_meters ?? 5,
        isNew: true
      };

      setRecords(prev => [
        newRow,
        ...prev.filter(r => r.hallTicket !== newRow.hallTicket && r.id !== newRow.id).map(r => ({ ...r, isNew: false }))
      ]);
    });

    socket.on('attendance:delete', (data: any) => {
      const ht = (data.hallTicket || data.studentId || '').toUpperCase();
      if (ht) {
        setRecords(prev => prev.filter(r => r.hallTicket !== ht && r.id !== ht));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const filteredRecords = records.filter(r => {
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.hallTicket.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q) ||
      r.method.toLowerCase().includes(q)
    );
  });

  const presentCount = records.filter(r => r.status === 'present').length;
  const lateCount = records.filter(r => r.status === 'late').length;
  const blinkCount = records.filter(r => r.blinkVerified).length;

  const renderVerificationMethodBadge = (method: string) => {
    switch (method) {
      case 'biometric_fallback':
      case 'biometric_platform':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            <Fingerprint className="w-3.5 h-3.5 text-indigo-500" />
            <span>Biometrics</span>
          </span>
        );
      case 'manual':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <UserCheck className="w-3.5 h-3.5 text-slate-500" />
            <span>Faculty / Admin</span>
          </span>
        );
      case 'qr_gps':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
            <MapPin className="w-3.5 h-3.5 text-cyan-500" />
            <span>QR + GPS</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span>Face AI (128-D)</span>
          </span>
        );
    }
  };

  const renderStatusBadge = (status: string) => {
    if (status === 'late') {
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-heading">
          LATE
        </span>
      );
    }
    if (status === 'absent') {
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-heading">
          ABSENT
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 font-heading">
        PRESENT
      </span>
    );
  };

  return (
    <div className="max-w-[1440px] mx-auto w-full space-y-6">

      {/* Top Banner */}
      <div className="card-elevation p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-accent animate-ping' : 'bg-amber-500'}`}></span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-heading">
              {isConnected ? 'Live WebSocket Stream Connected' : 'Connecting to Attendance Stream...'}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-heading">
            Live Attendance Dashboard
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-sans">
            Real-time feed of campus check-ins with Face AI matching, eye blink liveness, and geofence tracking.
          </p>
        </div>

        {/* Stats Pills & Refresh */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-surface-dim border border-slate-200 dark:border-slate-800 text-xs font-bold">
            <Users className="w-3.5 h-3.5 text-accent" />
            <span>Total Marked: <span className="text-accent">{records.length}</span></span>
          </div>
          {lateCount > 0 && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-600 dark:text-amber-400">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Late: {lateCount}</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-surface-dim border border-slate-200 dark:border-slate-800 text-xs font-bold">
            <Eye className="w-3.5 h-3.5 text-accent" />
            <span>Blink Verified: <span className="text-accent">{blinkCount}</span></span>
          </div>
          <button
            onClick={fetchRecords}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-card-dark text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-dim transition"
            title="Refresh Records"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-accent' : ''}`} />
          </button>
        </div>
      </div>

      {/* Live Records Table */}
      <div className="card-elevation overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-accent animate-pulse" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">Incoming Attendance Stream</h3>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name, hall ticket..."
              className="input-premium pl-10 pr-3 py-1.5 text-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[680px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
                <th className="p-4">Student</th>
                <th className="p-4">Hall Ticket</th>
                <th className="p-4">Branch</th>
                <th className="p-4">Time</th>
                <th className="p-4">Verification Method</th>
                <th className="p-4 text-center">Liveness & GPS</th>
                <th className="p-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="text-xs text-slate-900 dark:text-white divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-xs text-slate-400">
                    <Radio className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-50" />
                    Waiting for student check-ins... Scanned attendance will stream in live.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const d = new Date(rec.timestamp);
                  return (
                    <tr
                      key={rec.id}
                      className={`transition-colors ${
                        rec.isNew
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/30 font-semibold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="p-4">
                        <div
                          onClick={() => setSelectedStudentHt(rec.hallTicket)}
                          className="font-bold text-slate-900 dark:text-white flex items-center gap-2 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                          title="Click to view full student report"
                        >
                          {rec.isNew && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                          )}
                          <span>{rec.name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => setSelectedStudentHt(rec.hallTicket)}
                          className="font-mono font-bold text-teal-600 dark:text-teal-400 hover:underline decoration-dotted underline-offset-2"
                        >
                          {rec.hallTicket}
                        </button>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300 font-semibold">
                        {rec.department}
                      </td>
                      <td className="p-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="p-4">
                        {renderVerificationMethodBadge(rec.method)}
                      </td>
                      <td className="p-4 text-center">
                        {rec.blinkVerified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            Blink Verified ✓
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">GPS {rec.distanceM || 5}m</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {renderStatusBadge(rec.status)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Attendance Lookup Modal */}
      <StudentAttendanceLookupModal
        isOpen={Boolean(selectedStudentHt)}
        onClose={() => setSelectedStudentHt(null)}
        initialHallTicket={selectedStudentHt || ''}
      />

    </div>
  );
};

export default LiveAttendance;
