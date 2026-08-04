import React from 'react';

export const SkeletonCard: React.FC = () => (
  <div className="glass-panel p-5 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <div className="h-3 w-24 bg-slate-700/60 light:bg-slate-300 rounded"></div>
        <div className="h-8 w-32 bg-slate-700/80 light:bg-slate-300 rounded"></div>
      </div>
      <div className="h-12 w-12 bg-slate-700/60 light:bg-slate-300 rounded-2xl"></div>
    </div>
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="glass-panel p-4 animate-pulse space-y-3">
    <div className="h-8 bg-slate-800 light:bg-slate-200 rounded-xl"></div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-12 bg-slate-800/50 light:bg-slate-100 rounded-lg"></div>
    ))}
  </div>
);
