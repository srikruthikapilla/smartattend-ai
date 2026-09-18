import React from 'react';

export const SkeletonCard: React.FC = () => (
  <div className="card-premium">
    <div className="card-premium-inner animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2.5">
          <div className="h-3 w-24 bg-slate-200 dark:bg-white/[0.06] rounded-md" />
          <div className="h-7 w-32 bg-slate-200 dark:bg-white/[0.08] rounded-md" />
        </div>
        <div className="h-9 w-9 bg-slate-200 dark:bg-white/[0.06] rounded-lg" />
      </div>
    </div>
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="card-premium">
    <div className="card-premium-inner !p-4 animate-pulse space-y-3">
      <div className="h-8 bg-slate-200 dark:bg-white/[0.06] rounded-lg" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-slate-100 dark:bg-white/[0.04] rounded-md" />
      ))}
    </div>
  </div>
);
