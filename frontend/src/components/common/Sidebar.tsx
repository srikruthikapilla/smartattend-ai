import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  UserCheck,
  FileSpreadsheet,
  BarChart3,
  Edit3,
  LogOut,
  Radio,
  ChevronLeft,
  ChevronRight,
  Shield,
  GraduationCap,
  X
} from 'lucide-react';

interface SidebarLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  collapsed?: boolean;
  onClick?: () => void;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({ to, icon, label, badge, collapsed, onClick }) => (
  <NavLink
    to={to}
    onClick={onClick}
    title={collapsed ? label : undefined}
    className={({ isActive }) =>
      `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-300 ease-premium relative ${isActive
        ? 'bg-accent-muted text-accent-DEFAULT dark:text-accent-light font-semibold'
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:text-slate-800 dark:hover:text-slate-200 font-medium'
      } ${collapsed ? 'justify-center px-2' : ''}`
    }
  >
    {/* Active indicator bar */}
    <NavLink
      to={to}
      className={({ isActive }) =>
        `absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-300 ${
          isActive ? 'h-5 bg-accent-DEFAULT' : 'h-0 bg-transparent'
        }`
      }
      tabIndex={-1}
      aria-hidden
    >
      {() => null}
    </NavLink>
    <span className="flex-shrink-0 w-4 h-4 transition-transform duration-300 ease-premium group-hover:translate-x-[2px]">{icon}</span>
    {!collapsed && <span className="text-xs tracking-tight truncate">{label}</span>}
    {!collapsed && badge !== undefined && badge > 0 && (
      <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-rose-500 text-white rounded-full min-w-[18px] text-center">
        {badge}
      </span>
    )}
  </NavLink>
);

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const { currentUser, pendingStudents, logout } = useAuth();
  if (!currentUser) return null;

  const role = currentUser.role;
  const portalLabel = role === 'admin' ? 'Admin' : 'Faculty';

  const sidebarContent = (isMobile: boolean) => (
    <div className="flex flex-col h-full py-5 px-3">
      {/* Brand & Collapse / Close Toggle */}
      <div className={`flex items-center ${!isMobile && collapsed ? 'justify-center' : 'justify-between px-2'} mb-6`}>
        {!isMobile && collapsed ? (
          <img
            src="/assets/logos/logo.png"
            alt="Smart Attend Logo"
            className="w-9 h-9 object-contain cursor-pointer transition-transform duration-300 ease-premium hover:scale-105"
            onClick={onToggleCollapse}
          />
        ) : (
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/logos/logo.png"
              alt="Smart Attend Logo"
              className="w-9 h-9 object-contain flex-shrink-0"
            />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight font-heading tracking-tight">Smart Attend</p>
              <p className="text-[10px] font-semibold text-accent-DEFAULT dark:text-accent-light tracking-wider uppercase">
                {portalLabel}
              </p>
            </div>
          </div>
        )}

        {isMobile ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all duration-300 ease-premium"
            title="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all duration-300 ease-premium"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto pr-1">
        {/* Admin Navigation */}
        {role === 'admin' && (
          <>
            <SidebarLink to="/admin/dashboard" icon={<LayoutDashboard className="w-4 h-4" />} label="Control center" collapsed={!isMobile && collapsed} onClick={isMobile ? onCloseMobile : undefined} />
            <SidebarLink to="/admin/approvals" icon={<UserCheck className="w-4 h-4" />} label="Student approvals" badge={pendingStudents?.length} collapsed={!isMobile && collapsed} onClick={isMobile ? onCloseMobile : undefined} />
            <SidebarLink to="/admin/manual-attendance" icon={<Edit3 className="w-4 h-4" />} label="Manual override" collapsed={!isMobile && collapsed} onClick={isMobile ? onCloseMobile : undefined} />
          </>
        )}

        {/* Faculty Navigation */}
        {role === 'faculty' && (
          <>
            <SidebarLink to="/faculty/dashboard" icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboard" collapsed={!isMobile && collapsed} onClick={isMobile ? onCloseMobile : undefined} />
            <SidebarLink to="/faculty/manual-attendance" icon={<Edit3 className="w-4 h-4" />} label="Manual attendance" collapsed={!isMobile && collapsed} onClick={isMobile ? onCloseMobile : undefined} />
          </>
        )}

        {/* Reports & Analytics — subtle separator */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.04]">
          <SidebarLink to="/attendance/live" icon={<Radio className="w-4 h-4 text-accent-DEFAULT animate-pulse" />} label="Live stream" collapsed={!isMobile && collapsed} onClick={isMobile ? onCloseMobile : undefined} />
          <SidebarLink to="/reports" icon={<FileSpreadsheet className="w-4 h-4" />} label="Records" collapsed={!isMobile && collapsed} onClick={isMobile ? onCloseMobile : undefined} />
          <SidebarLink to="/analytics" icon={<BarChart3 className="w-4 h-4" />} label="Analytics" collapsed={!isMobile && collapsed} onClick={isMobile ? onCloseMobile : undefined} />
        </div>
      </nav>

      {/* Footer: Profile + Logout */}
      <div className="mt-auto pt-4 border-t border-slate-100 dark:border-white/[0.04]">
        {/* Profile badge */}
        {(isMobile || !collapsed) && (
          <div className="flex items-center gap-2.5 px-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-accent-muted flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-accent-DEFAULT uppercase">
                {currentUser.name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
                {currentUser.name}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider flex items-center gap-1">
                {role === 'admin' ? <Shield className="w-2.5 h-2.5" /> : <GraduationCap className="w-2.5 h-2.5" />}
                {role}
              </p>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button
          type="button"
          onClick={() => {
            if (isMobile && onCloseMobile) onCloseMobile();
            logout();
          }}
          title="Sign out"
          className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 dark:text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-500 dark:hover:text-rose-400 transition-all duration-300 ease-premium ${!isMobile && collapsed ? 'justify-center px-2' : ''}`}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {(isMobile || !collapsed) && <span className="text-xs tracking-tight font-heading">Sign out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar (>= md) */}
      <aside
        className={`hidden md:flex flex-col h-screen fixed left-0 top-0 z-40 bg-white dark:bg-surface-card-dark border-r border-slate-200/60 dark:border-white/[0.06] transition-all duration-500 ease-premium ${collapsed ? 'w-20' : 'w-64'
          }`}
      >
        {sidebarContent(false)}
      </aside>

      {/* Mobile Slide-over Drawer (< md) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity animate-fade-in"
            onClick={onCloseMobile}
          />
          {/* Drawer Panel */}
          <aside className="relative w-72 max-w-[85vw] h-full bg-white dark:bg-surface-card-dark border-r border-slate-200/60 dark:border-white/[0.06] shadow-2xl z-10 animate-slide-in-left">
            {sidebarContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
