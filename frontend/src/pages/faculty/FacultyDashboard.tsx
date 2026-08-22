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

    const triggerStart = (lat?: number, lng?: number) => {
      startSession({
        sessionTitle: `${currentUser.department || "Machine Learning"} Lecture Session`,
        facultyId: currentUser.uid,
        facultyName: currentUser.name || "Faculty Member",
        branch: currentUser.assignedBranch || "CSM",
        section: currentUser.assignedSections?.[0] || "A",
        year: 3,
        room: "Innovation Lab 301",
        durationMinutes: 90,
        radiusMeters: 150,
        latitude: lat,
        longitude: lng
      });
      setIsStartingSession(false);
    };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          triggerStart(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.warn("GPS notice, falling back to default:", err);
          triggerStart(17.2472, 80.1514);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      triggerStart(17.2472, 80.1514);
    }
  };

  const assignedSections = currentUser?.assignedSections || ["CSE-A", "CSE-B"];

  return (
    <div className="max-w-[1440px] mx-auto w-full space-y-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight font-heading">
              Faculty Command Portal
            </h2>

          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
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
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold font-heading flex items-center gap-2 transition-all shadow-xs hover:shadow-indigo-500/20 active:scale-[0.98]"
            title="Lookup student's individual attendance profile, exam eligibility, and history"
          >
            <UserCheck className="w-4 h-4" />
            <span>Check Student Attendance</span>
          </button>

          <button
            onClick={() => setIsInsertModalOpen(true)}
            className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold font-heading flex items-center gap-2 transition-all shadow-xs hover:shadow-teal-500/20 active:scale-[0.98]"
            title="Import students via Excel (.xlsx) / CSV or manual entry"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Import Students</span>
          </button>

          {activeSession && (
            <button
              onClick={() => setIsEditSessionModalOpen(true)}
              className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold font-heading flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all shadow-2xs active:scale-[0.98]"
              title="Edit session parameters, room, or geofence radius"
            >
              <Edit3 className="w-4 h-4 text-blue-500" />
              <span>Edit Session</span>
            </button>
          )}

          {activeSession ? (
            <button
              onClick={() => endSession()}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold font-heading flex items-center gap-2 transition-all shadow-xs hover:shadow-rose-600/20 active:scale-[0.98]"
            >
              <StopCircle className="w-4 h-4" />
              <span>End Session</span>
            </button>
          ) : (
            <button
              onClick={handleStartSession}
              disabled={isStartingSession}
              className="bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 px-5 py-2.5 rounded-xl text-xs font-bold font-heading flex items-center gap-2 transition-all shadow-xs active:scale-[0.98] disabled:opacity-50"
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col items-center">

            {/* Status Bar */}
            <div className="w-full flex justify-between items-center mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {activeSession ? (
                  <>
                    <div className="relative w-2.5 h-2.5">
                      <div className="absolute inset-0 bg-teal-500 rounded-full"></div>
                      <div className="absolute inset-0 bg-teal-500 rounded-full animate-ping"></div>
                    </div>
                    <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider font-heading">
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
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-bold">
                  {activeSession.room || "Innovation Lab"}
                </span>
              )}
            </div>

            {/* QR Code */}
            {activeSession ? (
              <QRGenerator />
            ) : (
              <div className="w-full p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-center space-y-3">
                <div className="w-12 h-12 mx-auto bg-slate-200 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-400">
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
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-heading">
                  Active Session Parameters
                </span>
                <button
                  onClick={() => setIsEditSessionModalOpen(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Topic</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 truncate font-heading">{activeSession.sessionTitle}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Target Class</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 font-heading">{activeSession.branch} - Sec {activeSession.section} (Yr {activeSession.year})</div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Classroom</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 font-heading">{activeSession.room}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Geofence Radius</div>
                  <div className="font-mono font-bold text-teal-600 dark:text-teal-400">{activeSession.radiusMeters || 150}m Active</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Attendance Student Roster (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <LiveAttendanceRoster
            title="Real-Time Student Attendance Roster"
            defaultBranch={activeSession?.branch || currentUser?.assignedBranch || "CSM"}
            defaultSection={activeSession?.section || "A"}
            showSectionFilter={true}
          />
        </div>

      </div>

      {/* Insert & Bulk Import Students Modal */}
      <InsertStudentModal
        isOpen={isInsertModalOpen}
        onClose={() => setIsInsertModalOpen(false)}
        defaultBranch={currentUser?.assignedBranch || 'CSM'}
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

