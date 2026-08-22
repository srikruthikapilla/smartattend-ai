import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  UserCheck,
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  AlertCircle,
  XCircle,
  ShieldCheck,
  Camera,
  Fingerprint,
  GraduationCap,
  RefreshCw,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAttendance } from '../../context/AttendanceContext';

interface StudentProfile {
  id?: string;
  name: string;
  hallTicketNo: string;
  email?: string;
  branch: string;
  section: string;
  year?: number | string;
  role?: string;
  faceEnrollmentStatus?: string;
  biometricEnrollmentStatus?: string;
}

interface StudentReport {
  hallTicketNo: string;
  studentName: string;
  email?: string;
  branch: string;
  section: string;
  year: number;
  status: string;
  faceEnrollmentStatus: string;
  biometricEnrollmentStatus: string;
  totalSessionsConducted: number;
  totalSessionsAttended: number;
  totalSessionsMissed: number;
  attendancePercentage: number;
  complianceStatus: 'eligible' | 'condonation' | 'detained';
  complianceLabel: string;
  records: any[];
}

interface StudentAttendanceLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialHallTicket?: string;
}

export const StudentAttendanceLookupModal: React.FC<StudentAttendanceLookupModalProps> = ({
  isOpen,
  onClose,
  initialHallTicket = ''
}) => {
  const { users, currentUser } = useAuth();
  const { toggleAttendance, activeSession } = useAttendance();

  const [searchQuery, setSearchQuery] = useState<string>(initialHallTicket);
  const [selectedStudent, setSelectedStudent] = useState<StudentReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Filter students from the roster for quick suggestions
  const studentList = (users || []).filter(
    u => u.role === 'student' || (!u.role && u.hallTicketNo)
  );

  const filteredStudents = searchQuery.trim()
    ? studentList.filter(s =>
        (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.hallTicketNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.email || '').toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 8)
    : studentList.slice(0, 8);

  const fetchStudentReport = async (hallTicket: string) => {
    const ht = hallTicket.trim().toUpperCase();
    if (!ht) return;

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const resp = await fetch(`/api/student/records/${ht}`);
      const data = await resp.json();

      if (resp.ok && data.hallTicketNo) {
        setSelectedStudent(data);
      } else {
        // Fallback to local profile matching if network endpoint fails
        const matched = studentList.find(
          s => (s.hallTicketNo || '').toUpperCase() === ht
        );
        if (matched) {
          setSelectedStudent({
            hallTicketNo: ht,
            studentName: matched.name || `Student (${ht})`,
            email: matched.email || '',
            branch: matched.branch || 'CSE',
            section: matched.section || 'A',
            year: Number(matched.year || 3),
            status: matched.status || 'approved',
            faceEnrollmentStatus: matched.faceDescriptor ? 'enrolled' : 'pending',
            biometricEnrollmentStatus: 'pending',
            totalSessionsConducted: 0,
            totalSessionsAttended: 0,
            totalSessionsMissed: 0,
            attendancePercentage: 0,
            complianceStatus: 'eligible',
            complianceLabel: 'No attendance records yet',
            records: []
          });
        } else {
          setErrorMessage(data.detail || `No student found with Roll Number ${ht}`);
        }
      }
    } catch (err: any) {
      setErrorMessage('Failed to connect to student records service.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && initialHallTicket) {
      setSearchQuery(initialHallTicket);
      fetchStudentReport(initialHallTicket);
    }
  }, [isOpen, initialHallTicket]);

  const handleQuickSelect = (ht: string) => {
    setSearchQuery(ht);
    fetchStudentReport(ht);
  };

  const handleManualMark = async (status: 'present' | 'absent') => {
    if (!selectedStudent) return;
    try {
      toggleAttendance(
        selectedStudent.hallTicketNo,
        status,
        {
          name: selectedStudent.studentName,
          hallTicketNo: selectedStudent.hallTicketNo,
          branch: selectedStudent.branch,
          section: selectedStudent.section,
          year: selectedStudent.year
        }
      );
      setSuccessMessage(`Marked ${selectedStudent.studentName} as ${status.toUpperCase()}!`);
      // Refresh report
      setTimeout(() => fetchStudentReport(selectedStudent.hallTicketNo), 600);
    } catch (e: any) {
      setErrorMessage('Failed to record attendance: ' + (e.message || 'Unknown error'));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white font-heading">
                Student Attendance & Records Lookup
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Institutional individual student verification & compliance tracker
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Search Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchStudentReport(searchQuery);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Roll No (e.g. 24M65A6603) or Student Name..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !searchQuery.trim()}
              className="bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-extrabold uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-sm font-heading disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Lookup</span>
            </button>
          </form>

          {/* Quick Roster Suggestions */}
          {!selectedStudent && filteredStudents.length > 0 && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Quick Select Student ({filteredStudents.length})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredStudents.map((s) => (
                  <button
                    key={s.uid || s.hallTicketNo}
                    type="button"
                    onClick={() => handleQuickSelect(s.hallTicketNo || '')}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 text-left transition-all flex items-center justify-between group"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {s.name}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {s.hallTicketNo} • {s.branch} (Sec {s.section})
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Student Detailed Report View */}
          {selectedStudent && (
            <div className="space-y-5">
              {/* Profile Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/80 dark:to-slate-800/40 border border-slate-200 dark:border-slate-700/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-teal-400 text-white font-extrabold text-xl flex items-center justify-center shadow-md">
                    {selectedStudent.studentName
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase() || 'ST'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-heading">
                        {selectedStudent.studentName}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        {selectedStudent.branch} - Sec {selectedStudent.section}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>Roll: <strong className="text-slate-700 dark:text-slate-200">{selectedStudent.hallTicketNo}</strong></span>
                      {selectedStudent.email && <span>Email: {selectedStudent.email}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[11px]">
                      <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <Camera className="w-3 h-3 text-slate-400" />
                        Face:{' '}
                        <strong className={selectedStudent.faceEnrollmentStatus === 'enrolled' ? 'text-emerald-500' : 'text-amber-500'}>
                          {selectedStudent.faceEnrollmentStatus || 'Pending'}
                        </strong>
                      </span>
                      <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <Fingerprint className="w-3 h-3 text-slate-400" />
                        Bio:{' '}
                        <strong className={selectedStudent.biometricEnrollmentStatus === 'enrolled' ? 'text-emerald-500' : 'text-slate-400'}>
                          {selectedStudent.biometricEnrollmentStatus || 'Optional'}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Compliance Badge */}
                <div className="text-right flex flex-col items-start sm:items-end">
                  <span className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider inline-flex items-center gap-1.5 border shadow-sm ${
                    (selectedStudent.attendancePercentage ?? 0) >= 75
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : (selectedStudent.attendancePercentage ?? 0) >= 65
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                  }`}>
                    {(selectedStudent.attendancePercentage ?? 0) >= 75 ? (
                      <CheckCircle className="w-3.5 h-3.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5" />
                    )}
                    <span>{selectedStudent.complianceLabel || ((selectedStudent.attendancePercentage ?? 0) >= 75 ? 'Eligible for Exams' : 'Attendance Shortage')}</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-semibold mt-1">
                    Req: &ge;75% for Exam Hall Ticket
                  </span>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Conducted
                  </span>
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    {selectedStudent.totalSessionsConducted ?? 0}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Attended
                  </span>
                  <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {selectedStudent.totalSessionsAttended ?? 0}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Missed / Absent
                  </span>
                  <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
                    {selectedStudent.totalSessionsMissed ?? 0}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Percentage
                  </span>
                  <span className={`text-2xl font-extrabold ${
                    (selectedStudent.attendancePercentage ?? 0) >= 75
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : (selectedStudent.attendancePercentage ?? 0) >= 65
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {selectedStudent.attendancePercentage ?? 0}%
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-500 dark:text-slate-400">Academic Attendance Rate</span>
                  <span className="text-slate-900 dark:text-white font-bold">{selectedStudent.attendancePercentage ?? 0}%</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (selectedStudent.attendancePercentage ?? 0) >= 75
                        ? 'bg-emerald-500'
                        : (selectedStudent.attendancePercentage ?? 0) >= 65
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(selectedStudent.attendancePercentage ?? 0, 100)}%` }}
                  />
                  {/* 75% threshold indicator */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-900 dark:bg-white z-10 opacity-60"
                    style={{ left: '75%' }}
                    title="75% Regulatory Requirement"
                  />
                </div>
              </div>

              {/* Quick Actions (Faculty / Admin override) */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Manual Session Override
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Directly mark this student for current session
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleManualMark('present')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Mark Present
                  </button>
                  <button
                    type="button"
                    onClick={() => handleManualMark('absent')}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Mark Absent
                  </button>
                </div>
              </div>

              {/* Attendance Log Table */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Verified Attendance Log ({selectedStudent.records.length} Records)
                </span>
                {selectedStudent.records.length > 0 ? (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3">Date & Time</th>
                          <th className="py-2.5 px-3">Session</th>
                          <th className="py-2.5 px-3">Method</th>
                          <th className="py-2.5 px-3">GPS / Distance</th>
                          <th className="py-2.5 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {selectedStudent.records.map((rec: any, idx: number) => (
                          <tr key={rec.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                              {new Date(rec.marked_at || rec.markedAt).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                              {rec.session_title || rec.sessionTitle || 'Campus Session'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 capitalize">
                              {(rec.verification_method || rec.verificationMethod || 'face_recognition').replace(/_/g, ' ')}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                              {rec.gps_distance_meters ?? rec.distanceM ?? 12}m
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                rec.status === 'present'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-rose-500/10 text-rose-600'
                              }`}>
                                {rec.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                    No individual attendance check-in records logged yet for this student.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-400">
          <span>Smart Attend • Academic Student Compliance System</span>
          <button
            onClick={onClose}
            className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
