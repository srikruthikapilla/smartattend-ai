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
      `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-all duration-200 ${isActive
        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-sm'
        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white font-medium'
      } ${collapsed ? 'justify-center px-2' : ''}`
    }
  >
    <span className="flex-shrink-0 w-4 h-4">{icon}</span>
    {!collapsed && <span className="text-xs tracking-tight truncate">{label}</span>}
    {!collapsed && badge !== undefined && badge > 0 && (
      <span className="ml-auto px-2 py-0.5 text-[10px] font-bold bg-rose-500 text-white rounded-full shadow-sm">
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
  const portalLabel = role === 'admin' ? 'Admin Portal' : 'Faculty Portal';
  const roleColor = role === 'admin' ? 'bg-blue-600' : 'bg-indigo-600';
  const roleIcon = role === 'admin'
    ? <Shield className="w-3.5 h-3.5" />
    : <GraduationCap className="w-3.5 h-3.5" />;

  const sidebarContent = (isMobile: boolean) => (
    <div className="flex flex-col h-full py-5 px-3">
      {/* Brand & Collapse / Close Toggle */}
      <div className={`flex items-center ${!isMobile && collapsed ? 'justify-center' : 'justify-between px-2'} mb-6`}>
        {!isMobile && collapsed ? (
          <img
            src="/assets/logos/logo.png"
            alt="Smart Attend Logo"
            className="w-10 h-10 object-contain cursor-pointer transition-transform hover:scale-105"
            onClick={onToggleCollapse}
          />
        ) : (
          <div className="flex items-center gap-3">
            <img
              src="/assets/logos/logo.png"
              alt="Smart Attend Logo"
              className="w-20 h-20 object-contain flex-shrink-0"
            />
            <div>
              <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight font-heading">Smart Attend</p>
              <p className={`text-[10px] uppercase font-bold tracking-wider ${role === 'admin' ? 'text-blue-600 dark:text-blue-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                {portalLabel}
              </p>
            </div>
          </div>
        )}

        {isMobile ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 flex flex-col gap-1.5 overflow-y-auto pr-1">
        {(isMobile || !collapsed) && (
          <div className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
            {portalLabel}
          </div>
        )}

        {/* Admin Navigation */}
        {role === 'admin' && (
          <>
            <SidebarLink to="/admin/dashboard" icon={<LayoutDashboard className="w-4 h-4" />} label="Control Center" collapsed={!isMobile && collapsed} onClick={isMobile ? onCloseMobile : undefined} />
            <SidebarLink to="/admin/approvals" icon={<UserCheck className="w-4 h-4" />} label="Student Approvals" badge={pendingStudents?.length} collapsed={!isMobile && collapsed} onClick={isMobile ? onCloseMobile : undefined} />
            <SidebarLink to="/admin/manual-attendance" icon={<Edit3 className="w-4 h-4" />} label="Manual Override" collapsed={!isMobile && collapsed} onClick={isMobile ? onCloseMobile : undefined} />
          </>
        )}

        {/* Faculty Navigation */}
        {role === 'faculty' && (
          <>
            <SidebarLink to="/faculty/dashboard" icon={<LayoutDashboard className="w-4 h-4" />} label="Faculty Dashboard" collapsed={!isMobile && collapsed} onClick={isMobile ? onCloseMobile : undefined} />
            <SidebarLink to="/faculty/manual-attendance" icon={<Edit3 className="w-4 h-4" />} label="Manual Attendance" collapsed={!isMobile && collapsed} onClick={isMobile ? onCloseMobile : undefined} />
          </>
        )}

        {/* Reports & Analytics */}
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80">
          {(isMobile || !collapsed) && (
            <div className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Reports & Insights
            </div>
          )}
          <SidebarLink to="/attendance/live" icon={<Radio className="w-4 h-4 text-emerald-500 animate-pulse" />} label="Live Stream" collapsed={!isMobile && collapsed} onClick={isMobile ? onCloseMobile : undefined} />
          <SidebarLink to="/reports" icon={<FileSpreadsheet className="w-4 h-4" />} label="Attendance Records" collapsed={!isMobile && collapsed} onClick={isMobile ? onCloseMobile : undefined} />
          <SidebarLink to="/analytics" icon={<BarChart3 className="w-4 h-4" />} label="Visual Analytics" collapsed={!isMobile && collapsed} onClick={isMobile ? onCloseMobile : undefined} />
        </div>
      </nav>

      {/* Footer: User Profile + Logout */}
      <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800">
        {/* Profile Badge */}


        {/* Logout Button */}
        <button
          type="button"
          onClick={() => {
            if (isMobile && onCloseMobile) onCloseMobile();
            logout();
          }}
          title="Sign Out"
          className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 transition-all duration-200 ${!isMobile && collapsed ? 'justify-center px-2' : ''}`}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {(isMobile || !collapsed) && <span className="text-xs tracking-tight font-heading">Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop Fixed Sidebar (>= md) ── */}
      <aside
        className={`hidden md:flex flex-col h-screen fixed left-0 top-0 z-40 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'
          }`}
      >
        {sidebarContent(false)}
      </aside>

      {/* ── Mobile Slide-over Drawer (< md) ── */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-fadeIn"
            onClick={onCloseMobile}
          />
          {/* Drawer Panel */}
          <aside className="relative w-72 max-w-[85vw] h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl z-10 transition-transform duration-300">
            {sidebarContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};

