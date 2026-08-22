import React, { useState, useEffect } from 'react';
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
  Trash2
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

const COMMON_BRANCHES = ['CSE', 'ECE', 'AIML', 'DS', 'EEE', 'MECH', 'CIVIL'];

export const FacultyModal: React.FC<FacultyModalProps> = ({
  isOpen,
  onClose,
  facultyToEdit
}) => {
  const { registerFaculty, updateUser, deleteUser } = useAuth();

  const isEditMode = Boolean(facultyToEdit);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  useEffect(() => {
    if (facultyToEdit) {
      setName(facultyToEdit.name || '');
      setEmail(facultyToEdit.email || '');
      setPassword('');
      setPhone(facultyToEdit.phone || '');
      setDepartment(facultyToEdit.department || DEPARTMENTS[0]);
      setDesignation(facultyToEdit.designation || DESIGNATIONS[2]);
      setAssignedBranch(facultyToEdit.assignedBranch || COMMON_BRANCHES[0]);
      setSections(facultyToEdit.assignedSections && facultyToEdit.assignedSections.length > 0 
        ? facultyToEdit.assignedSections 
        : ['CSE-A']);
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

  const handleSubmit = async (e: React.FormEvent) => {
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
        setSuccessMsg('Faculty profile updated successfully in Supabase!');
      } else {
        await registerFaculty({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          college: 'Swarna Bharathi Institute of Science and Technology (SBIT)',
          department,
          designation,
          assignedBranch,
          assignedSections: sections
        }, password.trim() || 'faculty@123');
        setSuccessMsg('Faculty member added and registered in Supabase Auth & Users!');
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
      await deleteUser(facultyToEdit.uid);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete faculty member.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading">
                {isEditMode ? 'Edit Faculty Profile' : 'Add New Faculty Member'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEditMode ? 'Update academic assignment and contact details' : 'Register a professor to conduct attendance sessions'}
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

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
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

          {/* Password (for new faculty registration in Supabase Auth) */}
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
                  placeholder="e.g. CSE-A, AIML-B"
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
      </div>
    </div>
  );
};
