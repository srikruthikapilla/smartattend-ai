import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAttendance } from '../../context/AttendanceContext';
import { StatCard } from '../../components/common/StatCard';
import { QRGenerator } from '../../components/qr/QRGenerator';
import { GPSConfigModal } from '../../components/gps/GPSConfigModal';
import {
  Users,
  UserCheck,
  Building2,
  QrCode,
  CheckCircle2,
  Clock,
  XCircle,
  Percent,
  Search,
  MapPin,
  PlusCircle,
  ShieldCheck,
  Edit3
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminDashboard: React.FC = () => {
  const { users, pendingStudents } = useAuth();
  const { activeSession, attendanceRecords, geofence } = useAttendance();

  const [searchQuery, setSearchQuery] = useState('');
  const [isGPSModalOpen, setIsGPSModalOpen] = useState(false);

  // Computed metrics
  const totalStudents = users.filter(u => u.role === 'student' && u.status === 'approved').length;
  const totalFaculty = users.filter(u => u.role === 'faculty').length;
  const totalDepartments = 7; // CSE, ECE, EEE, MECH, CIVIL, IT, AIML

  const activeRecords = activeSession
    ? attendanceRecords.filter(r => r.sessionId === activeSession.sessionId)
    : attendanceRecords;

  const presentCount = activeRecords.filter(r => r.status === 'present').length;
  const lateCount = activeRecords.filter(r => r.status === 'late').length;
  const absentCount = activeRecords.filter(r => r.status === 'absent').length;
  const totalScanned = presentCount + lateCount + absentCount;

  const attendancePct = totalScanned > 0 ? Math.round(((presentCount + lateCount) / totalScanned) * 100) : 0;

  // Filtered student list for search box
  const filteredRecords = attendanceRecords.filter(rec => {
    const q = searchQuery.toLowerCase();
    return (
      rec.studentName.toLowerCase().includes(q) ||
      rec.hallTicketNo.toLowerCase().includes(q) ||
      rec.branch.toLowerCase().includes(q) ||
      rec.section.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glass-panel p-6">
        <div>
          <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider">
            SBIT Enterprise Command Center
          </span>
          <h2 className="text-2xl font-extrabold text-white light:text-slate-900 mt-2">
            Realtime Campus Attendance Analytics
          </h2>
          <p className="text-xs text-slate-400">
            Swarna Bharathi Institute of Science & Technology • Live GPS Geofence ({geofence.radiusMeters}m radius active)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsGPSModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition flex items-center gap-2"
          >
            <MapPin className="w-4 h-4 text-blue-400" />
            GPS Radius Settings
          </button>

          <Link
            to="/admin/qr-session"
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Start QR Session
          </Link>
        </div>
      </div>

      {/* Real-time Statistics Grid (8 Key Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={totalStudents}
          subtitle="Approved on Campus"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Total Faculty"
          value={totalFaculty}
          subtitle="Across 7 Departments"
          icon={UserCheck}
          color="indigo"
        />
        <StatCard
          title="Active Sessions"
          value={activeSession && activeSession.status === 'active' ? '1 Active' : '0 Inactive'}
          subtitle={activeSession?.subject || 'No Session'}
          icon={QrCode}
          color="amber"
        />
        <StatCard
          title="Attendance Rate"
          value={`${attendancePct}%`}
          subtitle="Present + Late Ratio"
          icon={Percent}
          color="purple"
        />

        <StatCard
          title="Present Students"
          value={presentCount}
          subtitle="Verified via QR/GPS"
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          title="Late Students"
          value={lateCount}
          subtitle="Recorded >15m cutoff"
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Absent Students"
          value={absentCount}
          subtitle="Unverified in Session"
          icon={XCircle}
          color="red"
        />
        <StatCard
          title="Pending Approvals"
          value={pendingStudents.length}
          subtitle="Requires Admin Action"
          icon={ShieldCheck}
          color="blue"
        />
      </div>

      {/* Active QR Session Display Component */}
      <QRGenerator />

      {/* Realtime Attendance Log & Student Search Filter */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-white light:text-slate-900">
              Live Attendance Audit Stream
            </h3>
            <p className="text-xs text-slate-400">Search student name, hall ticket number, branch or section</p>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Name, HT No, Branch, Sec..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Audit Stream Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Hall Ticket No</th>
                <th className="py-3 px-4">Branch / Sec</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No matching attendance records found.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(rec => (
                  <tr key={rec.recordId} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-semibold text-white">{rec.studentName}</td>
                    <td className="py-3 px-4 font-mono">{rec.hallTicketNo}</td>
                    <td className="py-3 px-4">{rec.branch} - {rec.section} ({rec.year} Yr)</td>
                    <td className="py-3 px-4">{rec.subject}</td>
                    <td className="py-3 px-4">
                      {new Date(rec.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rec.verificationMethod === 'qr_gps' ? 'bg-blue-950 text-blue-300' : 'bg-purple-950 text-purple-300'
                      }`}>
                        {rec.verificationMethod === 'qr_gps' ? `QR+GPS (${rec.gpsDistanceMeters || 0}m)` : 'Manual Override'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                        rec.status === 'present' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        rec.status === 'late' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                        'bg-red-950 text-red-400 border border-red-800'
                      }`}>
                        {rec.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* GPS Settings Modal */}
      <GPSConfigModal isOpen={isGPSModalOpen} onClose={() => setIsGPSModalOpen(false)} />

    </div>
  );
};
