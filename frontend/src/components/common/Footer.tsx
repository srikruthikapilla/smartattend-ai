import React from 'react';
import { ShieldCheck, Award } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 py-6 transition-colors">
      <div className="max-w-[1440px] mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center text-center md:text-left">

          {/* SBIT Info */}
          <div>
            <h3 className="text-slate-900 dark:text-white font-bold text-sm mb-1 flex items-center justify-center md:justify-start gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Swarna Bharathi Institute of Science and Technology
            </h3>
            <p className="text-[11px] text-slate-400">
              Approved by AICTE, New Delhi • Permanently Affiliated to JNTUH<br />
              Khammam, Telangana - 507002
            </p>
          </div>

          {/* Partner Logos */}
          <div className="flex items-center justify-center space-x-6">
            <div className="flex flex-col items-center group">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 group-hover:border-slate-400 dark:group-hover:border-slate-600 transition">
                <img
                  src="/assets/logos/spark-logo.png"
                  alt="SBIT Campus Portal"
                  className="h-12 sm:h-14 w-auto object-contain"
                />
              </div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 mt-1 tracking-wider">SBIT Campus AI</span>
            </div>
            <div className="flex flex-col items-center group">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group-hover:border-slate-400 dark:group-hover:border-slate-600 transition">
                <img
                  src="/assets/logos/aicte-logo.png"
                  alt="AICTE Approved"
                  className="h-12 sm:h-14 w-auto object-contain"
                />
              </div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 mt-1 tracking-wider">AICTE Approved</span>
            </div>
          </div>

          {/* System Status */}
          <div className="text-center md:text-right text-xs space-y-2">
            <p className="text-slate-400 text-[11px]">
              © {new Date().getFullYear()} SBIT Smart Campus. Designed & Developed for Enterprise Campus Automation.
            </p>
          </div>

        </div>
      </div>
    </footer>
  );
};
