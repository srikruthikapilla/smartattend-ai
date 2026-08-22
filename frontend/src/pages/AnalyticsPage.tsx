import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { AttendanceCharts } from '../components/analytics/AttendanceCharts';
import { StatCard } from '../components/common/StatCard';
import { BarChart3, TrendingUp, TrendingDown, Percent, Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const { attendanceRecords, seedDemoAttendance } = useAttendance();

  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [seedNotice, setSeedNotice] = useState<string | null>(null);

  // Timeframe and branch filtering
  const now = new Date();
  const filtered = attendanceRecords.filter(r => {
    if (selectedBranch !== 'all' && r.branch !== selectedBranch) return false;

    const recordDate = new Date(r.markedAt);
    if (timeframe === 'daily') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (recordDate < todayStart) return false;
    } else if (timeframe === 'weekly') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (recordDate < weekAgo) return false;
    } else if (timeframe === 'monthly') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (recordDate < monthAgo) return false;
    } else if (timeframe === 'yearly') {
      const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      if (recordDate < yearAgo) return false;
    }
    return true;
  });

  const total = filtered.length;
  const present = filtered.filter(r => r.status === 'present').length;
  const late = filtered.filter(r => r.status === 'late').length;
  const absent = filtered.filter(r => r.status === 'absent').length;
  const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  // Dynamically compute Highest & Lowest Performing Branches across all records
  const branches = ['CSE', 'AIML', 'ECE', 'IT', 'EEE', 'CIVIL', 'MECH'];
  const branchStats = branches.map(b => {
    const bRecs = attendanceRecords.filter(r => r.branch === b);
    const bTotal = bRecs.length;
    const bPresent = bRecs.filter(r => r.status === 'present' || r.status === 'late').length;
    const bRate = bTotal > 0 ? Math.round((bPresent / bTotal) * 100) : null;
    return { branch: b, total: bTotal, rate: bRate };
  }).filter(b => b.rate !== null);

  let highestBranchText = 'No Data';
  let lowestBranchText = 'No Data';

  if (branchStats.length > 0) {
    branchStats.sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
    highestBranchText = `${branchStats[0].branch} (${branchStats[0].rate}%)`;
    lowestBranchText = `${branchStats[branchStats.length - 1].branch} (${branchStats[branchStats.length - 1].rate}%)`;
  }

  const handleSeedDemoData = () => {
    seedDemoAttendance();
    setSeedNotice('Campus attendance dataset seeded with 150+ real multi-branch records.');
    setTimeout(() => setSeedNotice(null), 4000);
  };

  return (
    <div className="max-w-[1440px] mx-auto w-full space-y-6">
      
      {/* Seed Notice Banner */}
      {seedNotice && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span>{seedNotice}</span>
          </div>
        </div>
      )}

      {/* Header & Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
            Campus Intelligence & Analytics
          </span>
          <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white mt-1 tracking-tight">
            Multi-Dimensional Visual Analytics
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time data visualizations powered by SBIT Campus Intelligence Engine.
          </p>
        </div>

        {/* Timeframe, Branch Filter, and Seed Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded-md capitalize transition ${
                  timeframe === tf ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:outline-none"
          >
            <option value="all">All Branches</option>
            {['CSE', 'AIML', 'ECE', 'IT', 'EEE', 'CIVIL', 'MECH'].map(b => (
              <option key={b} value={b}>{b} Department</option>
            ))}
          </select>

          <button
            onClick={handleSeedDemoData}
            title="Populate realistic SBIT multi-branch attendance records"
            className="px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Seed Campus Data</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Overall Attendance Rate"
          value={`${rate}%`}
          subtitle={selectedBranch === 'all' ? `${timeframe} Average` : `${selectedBranch} • ${timeframe}`}
          icon={Percent}
          color="purple"
        />
        <StatCard
          title="Total Attendance Events"
          value={total}
          subtitle="Processed Scans"
          icon={BarChart3}
          color="blue"
        />
        <StatCard
          title="Highest Branch"
          value={highestBranchText}
          subtitle="Top Performing"
          icon={TrendingUp}
          color="emerald"
        />
        <StatCard
          title="Lowest Branch"
          value={lowestBranchText}
          subtitle="Needs Followup"
          icon={TrendingDown}
          color="red"
        />
      </div>

      {/* Recharts Visualizations Component */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <AttendanceCharts records={filtered} selectedBranch={selectedBranch} />
      </div>

    </div>
  );
};
