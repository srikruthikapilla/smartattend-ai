import React, { useState } from 'react';
import { ShieldCheck, Lock, Trash2, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface StudentConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConsentConfirmed: () => void;
  studentName?: string;
  hallTicket?: string;
}

export const StudentConsentModal: React.FC<StudentConsentModalProps> = ({
  isOpen,
  onClose,
  onConsentConfirmed,
  studentName,
  hallTicket
}) => {
  const [agreed, setAgreed] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-950/20">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-md shadow-indigo-600/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Biometric Consent Declaration
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Digital Personal Data Protection (DPDP) Standard
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-slate-600 dark:text-slate-300">
          <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between font-mono">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Student</span>
              <span className="font-bold text-slate-900 dark:text-white text-xs">{studentName || "Student"}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Roll / Hall Ticket</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 text-xs">{hallTicket || "N/A"}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <p>
                <strong>Vector Embedding Only:</strong> Your camera capture is processed directly in memory to generate a 128-D / 512-D mathematical vector. <em>No raw facial images are stored on server disk or database.</em>
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <p>
                <strong>Strict Purpose Limitation:</strong> Biometric vectors are solely utilized to automate your lecture attendance and prevent proxy submissions.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <Trash2 className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <p>
                <strong>Right to Erasure:</strong> You can delete and revoke your facial biometric data at any time from your Student Portal profile.
              </p>
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <label className="flex items-start gap-3 p-3.5 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
            />
            <span className="text-xs text-slate-700 dark:text-slate-200 leading-tight">
              I am a college student and voluntarily consent to register my facial vector descriptor for automated academic attendance.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (agreed) {
                onConsentConfirmed();
                onClose();
              }
            }}
            disabled={!agreed}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all"
          >
            Confirm & Proceed to Scan
          </button>
        </div>
      </div>
    </div>
  );
};
