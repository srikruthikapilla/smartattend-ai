import React, { useState, useMemo } from 'react';
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
import { StatCard } from '../../components/common/StatCard';
import { UserProfile } from '../../types/auth';
import { AttendanceRecord } from '../../types/attendance';
import {
  Users, UserCheck, Search, MapPin, PlusCircle, ShieldCheck,
  Download, TrendingUp, TrendingDown, Radio,
  MoreVertical, UserPlus, CheckSquare, Square, Check, X,
  GraduationCap, BarChart3, Pencil, Trash2, Plus, Mail, Phone, FileSpreadsheet, Shield, Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminDashboard: React.FC = () => {
  const { users, currentUser, pendingStudents, updateStudentStatus, deleteUser, bulkDeleteUsers, refreshUsers } = useAuth();
  const { activeSession, attendanceRecords, geofence } = useAttendance();

  const [searchQuery, setSearchQuery] = useState('');
  const [facultySearch, setFacultySearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<'ALL' | 'CSE' | 'AI' | 'DS'>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING'>('ALL');
  const [selectedStudentUids, setSelectedStudentUids] = useState<string[]>([]);
  const [isDeletingStudents, setIsDeletingStudents] = useState(false);
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

  // Real-time: students added this week (from users createdAt)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const studentsThisWeek = users.filter(u =>
    u.role === 'student' &&
    u.status === 'approved' &&
    u.createdAt &&
    new Date(u.createdAt) >= weekAgo
  ).length;

  // Real-time: today vs yesterday attendance rate delta
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  const getAttendanceRate = (records: AttendanceRecord[]) => {
    if (records.length === 0) return null;
    const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
    return Math.round((present / records.length) * 100);
  };

  const todayRecords = attendanceRecords.filter(r => new Date(r.markedAt) >= todayStart);
  const yesterdayRecords = attendanceRecords.filter(r => {
    const d = new Date(r.markedAt);
    return d >= yesterdayStart && d < todayStart;
  });
  const todayRate = getAttendanceRate(todayRecords);
  const yesterdayRate = getAttendanceRate(yesterdayRecords);
  const attendanceDelta = (todayRate !== null && yesterdayRate !== null) ? todayRate - yesterdayRate : null;

  // Filtered Students Directory
  const allStudents = useMemo(() => {
    return users.filter(u => u.role === 'student');
  }, [users]);

  const filteredStudents = useMemo(() => {
    return allStudents.filter(st => {
      // Branch filter
      if (selectedBranchFilter !== 'ALL') {
        const b = (st.branch || '').toUpperCase();
        if (selectedBranchFilter === 'CSE' && b !== 'CSE') return false;
        if (selectedBranchFilter === 'AI' && b !== 'AI' && !b.includes('AI')) return false;
        if (selectedBranchFilter === 'DS' && b !== 'DS' && !b.includes('DS')) return false;
      }
      // Status filter
      if (selectedStatusFilter !== 'ALL') {
        const s = (st.status || 'approved').toUpperCase();
        if (selectedStatusFilter === 'APPROVED' && s !== 'APPROVED') return false;
        if (selectedStatusFilter === 'PENDING' && s !== 'PENDING') return false;
      }
      // Search
      if (studentSearch.trim()) {
        const q = studentSearch.toLowerCase();
        const matchName = (st.name || '').toLowerCase().includes(q);
        const matchEmail = (st.email || '').toLowerCase().includes(q);
        const matchHT = (st.hallTicketNo || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchHT) return false;
      }
      return true;
    });
  }, [allStudents, selectedBranchFilter, selectedStatusFilter, studentSearch]);

  const handleSelectAllStudents = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedStudentUids(filteredStudents.map(s => s.uid));
    } else {
      setSelectedStudentUids([]);
    }
  };

  const handleToggleSelectStudent = (uid: string) => {
    setSelectedStudentUids(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleDeleteSingleStudent = async (student: UserProfile) => {
    const nameStr = student.name || 'Student';
    const htStr = student.hallTicketNo || student.email;
    if (window.confirm(`Are you sure you want to permanently delete student ${nameStr} (${htStr})?\n\nThis will remove their roster account, biometric face data, and attendance records from the database.`)) {
      try {
        await deleteUser(student.uid || student.hallTicketNo || student.email);
        setSelectedStudentUids(prev => prev.filter(id => id !== student.uid));
      } catch (err: any) {
        alert(err.message || 'Failed to delete student.');
      }
    }
  };

  const handleBulkDeleteStudents = async () => {
    if (selectedStudentUids.length === 0) return;
    if (window.confirm(`Are you sure you want to permanently delete all ${selectedStudentUids.length} selected students?\n\nThis action cannot be undone.`)) {
      setIsDeletingStudents(true);
      try {
        await bulkDeleteUsers(selectedStudentUids);
        setSelectedStudentUids([]);
      } catch (err: any) {
        alert(err.message || 'Failed to bulk delete students.');
      } finally {
        setIsDeletingStudents(false);
      }
    }
  };

  const handleApproveAllPending = async () => {
    const pendingList = allStudents.filter(s => s.status === 'pending');
    if (pendingList.length === 0) return;
    for (const st of pendingList) {
      await updateStudentStatus(st.uid, 'approved');
    }
    await refreshUsers();
  };

  // Real-time: GPS integrity and out-of-bounds from live records
  const geofenceRadius = geofence.radiusMeters || 150;
  const recordsWithGPS = attendanceRecords.filter(r =>
    r.studentLat !== undefined &&
    r.studentLng !== undefined &&
    r.gpsDistanceMeters !== undefined
  );
  const outOfBoundsToday = recordsWithGPS.filter(r =>
    new Date(r.markedAt) >= todayStart &&
    (r.gpsDistanceMeters || 0) > geofenceRadius
  ).length;
  const gpsIntegrity = recordsWithGPS.length > 0
    ? Math.round(((recordsWithGPS.length - outOfBoundsToday) / recordsWithGPS.length) * 100)
    : 0;

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
        <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end">
          <button
            onClick={() => setIsInsertModalOpen(true)}
            className="btn-primary"
            title="Import students via Excel (.xlsx) / CSV or manual entry"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Import students</span>
          </button>
          <Link
            to="/attendance/live"
            className="btn-outline text-accent hover:border-accent"
            title="Watch real-time multi-modal attendance stream"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse text-accent" />
            <span>Live stream</span>
          </Link>
          <button
            onClick={() => setIsGPSModalOpen(true)}
            className="btn-outline"
            title="Configure campus perimeter and GPS anchor"
          >
            <MapPin className="w-3.5 h-3.5 text-accent" />
            <span>GPS geofence</span>
          </button>
          <button
            onClick={() => {
              setSelectedStudentLookup('');
              setIsStudentLookupOpen(true);
            }}
            className="btn-outline"
            title="Lookup student attendance records and eligibility"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Student lookup</span>
          </button>
          <button
            onClick={() => setIsAdminModalOpen(true)}
            className="btn-outline"
            title="Manage administrators, add new admins, or delete accounts"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Manage admins</span>
          </button>
          <button
            onClick={() => exportAttendanceToExcel(attendanceRecords, 'SBIT_Admin_Attendance')}
            className="btn-outline"
            title="Export attendance ledger to Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
        <div className="animate-fade-up stagger-1">
          <StatCard
            title="Total students"
            value={totalStudents > 0 ? totalStudents.toLocaleString() : '—'}
            icon={GraduationCap}
            color="accent"
            trend={studentsThisWeek > 0 ? { value: `+${studentsThisWeek} this week`, isPositive: true } : undefined}
          />
        </div>
        <div className="animate-fade-up stagger-2">
          <StatCard
            title="Avg attendance"
            value={`${attendancePct}%`}
            icon={BarChart3}
            color="accent"
            subtitle={attendanceDelta === null ? 'No data yet' : undefined}
            trend={attendanceDelta !== null ? { value: `${attendanceDelta > 0 ? '+' : ''}${attendanceDelta}% from yesterday`, isPositive: attendanceDelta >= 0 } : undefined}
          />
        </div>
        <div className="animate-fade-up stagger-3">
          <StatCard
            title="Active sessions"
            value={activeSession ? '1' : '0'}
            icon={Radio}
            color="accent"
            subtitle={activeSession ? 'Live now' : 'No active'}
          />
        </div>
        <div className="animate-fade-up stagger-4">
          <StatCard
            title="Pending approvals"
            value={pendingStudents.length}
            icon={UserPlus}
            color="amber"
            subtitle="Awaiting verification"
          />
        </div>
      </div>

      {/* Complex Layout: Analytics + Geofencing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Live System Analytics Chart (2 cols) */}
        <div className="lg:col-span-2 card-premium">
          <div className="card-premium-inner !p-0 overflow-hidden flex flex-col">
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
                          ? 'bg-accent shadow-sm'
                          : 'bg-slate-200 dark:bg-slate-800 hover:bg-accent/60'
                      }`}
                      style={{ height: `${Math.max(val * 2.2, 4)}px` }}
                    >
                      <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap shadow-md z-20">
                        {val}%
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">{chartLabels[idx]}</span>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>

        {/* Geofencing Status (1 col) */}
        <div className="card-premium">
          <div className="card-premium-inner !p-0 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-surface-dim/50">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 font-heading">
              <MapPin className="w-4 h-4 text-accent" /> Campus Geofence
            </h3>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider font-heading ${
              geofence.enabled !== false
                ? 'bg-accent-muted text-accent border border-accent/20'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {geofence.enabled !== false ? 'Enforced' : 'Disabled'}
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
              showRadius={geofence.enabled !== false}
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
          <div className="p-4 space-y-3 flex-1 text-xs">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Campus Anchor</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {(geofence.latitude || 17.2472).toFixed(4)}, {(geofence.longitude || 80.1514).toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Perimeter Radius</span>
              <span className="font-mono font-bold text-accent">{geofence.radiusMeters || 150}m Active</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-slate-500 dark:text-slate-400 font-medium">GPS Integrity</span>
              <span className={`${gpsIntegrity >= 90 ? 'text-accent' : gpsIntegrity >= 70 ? 'text-amber-500' : 'text-rose-500'} font-bold font-heading`}>
                {gpsIntegrity}% {gpsIntegrity >= 90 ? 'High' : gpsIntegrity >= 70 ? 'Medium' : 'Low'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Out of Bounds Today</span>
              <span className={`${outOfBoundsToday > 0 ? 'text-rose-500' : 'text-accent'} font-bold font-heading`}>
                {outOfBoundsToday} {outOfBoundsToday === 1 ? 'Student' : 'Students'}
              </span>
            </div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-surface-dim/50 text-center border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setIsGPSModalOpen(true)}
              className="text-xs font-bold uppercase tracking-wider text-accent hover:underline flex items-center justify-center gap-1.5 mx-auto font-heading transition"
            >
              <MapPin className="w-3.5 h-3.5" />
              Configure Campus Location & Radius →
            </button>
          </div>
          </div>
        </div>
      </div>

      {/* Active Session & Live QR Broadcast */}
      {activeSession && (
        <div className="mt-6 card-premium max-w-md mx-auto">
          <div className="card-premium-inner">
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

      {/* Comprehensive Student Management & Roster */}
      <div className="mt-6 card-premium">
        <div className="card-premium-inner !p-0 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70 dark:bg-surface-dim/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                    Student Directory & Roster
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/40">
                    {allStudents.length} Total
                  </span>
                  {pendingStudents.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                      {pendingStudents.length} Pending
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Manage student profiles, biometrics enrollment status, and account authorizations.
                </p>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {pendingStudents.length > 0 && (
                <button
                  onClick={handleApproveAllPending}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
                  title="Approve all pending student accounts"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve All ({pendingStudents.length})</span>
                </button>
              )}
              {selectedStudentUids.length > 0 && (
                <button
                  onClick={handleBulkDeleteStudents}
                  disabled={isDeletingStudents}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
                  title="Permanently delete selected students"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedStudentUids.length})</span>
                </button>
              )}
              <button
                onClick={() => setIsInsertModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0 border border-slate-700/50"
                title="Add new student or bulk import"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Student</span>
              </button>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-surface-base">
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search by Name, Hall Ticket, Email..."
                className="pl-9 pr-4 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-slate-900 dark:focus:ring-white focus:bg-white dark:focus:bg-slate-700 w-full text-slate-900 dark:text-white placeholder-slate-400 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              {/* Branch Filter Pills */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                {(['ALL', 'CSE', 'AI', 'DS'] as const).map(b => (
                  <button
                    key={b}
                    onClick={() => setSelectedBranchFilter(b)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition font-heading ${
                      selectedBranchFilter === b
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {b === 'ALL' ? 'All Branches' : b}
                  </button>
                ))}
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                {(['ALL', 'APPROVED', 'PENDING'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSelectedStatusFilter(s)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition font-heading ${
                      selectedStatusFilter === s
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {s === 'ALL' ? 'All Status' : s === 'APPROVED' ? 'Approved' : 'Pending'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Student Table */}
          <div className="overflow-x-auto max-h-[520px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 backdrop-blur z-10 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredStudents.length > 0 && selectedStudentUids.length === filteredStudents.length}
                      onChange={handleSelectAllStudents}
                      className="rounded border-slate-300 dark:border-slate-700 text-teal-600 focus:ring-teal-500"
                    />
                  </th>
                  <th className="p-3">Student Name</th>
                  <th className="p-3">Hall Ticket No</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Branch / Sec</th>
                  <th className="p-3">Biometrics</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map(student => {
                    const isSelected = selectedStudentUids.includes(student.uid);
                    const isPending = (student.status || 'approved').toLowerCase() === 'pending';
                    const isFaceEnrolled = student.faceEnrollmentStatus === 'enrolled' || (student.faceDescriptor && student.faceDescriptor.length === 128);

                    return (
                      <tr
                        key={student.uid}
                        className={`transition-colors ${
                          isSelected
                            ? 'bg-teal-50/50 dark:bg-teal-950/20'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectStudent(student.uid)}
                            className="rounded border-slate-300 dark:border-slate-700 text-teal-600 focus:ring-teal-500"
                          />
                        </td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-[10px] shrink-0">
                            {(student.name || 'S').substring(0, 2).toUpperCase()}
                          </div>
                          <span>{student.name}</span>
                        </td>
                        <td className="p-3 font-mono font-bold text-teal-600 dark:text-teal-400">
                          {student.hallTicketNo || 'Pending'}
                        </td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">
                          {student.email}
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300 font-semibold font-mono">
                          {student.branch || 'CSE'} - {student.section || 'A'}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              isFaceEnrolled
                                ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {isFaceEnrolled ? 'Face Enrolled' : 'Not Enrolled'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              isPending
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                            }`}
                          >
                            {isPending ? 'Pending Approval' : 'Approved'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPending && (
                              <>
                                <button
                                  onClick={() => updateStudentStatus(student.uid, 'approved')}
                                  className="px-2 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white font-bold text-[10px] transition flex items-center gap-1"
                                  title="Approve student account"
                                >
                                  <Check className="w-3 h-3" /> Approve
                                </button>
                                <button
                                  onClick={() => updateStudentStatus(student.uid, 'rejected')}
                                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[10px] transition"
                                  title="Reject student account"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => {
                                setSelectedStudentLookup(student.hallTicketNo || '');
                                setIsStudentLookupOpen(true);
                              }}
                              className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                              title="View student attendance record"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSingleStudent(student)}
                              className="p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                              title="Permanently delete student"
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
                    <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                      {studentSearch || selectedBranchFilter !== 'ALL' || selectedStatusFilter !== 'ALL'
                        ? 'No students match your filter criteria.'
                        : 'No students registered in the database yet. Click "+ Add Student" to insert or upload students.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Faculty Management Table */}
      <div className="mt-6 card-premium">
        <div className="card-premium-inner !p-0 overflow-hidden">
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
      </div>

      {/* Administrators Management Table */}
      <div className="mt-6 card-premium">
        <div className="card-premium-inner !p-0 overflow-hidden">
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


