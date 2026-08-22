import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon, LogOut, Shield, UserCheck, Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const { currentUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/admin/dashboard')) return 'Admin Control Center';
    if (path.includes('/admin/approvals')) return 'Student Approvals';
    if (path.includes('/admin/manual-attendance') || path.includes('/faculty/manual-attendance')) return 'Manual Attendance';
    if (path.includes('/faculty/dashboard')) return 'Faculty Portal';
    if (path.includes('/attendance/live')) return 'Live Attendance Stream';
    if (path.includes('/reports')) return 'Attendance Reports';
    if (path.includes('/analytics')) return 'Visual Analytics';
    return 'Smart Attend';
  };

  const roleIcon = currentUser?.role === 'admin'
    ? <Shield className="w-3.5 h-3.5 text-blue-500" />
    : <UserCheck className="w-3.5 h-3.5 text-indigo-500" />;

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors h-16">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-3">
        {/* Left: Mobile Menu Toggle & Dynamic Page Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white md:hidden transition-colors"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <img
            src="/assets/logos/logo.png"
            alt="Smart Attend Logo"
            className="w-8 h-8 object-contain md:hidden flex-shrink-0"
          />
          <h1 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 font-heading truncate">
            {getPageTitle()}
          </h1>
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200/60 dark:border-slate-800"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* User Profile Info + Logout */}
          {currentUser && (
            <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-slate-200 dark:border-slate-800">
              <div className="hidden sm:flex items-center gap-2">
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-200 leading-tight truncate max-w-[120px] lg:max-w-[200px]">
                    {currentUser.name}
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider">
                    {roleIcon}
                    <span>{currentUser.role}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={logout}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};



