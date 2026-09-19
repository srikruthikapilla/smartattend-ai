import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAttendance } from '../../context/AttendanceContext';
import { QRGenerator } from '../../components/qr/QRGenerator';
import { InsertStudentModal } from '../../components/admin/InsertStudentModal';
import { EditSessionModal } from '../../components/attendance/EditSessionModal';
import { LiveAttendanceRoster } from '../../components/attendance/LiveAttendanceRoster';
import { StudentAttendanceLookupModal } from '../../components/attendance/StudentAttendanceLookupModal';
import {
  PlusCircle, StopCircle, FileSpreadsheet, Edit3, UserCheck
} from 'lucide-react';

export const FacultyDashboard: React.FC = () => {
  const { currentUser, approvedStudents } = useAuth();
  const {
    activeSession,
    endSession,
    startSession,
    geofence,
  } = useAttendance();

  const [isInsertModalOpen, setIsInsertModalOpen] = useState(false);
  const [isEditSessionModalOpen, setIsEditSessionModalOpen] = useState(false);
  const [isStudentLookupOpen, setIsStudentLookupOpen] = useState(false);
  const [selectedStudentLookup, setSelectedStudentLookup] = useState('');

  const [isStartingSession, setIsStartingSession] = useState(false);

  const handleStartSession = () => {
    if (!currentUser) {
      alert("Please log in as a Faculty member to start an attendance session.");
      return;
    }

    setIsStartingSession(true);

    startSession({
      sessionTitle: `${currentUser.department || "Machine Learning"} Lecture Session`,
      facultyId: currentUser.uid,
      facultyName: currentUser.name || "Faculty Member",
      branch: currentUser.assignedBranch || "CSE",
      section: currentUser.assignedSections?.[0] || "A",
      year: 3,
      room: "Innovation Lab 301",
      durationMinutes: 90,
      radiusMeters: geofence?.radiusMeters || 150,
      latitude: geofence?.latitude || 17.2472,
      longitude: geofence?.longitude || 80.1514
    });

    setIsStartingSession(false);
  };

  const assignedSections = currentUser?.assignedSections || ["CSE-A", "CSE-B"];

  return (
    <div className="max-w-[1440px] mx-auto w-full space-y-6 animate-fade-up">

      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight font-heading">
              Faculty Command Portal
            </h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-sans">
            {activeSession
              ? `Dynamic Lecture Broadcasting • ${activeSession.sessionTitle || "Campus Session"}`
              : `Welcome, ${currentUser?.name || 'Faculty Member'} • SBIT Innovation Centre`
            }
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setSelectedStudentLookup('');
              setIsStudentLookupOpen(true);
            }}
            className="btn-outline"
            title="Lookup student's individual attendance profile, exam eligibility, and history"
          >
            <UserCheck className="w-4 h-4 text-accent" />
            <span>Check Student Attendance</span>
          </button>

          <button
            onClick={() => setIsInsertModalOpen(true)}
            className="btn-secondary"
            title="Import students via Excel (.xlsx) / CSV or manual entry"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Import Students</span>
          </button>

          {activeSession && (
            <button
              onClick={() => setIsEditSessionModalOpen(true)}
              className="btn-outline"
              title="Edit session parameters, room, or geofence radius"
            >
              <Edit3 className="w-4 h-4 text-accent" />
              <span>Edit Session</span>
            </button>
          )}

          {activeSession ? (
            <button
              onClick={() => endSession()}
              className="btn-premium bg-red-600 hover:bg-red-500 text-white shadow-xs hover:shadow-red-600/20"
            >
              <StopCircle className="w-4 h-4" />
              <span>End Session</span>
            </button>
          ) : (
            <button
              onClick={handleStartSession}
              disabled={isStartingSession}
              className="btn-primary disabled:opacity-50"
            >
              <PlusCircle className={`w-4 h-4 ${isStartingSession ? 'animate-spin' : ''}`} />
              <span>{isStartingSession ? 'Locating GPS...' : 'Start Session'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Active Session Controls & Dynamic QR Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Left Column: Dynamic QR Generator (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">

          {/* QR Card */}
          <div className="card-elevation p-5 sm:p-6 flex flex-col items-center">

            {/* Status Bar */}
            <div className="w-full flex justify-between items-center mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {activeSession ? (
                  <>
                    <div className="relative w-2.5 h-2.5">
                      <div className="absolute inset-0 bg-accent rounded-full"></div>
                      <div className="absolute inset-0 bg-accent rounded-full animate-ping"></div>
                    </div>
                    <span className="text-xs font-bold text-accent uppercase tracking-wider font-heading">
                      Session Live & Broadcasting
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-2.5 h-2.5 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-heading">
                      Broadcasting Inactive
                    </span>
                  </>
                )}
              </div>

              {activeSession && (
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                  {activeSession.room || "Innovation Lab"}
                </span>
              )}
            </div>

            {/* QR Code */}
            {activeSession ? (
              <QRGenerator />
            ) : (
              <div className="w-full p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-surface-dim/40 text-center space-y-3">
                <div className="w-12 h-12 mx-auto bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400">
                  <PlusCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 font-heading">No Active Session</p>
                  <p className="text-xs text-slate-400 mt-0.5">Click "Start Session" above to activate dynamic QR rotation.</p>
                </div>
              </div>
            )}
          </div>

          {/* Session Details Card */}
          {activeSession && (
            <div className="card-elevation p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-heading">
                  Active Session Parameters
                </span>
                <button
                  onClick={() => setIsEditSessionModalOpen(true)}
                  className="text-xs text-accent font-bold hover:underline flex items-center gap-1 font-heading"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-dim border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Topic</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 truncate font-heading mt-0.5">{activeSession.sessionTitle}</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-dim border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Target Class</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 font-heading mt-0.5">{activeSession.branch} - Sec {activeSession.section} (Yr {activeSession.year})</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-dim border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Classroom</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 font-heading mt-0.5">{activeSession.room}</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-dim border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Geofence Radius</div>
                  <div className="font-mono font-bold text-accent mt-0.5">{activeSession.radiusMeters || 150}m Active</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Attendance Student Roster (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <LiveAttendanceRoster
            title="Real-Time Student Attendance Roster"
            defaultBranch={activeSession?.branch || currentUser?.assignedBranch || "CSE"}
            defaultSection={activeSession?.section || "A"}
            showSectionFilter={true}
          />
        </div>

      </div>

      {/* Insert & Bulk Import Students Modal */}
      <InsertStudentModal
        isOpen={isInsertModalOpen}
        onClose={() => setIsInsertModalOpen(false)}
        defaultBranch={currentUser?.assignedBranch || 'CSE'}
        defaultSection={assignedSections[0]?.split('-')[1] || 'A'}
      />

      {/* Edit Active Session Modal */}
      <EditSessionModal
        isOpen={isEditSessionModalOpen}
        onClose={() => setIsEditSessionModalOpen(false)}
      />

      {/* Individual Student Attendance Lookup Modal */}
      <StudentAttendanceLookupModal
        isOpen={isStudentLookupOpen}
        onClose={() => setIsStudentLookupOpen(false)}
        initialHallTicket={selectedStudentLookup}
      />

    </div>
  );
};

