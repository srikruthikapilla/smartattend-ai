import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import {
  KeyRound, Mail, CheckCircle2, AlertCircle, Eye, EyeOff,
  ArrowRight, ShieldCheck, RefreshCw, Sparkles, Lock
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  onSuccess?: (email: string) => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
  onSuccess
}) => {
  const { requestPasswordReset, resetPasswordWithCode } = useAuth();

  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync initialEmail when opened
  React.useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
    if (!isOpen) {
      // Reset state on close
      setStep('request');
      setError(null);
      setSuccessMsg(null);
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setGeneratedOtp(null);
    }
  }, [isOpen, initialEmail]);

  // Step 1: Request Password Reset Code
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await requestPasswordReset(cleanEmail);
      if (res.success) {
        if (res.otpCode) {
          setGeneratedOtp(res.otpCode);
          setOtp(res.otpCode); // Pre-fill for seamless verification
        }
        setSuccessMsg(res.message);
        setStep('verify');
      } else {
        setError('Failed to initiate password reset. Please check your email address.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to request password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify Code and Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify your new password.');
      return;
    }

    setIsLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await resetPasswordWithCode(cleanEmail, otp.trim(), newPassword);
      if (res.success) {
        setSuccessMsg('Password updated successfully! You can now log in.');
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        setTimeout(() => {
          if (onSuccess) onSuccess(cleanEmail);
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please verify your OTP code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 'request' ? "Forgot Password" : "Set New Password"}
      maxWidth="md"
    >
      <div className="space-y-5 text-left">
        
        {/* Step Indicator */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
              step === 'request'
                ? 'bg-blue-600 text-white'
                : 'bg-teal-600 text-white'
            }`}>
              {step === 'request' ? '1' : '✓'}
            </span>
            <span className={`font-semibold ${step === 'request' ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
              Verify Account
            </span>
          </div>

          <div className="h-0.5 w-8 bg-slate-300 dark:bg-slate-700"></div>

          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
              step === 'verify'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
            }`}>
              2
            </span>
            <span className={`font-semibold ${step === 'verify' ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
              New Password
            </span>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Notification */}
        {successMsg && (
          <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ── STEP 1: REQUEST OTP CODE ── */}
        {step === 'request' && (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
                Enter your institutional email address. We will generate a secure recovery code to reset your credentials.
              </p>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-heading">
                Institutional Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@sbit.ac.in or registered email"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 hover:opacity-90 transition font-heading flex items-center gap-2 shadow-xs disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Send Recovery Code</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 2: VERIFY CODE & NEW PASSWORD ── */}
        {step === 'verify' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            
            {/* Display Target Email & OTP banner */}
            <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/50 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">{email}</span>
              </div>
              <button
                type="button"
                onClick={() => setStep('request')}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Change
              </button>
            </div>

            {/* Generated OTP Display in dev mode */}
            {generatedOtp && (
              <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 text-xs flex items-center justify-between">
                <span className="text-teal-700 dark:text-teal-300 font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  Institutional OTP Code:
                </span>
                <span className="font-mono font-extrabold text-sm tracking-widest text-teal-800 dark:text-teal-200 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-teal-300 dark:border-teal-700">
                  {generatedOtp}
                </span>
              </div>
            )}

            {/* 6-Digit OTP Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-heading">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                required
                maxLength={6}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base tracking-widest font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none text-center"
              />
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-heading">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  required
                  minLength={6}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-heading">
                Confirm New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                minLength={6}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('request')}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 hover:opacity-90 transition font-heading flex items-center gap-2 shadow-xs disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Update Password & Sign In</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </Modal>
  );
};

export default ForgotPasswordModal;
