import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ForgotPasswordModal } from '../../components/auth/ForgotPasswordModal';
import PortalFieldCollection from '@/components/ui/portal-field';
import { Eye, EyeOff, AlertCircle, ArrowRight, Check, LockKeyhole, Mail, Fingerprint, MapPin, QrCode } from 'lucide-react';

const TYPING_WORDS = ['verified.', 'automated.', 'intelligent.', 'anti-proxy.', 'streamlined.'];

export const Login: React.FC = () => {
  const { login, currentUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  // Animated typing text effect
  const [wordIndex, setWordIndex] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = TYPING_WORDS[wordIndex];
    const typingSpeed = isDeleting ? 45 : 90;

    if (!isDeleting && typedText === currentWord) {
      const pauseTimeout = setTimeout(() => setIsDeleting(true), 2000);
      return () => clearTimeout(pauseTimeout);
    }

    if (isDeleting && typedText === '') {
      setIsDeleting(false);
      setWordIndex((prev) => (prev + 1) % TYPING_WORDS.length);
      return;
    }

    const timer = setTimeout(() => {
      setTypedText((prev) =>
        isDeleting
          ? currentWord.slice(0, prev.length - 1)
          : currentWord.slice(0, prev.length + 1)
      );
    }, typingSpeed);

    return () => clearTimeout(timer);
  }, [typedText, isDeleting, wordIndex]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const success = await login(cleanEmail, password);
      if (success) {
        const userRole = (await useAuth()).currentUser?.role || 'faculty';
        navigate(userRole === 'admin' ? '/admin/dashboard' : userRole === 'student' ? '/student/dashboard' : '/faculty/dashboard', { replace: true });
      } else {
        setError('Invalid email or password.');
      }
    } catch (err: any) {
      setError(err.message || 'Unable to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white dark:bg-surface-dark text-slate-900 dark:text-white flex">
      {/* Left: Brand Visual with Moving Portal Field Background & Animated Typography */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-[#020202] text-white p-12 relative overflow-hidden border-r border-slate-200/10">
        {/* Moving Dynamic Three.js Shader Portal Background */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-75">
          <PortalFieldCollection
            mode="dark"
            speed={0.8}
            size={1.2}
            length={1}
            opacity={0.85}
          />
        </div>

        {/* Soft vignette & ambient radial depth overlays for crystal-clear readability */}
        <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_70%_20%,rgba(13,148,136,0.2),transparent_65%),radial-gradient(ellipse_at_20%_80%,rgba(13,148,136,0.12),transparent_60%)]" />
        <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-b from-[#020202]/50 via-transparent to-[#020202]/85" />

        {/* Minimal precision dot-matrix grid with radial vignette */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.18]"
          style={{
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.22) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 45%, black 25%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 45%, black 25%, transparent 75%)',
          }}
        />

        {/* Subtle noise texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.02]"
          style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
            backgroundRepeat: 'repeat',
            mixBlendMode: 'overlay',
          }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center border border-accent/30 backdrop-blur-sm">
            <Check className="w-4 h-4 text-accent-light" />
          </div>
          <div>
            <p className="font-bold text-sm tracking-tight font-heading">Smart Attend</p>
            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">SBIT Khammam</p>
          </div>
        </div>

        {/* Hero copy with Animated Typing Text */}
        <div className="relative z-10 max-w-md space-y-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter leading-[1.15] font-heading min-h-[5.5rem]">
              Attendance,<br />
              <span className="text-accent-light inline-block">
                {typedText}
              </span>
              <span className="inline-block w-[3px] h-[0.85em] bg-accent-light ml-1.5 translate-y-[2px] animate-pulse" />
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed mt-4 max-w-[45ch]">
              One sign-in for students, faculty, and administrators. Secure, fast, and built for campus-wide deployment.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: Fingerprint, text: 'Face and biometric verification' },
              { icon: QrCode, text: 'Real-time QR session sync' },
              { icon: MapPin, text: 'Campus GPS geofencing' },
            ].map(({ icon: ItemIcon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-slate-300">
                <div className="w-6 h-6 rounded-md bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                  <ItemIcon className="w-3.5 h-3.5 text-accent-light" />
                </div>
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-[10px] text-slate-600">
          © {new Date().getFullYear()} Smart Attend — Swarna Bharathi Institute of Science and Technology
        </div>
      </div>

      {/* Right: Sign-in Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8 animate-fade-up">
          <div>
            <div className="lg:hidden flex items-center gap-2.5 mb-8">
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center border border-accent/30">
                <Check className="w-4 h-4 text-accent" />
              </div>
              <span className="font-bold text-sm font-heading tracking-tight">Smart Attend</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold tracking-tighter font-heading">Welcome back</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Sign in to your institutional account
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@sbit.ac.in"
                  required
                  className="input-premium pl-10 pr-4"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <LockKeyhole className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="input-premium pl-10 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors duration-300"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-accent-DEFAULT focus:ring-accent-DEFAULT"
                />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(true)}
                className="text-sm font-medium text-accent-DEFAULT dark:text-accent-light hover:underline transition"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-secondary w-full justify-center py-3"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <div className="w-6 h-6 rounded-full bg-white/10 dark:bg-black/10 flex items-center justify-center ml-1">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </>
              )}
            </button>
          </form>

          <div className="pt-6 border-t border-slate-100 dark:border-white/[0.06]">
            <p className="text-center text-xs text-slate-400 dark:text-slate-500">
              Don't have an account?{' '}
              <a href="/register/student" className="text-accent-DEFAULT dark:text-accent-light font-medium hover:underline">
                Register as a student
              </a>
            </p>
          </div>
        </div>
      </div>

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
