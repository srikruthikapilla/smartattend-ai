import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { AttendanceCharts } from '../components/analytics/AttendanceCharts';
import { StatCard } from '../components/common/StatCard';
import { BarChart3, Calendar, Filter, TrendingUp, TrendingDown, Percent, Users, Award } from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const { attendanceRecords } = useAttendance();

  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  // Filter records
  const filtered = attendanceRecords.filter(r => {
    if (selectedBranch !== 'all' && r.branch !== selectedBranch) return false;
    if (selectedSubject !== 'all' && r.subject !== selectedSubject) return false;
    return true;
  });

  const total = filtered.length;
  const present = filtered.filter(r => r.status === 'present').length;
  const late = filtered.filter(r => r.status === 'late').length;
  const absent = filtered.filter(r => r.status === 'absent').length;
  const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  return (
    <div className="space-y-6">
      
      {/* Header & Controls */}
      <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase">
            Campus Intelligence & Analytics
          </span>
          <h2 className="text-2xl font-extrabold text-white mt-2">
            Multi-Dimensional Visual Analytics
          </h2>
          <p className="text-xs text-slate-400">
            Realtime data visualizations powered by Recharts & SBIT Campus Intelligence Engine
          </p>
        </div>

        {/* Timeframe & Filter Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded-lg capitalize transition ${
                  timeframe === tf ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none"
          >
            <option value="all">All Branches</option>
            {['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AIML'].map(b => (
              <option key={b} value={b}>{b} Department</option>
            ))}
          </select>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Overall Attendance Rate"
          value={`${rate}%`}
          subtitle="Selected Criteria"
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
          value="CSE (94%)"
          subtitle="Top Performing"
          icon={TrendingUp}
          color="emerald"
        />
        <StatCard
          title="Lowest Branch"
          value="MECH (78%)"
          subtitle="Needs Followup"
          icon={TrendingDown}
          color="red"
        />
      </div>

      {/* Recharts Visualizations Component */}
      <AttendanceCharts records={filtered} />

    </div>
  );
};
