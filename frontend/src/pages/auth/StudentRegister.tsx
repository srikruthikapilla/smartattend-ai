import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { SBIT_COLLEGE_NAME } from '../../utils/seedData';
import { isValidHallTicketNo } from '../../types/auth';
import { GraduationCap, ArrowRight, User, Mail, Phone, Lock, Clock, AlertTriangle } from 'lucide-react';

export const StudentRegister: React.FC = () => {
  const { registerStudent } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [hallTicketNo, setHallTicketNo] = useState('');
  const [branch, setBranch] = useState('CSE');
  const [year, setYear] = useState('III');
  const [semester, setSemester] = useState('1');
  const [section, setSection] = useState('A');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanHT = hallTicketNo.trim().toUpperCase();
    if (!isValidHallTicketNo(cleanHT)) {
      setFormError('Invalid Hall Ticket Number. Must be exactly 10 alphanumeric characters starting with 2 (e.g. 21SBIT0501).');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setFormError('A valid student email address is mandatory.');
      return;
    }

    try {
      await registerStudent({
        name: name.trim(),
        hallTicketNo: cleanHT,
        branch,
        year,
        semester,
        section,
        email: cleanEmail,
        phone,
        college: SBIT_COLLEGE_NAME
      });
      setSubmitted(true);
    } catch (err: any) {
      setFormError(err.message || 'Registration failed.');
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-6 shadow-lg">
          <div className="p-4 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 w-16 h-16 mx-auto flex items-center justify-center">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Registration Submitted!</h2>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-1 uppercase tracking-wider">Status: Pending Administrator Approval</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
              Your profile for <span className="text-slate-900 dark:text-white font-semibold">{name}</span> ({hallTicketNo}) has been successfully submitted to SBIT Academic Affairs.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1 text-left">
            <p>• Once approved by an Admin, you can log in to mark attendance.</p>
            <p>• Scanned dynamic QR codes will validate automatically against your approved credentials.</p>
          </div>

          <Link
            to="/login"
            className="block w-full py-3 rounded-lg font-bold text-white text-xs uppercase tracking-wider bg-slate-900 dark:bg-white dark:text-slate-900 shadow-sm hover:opacity-90 transition text-center"
          >
            Return to Login Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 space-y-6 shadow-lg">
        <div className="text-center space-y-2">
          <img
            src="/assets/logos/logo.png"
            alt="Smart Attend Logo"
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain mx-auto drop-shadow-sm mb-2"
          />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Student Campus Registration</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{SBIT_COLLEGE_NAME}</p>
        </div>

        {formError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Student Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Rahul Verma"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-slate-900 dark:focus:border-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Hall Ticket Number <span className="text-[10px] text-teal-600 dark:text-teal-400 font-normal lowercase">(2XXXXXXXXX)</span>
              </label>
              <input
                type="text"
                value={hallTicketNo}
                maxLength={10}
                onChange={(e) => setHallTicketNo(e.target.value.toUpperCase())}
                placeholder="21SBIT0501"
                required
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono uppercase focus:border-slate-900 dark:focus:border-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Branch</label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none"
              >
                <option value="CSE">CSE</option>
                <option value="AI">AI</option>
                <option value="DS">DS</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none"
              >
                <option value="I">1st Year</option>
                <option value="II">2nd Year</option>
                <option value="III">3rd Year</option>
                <option value="IV">4th Year</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Semester</label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none"
              >
                <option value="1">1st Sem</option>
                <option value="2">2nd Sem</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Section</label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none"
              >
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
                <option value="D">Section D</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-slate-900 dark:focus:border-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Mobile Phone Number</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-slate-900 dark:focus:border-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Portal Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-slate-900 dark:focus:border-white focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-lg font-bold text-white text-xs uppercase tracking-wider bg-slate-900 dark:bg-white dark:text-slate-900 shadow-sm hover:opacity-90 transition flex items-center justify-center gap-2"
          >
            Submit for Academic Verification <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="text-teal-600 dark:text-teal-400 font-semibold hover:underline">
            Sign In Here
          </Link>
        </div>

      </div>
    </div>
  );
};
