import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  QrCode,
  UserCheck,
  Users,
  MapPin,
  FileSpreadsheet,
  BarChart3,
  Edit3,
  Clock,
  GraduationCap,
  ShieldAlert
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { currentUser, pendingStudents } = useAuth();
  if (!currentUser) return null;

  const role = currentUser.role;

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-900/60 light:bg-white/70 border-r border-slate-800 light:border-slate-200 min-h-[calc(100vh-5rem)] p-4 transition-colors">
      <div className="space-y-6">
        
        {/* User Role Badge */}
        <div className="p-3.5 rounded-xl bg-slate-800/80 light:bg-slate-100 border border-slate-700/60 light:border-slate-200">
          <div className="text-xs font-semibold text-slate-400 light:text-slate-500 uppercase tracking-wider">
            Current Workspace
          </div>
          <div className="text-sm font-bold text-white light:text-slate-900 mt-0.5 capitalize flex items-center gap-2">
            {role === 'admin' && <ShieldAlert className="w-4 h-4 text-blue-400" />}
            {role === 'faculty' && <UserCheck className="w-4 h-4 text-indigo-400" />}
            {role === 'student' && <GraduationCap className="w-4 h-4 text-emerald-400" />}
            {role} Portal
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="space-y-1">
          
          {/* Admin Navigation */}
          {role === 'admin' && (
            <>
              <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Administration
              </div>
              <NavLink
                to="/admin/dashboard"
                className={({ isActive }) =>
                  `flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-slate-300 light:text-slate-700 hover:bg-slate-800 light:hover:bg-slate-100'
                  }`
                }
              >
                <LayoutDashboard className="w-4 h-4 mr-3" />
                Admin Dashboard
              </NavLink>

              <NavLink
                to="/admin/qr-session"
                className={({ isActive }) =>
                  `flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-slate-300 light:text-slate-700 hover:bg-slate-800 light:hover:bg-slate-100'
                  }`
                }
              >
                <QrCode className="w-4 h-4 mr-3" />
                Live QR Sessions
              </NavLink>

              <NavLink
                to="/admin/approvals"
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-slate-300 light:text-slate-700 hover:bg-slate-800 light:hover:bg-slate-100'
                  }`
                }
              >
                <div className="flex items-center">
                  <UserCheck className="w-4 h-4 mr-3" />
                  Student Approvals
                </div>
                {pendingStudents.length > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-amber-500 text-slate-950 rounded-full">
                    {pendingStudents.length}
                  </span>
                )}
              </NavLink>

              <NavLink
                to="/admin/gps"
                className={({ isActive }) =>
                  `flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-slate-300 light:text-slate-700 hover:bg-slate-800 light:hover:bg-slate-100'
                  }`
                }
              >
                <MapPin className="w-4 h-4 mr-3" />
                GPS Geofence Config
              </NavLink>

              <NavLink
                to="/admin/manual-attendance"
                className={({ isActive }) =>
                  `flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-slate-300 light:text-slate-700 hover:bg-slate-800 light:hover:bg-slate-100'
                  }`
                }
              >
                <Edit3 className="w-4 h-4 mr-3" />
                Manual Override Log
              </NavLink>
            </>
          )}

          {/* Faculty Navigation */}
          {role === 'faculty' && (
            <>
              <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Faculty Control
              </div>
              <NavLink
                to="/faculty/dashboard"
                className={({ isActive }) =>
                  `flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-slate-300 light:text-slate-700 hover:bg-slate-800 light:hover:bg-slate-100'
                  }`
                }
              >
                <LayoutDashboard className="w-4 h-4 mr-3" />
                Faculty Dashboard
              </NavLink>

              <NavLink
                to="/faculty/sessions"
                className={({ isActive }) =>
                  `flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-slate-300 light:text-slate-700 hover:bg-slate-800 light:hover:bg-slate-100'
                  }`
                }
              >
                <QrCode className="w-4 h-4 mr-3" />
                Classroom QR Session
              </NavLink>

              <NavLink
                to="/faculty/manual-attendance"
                className={({ isActive }) =>
                  `flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-slate-300 light:text-slate-700 hover:bg-slate-800 light:hover:bg-slate-100'
                  }`
                }
              >
                <Edit3 className="w-4 h-4 mr-3" />
                Manual Section Attendance
              </NavLink>
            </>
          )}

          {/* Student Navigation */}
          {role === 'student' && (
            <>
              <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Student Self-Service
              </div>
              <NavLink
                to="/student/dashboard"
                className={({ isActive }) =>
                  `flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                      : 'text-slate-300 light:text-slate-700 hover:bg-slate-800 light:hover:bg-slate-100'
                  }`
                }
              >
                <LayoutDashboard className="w-4 h-4 mr-3" />
                My Dashboard
              </NavLink>

              <NavLink
                to="/student/scan"
                className={({ isActive }) =>
                  `flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                      : 'text-slate-300 light:text-slate-700 hover:bg-slate-800 light:hover:bg-slate-100'
                  }`
                }
              >
                <QrCode className="w-4 h-4 mr-3" />
                Scan Attendance QR
              </NavLink>
            </>
          )}

          {/* Common Analytics & Export Section */}
          <div className="pt-4 border-t border-slate-800 light:border-slate-200 mt-4">
            <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Reports & Insights
            </div>
            <NavLink
              to="/analytics"
              className={({ isActive }) =>
                `flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-slate-300 light:text-slate-700 hover:bg-slate-800 light:hover:bg-slate-100'
                }`
              }
            >
              <BarChart3 className="w-4 h-4 mr-3" />
              Advanced Analytics
            </NavLink>
            <NavLink
              to="/reports"
              className={({ isActive }) =>
                `flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-slate-300 light:text-slate-700 hover:bg-slate-800 light:hover:bg-slate-100'
                }`
              }
            >
              <FileSpreadsheet className="w-4 h-4 mr-3" />
              Export PDF & Excel
            </NavLink>
          </div>

        </nav>
      </div>
    </aside>
  );
};
