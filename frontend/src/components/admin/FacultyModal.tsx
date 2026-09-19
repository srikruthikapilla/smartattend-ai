import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import { UserProfile } from '../../types/auth';
import {
  X,
  UserCheck,
  Mail,
  Phone,
  Building,
  Briefcase,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  FileSpreadsheet,
  Upload,
  Download,
  FileCheck
} from 'lucide-react';

interface FacultyModalProps {
  isOpen: boolean;
  onClose: () => void;
  facultyToEdit: UserProfile | null;
}

const DEPARTMENTS = [
  'Computer Science & Engineering',
  'Electronics & Communication Engg',
  'Artificial Intelligence & ML',
  'Data Science',
  'Electrical & Electronics Engg',
  'Mechanical Engineering',
  'Civil Engineering',
  'Humanities & Sciences'
];

const DESIGNATIONS = [
  'Professor & HOD',
  'Professor',
  'Associate Professor',
  'Assistant Professor',
  'Senior Assistant Professor',
  'Adjunct Faculty',
  'Lab Instructor'
];

const COMMON_BRANCHES = ['CSE', 'AI', 'DS'];

export const FacultyModal: React.FC<FacultyModalProps> = ({
  isOpen,
  onClose,
  facultyToEdit
}) => {
  const { registerFaculty, updateUser, deleteUser, bulkInsertFaculty, refreshUsers } = useAuth();

  const isEditMode = Boolean(facultyToEdit);
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');

  // Single Faculty Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('faculty@123');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [designation, setDesignation] = useState(DESIGNATIONS[2]);
  const [assignedBranch, setAssignedBranch] = useState(COMMON_BRANCHES[0]);
  const [sections, setSections] = useState<string[]>(['CSE-A', 'CSE-B']);
  const [customSection, setCustomSection] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Bulk Upload State
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [parsedFaculty, setParsedFaculty] = useState<any[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<{ added: number; duplicates: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (facultyToEdit) {
      setName(facultyToEdit.name || '');
      setEmail(facultyToEdit.email || '');
      setPassword('');
      setPhone(facultyToEdit.phone || '');
      setDepartment(facultyToEdit.department || DEPARTMENTS[0]);
      setDesignation(facultyToEdit.designation || DESIGNATIONS[2]);
      setAssignedBranch(facultyToEdit.assignedBranch || COMMON_BRANCHES[0]);
      setSections(
        facultyToEdit.assignedSections && facultyToEdit.assignedSections.length > 0
          ? facultyToEdit.assignedSections
          : ['CSE-A']
      );
      setActiveTab('single');
    } else {
      setName('');
      setEmail('');
      setPassword('faculty@123');
      setPhone('');
      setDepartment(DEPARTMENTS[0]);
      setDesignation(DESIGNATIONS[2]);
      setAssignedBranch(COMMON_BRANCHES[0]);
      setSections(['CSE-A', 'CSE-B']);
    }
    setError(null);
    setSuccessMsg(null);
    setShowDeleteConfirm(false);
    setBulkFile(null);
    setParsedFaculty([]);
    setBulkError(null);
    setBulkSuccess(null);
  }, [facultyToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAddSection = () => {
    const trimmed = customSection.trim().toUpperCase();
    if (trimmed && !sections.includes(trimmed)) {
      setSections([...sections, trimmed]);
      setCustomSection('');
    }
  };

  const handleRemoveSection = (sec: string) => {
    setSections(sections.filter(s => s !== sec));
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setError('Faculty full name is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid institutional email address.');
      return;
    }

    setLoading(true);
    try {
      if (isEditMode && facultyToEdit) {
        await updateUser(facultyToEdit.uid, {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          department,
          designation,
          assignedBranch,
          assignedSections: sections
        });
        await refreshUsers();
        setSuccessMsg('Faculty profile updated successfully!');
      } else {
        await registerFaculty(
          {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim() || undefined,
            college: 'Swarna Bharathi Institute of Science and Technology (SBIT)',
            department,
            designation,
            assignedBranch,
            assignedSections: sections
          },
          password.trim() || 'faculty@123'
        );
        await refreshUsers();
        setSuccessMsg('Faculty member added and registered successfully!');
      }
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Operation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!facultyToEdit) return;
    setLoading(true);
    try {
      await deleteUser(facultyToEdit.uid || facultyToEdit.email);
      await refreshUsers();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete faculty member.');
    } finally {
      setLoading(false);
    }
  };

  // ── Bulk File Handling ────────────────────────────────────────────────────

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;

    setBulkFile(uploaded);
    setBulkError(null);
    setBulkSuccess(null);

    const reader = new FileReader();
    reader.onload = evt => {
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
        rows.forEach(row => {
          const normalized: Record<string, any> = {};
          Object.keys(row).forEach(k => {
            const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            normalized[cleanKey] = row[k];
          });

          const facultyName = (
            normalized['name'] ||
            normalized['fullname'] ||
            normalized['facultyname'] ||
            normalized['professorname'] ||
            ''
          ).toString().trim();

          const facultyEmail = (
            normalized['email'] ||
            normalized['facultyemail'] ||
            normalized['mail'] ||
            ''
          ).toString().trim().toLowerCase();

          if (!facultyName || !facultyEmail) return;

          const facultyPhone = (
            normalized['phone'] ||
            normalized['phonenumber'] ||
            normalized['mobile'] ||
            ''
          ).toString().trim();

          const dept = (
            normalized['department'] ||
            normalized['dept'] ||
            'Computer Science & Engineering'
          ).toString().trim();

          const desig = (
            normalized['designation'] ||
            normalized['role'] ||
            'Assistant Professor'
          ).toString().trim();

          const branch = (
            normalized['branch'] ||
            normalized['assignedbranch'] ||
            'CSE'
          ).toString().trim().toUpperCase();

          const secStr = (
            normalized['sections'] ||
            normalized['section'] ||
            'A, B'
          ).toString().trim();

          const parsedSections = secStr
            .split(/[,;/]+/)
            .map(s => s.trim().toUpperCase())
            .filter(Boolean);

          validList.push({
            name: facultyName,
            email: facultyEmail,
            phone: facultyPhone,
            department: dept,
            designation: desig,
            assignedBranch: branch,
            assignedSections: parsedSections.length > 0 ? parsedSections : ['A', 'B'],
            password: 'faculty@123'
          });
        });

        if (validList.length === 0) {
          setBulkError('No valid faculty records found. Ensure columns contain "Name" and "Email".');
          return;
        }

        setParsedFaculty(validList);
      } catch (err: any) {
        setBulkError('Failed to parse Excel file. Please ensure it is a valid .xlsx or .csv format.');
      }
    };
    reader.readAsArrayBuffer(uploaded);
  };

  const handleBulkSubmit = async () => {
    if (parsedFaculty.length === 0) return;
    setBulkLoading(true);
    setBulkError(null);

    try {
      const result = await bulkInsertFaculty(parsedFaculty);
      await refreshUsers();
      setBulkSuccess({
        added: result.addedCount,
        duplicates: result.duplicateCount
      });
      setParsedFaculty([]);
      setBulkFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setBulkError(err.message || 'Bulk upload failed. Please try again.');
    } finally {
      setBulkLoading(false);
    }
  };

  const downloadFacultyTemplate = () => {
    const templateData = [
      {
        'Name': 'Dr. Rajesh Sharma',
        'Email': 'rajesh.sharma@sbit.ac.in',
        'Phone': '+91 9876543210',
        'Department': 'Computer Science & Engineering',
        'Designation': 'Associate Professor',
        'Branch': 'CSE',
        'Sections': 'A, B'
      },
      {
        'Name': 'Prof. Ananya Rao',
        'Email': 'ananya.rao@sbit.ac.in',
        'Phone': '+91 9848123456',
        'Department': 'Artificial Intelligence & ML',
        'Designation': 'Assistant Professor',
        'Branch': 'AI',
        'Sections': 'A'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Faculty_Template');
    XLSX.writeFile(workbook, 'Faculty_Import_Template.xlsx');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading">
                {isEditMode ? 'Edit Faculty Profile' : 'Faculty Management'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEditMode ? 'Update academic assignment and contact details' : 'Register individual faculty or bulk import via Excel sheet'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls (Only shown when adding new faculty, not editing) */}
        {!isEditMode && (
          <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/30 dark:bg-slate-900/40">
            <button
              onClick={() => setActiveTab('single')}
              className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
                activeTab === 'single'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Single Faculty Registration
            </button>
            <button
              onClick={() => setActiveTab('bulk')}
              className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'bulk'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Bulk Import (Excel / CSV)
            </button>
          </div>
        )}

        {/* Content Body */}
        {activeTab === 'single' ? (
          <form onSubmit={handleSingleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-heading">
                Full Name with Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Rajesh Kumar"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-heading">
                  Institutional Email <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="faculty@sbit.ac.in"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-heading">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98481 23456"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            {!isEditMode && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-heading">
                  Initial Login Password <span className="text-slate-400 text-[10px] lowercase">(default: faculty@123)</span>
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="faculty@123"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-400 font-mono"
                />
              </div>
            )}

            {/* Department & Designation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-heading">
                  Department
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:outline-none transition-all"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-heading">
                  Designation
                </label>
                <select
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:outline-none transition-all"
                >
                  {DESIGNATIONS.map((desig) => (
                    <option key={desig} value={desig}>
                      {desig}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assigned Branch & Sections */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-heading">
                  Primary Branch
                </label>
                <select
                  value={assignedBranch}
                  onChange={(e) => setAssignedBranch(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:outline-none transition-all font-semibold"
                >
                  {COMMON_BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-heading">
                  Assigned Sections / Batches
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customSection}
                    onChange={(e) => setCustomSection(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSection();
                      }
                    }}
                    placeholder="e.g. CSE-A, AI-B"
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:outline-none transition-all uppercase placeholder:normal-case placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddSection}
                    className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Section Chips */}
            <div>
              <div className="flex flex-wrap gap-2 pt-1">
                {sections.map((sec) => (
                  <span
                    key={sec}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                  >
                    {sec}
                    <button
                      type="button"
                      onClick={() => handleRemoveSection(sec)}
                      className="hover:text-rose-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {sections.length === 0 && (
                  <span className="text-xs text-slate-400 italic">No sections assigned yet. Type above and click Add.</span>
                )}
              </div>
            </div>

            {/* Delete Confirmation Box if in Edit Mode */}
            {isEditMode && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                {showDeleteConfirm ? (
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2">
                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                      Are you sure you want to remove <span className="font-bold">{facultyToEdit?.name}</span>?
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition"
                      >
                        Yes, Delete Faculty
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-300 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1.5 font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove this faculty member from institution
                  </button>
                )}
              </div>
            )}

            {/* Modal Footer Buttons */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition flex items-center gap-2 disabled:opacity-50"
              >
                {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                {isEditMode ? 'Save Changes' : 'Register Faculty'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {bulkError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{bulkError}</span>
              </div>
            )}

            {bulkSuccess && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 space-y-1">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Bulk Import Complete!</span>
                </div>
                <p className="text-xs">
                  Successfully registered {bulkSuccess.added} faculty members ({bulkSuccess.duplicates} duplicates skipped).
                </p>
              </div>
            )}

            {/* Download Template Banner */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Download Faculty Excel Template (.xlsx)
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Includes formatted columns for Name, Email, Phone, Department, Designation, and Branch.
                </p>
              </div>
              <button
                onClick={downloadFacultyTemplate}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 transition flex items-center gap-1.5 shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Download Template
              </button>
            </div>

            {/* Drag & Drop / File Input */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl hover:border-blue-500 dark:hover:border-blue-400 bg-slate-50/50 dark:bg-slate-800/30 transition text-center cursor-pointer"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 border border-blue-100 dark:border-blue-900/50">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {bulkFile ? bulkFile.name : 'Click or drag Excel sheet (.xlsx, .csv) here'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Columns: Name, Email, Phone, Department, Designation, Branch, Sections
              </p>
            </div>

            {/* Parsed Preview Table */}
            {parsedFaculty.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Parsed Records ({parsedFaculty.length})
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-semibold sticky top-0">
                      <tr>
                        <th className="p-2.5">Name</th>
                        <th className="p-2.5">Email</th>
                        <th className="p-2.5">Department</th>
                        <th className="p-2.5">Designation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedFaculty.slice(0, 10).map((f, i) => (
                        <tr key={i} className="text-slate-700 dark:text-slate-300">
                          <td className="p-2.5 font-medium">{f.name}</td>
                          <td className="p-2.5 text-slate-500">{f.email}</td>
                          <td className="p-2.5">{f.department}</td>
                          <td className="p-2.5">{f.designation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedFaculty.length > 10 && (
                  <p className="text-[11px] text-slate-400 italic text-center">
                    ...and {parsedFaculty.length - 10} more records ready to import.
                  </p>
                )}
              </div>
            )}

            {/* Bulk Footer Buttons */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleBulkSubmit}
                disabled={bulkLoading || parsedFaculty.length === 0}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition flex items-center gap-2 disabled:opacity-50"
              >
                {bulkLoading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                Import {parsedFaculty.length} Faculty
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
