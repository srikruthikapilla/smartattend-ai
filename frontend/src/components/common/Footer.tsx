import React from 'react';
import { Award } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto py-6 transition-colors">
      {/* Accent gradient separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-accent-DEFAULT/15 to-transparent mb-6" />

      <div className="max-w-[1440px] mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          {/* Institution */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <Award className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-tight">
                Swarna Bharathi Institute of Science and Technology
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Approved by AICTE, New Delhi · Affiliated to JNTUH · Khammam, Telangana
              </p>
            </div>
          </div>

          {/* Partner logos — compact */}
          <div className="flex items-center gap-4">
            <img
              src="/assets/logos/spark-logo.png"
              alt="SBIT Campus AI"
              className="h-8 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity duration-300"
            />
            <img
              src="/assets/logos/aicte-logo.png"
              alt="AICTE Approved"
              className="h-8 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity duration-300"
            />
          </div>

          {/* Copyright */}
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            © {new Date().getFullYear()} SBIT Smart Campus
          </p>
        </div>
      </div>
    </footer>
  );
};
