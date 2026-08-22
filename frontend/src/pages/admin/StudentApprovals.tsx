import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserProfile } from '../../types/auth';
import { Modal } from '../../components/common/Modal';
import { InsertStudentModal } from '../../components/admin/InsertStudentModal';
import { UserCheck, CheckCircle2, XCircle, Edit, Ban, Search, ShieldAlert, GraduationCap, Smartphone, RefreshCw, Trash2, Mail, Sparkles, UserPlus, FileSpreadsheet } from 'lucide-react';

export const StudentApprovals: React.FC = () => {
  const { users, updateStudentStatus, updateUser, deleteUser, resetTrustedDevice } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [isInsertModalOpen, setIsInsertModalOpen] = useState(false);
  
  const [editingStudent, setEditingStudent] = useState<UserProfile | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const students = users.filter(u => u.role === 'student');

  const filteredStudents = students.filter(s => {
    if (activeTab === 'pending' && s.status !== 'pending') return false;
    if (activeTab === 'approved' && s.status !== 'approved') return false;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.hallTicketNo && s.hallTicketNo.toLowerCase().includes(q)) ||
      (s.branch && s.branch.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q))
    );
  });

  const triggerNotify = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  const handleStatusChange = (uid: string, status: 'approved' | 'rejected' | 'suspended') => {
    const target = students.find(s => s.uid === uid);
    updateStudentStatus(uid, status);
    triggerNotify(`Updated ${target?.name || 'student'} status to ${status.toUpperCase()} and sent notification email.`);
  };

  const handleResetDevice = (student: UserProfile) => {
    resetTrustedDevice(student.uid);
    triggerNotify(`Reset trusted device for ${student.name}. Notification email dispatched.`);
  };

  const handleDelete = (student: UserProfile) => {
    if (window.confirm(`Are you sure you want to permanently delete student record for ${student.name}?`)) {
      deleteUser(student.uid);
      triggerNotify(`Deleted student profile for ${student.name}.`);
    }
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStudent) {
      updateUser(editingStudent.uid, editingStudent);
      setEditingStudent(null);
      triggerNotify(`Saved changes for ${editingStudent.name}.`);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto w-full space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
            Student Enrollment & Security Registry
          </span>
          <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white mt-1 tracking-tight">Student Registration & Security Approvals</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review face enrollment status, inspect trusted devices, approve registrations, and manage credentials.
          </p>
        </div>

        {/* Header Actions: Insert Students & Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsInsertModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition font-heading"
          >
            <UserPlus className="w-4 h-4" />
            <span>Insert Students</span>
          </button>

          <div className="flex flex-wrap bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold gap-1">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 rounded-md transition ${activeTab === 'pending' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Pending ({students.filter(s => s.status === 'pending').length})
            </button>
            <button
              onClick={() => setActiveTab('approved')}
              className={`px-3 py-1.5 rounded-md transition ${activeTab === 'approved' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Approved ({students.filter(s => s.status === 'approved').length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-md transition ${activeTab === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              All Registered ({students.length})
            </button>
          </div>
        </div>
      </div>

      {notificationMsg && (
        <div className="p-4 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
          <span>{notificationMsg}</span>
        </div>
      )}

      {/* Main Student Directory Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden space-y-4">
        
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-slate-900 dark:text-white" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Student Records ({filteredStudents.length})
            </h3>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Student, Hall Ticket, Branch, Email..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-slate-900 dark:focus:border-white focus:outline-none transition"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[780px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold text-[11px]">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Hall Ticket No</th>
                <th className="py-3 px-4">Branch & Section</th>
                <th className="py-3 px-4">Face Recognition AI</th>
                <th className="py-3 px-4">Trusted Hardware ID</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No students match the current filter or search criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => (
                  <tr key={student.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    
                    {/* Student Info */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{student.name}</div>
                      {student.phone && <div className="text-slate-400 text-[10px]">{student.phone}</div>}
                    </td>

                    {/* Hall Ticket No */}
                    <td className="py-3 px-4 font-mono font-bold text-teal-600 dark:text-teal-400">
                      {student.hallTicketNo || 'Pending'}
                    </td>

                    {/* Academic Dept */}
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900 dark:text-white">{student.branch || 'CSE'}</span> - Sec {student.section || 'A'}
                      <div className="text-slate-400 text-[10px]">Year {student.year || '3'}, Sem {student.semester || '1'}</div>
                    </td>

                    {/* AI Face Status */}
                    <td className="py-3 px-4">
                      {student.faceEnrollmentStatus === 'enrolled' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
                          <Sparkles className="w-3 h-3 text-teal-500" /> 128-d Vector Enrolled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          Not Enrolled
                        </span>
                      )}
                    </td>

                    {/* Hardware Fingerprint */}
                    <td className="py-3 px-4">
                      {student.trustedDeviceId ? (
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          <Smartphone className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                          <span className="truncate max-w-[120px]" title={student.trustedDeviceId}>
                            {student.trustedDeviceId}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Not Bound</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        student.status === 'approved' ? 'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800' :
                        student.status === 'pending' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800' :
                        'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                      }`}>
                        {student.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        
                        {student.status === 'pending' && (
                          <button
                            onClick={() => handleStatusChange(student.uid, 'approved')}
                            className="px-2.5 py-1 rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-[10px] hover:opacity-90 transition"
                            title="Approve Registration"
                          >
                            Approve
                          </button>
                        )}

                        {student.status === 'approved' && (
                          <button
                            onClick={() => handleStatusChange(student.uid, 'suspended')}
                            className="p-1.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 transition"
                            title="Suspend Registration"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {student.trustedDeviceId && (
                          <button
                            onClick={() => handleResetDevice(student)}
                            className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-slate-200 transition"
                            title="Reset Trusted Device Binding"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => setEditingStudent({ ...student })}
                          className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"
                          title="Edit Student Info"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDelete(student)}
                          className="p-1.5 rounded bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 transition"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Edit Student Modal */}
      {editingStudent && (
        <Modal
          isOpen={true}
          onClose={() => setEditingStudent(null)}
          title={`Edit Student Profile: ${editingStudent.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleEditSave} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Full Name</label>
              <input
                type="text"
                value={editingStudent.name}
                onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Hall Ticket No</label>
                <input
                  type="text"
                  value={editingStudent.hallTicketNo || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, hallTicketNo: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Branch</label>
                <select
                  value={editingStudent.branch || 'CSE'}
                  onChange={(e) => setEditingStudent({ ...editingStudent, branch: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="CSE">CSE</option>
                  <option value="ECE">ECE</option>
                  <option value="EEE">EEE</option>
                  <option value="MECH">MECH</option>
                  <option value="CIVIL">CIVIL</option>
                  <option value="IT">IT</option>
                  <option value="AIML">AIML</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Year</label>
                <input
                  type="text"
                  value={editingStudent.year || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, year: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Semester</label>
                <input
                  type="text"
                  value={editingStudent.semester || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, semester: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Section</label>
                <input
                  type="text"
                  value={editingStudent.section || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, section: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold"
              >
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Insert & Bulk Import Students Modal */}
      <InsertStudentModal
        isOpen={isInsertModalOpen}
        onClose={() => setIsInsertModalOpen(false)}
      />

    </div>
  );
};
