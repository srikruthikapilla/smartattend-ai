import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { generateAttendancePDF } from '../utils/pdfGenerator';
import { exportAttendanceToExcel, exportAttendanceToCSV } from '../utils/excelGenerator';
import { FileSpreadsheet, FileText, Download, Filter, Search, Table, CheckCircle2 } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { attendanceRecords } = useAttendance();

  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const filteredRecords = attendanceRecords.filter(rec => {
    if (selectedBranch !== 'all' && rec.branch !== selectedBranch) return false;
    if (selectedSection !== 'all' && rec.section !== selectedSection) return false;
    if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
    const q = search.toLowerCase();
    return (
      rec.studentName.toLowerCase().includes(q) ||
      rec.hallTicketNo.toLowerCase().includes(q) ||
      rec.subject.toLowerCase().includes(q)
    );
  });

  const handleExportPDF = () => {
    generateAttendancePDF(filteredRecords, {
      title: 'SBIT Official Attendance Report',
      subtitle: 'Swarna Bharathi Institute of Science and Technology, Khammam'
    });
  };

  const handleExportExcel = () => {
    exportAttendanceToExcel(filteredRecords, 'SBIT_Campus_Attendance');
  };

  const handleExportCSV = () => {
    exportAttendanceToCSV(filteredRecords, 'SBIT_Campus_Attendance');
  };

  return (
    <div className="space-y-6">
      
      {/* Header & One-Click Export Actions */}
      <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase">
            Automated Reporting Engine
          </span>
          <h2 className="text-2xl font-extrabold text-white mt-2">
            Export Attendance Reports & Audit Documents
          </h2>
          <p className="text-xs text-slate-400">
            Generate standardized PDF, Excel (.xlsx), and CSV files formatted for SBIT Academic Records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Export PDF Document
          </button>

          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel (.xlsx)
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="glass-panel p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Search Keyword</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Student, Hall Ticket, Subject..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Filter by Branch</label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none"
          >
            <option value="all">All Branches</option>
            {['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AIML', 'DS'].map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Filter by Section</label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none"
          >
            <option value="all">All Sections</option>
            <option value="A">Section A</option>
            <option value="B">Section B</option>
            <option value="C">Section C</option>
            <option value="D">Section D</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Filter by Attendance Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="present">PRESENT</option>
            <option value="late">LATE</option>
            <option value="absent">ABSENT</option>
          </select>
        </div>
      </div>

      {/* Preview Table */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Table className="w-5 h-5 text-blue-400" />
            Report Data Preview ({filteredRecords.length} Rows)
          </h3>
          <span className="text-xs text-slate-400">
            Standard Columns: Date, Time, Student Name, Hall Ticket No, Branch, Sec, Year, Subject, Faculty, Status
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Hall Ticket No</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">Sec</th>
                <th className="py-3 px-4">Year</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Faculty</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {filteredRecords.map(rec => {
                const d = new Date(rec.markedAt);
                return (
                  <tr key={rec.recordId} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono">{d.toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="py-3 px-4 font-semibold text-white">{rec.studentName}</td>
                    <td className="py-3 px-4 font-mono text-amber-400">{rec.hallTicketNo}</td>
                    <td className="py-3 px-4">{rec.branch}</td>
                    <td className="py-3 px-4">{rec.section}</td>
                    <td className="py-3 px-4">{rec.year}</td>
                    <td className="py-3 px-4">{rec.subject}</td>
                    <td className="py-3 px-4">{rec.facultyName}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        rec.status === 'present' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        rec.status === 'late' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                        'bg-red-950 text-red-400 border border-red-800'
                      }`}>
                        {rec.status}
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
