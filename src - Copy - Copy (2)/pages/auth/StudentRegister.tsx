import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { SBIT_COLLEGE_NAME } from '../../utils/seedData';
import { GraduationCap, ArrowRight, User, Mail, Phone, Lock, CheckCircle2, Clock } from 'lucide-react';

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

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await registerStudent({
      name,
      hallTicketNo,
      branch,
      year,
      semester,
      section,
      email,
      phone,
      college: SBIT_COLLEGE_NAME
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md glass-panel p-8 text-center space-y-6">
          <div className="p-4 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 w-16 h-16 mx-auto flex items-center justify-center">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white">Registration Submitted!</h2>
            <p className="text-xs text-amber-300 font-semibold mt-1 uppercase tracking-wider">Status: Pending Administrator Approval</p>
            <p className="text-xs text-slate-400 mt-3">
              Your profile for <span className="text-white font-semibold">{name}</span> ({hallTicketNo}) has been successfully submitted to SBIT Academic Affairs.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300 space-y-1 text-left">
            <p>• Once approved by an Admin, you can log in to mark attendance.</p>
            <p>• Scanned dynamic QR codes will validate automatically against your approved credentials.</p>
          </div>

          <Link
            to="/login"
            className="block w-full py-3 rounded-xl font-bold text-white text-sm bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 transition text-center"
          >
            Return to Login Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-xl glass-panel p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="p-3 rounded-2xl bg-emerald-600/20 text-emerald-400 w-12 h-12 mx-auto flex items-center justify-center">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-white">Student Campus Registration</h2>
          <p className="text-xs text-slate-400">{SBIT_COLLEGE_NAME}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Student Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Rahul Verma"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Hall Ticket Number</label>
              <input
                type="text"
                value={hallTicketNo}
                onChange={(e) => setHallTicketNo(e.target.value.toUpperCase())}
                placeholder="21SBIT0501"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:border-emerald-500 focus:outline-none uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Branch</label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full px-2.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none"
              >
                {['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AIML', 'DS'].map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-2.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none"
              >
                {['I', 'II', 'III', 'IV'].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Semester</label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full px-2.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none"
              >
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Section</label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full px-2.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none"
              >
                {['A', 'B', 'C', 'D'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@gmail.com"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 91234 56789"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl font-bold text-white text-sm bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
          >
            Submit Registration for Approval <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center text-xs text-slate-400 pt-2">
          Already registered? <Link to="/login" className="text-emerald-400 hover:underline">Sign In</Link>
        </div>
      </div>
    </div>
  );
};
