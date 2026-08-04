import React from 'react';
import { ShieldCheck, Cpu, Award } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto bg-slate-950 light:bg-slate-900 text-slate-400 border-t border-slate-800 light:border-slate-700 py-8 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center text-center md:text-left">
          
          {/* SBIT Info */}
          <div>
            <h3 className="text-white font-bold text-base mb-1 flex items-center justify-center md:justify-start gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              Swarna Bharathi Institute of Science and Technology
            </h3>
            <p className="text-xs text-slate-400">
              Approved by AICTE, New Delhi • Permanently Affiliated to JNTUH<br />
              Khammam, Telangana - 507002
            </p>
          </div>

          {/* Partner & Accreditation Logos (SPARK & AICTE) */}
          <div className="flex items-center justify-center space-x-6">
            
            {/* SPARK Innovation Centre Logo */}
            <div className="flex flex-col items-center group">
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 group-hover:border-blue-500/50 transition shadow-inner">
                <img
                  src="/assets/logos/spark-logo.png"
                  alt="SPARK Innovation Centre"
                  className="h-12 w-auto object-contain drop-shadow"
                />
              </div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 mt-1">SPARK Innovation Cell</span>
            </div>

            {/* AICTE Logo */}
            <div className="flex flex-col items-center group">
              <div className="p-2 rounded-xl bg-white border border-slate-700 group-hover:border-amber-500/50 transition shadow-inner">
                <img
                  src="/assets/logos/aicte-logo.png"
                  alt="AICTE Approved"
                  className="h-12 w-auto object-contain drop-shadow"
                />
              </div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 mt-1">AICTE Approved</span>
            </div>

          </div>

          {/* System Status & Copyright */}
          <div className="text-center md:text-right text-xs space-y-2">
            <div className="inline-flex items-center space-x-2 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="font-mono text-[11px]">Dynamic 30s QR Engine + GPS Active</span>
            </div>
            <p className="text-slate-500">
              © {new Date().getFullYear()} SBIT Smart Campus. Designed & Developed for Enterprise Campus Automation.
            </p>
          </div>

        </div>
      </div>
    </footer>
  );
};
