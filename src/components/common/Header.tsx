import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon, LogOut, UserCheck, Shield, GraduationCap, User } from 'lucide-react';

export const Header: React.FC = () => {
  const { currentUser, logout, switchUser, users } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 light:bg-white/90 backdrop-blur-md border-b border-slate-800 light:border-slate-200 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* SBIT Header Branding with Logo */}
        <div className="flex items-center space-x-4">
          <div className="relative group flex-shrink-0">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full blur opacity-40 group-hover:opacity-75 transition duration-300"></div>
            <img
              src="/assets/logos/sbit-logo.png"
              alt="Swarna Bharathi Institute of Science & Technology"
              className="relative h-14 w-auto object-contain drop-shadow-md bg-white rounded-full p-1 border border-slate-700 light:border-slate-300"
            />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white light:text-slate-900 flex items-center gap-2">
              <span>Swarna Bharathi Institute of Science and Technology</span>
              <span className="hidden md:inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-900/60 light:bg-blue-100 text-blue-300 light:text-blue-800 border border-blue-700/50">
                SBIT Khammam
              </span>
            </h1>
            <p className="text-xs text-blue-400 light:text-blue-600 font-medium tracking-wide">
              Smart Campus Attendance & Analytics Platform • <span className="italic">Technology Empowers The Nation</span>
            </p>
          </div>
        </div>

        {/* User Status, Role Switcher, & Theme Controls */}
        <div className="flex items-center space-x-3">
          
          {/* Quick Demo Persona Switcher */}
          {currentUser && (
            <div className="hidden lg:flex items-center space-x-1 bg-slate-800/80 light:bg-slate-100 border border-slate-700 light:border-slate-300 rounded-lg p-1 text-xs">
              <span className="text-slate-400 px-2 font-medium">Switch Role:</span>
              <button
                onClick={() => switchUser('admin_101')}
                className={`px-2.5 py-1 rounded-md transition font-medium flex items-center gap-1 ${
                  currentUser.role === 'admin'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 light:text-slate-700 hover:bg-slate-700 light:hover:bg-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" /> Admin
              </button>
              <button
                onClick={() => switchUser('faculty_201')}
                className={`px-2.5 py-1 rounded-md transition font-medium flex items-center gap-1 ${
                  currentUser.role === 'faculty'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 light:text-slate-700 hover:bg-slate-700 light:hover:bg-slate-200'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" /> Faculty
              </button>
              <button
                onClick={() => switchUser('student_301')}
                className={`px-2.5 py-1 rounded-md transition font-medium flex items-center gap-1 ${
                  currentUser.role === 'student'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 light:text-slate-700 hover:bg-slate-700 light:hover:bg-slate-200'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" /> Student
              </button>
            </div>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-800 light:bg-slate-100 text-slate-300 light:text-slate-700 hover:text-white light:hover:text-slate-900 border border-slate-700 light:border-slate-300 transition-colors shadow-sm"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-600" />}
          </button>

          {/* User Profile Info & Logout */}
          {currentUser ? (
            <div className="flex items-center space-x-3 pl-2 border-l border-slate-800 light:border-slate-200">
              <div className="hidden sm:block text-right">
                <div className="text-sm font-semibold text-white light:text-slate-900">{currentUser.name}</div>
                <div className="text-xs text-slate-400 light:text-slate-500 capitalize flex items-center justify-end gap-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    currentUser.role === 'admin' ? 'bg-blue-400' : currentUser.role === 'faculty' ? 'bg-indigo-400' : 'bg-emerald-400'
                  }`}></span>
                  {currentUser.role} {currentUser.designation ? `(${currentUser.designation})` : ''}
                </div>
              </div>
              <button
                onClick={logout}
                className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : null}

        </div>
      </div>
    </header>
  );
};
