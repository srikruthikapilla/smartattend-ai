import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { SBIT_COLLEGE_NAME } from '../../utils/seedData';
import { Shield, ArrowRight, User, Mail, Phone, Lock, Building, AlertCircle } from 'lucide-react';

export const AdminRegister: React.FC = () => {
  const { registerAdmin } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('Director / Principal');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await registerAdmin({
        name,
        email,
        phone,
        college: SBIT_COLLEGE_NAME,
        designation
      }, password);
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to register administrator.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-lg card-elevation p-8 space-y-6">
        <div className="text-center space-y-2">
          <img
            src="/assets/logos/logo.png"
            alt="Smart Attend Logo"
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain mx-auto drop-shadow-sm mb-2"
          />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-heading">Administrator Registration</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">{SBIT_COLLEGE_NAME}</p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Full Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Academic Director"
                required
                className="input-premium pl-10 pr-4 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Administrator Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@sbit.ac.in"
                required
                className="input-premium pl-10 pr-4 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Phone (Optional)</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98480 12345"
                  className="input-premium pl-10 pr-4 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Designation</label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  required
                  className="input-premium pl-10 pr-4 text-xs"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Portal Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="input-premium pl-10 pr-4 text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary w-full justify-center py-3 text-xs uppercase tracking-wider shadow-sm hover:shadow-md transition-all"
          >
            <span>Create Admin Profile & Launch Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
          Already registered? <Link to="/login" className="text-accent font-semibold hover:underline">Sign In</Link>
        </div>
      </div>
    </div>
  );
};
