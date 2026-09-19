import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import confetti from 'canvas-confetti';
import {
  UserPlus,
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileCheck,
  X,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { isValidHallTicketNo } from '../../types/auth';

interface InsertStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultBranch?: string;
  defaultSection?: string;
  defaultYear?: number;
}

export const InsertStudentModal: React.FC<InsertStudentModalProps> = ({
  isOpen,
  onClose,
  defaultBranch = 'CSE',
  defaultSection = 'A',
  defaultYear = 3
}) => {
  const { insertStudent, bulkInsertStudents } = useAuth();
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');

  // Single Student Form State
  const [singleForm, setSingleForm] = useState({
    name: '',
    email: '',
    hallTicketNo: '',
    branch: defaultBranch,
    section: defaultSection,
    year: defaultYear,
    semester: 1,
    phone: '',
    status: 'approved' as 'approved' | 'pending'
  });
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleSuccess, setSingleSuccess] = useState<string | null>(null);
  const [singleError, setSingleError] = useState<string | null>(null);

  // Bulk Upload State
  const [file, setFile] = useState<File | null>(null);
  const [parsedStudents, setParsedStudents] = useState<any[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState<{ added: number; duplicates: number } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format Hall Ticket when entered
  const handleHTChange = (ht: string) => {
    const formatted = ht.toUpperCase();
    setSingleForm(prev => ({
      ...prev,
      hallTicketNo: formatted
    }));
  };

  // Submit Single Student
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSingleError(null);
    setSingleSuccess(null);

    const cleanEmail = singleForm.email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setSingleError('Student email is mandatory and must be a valid email address.');
      return;
    }

    setSingleLoading(true);

    try {
      const created = await insertStudent({
        name: singleForm.name.trim(),
        email: cleanEmail,
        hallTicketNo: singleForm.hallTicketNo.trim().toUpperCase(),
        branch: singleForm.branch,
        section: singleForm.section,
        year: Number(singleForm.year),
        semester: Number(singleForm.semester),
        phone: singleForm.phone.trim(),
        status: singleForm.status
      });

      setSingleSuccess(`Student ${created.name} (${created.hallTicketNo}) added successfully!`);
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });

      // Reset form
      setSingleForm({
        name: '',
        email: '',
        hallTicketNo: '',
        branch: defaultBranch,
        section: defaultSection,
        year: defaultYear,
        semester: 1,
        phone: '',
        status: 'approved'
      });
    } catch (err: any) {
      setSingleError(err.message || 'Failed to insert student');
    } finally {
      setSingleLoading(false);
    }
  };

  // Parse Excel / CSV File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setBulkError(null);
    setBulkSuccess(null);
    setParseErrors([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rows.length === 0) {
          setBulkError('The uploaded file is empty.');
          return;
        }

        const validList: any[] = [];
        const errors: string[] = [];

        rows.forEach((row, idx) => {
          // Normalize column keys (case-insensitive & whitespace trimmed)
          const normalized: Record<string, any> = {};
          Object.keys(row).forEach(k => {
            const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            normalized[cleanKey] = row[k];
          });

          // Flexible header resolution for Hall Ticket / Roll Number
          const rawHT = (
            normalized['rollnumber'] ||
            normalized['rollno'] ||
            normalized['rollnum'] ||
            normalized['hallticketno'] ||
            normalized['hallticket'] ||
            normalized['hallticketnumber'] ||
            normalized['htno'] ||
            normalized['ht'] ||
            normalized['regno'] ||
            normalized['registrationno'] ||
            normalized['pin'] ||
            normalized['studentid'] ||
            ''
          ).toString().trim().toUpperCase();

          // Flexible header resolution for Student Name
          const name = (
            normalized['name'] ||
            normalized['fullname'] ||
            normalized['studentname'] ||
            normalized['studentfullname'] ||
            normalized['nameofstudent'] ||
            normalized['nameofcandidate'] ||
            normalized['candidatename'] ||
            ''
          ).toString().trim();

          // Flexible header resolution for Branch / Department
          const branch = (
            normalized['branch'] ||
            normalized['department'] ||
            normalized['dept'] ||
            normalized['course'] ||
            normalized['stream'] ||
            defaultBranch
          ).toString().trim().toUpperCase();

          // Flexible header resolution for Section
          let rawSec = (
            normalized['section'] ||
            normalized['sec'] ||
            normalized['division'] ||
            ''
          ).toString().trim().toUpperCase();
          if (!rawSec || rawSec === 'NONE' || rawSec === 'NULL' || rawSec === 'UNDEFINED') {
            rawSec = defaultSection || 'A';
          }
          const section = rawSec;

          // Flexible header resolution for Year
          const rawYear = (
            normalized['year'] ||
            normalized['classyear'] ||
            normalized['yr'] ||
            defaultYear
          ).toString().trim().toUpperCase();
          let year = 3;
          if (rawYear === '1' || rawYear === 'I' || rawYear === 'FIRST') year = 1;
          else if (rawYear === '2' || rawYear === 'II' || rawYear === 'SECOND') year = 2;
          else if (rawYear === '3' || rawYear === 'III' || rawYear === 'THIRD') year = 3;
          else if (rawYear === '4' || rawYear === 'IV' || rawYear === 'FOURTH') year = 4;
          else if (!isNaN(Number(rawYear)) && Number(rawYear) > 0) year = Number(rawYear);

          // Flexible header resolution for Semester
          const rawSem = (
            normalized['semester'] ||
            normalized['sem'] ||
            normalized['term'] ||
            1
          ).toString().trim().toUpperCase();
          let semester = 1;
          if (rawSem === '2' || rawSem === 'II' || rawSem === 'SECOND') semester = 2;
          else if (!isNaN(Number(rawSem)) && Number(rawSem) > 0) semester = Number(rawSem);

          // Flexible header resolution for Phone
          const phone = (
            normalized['phone'] ||
            normalized['mobile'] ||
            normalized['contact'] ||
            normalized['phoneno'] ||
            normalized['cell'] ||
            ''
          ).toString().trim();

          // Flexible header resolution for Email
          const email = (
            normalized['email'] ||
            normalized['emailaddress'] ||
            normalized['mail'] ||
            normalized['studentemail'] ||
            ''
          ).toString().trim().toLowerCase();

          if (!name || !rawHT) {
            errors.push(`Row ${idx + 2}: Missing required Name or Roll Number / Hall Ticket`);
            return;
          }

          if (!email || !email.includes('@') || !email.includes('.')) {
            errors.push(`Row ${idx + 2}: Student email is mandatory. Missing or invalid email for "${rawHT}" (${name})`);
            return;
          }

          if (!isValidHallTicketNo(rawHT)) {
            errors.push(`Row ${idx + 2}: Invalid Roll Number / Hall Ticket "${rawHT}" (must be 10 characters starting with 2)`);
            return;
          }

          validList.push({
            name,
            hallTicketNo: rawHT,
            email,
            branch,
            section,
            year,
            semester,
            phone,
            status: 'approved'
          });
        });

        setParsedStudents(validList);
        setParseErrors(errors);
      } catch (err: any) {
        setBulkError(`Failed to parse file: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  // Submit Bulk Students
  const handleBulkSubmit = async () => {
    if (parsedStudents.length === 0) return;
    setBulkLoading(true);
    setBulkError(null);

    try {
      const result = await bulkInsertStudents(parsedStudents);
      setBulkSuccess({
        added: result.addedCount,
        duplicates: result.duplicateCount
      });

      if (result.addedCount > 0) {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      }

      setParsedStudents([]);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setBulkError(err.message || 'Bulk import failed');
    } finally {
      setBulkLoading(false);
    }
  };

  // Download Sample Template
  const handleDownloadTemplate = (format: 'xlsx' | 'csv') => {
    const sampleData = [
      {
        'Hall Ticket No': '24M61A6601',
        'Full Name': 'K. Rahul Kumar',
        'Email': 'rahul.kumar@gmail.com',
        'Branch': 'CSE',
        'Section': 'A',
        'Year': 3,
        'Semester': 1,
        'Phone': '9876543210'
      },
      {
        'Hall Ticket No': '24M61A6602',
        'Full Name': 'M. Sneha Reddy',
        'Email': 'sneha.reddy@gmail.com',
        'Branch': 'AI',
        'Section': 'A',
        'Year': 3,
        'Semester': 1,
        'Phone': '9876543211'
      },
      {
        'Hall Ticket No': '24M61A6603',
        'Full Name': 'P. Sai Teja',
        'Email': 'sai.teja@gmail.com',
        'Branch': 'DS',
        'Section': 'B',
        'Year': 3,
        'Semester': 1,
        'Phone': '9876543212'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');

    if (format === 'xlsx') {
      XLSX.writeFile(wb, 'SBIT_Student_Import_Template.xlsx');
    } else {
      XLSX.writeFile(wb, 'SBIT_Student_Import_Template.csv');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Insert & Import Students" maxWidth="2xl">
      <div className="space-y-6">

        {/* Navigation Switch Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-bold font-heading">
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`py-2.5 rounded-xl flex items-center justify-center gap-2 transition ${activeTab === 'single'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Single Student Entry</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bulk')}
            className={`py-2.5 rounded-xl flex items-center justify-center gap-2 transition ${activeTab === 'bulk'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>Excel / CSV Bulk Upload</span>
          </button>
        </div>

        {/* ── TAB 1: SINGLE STUDENT FORM ── */}
        {activeTab === 'single' && (
          <form onSubmit={handleSingleSubmit} className="space-y-4">
            {singleSuccess && (
              <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{singleSuccess}</span>
              </div>
            )}

            {singleError && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{singleError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Hall Ticket Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-heading">
                  Hall Ticket / Roll No *
                </label>
                <input
                  type="text"
                  value={singleForm.hallTicketNo}
                  onChange={(e) => handleHTChange(e.target.value)}
                  placeholder="24M61A6601"
                  required
                  maxLength={10}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 uppercase font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">Format: 10 characters</p>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-heading">
                  Student Full Name *
                </label>
                <input
                  type="text"
                  value={singleForm.name}
                  onChange={(e) => setSingleForm({ ...singleForm, name: e.target.value })}
                  placeholder="e.g. Rahul Kumar"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Student Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-heading">
                  Student Email *
                </label>
                <input
                  type="email"
                  value={singleForm.email}
                  onChange={(e) => setSingleForm({ ...singleForm, email: e.target.value })}
                  placeholder="student@gmail.com"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Contact Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-heading">
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  value={singleForm.phone}
                  onChange={(e) => setSingleForm({ ...singleForm, phone: e.target.value })}
                  placeholder="9876543210"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Academic Hierarchy Selection */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-heading">
                  Branch
                </label>
                <select
                  value={singleForm.branch}
                  onChange={(e) => setSingleForm({ ...singleForm, branch: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CSE">CSE</option>
                  <option value="AI">AI</option>
                  <option value="DS">DS</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-heading">
                  Section
                </label>
                <select
                  value={singleForm.section}
                  onChange={(e) => setSingleForm({ ...singleForm, section: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                >
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="C">Section C</option>
                  <option value="D">Section D</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-heading">
                  Year
                </label>
                <select
                  value={singleForm.year}
                  onChange={(e) => setSingleForm({ ...singleForm, year: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>1st Year</option>
                  <option value={2}>2nd Year</option>
                  <option value={3}>3rd Year</option>
                  <option value={4}>4th Year</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-heading">
                  Semester
                </label>
                <select
                  value={singleForm.semester}
                  onChange={(e) => setSingleForm({ ...singleForm, semester: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>Sem 1</option>
                  <option value={2}>Sem 2</option>
                </select>
              </div>
            </div>

            {/* Approval Status Toggle */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Immediate Approval Status</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Allow instant attendance check-in without waiting for approval</p>
              </div>
              <input
                type="checkbox"
                checked={singleForm.status === 'approved'}
                onChange={(e) => setSingleForm({ ...singleForm, status: e.target.checked ? 'approved' : 'pending' })}
                className="w-4 h-4 text-blue-600 rounded border-slate-300"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={singleLoading}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition shadow-sm flex items-center gap-2 font-heading disabled:opacity-50"
              >
                {singleLoading ? 'Adding...' : 'Add Student'}
              </button>
            </div>
          </form>
        )}

        {/* ── TAB 2: EXCEL / CSV BULK IMPORT ── */}
        {activeTab === 'bulk' && (
          <div className="space-y-5">

            {/* Template Download Row */}
            <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5 font-heading">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Excel & CSV Format Templates
                </p>
                <p className="text-[11px] text-blue-700 dark:text-blue-300/80">
                  Download ready-made template with pre-formatted headers and sample rows.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('xlsx')}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.XLSX Template</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('csv')}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.CSV Template</span>
                </button>
              </div>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-3xl p-6 text-center cursor-pointer bg-slate-50/50 dark:bg-slate-900/50 transition-all group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 font-heading">
                {file ? file.name : 'Click or Drag & Drop Excel / CSV file here'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv)
              </p>
            </div>

            {/* Bulk Success Notice */}
            {bulkSuccess && (
              <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold font-heading">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Bulk Import Completed Successfully!</span>
                </div>
                <p className="text-[11px] text-teal-700 dark:text-teal-300">
                  Added <strong>{bulkSuccess.added}</strong> new student(s). {bulkSuccess.duplicates > 0 && `(Skipped ${bulkSuccess.duplicates} existing duplicates)`}
                </p>
              </div>
            )}

            {/* Bulk Error Alert */}
            {bulkError && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{bulkError}</span>
              </div>
            )}

            {/* Parse Warnings */}
            {parseErrors.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs space-y-1 max-h-32 overflow-y-auto">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <span>{parseErrors.length} row(s) had formatting issues:</span>
                </p>
                <ul className="list-disc pl-5 text-[11px] space-y-0.5">
                  {parseErrors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {parseErrors.length > 5 && <li>...and {parseErrors.length - 5} more</li>}
                </ul>
              </div>
            )}

            {/* Parsed Preview Table */}
            {parsedStudents.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-heading flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>Parsed Roster Preview ({parsedStudents.length} Students Ready)</span>
                  </p>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-heading text-[10px]">
                      <tr>
                        <th className="px-3 py-2">Hall Ticket / Roll No</th>
                        <th className="px-3 py-2">Student Name</th>
                        <th className="px-3 py-2">Branch</th>
                        <th className="px-3 py-2">Section</th>
                        <th className="px-3 py-2">Year / Sem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedStudents.slice(0, 8).map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="px-3 py-1.5 font-mono font-bold text-slate-900 dark:text-white">{s.hallTicketNo}</td>
                          <td className="px-3 py-1.5 font-semibold text-slate-800 dark:text-slate-200">{s.name}</td>
                          <td className="px-3 py-1.5 text-slate-500 font-bold">{s.branch}</td>
                          <td className="px-3 py-1.5 text-slate-500">Sec {s.section}</td>
                          <td className="px-3 py-1.5 text-slate-500 font-mono text-[11px]">Yr {s.year}, Sem {s.semester}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {parsedStudents.length > 8 && (
                  <p className="text-[11px] text-slate-400 text-right">
                    Showing first 8 of {parsedStudents.length} parsed records
                  </p>
                )}

                {/* Confirm Import Button */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setParsedStudents([]);
                      setFile(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Clear Roster
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkSubmit}
                    disabled={bulkLoading}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 transition shadow-sm flex items-center gap-2 font-heading disabled:opacity-50"
                  >
                    {bulkLoading ? 'Importing Roster...' : `Confirm & Import ${parsedStudents.length} Students`}
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </Modal>
  );
};

export default InsertStudentModal;
