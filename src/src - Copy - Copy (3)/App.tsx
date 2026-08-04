import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { Sidebar } from './components/common/Sidebar';

// Pages
import { Login } from './pages/auth/Login';
import { AdminRegister } from './pages/auth/AdminRegister';
import { StudentRegister } from './pages/auth/StudentRegister';

import { AdminDashboard } from './pages/admin/AdminDashboard';
import { QRSessionManager } from './pages/admin/QRSessionManager';
import { StudentApprovals } from './pages/admin/StudentApprovals';
import { GPSConfigModal } from './components/gps/GPSConfigModal';
import { ManualAttendanceAdmin } from './pages/admin/ManualAttendanceAdmin';

import { FacultyDashboard } from './pages/faculty/FacultyDashboard';
import { StudentDashboard } from './pages/student/StudentDashboard';

import { AnalyticsPage } from './pages/AnalyticsPage';
import { ReportsPage } from './pages/ReportsPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({
  children,
  allowedRoles
}) => {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    // Redirect to respective dashboard based on actual role
    if (currentUser.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (currentUser.role === 'faculty') return <Navigate to="/faculty/dashboard" replace />;
    return <Navigate to="/student/dashboard" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  const { currentUser } = useAuth();
  const [isGPSModalOpen, setIsGPSModalOpen] = React.useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 light:bg-slate-50 text-slate-100 light:text-slate-900 transition-colors">
      <Header />

      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {currentUser && <Sidebar />}

        <main className="flex-1 min-w-0">
          <Routes>
            {/* Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register/admin" element={<AdminRegister />} />
            <Route path="/register/student" element={<StudentRegister />} />

            {/* Admin Protected Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/qr-session"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <QRSessionManager />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/approvals"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <StudentApprovals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/gps"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/manual-attendance"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ManualAttendanceAdmin />
                </ProtectedRoute>
              }
            />

            {/* Faculty Protected Routes */}
            <Route
              path="/faculty/dashboard"
              element={
                <ProtectedRoute allowedRoles={['faculty', 'admin']}>
                  <FacultyDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/faculty/sessions"
              element={
                <ProtectedRoute allowedRoles={['faculty', 'admin']}>
                  <QRSessionManager />
                </ProtectedRoute>
              }
            />
            <Route
              path="/faculty/manual-attendance"
              element={
                <ProtectedRoute allowedRoles={['faculty', 'admin']}>
                  <ManualAttendanceAdmin />
                </ProtectedRoute>
              }
            />

            {/* Student Protected Routes */}
            <Route
              path="/student/dashboard"
              element={
                <ProtectedRoute allowedRoles={['student', 'admin']}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/scan"
              element={
                <ProtectedRoute allowedRoles={['student', 'admin']}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />

            {/* Analytics & Reports */}
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />

            {/* Default Catch-all */}
            <Route path="*" element={<Navigate to={currentUser ? `/${currentUser.role}/dashboard` : '/login'} replace />} />
          </Routes>
        </main>
      </div>

      <Footer />
    </div>
  );
};

export default App;