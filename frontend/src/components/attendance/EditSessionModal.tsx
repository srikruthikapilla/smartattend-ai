import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useAttendance } from '../../context/AttendanceContext';
import { Sliders, CheckCircle2, AlertCircle, MapPin, Building, BookOpen, Clock } from 'lucide-react';

interface EditSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditSessionModal: React.FC<EditSessionModalProps> = ({ isOpen, onClose }) => {
  const { activeSession, updateSession } = useAttendance();

  const [sessionTitle, setSessionTitle] = useState('');
  const [room, setRoom] = useState('');
  const [branch, setBranch] = useState('CSE');
  const [section, setSection] = useState('A');
  const [year, setYear] = useState(3);
  const [radiusMeters, setRadiusMeters] = useState(150);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeSession) {
      setSessionTitle(activeSession.sessionTitle || 'Campus Lecture Session');
      setRoom(activeSession.room || 'Innovation Lab');
      setBranch(activeSession.branch || 'CSE');
      setSection(activeSession.section || 'A');
      setYear(activeSession.year || 3);
      setRadiusMeters(activeSession.radiusMeters || 150);
    }
  }, [activeSession, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    updateSession({
      sessionTitle,
      room,
      branch,
      section,
      year: Number(year),
      radiusMeters: Number(radiusMeters)
    });

    setSuccessMsg('Session parameters updated in real-time!');
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 1200);
  };

  if (!activeSession) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Active Session Parameters" maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        {successMsg && (
          <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Topic Title */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-heading flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-blue-500" />
            <span>Lecture Topic / Subject Name</span>
          </label>
          <input
            type="text"
            value={sessionTitle}
            onChange={(e) => setSessionTitle(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Room / Location */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-heading flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-indigo-500" />
            <span>Classroom / Lab Location</span>
          </label>
          <input
            type="text"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Branch, Section & Year */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-heading">
              Branch
            </label>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
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
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500"
            >
              <option value="A">Sec A</option>
              <option value="B">Sec B</option>
              <option value="C">Sec C</option>
              <option value="D">Sec D</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-heading">
              Academic Year
            </label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1st Year</option>
              <option value={2}>2nd Year</option>
              <option value={3}>3rd Year</option>
              <option value={4}>4th Year</option>
            </select>
          </div>
        </div>

        {/* Geofence Radius */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-heading flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-teal-500" />
              <span>Geofencing Radius</span>
            </label>
            <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400">
              {radiusMeters} meters
            </span>
          </div>
          <input
            type="range"
            min={30}
            max={500}
            step={10}
            value={radiusMeters}
            onChange={(e) => setRadiusMeters(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-600"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>Tight Classroom (30m)</span>
            <span>Campus Lab (150m)</span>
            <span>Entire Campus (500m)</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 hover:opacity-90 transition shadow-sm font-heading"
          >
            Save Changes
          </button>
        </div>
      </form>
    </Modal>
  );
};
