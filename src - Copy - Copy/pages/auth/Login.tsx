import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/auth';
import { Shield, UserCheck, GraduationCap, ArrowRight, Lock, Mail, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, switchUser } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<UserRole>('admin');
  const [email, setEmail] = useState<string>('admin@sbit.ac.in');
  const [password, setPassword] = useState<string>('password123');
  const [error, setError] = useState<string | null>(null);

  const handleRoleSelect = (selectedRole: UserRole) => {
    setRole(selectedRole);
    setError(null);
    if (selectedRole === 'admin') setEmail('admin@sbit.ac.in');
    else if (selectedRole === 'faculty') setEmail('p.srinivas@sbit.ac.in');
    else setEmail('rahul.21sbit@gmail.com');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const success = await login(email, role);
      if (success) {
        if (role === 'admin') navigate('/admin/dashboard');
        else if (role === 'faculty') navigate('/faculty/dashboard');
        else navigate('/student/dashboard');
      } else {
        setError('Invalid credentials or user not found for selected role.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-panel p-8 space-y-6">
        
        {/* Header Logo & Title */}
        <div className="text-center space-y-2">
          <img
            src="/assets/logos/sbit-logo.png"
            alt="SBIT Logo"
            className="h-16 w-auto mx-auto object-contain bg-white rounded-full p-1 shadow"
          />
          <h2 className="text-2xl font-extrabold text-white light:text-slate-900">SBIT Campus Portal</h2>
          <p className="text-xs text-slate-400">Swarna Bharathi Institute of Science and Technology</p>
        </div>

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => handleRoleSelect('admin')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1 transition ${
              role === 'admin' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" /> Admin
          </button>

          <button
            type="button"
            onClick={() => handleRoleSelect('faculty')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1 transition ${
              role === 'faculty' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" /> Faculty
          </button>

          <button
            type="button"
            onClick={() => handleRoleSelect('student')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1 transition ${
              role === 'student' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" /> Student
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className={`w-full py-3 rounded-xl font-bold text-white text-sm shadow-lg transition flex items-center justify-center gap-2 ${
              role === 'admin' ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30' :
              role === 'faculty' ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30' :
              'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
            }`}
          >
            Sign In as {role.toUpperCase()} <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Registration Links */}
        <div className="pt-4 border-t border-slate-800 text-center space-y-2 text-xs text-slate-400">
          <p>Don't have an account yet?</p>
          <div className="flex justify-center space-x-4 font-semibold">
            <Link to="/register/student" className="text-emerald-400 hover:underline">Student Registration</Link>
            <span>•</span>
            <Link to="/register/admin" className="text-blue-400 hover:underline">Admin Registration</Link>
          </div>
        </div>

      </div>
    </div>
  );
};
