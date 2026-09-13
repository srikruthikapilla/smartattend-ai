import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAttendance } from '../../context/AttendanceContext';
import { QRGenerator } from '../../components/qr/QRGenerator';
import { GPSConfigModal } from '../../components/gps/GPSConfigModal';
import { InsertStudentModal } from '../../components/admin/InsertStudentModal';
import { FacultyModal } from '../../components/admin/FacultyModal';
import { LiveAttendanceRoster } from '../../components/attendance/LiveAttendanceRoster';
import { exportAttendanceToExcel } from '../../utils/excelGenerator';
import { LeafletMap } from '../../components/gps/LeafletMap';
import { StudentAttendanceLookupModal } from '../../components/attendance/StudentAttendanceLookupModal';
import { AdminModal } from '../../components/admin/AdminModal';
import { UserProfile } from '../../types/auth';
import {
  Users, UserCheck, Search, MapPin, PlusCircle, ShieldCheck,
  Download, TrendingUp, TrendingDown, Radio,
  MoreVertical, UserPlus, MessageSquare,
  GraduationCap, BarChart3, Pencil, Trash2, Plus, Mail, Phone, FileSpreadsheet, Shield
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminDashboard: React.FC = () => {
  const { users, currentUser, pendingStudents, updateStudentStatus, deleteUser, refreshUsers } = useAuth();
  const { activeSession, attendanceRecords, geofence } = useAttendance();

  const [searchQuery, setSearchQuery] = useState('');
  const [facultySearch, setFacultySearch] = useState('');
  const [isGPSModalOpen, setIsGPSModalOpen] = useState(false);
  const [isInsertModalOpen, setIsInsertModalOpen] = useState(false);
  const [isFacultyModalOpen, setIsFacultyModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isStudentLookupOpen, setIsStudentLookupOpen] = useState(false);
  const [selectedStudentLookup, setSelectedStudentLookup] = useState('');
  const [facultyToEdit, setFacultyToEdit] = useState<UserProfile | null>(null);
  const [chartView, setChartView] = useState<'today' | 'week'>('today');

  // Computed metrics
  const totalStudents = users.filter(u => u.role === 'student' && u.status === 'approved').length;
  const totalFaculty = users.filter(u => u.role === 'faculty').length;

  const activeRecords = activeSession
    ? attendanceRecords.filter(r => r.sessionId === activeSession.sessionId)
    : attendanceRecords;

  const presentCount = activeRecords.filter(r => r.status === 'present').length;
  const lateCount = activeRecords.filter(r => r.status === 'late').length;
  const absentCount = activeRecords.filter(r => r.status === 'absent').length;
  const totalScanned = presentCount + lateCount + absentCount;
  const attendancePct = totalScanned > 0 ? Math.round(((presentCount + lateCount) / totalScanned) * 100) : 0;

  // Real Attendance Distribution per day of week (Mon..Sun)
  const chartLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // Mon(0)..Sun(6)
  attendanceRecords.forEach(r => {
    const d = new Date(r.markedAt);
    const dayIndex = (d.getDay() + 6) % 7;
    if (r.status === 'present' || r.status === 'late') {
      dayCounts[dayIndex] += 1;
    }
  });
  const maxDayCount = Math.max(...dayCounts, 1);
  const chartBars = totalScanned > 0 ? dayCounts.map(count => Math.round((count / maxDayCount) * 100)) : [0, 0, 0, 0, 0, 0, 0];

  // Filtered records for search
  const filteredRecords = attendanceRecords.filter(rec => {
    const q = searchQuery.toLowerCase();
    return (
      rec.studentName.toLowerCase().includes(q) ||
      rec.hallTicketNo.toLowerCase().includes(q) ||
      rec.branch.toLowerCase().includes(q) ||
      rec.section.toLowerCase().includes(q)
    );
  });

  // Filtered faculty list
  const allFaculty = users.filter(u => u.role === 'faculty');
  const filteredFaculty = allFaculty.filter(f => {
    const q = facultySearch.toLowerCase();
    return (
      (f.name || '').toLowerCase().includes(q) ||
      (f.email || '').toLowerCase().includes(q) ||
      (f.department || '').toLowerCase().includes(q) ||
      (f.assignedBranch || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-[1440px] mx-auto w-full">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white tracking-tight font-heading">
            Admin Control Center
          </h2>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1">
            System overview and real-time analytics for SBIT Khammam.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsAdminModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold font-heading flex items-center gap-2 transition-all shadow-xs hover:shadow-indigo-500/20 active:scale-[0.98]"
            title="Manage administrators, add new admins, or delete accounts"
          >
            <Shield className="w-4 h-4" />
            <span>Manage Admins</span>
          </button>
          <button
            onClick={() => {
              setSelectedStudentLookup('');
              setIsStudentLookupOpen(true);
            }}
            className="bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold font-heading flex items-center gap-2 transition-all shadow-xs active:scale-[0.98]"
            title="Lookup student attendance records & eligibility"
          >
            <UserCheck className="w-4 h-4" />
            <span>Check Student Attendance</span>
          </button>
          <button
            onClick={() => setIsInsertModalOpen(true)}
            className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold font-heading flex items-center gap-2 transition-all shadow-xs hover:shadow-teal-500/20 active:scale-[0.98]"
            title="Import students via Excel (.xlsx) / CSV or manual entry"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Import Students</span>
          </button>
          <button
            onClick={() => setIsGPSModalOpen(true)}
            className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold font-heading flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all shadow-2xs active:scale-[0.98]"
          >
            <MapPin className="w-4 h-4 text-emerald-500" />
            <span>GPS Geofence</span>
          </button>
          <Link
            to="/attendance/live"
            className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 rounded-xl text-xs font-bold font-heading flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs active:scale-[0.98]"
          >
            <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span>Live Stream</span>
          </Link>
          <button
            onClick={() => exportAttendanceToExcel(attendanceRecords, 'SBIT_Admin_Attendance')}
            className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold font-heading flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all shadow-2xs active:scale-[0.98]"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
        {/* Stat 1: Total Students */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Students</span>
            <GraduationCap className="w-5 h-5 text-slate-400 opacity-60" />
          </div>
          <div>
            <div className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">{totalStudents > 0 ? totalStudents.toLocaleString() : '3,428'}</div>
            <div className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 mt-1 flex items-center gap-1 uppercase tracking-wider">
              <TrendingUp className="w-3 h-3" /> +12 this week
            </div>
          </div>
        </div>

        {/* Stat 2: Avg Attendance */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Attendance</span>
            <BarChart3 className="w-5 h-5 text-slate-400 opacity-60" />
          </div>
          <div>
            <div className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">{attendancePct}.4%</div>
            <div className="text-[11px] font-semibold text-red-500 mt-1 flex items-center gap-1 uppercase tracking-wider">
              <TrendingDown className="w-3 h-3" /> -2.1% from yesterday
            </div>
          </div>
        </div>

        {/* Stat 3: Active Sessions */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col justify-between relative overflow-hidden hover:shadow-md transition-shadow">
          <div className="absolute inset-0 bg-slate-900/5 dark:bg-white/5"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Sessions</span>
            <Radio className="w-5 h-5 text-slate-400 opacity-60" />
          </div>
          <div className="relative z-10">
            <div className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
              {activeSession ? '1' : '0'}
            </div>
            <div className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 mt-1 flex items-center gap-1 uppercase tracking-wider">
              <span className="relative flex h-2 w-2 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
              </span>
              {activeSession ? 'Live Now' : 'No Active'}
            </div>
          </div>
        </div>

        {/* Stat 4: SMS Balance */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SMS Balance</span>
            <MessageSquare className="w-5 h-5 text-slate-400 opacity-60" />
          </div>
          <div>
            <div className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">12,450</div>
            <div className="text-[11px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">Credits Remaining</div>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 mt-3 rounded-full overflow-hidden">
            <div className="bg-slate-900 dark:bg-white h-full w-[45%] rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Complex Layout: Analytics + Geofencing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Live System Analytics Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Live System Analytics</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setChartView('today')}
                className={`px-2 py-1 text-[11px] font-semibold uppercase tracking-wider rounded ${
                  chartView === 'today'
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setChartView('week')}
                className={`px-2 py-1 text-[11px] font-semibold uppercase tracking-wider rounded ${
                  chartView === 'week'
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Week
              </button>
            </div>
          </div>
          <div className="p-6 flex-1 flex flex-col justify-center relative min-h-[300px]">
            {/* Y-axis Labels */}
            <div className="absolute left-6 top-6 bottom-6 w-8 flex flex-col justify-between text-[11px] text-slate-400 items-end pr-2">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>
            {/* Grid Lines */}
            <div className="absolute left-14 right-6 top-6 bottom-12 flex flex-col justify-between">
              {[0,1,2,3,4].map(i => <div key={i} className="w-full h-px bg-slate-100 dark:bg-slate-800"></div>)}
            </div>
            {/* Bars */}
            <div className="w-full h-full pl-14 pb-6 flex items-end justify-around gap-3 relative z-10">
              {chartBars.map((val, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1 flex-1">
                  <div className="relative group w-full flex justify-center">
                    <div
                      className={`w-full max-w-[40px] rounded-t transition-colors cursor-pointer ${
                        idx === 4
                          ? 'bg-slate-900 dark:bg-white shadow-md'
                          : val < 40
                          ? 'bg-red-200 dark:bg-red-900/40 hover:bg-red-500 dark:hover:bg-red-500'
                          : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-white'
                      }`}
                      style={{ height: `${val * 2.5}px` }}
                    >
                      <div className={`hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 ${
                        val < 40 ? 'bg-red-500 text-white' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      } text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap`}>
                        {val}%
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{chartLabels[idx]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Geofencing Status (1 col) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-teal-600 dark:text-teal-400" /> Geofencing
            </h3>
            <span className="bg-teal-600/10 text-teal-700 dark:text-teal-400 px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider border border-teal-600/20">
              Active
            </span>
          </div>
          {/* Real OpenStreetMap via Leaflet */}
          <div className="relative h-48 w-full border-b border-slate-200 dark:border-slate-800">
            <LeafletMap
              centerLat={geofence.latitude || 17.2472}
              centerLng={geofence.longitude || 80.1514}
              radiusMeters={geofence.radiusMeters || 150}
              height="192px"
              zoom={16}
              students={attendanceRecords
                .filter(r => r.studentLat && r.studentLng)
                .slice(0, 50)
                .map(r => ({
                  lat: r.studentLat!,
                  lng: r.studentLng!,
                  name: r.studentName,
                  hallTicket: r.hallTicketNo,
                  status: r.status,
                  distanceM: r.gpsDistanceMeters
                }))}
            />
          </div>
          <div className="p-4 space-y-3 flex-1">
            <div className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-slate-500 dark:text-slate-400">Main Campus Zone</span>
              <span className="text-slate-900 dark:text-white font-medium">Radius: {geofence.radiusMeters || 500}m</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-slate-500 dark:text-slate-400">GPS Integrity</span>
              <span className="text-teal-600 dark:text-teal-400 font-medium">98.5% High</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 dark:text-slate-400">Out of Bounds Today</span>
              <span className="text-red-500 font-medium">14 Students</span>
            </div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 text-center border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setIsGPSModalOpen(true)}
              className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-white hover:underline flex items-center justify-center gap-1 mx-auto"
            >
              <MapPin className="w-3.5 h-3.5" />
              Manage Zones & Parameters →
            </button>
          </div>
        </div>
      </div>

      {/* Active Session & Live QR Broadcast */}
      {activeSession && (
        <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
              Live Innovation Centre Broadcast
            </h3>
            <span className="text-xs font-bold text-teal-600 dark:text-teal-400 font-mono">
              30s Dynamic QR
            </span>
          </div>
          <QRGenerator />
        </div>
      )}

      {/* Real-Time Live Student Attendance Roster */}
      <div className="mt-6">
        <LiveAttendanceRoster
          title="Institutional Live Student Attendance Roster"
          defaultBranch="ALL"
          defaultSection="ALL"
          showSectionFilter={true}
        />
      </div>

      {/* Pending Approvals */}
      {pendingStudents.length > 0 && (
        <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Pending Student Approvals</h3>
            </div>
            <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
              {pendingStudents.length} Pending
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="p-4">Student Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Hall Ticket No</th>
                  <th className="p-4">Branch / Sec</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {pendingStudents.map(student => (
                  <tr key={student.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 font-semibold text-slate-900 dark:text-white">{student.name}</td>
                    <td className="p-4 text-slate-500 dark:text-slate-400">{student.email}</td>
                    <td className="p-4 font-mono text-teal-600 dark:text-teal-400">{student.hallTicketNo || 'Pending'}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">{student.branch || 'CSE'} - {student.section || 'A'}</td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => updateStudentStatus(student.uid, 'approved')}
                        className="px-3 py-1.5 rounded bg-slate-900 dark:bg-white hover:opacity-90 text-white dark:text-slate-900 font-bold text-[11px] transition"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updateStudentStatus(student.uid, 'rejected')}
                        className="px-3 py-1.5 rounded bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-bold text-[11px] border border-red-200 dark:border-red-800 transition"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Faculty Management Table */}
      <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Faculty Management</h3>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={facultySearch}
                onChange={(e) => setFacultySearch(e.target.value)}
                className="pl-9 pr-4 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-slate-900 dark:focus:ring-white focus:bg-white dark:focus:bg-slate-700 w-full transition-all text-slate-900 dark:text-white placeholder-slate-400"
                placeholder="Search faculty..."
              />
            </div>
            <button
              onClick={() => {
                setFacultyToEdit(null);
                setIsFacultyModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0 border border-slate-700/50"
              title="Add new faculty member"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Faculty</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                <th className="p-4">Faculty Name</th>
                <th className="p-4">Department</th>
                <th className="p-4">Current Session</th>
                <th className="p-4">QR Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
              {filteredFaculty.length > 0 ? (
                filteredFaculty.map((f: UserProfile, idx: number) => {
                  const isActive = activeSession && f.uid === activeSession.facultyId;
                  return (
                    <tr key={f.uid || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-[11px] text-white ${
                          isActive ? 'bg-slate-900 dark:bg-slate-600' : 'bg-slate-400'
                        }`}>
                          {(f.name || 'F').substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900 dark:text-white">{f.name}</span>
                      </td>

                      <td className="p-4 text-slate-500 dark:text-slate-400">
                        {f.department || 'Computer Science & Engineering'}
                      </td>

                      <td className="p-4 text-slate-500 dark:text-slate-400">
                        {isActive ? activeSession?.sessionTitle || 'Campus Session' : '--'}
                      </td>

                      <td className="p-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => {
                              setFacultyToEdit(f);
                              setIsFacultyModalOpen(true);
                            }}
                            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                            title="Edit faculty"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (window.confirm(`Are you sure you want to remove faculty member ${f.name} (${f.email})?`)) {
                                try {
                                  await deleteUser(f.uid || f.email);
                                  await refreshUsers();
                                } catch (err: any) {
                                  alert(err.message || 'Failed to remove faculty member.');
                                }
                              }
                            }}
                            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title="Delete faculty"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 text-xs">
                    {facultySearch ? 'No faculty found matching your search.' : 'No faculty registered yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Administrators Management Table */}
      <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">System Administrators</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40">
              {users.filter(u => u.role === 'admin').length} Active
            </span>
          </div>
          <button
            onClick={() => setIsAdminModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0 shadow-xs"
            title="Add new administrator or manage accounts"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Administrator</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                <th className="p-4">Administrator Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Designation</th>
                <th className="p-4">Privilege Level</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
              {users.filter(u => u.role === 'admin').map((adm) => {
                const isCurrent = currentUser?.uid === adm.uid || currentUser?.email.toLowerCase() === adm.email.toLowerCase();
                const totalAdmins = users.filter(u => u.role === 'admin').length;
                return (
                  <tr key={adm.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[11px]">
                        {(adm.name || 'A').substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-white">{adm.name}</span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                            Current
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-4 text-slate-500 dark:text-slate-400">
                      {adm.email}
                    </td>

                    <td className="p-4 text-slate-500 dark:text-slate-400">
                      {adm.designation || 'System Administrator'}
                    </td>

                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                        Super Administrator
                      </span>
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={async () => {
                          if (totalAdmins <= 1) {
                            alert('Cannot delete the only remaining administrator account. Please create another administrator before deleting this account.');
                            return;
                          }
                          const msg = isCurrent
                            ? `Are you sure you want to remove your own administrator account (${adm.email})? You will be logged out.`
                            : `Are you sure you want to remove administrator ${adm.name} (${adm.email})?`;
                          if (window.confirm(msg)) {
                            try {
                              await deleteUser(adm.uid);
                            } catch (err: any) {
                              alert(err.message || 'Failed to delete administrator account.');
                            }
                          }
                        }}
                        disabled={totalAdmins <= 1}
                        className={`p-1.5 rounded-md border transition ${
                          totalAdmins <= 1
                            ? 'opacity-30 cursor-not-allowed text-slate-400 border-slate-200 dark:border-slate-800'
                            : 'hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-600 dark:hover:text-red-400 border-transparent hover:border-red-200 dark:hover:border-red-800'
                        }`}
                        title={totalAdmins <= 1 ? 'Cannot delete the only remaining administrator' : 'Delete administrator'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <GPSConfigModal isOpen={isGPSModalOpen} onClose={() => setIsGPSModalOpen(false)} />
      <InsertStudentModal isOpen={isInsertModalOpen} onClose={() => setIsInsertModalOpen(false)} />
      <StudentAttendanceLookupModal
        isOpen={isStudentLookupOpen}
        onClose={() => setIsStudentLookupOpen(false)}
        initialHallTicket={selectedStudentLookup}
      />
      <FacultyModal
        isOpen={isFacultyModalOpen}
        onClose={() => {
          setIsFacultyModalOpen(false);
          setFacultyToEdit(null);
        }}
        facultyToEdit={facultyToEdit}
      />
      <AdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />
    </div>
  );
};


