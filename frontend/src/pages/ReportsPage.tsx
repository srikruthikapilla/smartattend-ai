import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { generateAttendancePDF } from '../utils/pdfGenerator';
import { exportAttendanceToExcel, exportAttendanceToCSV } from '../utils/excelGenerator';
import { FileSpreadsheet, FileText, Download, Search, RotateCcw, Users } from 'lucide-react';
import { getAcademicGroups, normalizeAcademicValue } from '../utils/academicGrouping';

export const ReportsPage: React.FC = () => {
  const { attendanceRecords } = useAttendance();

  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const availableBranches = Array.from(new Set(
    attendanceRecords.map(record => normalizeAcademicValue(record.branch)).filter(Boolean)
  )).sort();
  const availableSections = Array.from(new Set(
    attendanceRecords
      .filter(record => selectedBranch === 'all' || normalizeAcademicValue(record.branch) === selectedBranch)
      .map(record => normalizeAcademicValue(record.section))
      .filter(Boolean)
  )).sort();

  const filteredRecords = attendanceRecords.filter(rec => {
    if (selectedBranch !== 'all' && normalizeAcademicValue(rec.branch) !== selectedBranch) return false;
    if (selectedSection !== 'all' && normalizeAcademicValue(rec.section) !== selectedSection) return false;
    if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    return (
      rec.studentName.toLowerCase().includes(q) ||
      rec.hallTicketNo.toLowerCase().includes(q) ||
      normalizeAcademicValue(rec.branch).toLowerCase().includes(q) ||
      normalizeAcademicValue(rec.section).toLowerCase().includes(q) ||
      (rec.sessionTitle && rec.sessionTitle.toLowerCase().includes(q))
    );
  });

  const academicGroups = getAcademicGroups(filteredRecords, record => record.branch, record => record.section);
  const clearFilters = () => {
    setSelectedBranch('all');
    setSelectedSection('all');
    setStatusFilter('all');
    setSearch('');
  };
  const exportName = ['SBIT_Attendance', selectedBranch !== 'all' ? selectedBranch : '', selectedSection !== 'all' ? `Section_${selectedSection}` : '']
    .filter(Boolean).join('_');

  const handleExportPDF = () => {
    generateAttendancePDF(filteredRecords, {
      title: 'SBIT Official Attendance Report',
      subtitle: 'Swarna Bharathi Institute of Science and Technology, Khammam'
    });
  };

  const handleExportExcel = () => {
    exportAttendanceToExcel(filteredRecords, exportName);
  };

  const handleExportCSV = () => {
    exportAttendanceToCSV(filteredRecords, exportName);
  };

  return (
    <div className="max-w-[1440px] mx-auto w-full space-y-6">
      
      {/* Header & One-Click Export Actions */}
      <div className="card-elevation p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent-muted border border-accent/20 text-accent font-heading">
            Automated Reporting Engine
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-1.5 tracking-tight font-heading">
            Attendance Reports & Audits
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Generate standardized PDF, Excel (.xlsx), and CSV files formatted for SBIT Academic Records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="btn-primary"
            title="Download formatted official attendance PDF"
          >
            <FileText className="w-4 h-4" />
            <span>Export PDF</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="btn-outline"
            title="Download full Excel spreadsheet (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-accent" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="btn-outline"
            title="Download raw CSV file"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="card-elevation p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.5fr)_repeat(3,minmax(150px,1fr))_auto] gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Search Keyword</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Student, Hall Ticket, Session..."
              className="input-premium pl-10 pr-3 text-xs"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Branch</label>
          <select
            value={selectedBranch}
            onChange={(e) => { setSelectedBranch(e.target.value); setSelectedSection('all'); }}
            className="input-premium text-xs"
          >
            <option value="all">All Branches</option>
            {availableBranches.map(b => (
              <option key={b} value={b}>{b} Department</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Section</label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="input-premium text-xs"
          >
            <option value="all">All Sections</option>
            {availableSections.map(sec => (
              <option key={sec} value={sec}>Section {sec}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Attendance Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-premium text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="present">Present Only</option>
            <option value="late">Late Only</option>
            <option value="absent">Absent Only</option>
          </select>
        </div>

        <button
          type="button"
          onClick={clearFilters}
          className="btn-outline h-10 justify-center"
          title="Clear branch, section, status, and search filters"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="card-elevation p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent-muted text-accent flex items-center justify-center"><Users className="w-4 h-4" /></div>
          <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Filtered records</p><p className="text-xl font-bold text-slate-900 dark:text-white">{filteredRecords.length}</p></div>
        </div>
        {academicGroups.slice(0, 3).map(group => (
          <div key={`${group.branch}-${group.section}`} className="card-elevation p-4 flex items-center justify-between gap-3">
            <div><p className="text-[11px] uppercase tracking-wide text-slate-500">{group.branch} · Section {group.section}</p><p className="text-xs text-slate-500 mt-1">Separate cohort</p></div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">{group.count}</span>
          </div>
        ))}
      </div>

      {/* Reports Table View */}
      <div className="card-elevation overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-white/[0.06] flex justify-between items-center">
          <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
            Matching Records ({filteredRecords.length})
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {selectedBranch === 'all' ? 'All branches' : selectedBranch}{selectedSection === 'all' ? ' · All sections' : ` · Section ${selectedSection}`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold text-[11px]">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Hall Ticket No</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">Section</th>
                <th className="py-3 px-4">Session Title</th>
                <th className="py-3 px-4">Faculty</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No attendance records match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(rec => (
                  <tr key={rec.recordId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{rec.studentName}</td>
                    <td className="py-3 px-4 font-mono text-teal-600 dark:text-teal-400">{rec.hallTicketNo}</td>
                    <td className="py-3 px-4"><span className="inline-flex px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold">{normalizeAcademicValue(rec.branch) || 'Unassigned'}</span></td>
                    <td className="py-3 px-4"><span className="inline-flex px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold">{normalizeAcademicValue(rec.section) ? `Section ${normalizeAcademicValue(rec.section)}` : 'Unassigned'}</span></td>
                    <td className="py-3 px-4">{rec.sessionTitle || `${rec.branch} Session`}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{rec.facultyName || 'Faculty'}</td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      {rec.verificationMethod === 'qr_gps' ? 'Dynamic QR + GPS' : 'Manual Override'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {new Date(rec.markedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                      {new Date(rec.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        rec.status === 'present' ? 'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800' :
                        rec.status === 'late' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800' :
                        'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
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

    </div>
  );
};
