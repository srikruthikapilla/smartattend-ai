import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ForgotPasswordModal } from '../../components/auth/ForgotPasswordModal';
import {
  Eye,
  EyeOff,
  Shield,
  UserCheck,
  AlertCircle,
  Sparkles,
  ScanFace,
  ShieldCheck
} from 'lucide-react';

export const Login: React.FC = () => {
  const { login, users } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const success = await login(cleanEmail, password);
      if (success) {
        let userRole = 'faculty';
        try {
          const saved = localStorage.getItem("sbit_current_user");
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed?.role) userRole = parsed.role;
          }
        } catch {
          const matched = users.find(u => u.email.toLowerCase() === cleanEmail);
          if (matched?.role) userRole = matched.role;
        }

        if (userRole === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else if (userRole === 'student') {
          navigate('/student/dashboard', { replace: true });
        } else {
          navigate('/faculty/dashboard', { replace: true });
        }
      } else {
        setError('Invalid credentials or unauthorized account.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-900 text-slate-900 dark:text-white transition-colors">

      {/* ── Left Panel: Brand Showcase & Institutional Hero ── */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white relative overflow-hidden border-r border-slate-800">
        {/* Background Ambient Glow Circles */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Bar Institutional Badge */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <img
              src="/assets/logos/logo.png"
              alt="Smart Attend Logo"
              className="w-10 h-10 object-contain drop-shadow-sm"
            />
            <span className="font-bold text-base tracking-tight text-white font-heading">Smart Attend</span>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-500/10 text-teal-300 border border-teal-500/20 font-heading">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
            SBIT Khammam
          </span>
        </div>

        {/* Center Showcase Content */}
        <div className="max-w-lg space-y-6 relative z-10 my-auto py-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Institutional Management Portal</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight font-heading leading-tight">
            Institutional Attendance & Security Command
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed">
            Faculty lecture broadcasting, real-time facial vector verification, eye blink liveness inspection, and campus audit intelligence.
          </p>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1">
              <div className="flex items-center gap-2 text-teal-300 text-xs font-bold">
                <ScanFace className="w-4 h-4" />
                <span>128-D Face AI</span>
              </div>

            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1">
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Blink Liveness</span>
              </div>

            </div>
          </div>
        </div>

        {/* Footer Accreditation */}

      </div>

      {/* ── Right Panel: Sign-In Form ── */}
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-900 p-6 sm:p-12 lg:p-16 min-h-screen">
        <div className="w-full max-w-md space-y-6">

          {/* Logo & Header */}
          <div className="text-left">
            <img
              src="/assets/logos/logo.png"
              alt="Smart Attend Logo"
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain mb-3"
            />
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight font-heading">
              Institutional Sign In
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              Sign in with your institutional credentials to access your dashboard.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5 text-left">

            {/* Email Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Institutional Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@sbit.ac.in"
                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm transition"
                required
              />
            </div>

            {/* Password with Eye Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-500 dark:text-slate-400 transition"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me + Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-slate-700 rounded"
                />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(true)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium hover:underline transition"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3.5 px-4 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm text-sm disabled:opacity-50 font-heading"
            >
              {isLoading ? 'Signing In...' : 'Sign In to Portal'}
            </button>
          </form>

          {/* Institutional Notice */}
          <div className="pt-4 border-t border-gray-100 dark:border-slate-800 text-center text-xs text-gray-400 dark:text-slate-500">
            <p>SBIT Innovation Centre • Attendance Control System</p>
          </div>

        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        initialEmail={email}
        onSuccess={(updatedEmail) => {
          setEmail(updatedEmail);
          setError(null);
        }}
      />

    </div>
  );
};

export default Login;
