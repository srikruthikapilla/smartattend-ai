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
  const iconColorMap = {
    blue: 'text-blue-500',
    emerald: 'text-teal-500',
    amber: 'text-amber-500',
    purple: 'text-purple-500',
    red: 'text-red-500',
    indigo: 'text-indigo-500',
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col justify-between hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-4">
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {title}
        </span>
        <Icon className={`w-5 h-5 opacity-60 ${iconColorMap[color]}`} />
      </div>
      <div>
        <div className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
          {value}
        </div>
        {subtitle && (
          <div className="text-[11px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">
            {subtitle}
          </div>
        )}
      </div>
      {trend && (
        <div className={`mt-3 flex items-center text-[11px] font-semibold uppercase tracking-wider ${
          trend.isPositive ? 'text-teal-600 dark:text-teal-400' : 'text-red-500'
        }`}>
          {trend.isPositive ? '↑' : '↓'} {trend.value}
        </div>
      )}
    </div>
  );
};
