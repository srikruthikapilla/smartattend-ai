import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'accent' | 'blue' | 'emerald' | 'amber' | 'purple' | 'red' | 'indigo';
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'accent',
  trend,
  className = '',
}) => {
  const iconBgMap: Record<string, string> = {
    accent: 'bg-accent-muted',
    blue: 'bg-blue-500/10',
    emerald: 'bg-emerald-500/10',
    amber: 'bg-amber-500/10',
    purple: 'bg-purple-500/10',
    red: 'bg-red-500/10',
    indigo: 'bg-indigo-500/10',
  };

  const iconColorMap: Record<string, string> = {
    accent: 'text-accent-DEFAULT',
    blue: 'text-blue-500',
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    purple: 'text-purple-500',
    red: 'text-red-500',
    indigo: 'text-indigo-500',
  };

  return (
    <div className={`card-premium group ${className}`}>
      <div className="card-premium-inner flex flex-col justify-between min-h-[120px]">
        <div className="flex justify-between items-start mb-4">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-tight">
            {title}
          </span>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 ease-premium group-hover:scale-105 ${iconBgMap[color]}`}>
            <Icon className={`w-[18px] h-[18px] ${iconColorMap[color]}`} />
          </div>
        </div>
        <div>
          <div className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </div>
          {subtitle && (
            <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">
              {subtitle}
            </div>
          )}
        </div>
        {trend && (
          <div className={`mt-3 flex items-center text-[11px] font-semibold uppercase tracking-wider ${
            trend.isPositive ? 'text-accent-DEFAULT dark:text-accent-light' : 'text-red-500'
          }`}>
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </div>
        )}
      </div>
    </div>
  );
};
