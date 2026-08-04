import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserProfile } from '../../types/auth';
import { Modal } from '../../components/common/Modal';
import { UserCheck, CheckCircle2, XCircle, Edit, Ban, Search, ShieldAlert, GraduationCap, Smartphone, RefreshCw, Trash2, Mail, Sparkles } from 'lucide-react';

export const StudentApprovals: React.FC = () => {
  const { users, updateStudentStatus, updateUser, deleteUser, resetTrustedDevice } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'all'>('pending');
  const [search, setSearch] = useState('');
  
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
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase">
            Admin Approval & Security Command Center
          </span>
          <h2 className="text-2xl font-extrabold text-white mt-1">Dedicated Student Approval Center</h2>
          <p className="text-xs text-slate-400">
            Review face enrollment status, inspect trusted devices, approve registrations, and trigger Cloud Function email notices.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex bg-slate-950/60 p-1.5 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'pending' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            Pending ({students.filter(s => s.status === 'pending').length})
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'approved' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            Approved ({students.filter(s => s.status === 'approved').length})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'all' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            All Registered ({students.length})
          </button>
        </div>
      </div>

      {notificationMsg && (
        <div className="p-4 rounded-xl bg-blue-950/60 border border-blue-700 text-blue-200 text-xs font-semibold flex items-center gap-2">
          <Mail className="w-4 h-4 text-blue-400" />
          <span>{notificationMsg}</span>
        </div>
      )}

      {/* Main Table Panel */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Name, HT No, Branch, Email..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Hall Ticket No</th>
                <th className="py-3 px-4">Branch / Sec</th>
                <th className="py-3 px-4">AI Face Status</th>
                <th className="py-3 px-4">Trusted Device</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-center">Approval & Device Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No student registrations match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => (
                  <tr key={student.uid} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-semibold text-white">
                      <div className="flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-emerald-400" />
                        {student.name}
                      </div>
                      <div className="text-[10px] text-slate-500">{student.email}</div>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-amber-400">{student.hallTicketNo || 'N/A'}</td>
                    
                    <td className="py-3 px-4">{student.branch} • Sec {student.section} ({student.year} Yr)</td>

                    <td className="py-3 px-4">
                      {student.faceDescriptor && student.faceDescriptor.length > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-semibold">
                          <Sparkles className="w-3 h-3" /> Enrolled (128-d)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
                          Pending Enrollment
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {student.trustedDeviceId ? (
                        <div className="space-y-0.5">
                          <div className="font-mono text-[11px] text-emerald-400 truncate max-w-[120px]" title={student.trustedDeviceId}>
                            {student.trustedDeviceId}
                          </div>
                          <div className="text-[9px] text-slate-400">{student.trustedDeviceName || 'Mobile / PC'}</div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500">Not Bound Yet</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        student.status === 'approved' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        student.status === 'pending' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                        student.status === 'suspended' ? 'bg-purple-950 text-purple-400 border border-purple-800' :
                        'bg-red-950 text-red-400 border border-red-800'
                      }`}>
                        {student.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center space-x-1">
                      {student.status !== 'approved' && (
                        <button
                          onClick={() => handleStatusChange(student.uid, 'approved')}
                          className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white transition"
                          title="Approve Student"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}

                      {student.status !== 'rejected' && (
                        <button
                          onClick={() => handleStatusChange(student.uid, 'rejected')}
                          className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white transition"
                          title="Reject Student"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}

                      {student.trustedDeviceId && (
                        <button
                          onClick={() => handleResetDevice(student)}
                          className="p-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white transition"
                          title="Reset Trusted Device"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => setEditingStudent(student)}
                        className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white transition"
                        title="Edit Details"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      {student.status !== 'suspended' ? (
                        <button
                          onClick={() => handleStatusChange(student.uid, 'suspended')}
                          className="p-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white transition"
                          title="Suspend Account"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStatusChange(student.uid, 'approved')}
                          className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white transition"
                          title="Reactivate Account"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(student)}
                        className="p-1.5 rounded-lg bg-red-950 hover:bg-red-800 text-red-400 hover:text-white transition"
                        title="Delete Student Profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
        <Modal isOpen={!!editingStudent} onClose={() => setEditingStudent(null)} title="Edit Student Profile">
          <form onSubmit={handleEditSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Student Name</label>
              <input
                type="text"
                value={editingStudent.name}
                onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Hall Ticket No</label>
                <input
                  type="text"
                  value={editingStudent.hallTicketNo || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, hallTicketNo: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Branch</label>
                <input
                  type="text"
                  value={editingStudent.branch || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, branch: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="px-4 py-2 rounded-xl text-slate-400 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs"
              >
                Save Profile Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};
