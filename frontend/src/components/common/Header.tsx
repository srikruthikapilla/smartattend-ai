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
    if (path.includes('/admin/dashboard')) return 'Control center';
    if (path.includes('/admin/approvals')) return 'Student approvals';
    if (path.includes('/admin/manual-attendance') || path.includes('/faculty/manual-attendance')) return 'Manual attendance';
    if (path.includes('/faculty/dashboard')) return 'Faculty portal';
    if (path.includes('/attendance/live')) return 'Live stream';
    if (path.includes('/reports')) return 'Attendance reports';
    if (path.includes('/analytics')) return 'Visual analytics';
    return 'Smart Attend';
  };

  const roleIcon = currentUser?.role === 'admin'
    ? <Shield className="w-3 h-3" />
    : <UserCheck className="w-3 h-3" />;

  return (
    <header className="sticky top-0 z-30 h-16 transition-all duration-500 ease-premium">
      {/* Glass background layer */}
      <div className="absolute inset-0 backdrop-blur-xl bg-white/80 dark:bg-surface-dark/80 border-b border-slate-200/60 dark:border-white/[0.06]" />
      {/* Accent glow line at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-DEFAULT/20 to-transparent" />

      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-3">
        {/* Left: Mobile Menu Toggle & Dynamic Page Title */}
        <div className="flex items-center gap-3 min-w-0">
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white md:hidden transition-all duration-300 ease-premium"
              title="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <img
            src="/assets/logos/logo.png"
            alt="Smart Attend Logo"
            className="w-7 h-7 object-contain md:hidden flex-shrink-0"
          />
          <h1 className="text-sm font-semibold text-slate-700 dark:text-slate-200 font-heading truncate tracking-tight">
            {getPageTitle()}
          </h1>
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-700 dark:hover:text-slate-200 transition-all duration-300 ease-premium"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User Profile Info + Logout */}
          {currentUser && (
            <div className="flex items-center gap-2.5 pl-2.5 border-l border-slate-200/60 dark:border-white/[0.06]">
              <div className="hidden sm:flex items-center gap-2.5">
                {/* Avatar circle */}
                <div className="w-7 h-7 rounded-full bg-accent-muted flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-accent-DEFAULT uppercase">
                    {currentUser.name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight truncate max-w-[120px] lg:max-w-[180px]">
                    {currentUser.name}
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider">
                    {roleIcon}
                    <span>{currentUser.role}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={logout}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all duration-300 ease-premium"
                title="Sign out"
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
