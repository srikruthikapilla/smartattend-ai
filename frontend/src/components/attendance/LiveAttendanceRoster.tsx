import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAttendance } from '../../context/AttendanceContext';
import {
  Users, CheckCircle2, XCircle, Clock, Search, Filter,
  Download, RefreshCw, CheckCheck, RotateCcw, ScanFace,
  Smartphone, ShieldCheck, AlertTriangle, Sparkles, UserCheck, Eye,
  GraduationCap, ChevronDown, Check, UserX, Activity, ArrowUpRight,
  TrendingUp, Calendar, Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { StudentAttendanceLookupModal } from './StudentAttendanceLookupModal';

interface LiveAttendanceRosterProps {
  title?: string;
  defaultBranch?: string;
  defaultSection?: string;
  showSectionFilter?: boolean;
}

export const LiveAttendanceRoster: React.FC<LiveAttendanceRosterProps> = ({
  title = "Live Student Attendance Roster",
  defaultBranch = "ALL",
  defaultSection = "ALL",
  showSectionFilter = true
}) => {
  const { users, approvedStudents } = useAuth();
  const {
    activeSession,
    attendanceRecords,
    toggleAttendance,
    bulkMarkAttendance,
    refreshLiveAttendance
  } = useAttendance();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'LATE'>('ALL');
  const [selectedBranch, setSelectedBranch] = useState<string>(
    activeSession?.branch || defaultBranch
  );
  const [selectedSection, setSelectedSection] = useState<string>(
    activeSession?.section || defaultSection
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lookupStudentHt, setLookupStudentHt] = useState<string | null>(null);

  // All enrolled students (fallback to approvedStudents if users isn't loaded yet)
  const enrolledStudents = useMemo(() => {
    const students = users.filter(u => u.role === 'student');
    return students.length > 0 ? students : approvedStudents;
  }, [users, approvedStudents]);

  // Combine enrolled students with live attendance records so all active students show
  const rosterData = useMemo(() => {
    const accountedHt = new Set<string>();
    const accountedUid = new Set<string>();

    const rows = enrolledStudents.map(student => {
      const sHt = (student.hallTicketNo || '').trim().toUpperCase();
      const sName = (student.name || '').trim().toLowerCase();
      const sUid = (student.uid || '').trim();

      if (sHt) accountedHt.add(sHt);
      if (sUid) accountedUid.add(sUid);

      // Find matching attendance record for the active session (or most recent record)
      const record = attendanceRecords.find(r => {
        const rHt = (r.hallTicketNo || '').trim().toUpperCase();
        const rId = (r.studentId || '').trim();
        const rName = (r.studentName || '').trim().toLowerCase();

        return (
          (sHt && rHt && sHt === rHt) ||
          (sUid && rId && sUid === rId) ||
          (sHt && rId && sHt === rId.toUpperCase()) ||
          (sName && rName && sName === rName)
        );
      });

      const status: 'present' | 'absent' | 'late' = record ? (record.status as any) : 'absent';

      return {
        student,
        record,
        status
      };
    });

    // Also include any students in attendanceRecords not already in enrolledStudents
    attendanceRecords.forEach(record => {
      const rHt = (record.hallTicketNo || '').trim().toUpperCase();
      const rId = (record.studentId || '').trim();

      const alreadyIncluded =
        (rHt && accountedHt.has(rHt)) ||
        (rId && accountedUid.has(rId)) ||
        rows.some(row => (row.student.hallTicketNo || '').trim().toUpperCase() === rHt);

      if (!alreadyIncluded && (rHt || record.studentName)) {
        if (rHt) accountedHt.add(rHt);
        if (rId) accountedUid.add(rId);

        const synthStudent: any = {
          uid: rId || rHt || `rec_${record.recordId}`,
          name: record.studentName || `Student (${rHt})`,
          hallTicketNo: rHt || record.studentId || 'Pending',
          branch: record.branch || 'CSM',
          section: record.section || 'A',
          year: record.year || 3,
          role: 'student',
          status: 'approved',
          college: 'Swarna Bharathi Institute of Science and Technology (SBIT)'
        };

        rows.push({
          student: synthStudent,
          record,
          status: (record.status as any) || 'present'
        });
      }
    });

    return rows;
  }, [enrolledStudents, attendanceRecords]);

  // Extract unique branches and sections available among all students and records
  const availableBranches = useMemo(() => {
    const set = new Set<string>();
    rosterData.forEach(r => { if (r.student.branch) set.add(r.student.branch); });
    return Array.from(set);
  }, [rosterData]);

  const availableSections = useMemo(() => {
    const set = new Set<string>();
    rosterData.forEach(r => { if (r.student.section) set.add(r.student.section); });
    return Array.from(set);
  }, [rosterData]);

  // Apply filters
  const filteredRoster = useMemo(() => {
    return rosterData.filter(({ student, status }) => {
      // Branch filter
      if (selectedBranch !== 'ALL' && student.branch !== selectedBranch) {
        return false;
      }
      // Section filter
      if (selectedSection !== 'ALL' && student.section !== selectedSection) {
        return false;
      }
      // Status filter
      if (statusFilter === 'PRESENT' && status !== 'present') return false;
      if (statusFilter === 'ABSENT' && status !== 'absent') return false;
      if (statusFilter === 'LATE' && status !== 'late') return false;

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = student.name.toLowerCase().includes(q);
        const matchHT = student.hallTicketNo ? student.hallTicketNo.toLowerCase().includes(q) : false;
        const matchBranch = student.branch ? student.branch.toLowerCase().includes(q) : false;
        return matchName || matchHT || matchBranch;
      }

      return true;
    });
  }, [rosterData, selectedBranch, selectedSection, statusFilter, search]);

  // Summary Metrics
  const totalStudents = rosterData.length;
  const presentCount = rosterData.filter(r => r.status === 'present').length;
  const lateCount = rosterData.filter(r => r.status === 'late').length;
  const absentCount = totalStudents - presentCount - lateCount;
  const attendanceRate = totalStudents > 0 ? Math.round(((presentCount + lateCount) / totalStudents) * 100) : 0;

  // Handle Manual Refresh
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshLiveAttendance();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    const exportRows = filteredRoster.map(({ student, record, status }, idx) => ({
      'S.No': idx + 1,
      'Hall Ticket / Roll No': student.hallTicketNo || 'N/A',
      'Student Name': student.name,
      'Branch': student.branch || 'CSM',
      'Section': student.section || 'A',
      'Year': student.year || 3,
      'Attendance Status': status.toUpperCase(),
      'Verification Method': record?.verificationMethod || (status === 'present' ? 'MANUAL' : 'ABSENT'),
      'Timestamp': record ? new Date(record.markedAt).toLocaleTimeString() : 'N/A',
      'Date': record ? new Date(record.markedAt).toLocaleDateString() : new Date().toLocaleDateString()
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance Roster');
    const fileName = `Smart_Attend_Roster_${selectedBranch}_Sec${selectedSection}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Bulk Actions
  const handleMarkAllPresent = () => {
    const targets = filteredRoster.map(r => r.student);
    bulkMarkAttendance(targets, 'present');
  };

  const handleResetAttendance = () => {
    const targets = filteredRoster.map(r => r.student);
    bulkMarkAttendance(targets, 'absent');
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl shadow-sm overflow-hidden flex flex-col transition-all">

      {/* ── Top Header & Live Controls ── */}
      <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-b from-slate-50/70 to-white dark:from-slate-800/40 dark:to-slate-900/60 space-y-5">

        {/* Title Bar with Real-time Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500/20 to-emerald-500/10 border border-teal-500/30 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time student check-in status with instant inline attendance editing & verification auditing.
              </p>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-all text-xs font-bold font-heading flex items-center gap-1.5 shadow-xs"
              title="Export complete roster as Excel spreadsheet (.xlsx)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .XLSX</span>
            </button>

            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition shadow-2xs"
              title="Refresh live stream"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-teal-600 dark:text-teal-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── 4 Defined Modern Metric Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Total Enrolled */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-heading">
                Total Enrolled
              </span>
              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">
                {totalStudents}
              </div>
              <span className="text-[11px] font-bold text-slate-400 font-mono">
                {selectedBranch !== 'ALL' ? selectedBranch : 'All Depts'}
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-slate-400 dark:bg-slate-500 h-full rounded-full w-full"></div>
            </div>
          </div>

          {/* Present (Verified) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-50/80 to-emerald-50/40 dark:from-teal-950/30 dark:to-emerald-950/10 border border-teal-200/80 dark:border-teal-800/60 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300 font-heading">
                Present (Verified)
              </span>
              <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-700 dark:text-teal-300 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="text-2xl sm:text-3xl font-extrabold text-teal-700 dark:text-teal-300 font-heading tracking-tight">
                {presentCount}
              </div>
              <span className="px-2 py-0.5 rounded-md bg-teal-500/15 text-teal-800 dark:text-teal-200 font-bold text-xs font-mono">
                {attendanceRate}%
              </span>
            </div>
            <div className="w-full bg-teal-200/60 dark:bg-teal-900/60 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-teal-600 dark:bg-teal-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(attendanceRate, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Absent */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50/80 to-red-50/40 dark:from-rose-950/30 dark:to-red-950/10 border border-rose-200/80 dark:border-rose-800/60 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 font-heading">
                Absent
              </span>
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-700 dark:text-rose-300 flex items-center justify-center">
                <XCircle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 font-heading tracking-tight">
                {absentCount}
              </div>
              <span className="text-[11px] font-semibold text-rose-600/80 dark:text-rose-400/80 font-mono">
                {totalStudents > 0 ? Math.round((absentCount / totalStudents) * 100) : 0}% of class
              </span>
            </div>
            <div className="w-full bg-rose-200/60 dark:bg-rose-900/60 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-rose-500 dark:bg-rose-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${totalStudents > 0 ? (absentCount / totalStudents) * 100 : 0}%` }}
              ></div>
            </div>
          </div>

          {/* Late / Excused */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/80 to-orange-50/40 dark:from-amber-950/30 dark:to-orange-950/10 border border-amber-200/80 dark:border-amber-800/60 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 font-heading">
                Late / Excused
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-heading tracking-tight">
                {lateCount}
              </div>
              <span className="text-[11px] font-semibold text-amber-600/80 dark:text-amber-400/80 font-mono">
                Flagged
              </span>
            </div>
            <div className="w-full bg-amber-200/60 dark:bg-amber-900/60 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-amber-500 dark:bg-amber-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${totalStudents > 0 ? (lateCount / totalStudents) * 100 : 0}%` }}
              ></div>
            </div>
          </div>

        </div>

        {/* ── Filter Toolbar & Search ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">

          {/* Modern Segmented Status Tabs */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs font-bold font-heading">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${statusFilter === 'ALL'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <span>All</span>
              <span className="px-1.5 py-0.2 rounded-md bg-slate-200/80 dark:bg-slate-700 text-[10px] font-mono">
                {rosterData.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('PRESENT')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${statusFilter === 'PRESENT'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-teal-700 dark:text-teal-400 hover:bg-teal-500/10'
                }`}
            >
              <span>Present</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${statusFilter === 'PRESENT' ? 'bg-teal-700 text-white' : 'bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300'}`}>
                {presentCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('ABSENT')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${statusFilter === 'ABSENT'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                }`}
            >
              <span>Absent</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${statusFilter === 'ABSENT' ? 'bg-rose-700 text-white' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'}`}>
                {absentCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('LATE')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${statusFilter === 'LATE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                }`}
            >
              <span>Late</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${statusFilter === 'LATE' ? 'bg-amber-700 text-white' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'}`}>
                {lateCount}
              </span>
            </button>
          </div>

          {/* Academic Selectors & Search Input */}
          <div className="flex flex-wrap items-center gap-2.5">
            {showSectionFilter && (
              <>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold font-heading text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
                >
                  <option value="ALL">All Branches</option>
                  {availableBranches.map(b => (
                    <option key={b} value={b}>{b} Department</option>
                  ))}
                </select>

                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold font-heading text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
                >
                  <option value="ALL">All Sections</option>
                  {availableSections.map(sec => (
                    <option key={sec} value={sec}>Section {sec}</option>
                  ))}
                </select>
              </>
            )}

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student or roll no..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs transition"
              />
            </div>
          </div>

        </div>

      </div>

      {/* ── High-Definition Real-Time Table ── */}
      <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse min-w-[780px]">
          <thead className="bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur text-slate-500 dark:text-slate-400 uppercase font-heading text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-3.5 px-5">Student Identity</th>
              <th className="py-3.5 px-4">Roll Number / HT</th>
              <th className="py-3.5 px-4">Academic Dept</th>
              <th className="py-3.5 px-4">Live Verification Status</th>
              <th className="py-3.5 px-4 text-center">Time</th>
              <th className="py-3.5 px-5 text-right">Inline Attendance Controls</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredRoster.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-20 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-300 font-heading">No students match current filter criteria</p>
                      <p className="text-xs text-slate-400 mt-0.5">Try selecting a different branch, section, or clearing search query.</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRoster.map(({ student, record, status }) => {
                const isPresent = status === 'present';
                const isLate = status === 'late';
                const isAbsent = status === 'absent';

                // Initial monogram background styling
                const avatarGradients = [
                  'from-blue-600 to-indigo-600',
                  'from-teal-600 to-emerald-600',
                  'from-purple-600 to-pink-600',
                  'from-amber-600 to-orange-600',
                  'from-cyan-600 to-blue-600'
                ];
                const charCode = (student.name || 'S').charCodeAt(0);
                const gradientClass = avatarGradients[charCode % avatarGradients.length];

                return (
                  <tr
                    key={student.uid}
                    className={`hover:bg-slate-50/90 dark:hover:bg-slate-800/60 transition-colors group ${isPresent ? 'bg-teal-50/20 dark:bg-teal-950/10' :
                      isLate ? 'bg-amber-50/25 dark:bg-amber-950/10' : ''
                      }`}
                  >
                    {/* Student Avatar + Name (Clickable) */}
                    <td className="py-3.5 px-5">
                      <div
                        onClick={() => setLookupStudentHt(student.hallTicketNo || '')}
                        className="flex items-center gap-3.5 cursor-pointer"
                        title="Click to view detailed student attendance report & history"
                      >
                        <div className={`w-9 h-9 rounded-xl font-bold flex items-center justify-center text-xs text-white bg-gradient-to-br ${gradientClass} shadow-xs transition-transform group-hover:scale-105 relative`}>
                          {student.name.charAt(0).toUpperCase()}
                          {isPresent && (
                            <span className="w-2.5 h-2.5 rounded-full bg-teal-500 ring-2 ring-white dark:ring-slate-900 absolute -bottom-0.5 -right-0.5"></span>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white font-heading group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors flex items-center gap-1.5">
                            <span>{student.name}</span>
                            <ArrowUpRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium">
                            {student.email || student.phone || 'SBIT Student'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Hall Ticket / Roll Number Pill */}
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => setLookupStudentHt(student.hallTicketNo || '')}
                        className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/60 hover:border-teal-500 dark:hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 transition shadow-2xs"
                        title="Click to view student profile"
                      >
                        {student.hallTicketNo || 'Pending'}
                      </button>
                    </td>

                    {/* Academic Department & Class */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800 dark:text-slate-200 font-heading">
                        {student.branch || 'CSM'} • Sec {student.section || 'A'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                        Year {student.year || 3}, Sem {student.semester || 1}
                      </div>
                    </td>

                    {/* Live Status & Verification Badge */}
                    <td className="py-3.5 px-4">
                      {isPresent ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/80 w-fit shadow-2xs font-heading">
                            <CheckCircle2 className="w-3 h-3 text-teal-500" />
                            <span>Present (Verified)</span>
                          </span>

                          {/* Verification Method Sub-Badge */}
                          {record?.verificationMethod === 'face_recognition' && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-teal-600 dark:text-teal-400 font-semibold font-mono">
                              <ScanFace className="w-3 h-3" /> Face AI ({(record.faceMatchConfidence ? (record.faceMatchConfidence * 100).toFixed(0) : 98)}% match)
                            </span>
                          )}
                          {(record?.verificationMethod === 'biometric_platform' || record?.verificationMethod === 'biometric_fallback') && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold font-mono">
                              <ShieldCheck className="w-3 h-3" /> WebAuthn Passkey
                            </span>
                          )}
                          {record?.verificationMethod === 'qr_gps' && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold font-mono">
                              <CheckCircle2 className="w-3 h-3" /> Dynamic QR + GPS
                            </span>
                          )}
                          {(!record?.verificationMethod || record?.verificationMethod === 'manual') && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                              <UserCheck className="w-3 h-3 text-slate-400" /> Faculty Override
                            </span>
                          )}
                        </div>
                      ) : isLate ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/80 shadow-2xs font-heading">
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span>Late / Excused</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/80 shadow-2xs font-heading">
                          <XCircle className="w-3 h-3 text-rose-500" />
                          <span>Absent</span>
                        </span>
                      )}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3.5 px-4 text-center font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {record ? (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                          {new Date(record.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">--:--:--</span>
                      )}
                    </td>

                    {/* Modern Segmented Inline Attendance Toggles */}
                    <td className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => toggleAttendance(student.uid, 'present', {
                            name: student.name,
                            hallTicketNo: student.hallTicketNo || 'N/A',
                            branch: student.branch,
                            section: student.section,
                            year: student.year ? Number(student.year) : 3
                          })}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all font-heading ${isPresent
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-white/60 dark:hover:bg-slate-700/60'
                            }`}
                          title="Mark Present"
                        >
                          Present
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleAttendance(student.uid, 'late', {
                            name: student.name,
                            hallTicketNo: student.hallTicketNo || 'N/A',
                            branch: student.branch,
                            section: student.section,
                            year: student.year ? Number(student.year) : 3
                          })}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all font-heading ${isLate
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-white/60 dark:hover:bg-slate-700/60'
                            }`}
                          title="Mark Late"
                        >
                          Late
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleAttendance(student.uid, 'absent', {
                            name: student.name,
                            hallTicketNo: student.hallTicketNo || 'N/A',
                            branch: student.branch,
                            section: student.section,
                            year: student.year ? Number(student.year) : 3
                          })}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all font-heading ${isAbsent
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white/60 dark:hover:bg-slate-700/60'
                            }`}
                          title="Mark Absent"
                        >
                          Absent
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      <div className="p-3.5 sm:p-4 bg-slate-50/80 dark:bg-slate-800/60 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
        <div className="flex items-center gap-2">
          <span>Showing <strong className="text-slate-800 dark:text-slate-200">{filteredRoster.length}</strong> of <strong className="text-slate-800 dark:text-slate-200">{rosterData.length}</strong> enrolled students</span>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span>Filtered by: <strong className="text-teal-600 dark:text-teal-400">{statusFilter}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-500"></span>
          <span className="font-semibold text-slate-700 dark:text-slate-300 font-heading">
            Smart Attend Enterprise • High-Performance Roster Engine
          </span>
        </div>
      </div>

      {/* Individual Student Attendance Lookup Modal */}
      <StudentAttendanceLookupModal
        isOpen={Boolean(lookupStudentHt)}
        onClose={() => setLookupStudentHt(null)}
        initialHallTicket={lookupStudentHt || ''}
      />

    </div>
  );
};

export default LiveAttendanceRoster;
