import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'blue' | 'emerald' | 'amber' | 'purple' | 'red' | 'indigo';
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  trend
}) => {
  const colorMap = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20 light:bg-blue-50 light:text-blue-600 light:border-blue-200',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 light:bg-emerald-50 light:text-emerald-600 light:border-emerald-200',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20 light:bg-amber-50 light:text-amber-600 light:border-amber-200',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20 light:bg-purple-50 light:text-purple-600 light:border-purple-200',
    red: 'bg-red-500/10 text-red-400 border-red-500/20 light:bg-red-50 light:text-red-600 light:border-red-200',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 light:bg-indigo-50 light:text-indigo-600 light:border-indigo-200',
  };

  return (
    <div className="glass-panel p-5 transition-transform hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 light:text-slate-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white light:text-slate-900 mt-1 tracking-tight">{value}</h3>
          {subtitle && <p className="text-xs text-slate-400 light:text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-2xl border ${colorMap[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center text-xs">
          <span className={`font-semibold ${trend.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </span>
          <span className="text-slate-500 ml-1.5">vs previous session</span>
        </div>
      )}
    </div>
  );
};
