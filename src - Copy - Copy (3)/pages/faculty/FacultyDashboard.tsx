import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAttendance } from '../../context/AttendanceContext';
import { StatCard } from '../../components/common/StatCard';
import { QRGenerator } from '../../components/qr/QRGenerator';
import { Users, CheckCircle2, Clock, XCircle, Search, QrCode, PlusCircle, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

export const FacultyDashboard: React.FC = () => {
  const { currentUser, approvedStudents } = useAuth();
  const { activeSession, attendanceRecords } = useAttendance();
  const [search, setSearch] = useState('');

  const assignedSections = currentUser?.assignedSections || ["CSE-A", "CSE-B"];
  
  // Filter records for faculty's assigned branch/sections
  const facultyRecords = attendanceRecords.filter(r => 
    assignedSections.some(sec => sec.includes(r.section) || r.branch === currentUser?.assignedBranch)
  );

  const presentCount = facultyRecords.filter(r => r.status === 'present').length;
  const lateCount = facultyRecords.filter(r => r.status === 'late').length;
  const absentCount = facultyRecords.filter(r => r.status === 'absent').length;
  const total = presentCount + lateCount + absentCount;
  const pct = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;

  const filteredStudents = approvedStudents.filter(s => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.hallTicketNo && s.hallTicketNo.toLowerCase().includes(q)) ||
      (s.section && s.section.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase">
            Faculty Workspace • {currentUser?.department}
          </span>
          <h2 className="text-2xl font-extrabold text-white mt-2">
            Welcome, {currentUser?.name}
          </h2>
          <p className="text-xs text-slate-400">
            Assigned Sections: <span className="font-semibold text-white">{assignedSections.join(', ')}</span>
          </p>
        </div>

        <Link
          to="/faculty/sessions"
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Launch Classroom QR Session
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Assigned Students"
          value={approvedStudents.length}
          subtitle="Enrolled in Section"
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="Section Present"
          value={presentCount}
          subtitle="QR + GPS Verified"
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          title="Section Late"
          value={lateCount}
          subtitle="Cutoff Grace Period"
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Attendance Rate"
          value={`${pct}%`}
          subtitle="Overall Percentage"
          icon={BookOpen}
          color="purple"
        />
      </div>

      {/* Active Session Display */}
      <QRGenerator />

      {/* Student List & Attendance History */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-base font-bold text-white">Section Student Roster & Live Status</h3>
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Student Name / HT No..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Hall Ticket No</th>
                <th className="py-3 px-4">Branch / Sec</th>
                <th className="py-3 px-4">Latest Session Record</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {filteredStudents.map(s => {
                const lastRec = facultyRecords.find(r => r.studentId === s.uid);
                return (
                  <tr key={s.uid} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-semibold text-white">{s.name}</td>
                    <td className="py-3 px-4 font-mono">{s.hallTicketNo}</td>
                    <td className="py-3 px-4">{s.branch} - {s.section} ({s.year} Yr)</td>
                    <td className="py-3 px-4 text-slate-400">
                      {lastRec ? `${lastRec.subject} (${new Date(lastRec.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : 'No Recent Activity'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                        lastRec?.status === 'present' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        lastRec?.status === 'late' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {lastRec ? lastRec.status : 'NOT MARKED'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
