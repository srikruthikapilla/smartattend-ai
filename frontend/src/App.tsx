import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';

// Pages
import { Login } from './pages/auth/Login';
import { ResetPasswordPage } from './pages/auth/ResetPassword';
import { AdminRegister } from './pages/auth/AdminRegister';
import { StudentRegister } from './pages/auth/StudentRegister';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { StudentApprovals } from './pages/admin/StudentApprovals';
import { ManualAttendanceAdmin } from './pages/admin/ManualAttendanceAdmin';
import { FacultyDashboard } from './pages/faculty/FacultyDashboard';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ReportsPage } from './pages/ReportsPage';
import { PublicCheckin } from './pages/PublicCheckin';
import { LiveAttendance } from './pages/LiveAttendance';
import { StudentDashboard } from './pages/student/StudentDashboard';

// ─── Route Guards ──────────────────────────────────────────────────────────────

/**
 * ProtectedRoute: Must be logged in AND have an allowed role.
 * If not logged in → /login
 * If wrong role → own dashboard
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles: string[] }> = ({
  children,
  allowedRoles
}) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(currentUser.role)) {
    if (currentUser.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (currentUser.role === 'faculty') return <Navigate to="/faculty/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

/**
 * PublicOnlyRoute: Only accessible when NOT logged in.
 * Logged-in users are redirected to their role dashboard.
 */
const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <>{children}</>;
  if (currentUser.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (currentUser.role === 'faculty') return <Navigate to="/faculty/dashboard" replace />;
  return <Navigate to="/login" replace />;
};

// ─── Authenticated Shell Layout ─────────────────────────────────────────────

/**
 * AuthenticatedShell: Renders the collapsible Sidebar + sticky Header + page content.
 * Supports desktop collapsible navigation (>= md) and slide-in mobile drawer (< md).
 */
const AuthenticatedShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
      <Sidebar
        collapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />
      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ${
          isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'
        }`}
      >
        <Header onToggleMobileMenu={() => setIsMobileSidebarOpen(prev => !prev)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto w-full max-w-[1440px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

// ─── App ───────────────────────────────────────────────────────────────────────

export const App: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <Routes>
      {/* ── Public Student Kiosk — Fully Standalone (NO sidebar, NO header) ── */}
      <Route path="/checkin" element={<PublicCheckin />} />
      <Route path="/student/checkin" element={<Navigate to="/checkin" replace />} />
      <Route path="/register/student" element={<StudentRegister />} />
      <Route path="/student/register" element={<StudentRegister />} />
      <Route path="/register/admin" element={<AdminRegister />} />
      <Route path="/admin/register" element={<AdminRegister />} />

      {/* ── Student Portal & Dashboard ── */}
      <Route path="/student" element={<StudentDashboard />} />
      <Route path="/student/dashboard" element={<StudentDashboard />} />

      {/* ── Login & Recovery — Standalone, no chrome ── */}
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* ── Admin Routes (role: admin only) ── */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AuthenticatedShell><AdminDashboard /></AuthenticatedShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/approvals"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AuthenticatedShell><StudentApprovals /></AuthenticatedShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/manual-attendance"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AuthenticatedShell><ManualAttendanceAdmin /></AuthenticatedShell>
          </ProtectedRoute>
        }
      />

      {/* ── Faculty Routes (role: faculty or admin) ── */}
      <Route
        path="/faculty/dashboard"
        element={
          <ProtectedRoute allowedRoles={['faculty', 'admin']}>
            <AuthenticatedShell><FacultyDashboard /></AuthenticatedShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/faculty/manual-attendance"
        element={
          <ProtectedRoute allowedRoles={['faculty', 'admin']}>
            <AuthenticatedShell><ManualAttendanceAdmin /></AuthenticatedShell>
          </ProtectedRoute>
        }
      />

      {/* ── Shared Staff Routes (admin + faculty only) ── */}
      <Route
        path="/attendance/live"
        element={
          <ProtectedRoute allowedRoles={['admin', 'faculty']}>
            <AuthenticatedShell><LiveAttendance /></AuthenticatedShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute allowedRoles={['admin', 'faculty']}>
            <AuthenticatedShell><AnalyticsPage /></AuthenticatedShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={['admin', 'faculty']}>
            <AuthenticatedShell><ReportsPage /></AuthenticatedShell>
          </ProtectedRoute>
        }
      />

      {/* ── Legacy Redirects ── */}
      <Route path="/register/student" element={<Navigate to="/checkin" replace />} />
      <Route path="/register/admin" element={<Navigate to="/login" replace />} />

      {/* ── Catch-all ── */}
      <Route
        path="*"
        element={
          <Navigate
            to={
              currentUser?.role === 'admin'
                ? '/admin/dashboard'
                : currentUser?.role === 'faculty'
                ? '/faculty/dashboard'
                : '/login'
            }
            replace
          />
        }
      />
    </Routes>
  );
};

export default App;


