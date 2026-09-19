import React from 'react';
import { AttendanceRecord } from '../../types/attendance';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';
import { ScanFace, QrCode, Fingerprint, Edit3, Inbox } from 'lucide-react';

interface AttendanceChartsProps {
  records: AttendanceRecord[];
  selectedBranch?: string;
}

export const AttendanceCharts: React.FC<AttendanceChartsProps> = ({ records, selectedBranch = 'all' }) => {
  const totalCount = records.length;

  // 1. Status Breakdown (Pie Chart Data)
  const presentCount = records.filter(r => r.status === 'present').length;
  const lateCount = records.filter(r => r.status === 'late').length;
  const absentCount = records.filter(r => r.status === 'absent').length;

  const pieData = [
    { name: 'Present', value: presentCount, color: '#10b981' },
    { name: 'Late', value: lateCount, color: '#f59e0b' },
    { name: 'Absent', value: absentCount, color: '#ef4444' },
  ].filter(item => totalCount > 0 ? true : false);

  // 2. Branch or Section Breakdown (Bar Chart Data)
  const isSingleBranch = selectedBranch !== 'all';
  let barData: Array<{ label: string; Present: number; Late: number; Absent: number }> = [];

  if (isSingleBranch) {
    // Show Section Breakdown for selected branch
    const sections = ['Section A', 'Section B', 'Section C'];
    barData = sections.map(secName => {
      const secCode = secName.replace('Section ', '');
      const secRecs = records.filter(r => r.section === secCode || r.section === secName);
      return {
        label: secName,
        Present: secRecs.filter(r => r.status === 'present').length,
        Late: secRecs.filter(r => r.status === 'late').length,
        Absent: secRecs.filter(r => r.status === 'absent').length,
      };
    });
  } else {
    // Show all branches
    const branches = ['CSE', 'AI', 'DS'];
    barData = branches.map(branch => {
      const branchRecs = records.filter(r => r.branch === branch);
      return {
        label: branch,
        Present: branchRecs.filter(r => r.status === 'present').length,
        Late: branchRecs.filter(r => r.status === 'late').length,
        Absent: branchRecs.filter(r => r.status === 'absent').length,
      };
    });
  }

  // 3. Session-wise Rate Breakdown (Area Chart Data)
  const sessionsMap: { [key: string]: { total: number; present: number } } = {};
  records.forEach(rec => {
    const sTitle = rec.sessionTitle || `${rec.branch || 'Campus'} Session`;
    if (!sessionsMap[sTitle]) sessionsMap[sTitle] = { total: 0, present: 0 };
    sessionsMap[sTitle].total += 1;
    if (rec.status === 'present' || rec.status === 'late') sessionsMap[sTitle].present += 1;
  });

  const areaData = Object.keys(sessionsMap).slice(0, 10).map(sTitle => {
    const item = sessionsMap[sTitle];
    const pct = item.total > 0 ? Math.round((item.present / item.total) * 100) : 0;
    return {
      session: sTitle.length > 18 ? sTitle.substring(0, 18) + '...' : sTitle,
      AttendancePct: pct
    };
  });

  // 4. Timeline (Line Chart Data - Chronologically Sorted)
  const timelineMap: { [dateStr: string]: { timestamp: number; dateLabel: string; present: number; total: number } } = {};
  records.forEach(rec => {
    const d = new Date(rec.markedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    if (!timelineMap[key]) {
      timelineMap[key] = {
        timestamp: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
        dateLabel: label,
        present: 0,
        total: 0
      };
    }
    timelineMap[key].total += 1;
    if (rec.status === 'present' || rec.status === 'late') timelineMap[key].present += 1;
  });

  const lineData = Object.values(timelineMap)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(item => ({
      date: item.dateLabel,
      Rate: item.total > 0 ? Math.round((item.present / item.total) * 100) : 0
    }));

  // 5. Verification Method Modality Breakdown
  const methodCounts = {
    face: records.filter(r => r.verificationMethod === 'face_recognition').length,
    qr: records.filter(r => r.verificationMethod === 'qr_gps').length,
    bio: records.filter(r => r.verificationMethod === 'biometric_fallback').length,
    manual: records.filter(r => r.verificationMethod === 'manual').length,
  };

  const methodData = [
    { name: 'Face AI Liveness', count: methodCounts.face, color: '#8b5cf6', icon: ScanFace },
    { name: 'QR + GPS Geofence', count: methodCounts.qr, color: '#3b82f6', icon: QrCode },
    { name: 'Biometric WebAuthn', count: methodCounts.bio, color: '#10b981', icon: Fingerprint },
    { name: 'Faculty Manual', count: methodCounts.manual, color: '#f59e0b', icon: Edit3 },
  ];

  if (totalCount === 0) {
    return (
      <div className="py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
          <Inbox className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Attendance Records For Selected Filter</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            There are currently no attendance scans recorded matching the selected department or timeframe. Use "Seed Campus Data" above to load realistic demo records or run a live check-in session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Row: Pie Chart & Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        
        {/* Overall Status Distribution (Pie Chart) */}
        <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
              Attendance Distribution
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isSingleBranch ? `${selectedBranch} Department` : 'All SBIT Departments'}
            </p>
          </div>

          <div className="h-64 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Quick counts pills */}
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/50 text-center">
            <div className="bg-emerald-500/10 rounded-lg p-1.5 border border-emerald-500/20">
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Present</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">{presentCount}</span>
            </div>
            <div className="bg-amber-500/10 rounded-lg p-1.5 border border-amber-500/20">
              <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block">Late</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">{lateCount}</span>
            </div>
            <div className="bg-red-500/10 rounded-lg p-1.5 border border-red-500/20">
              <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 block">Absent</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">{absentCount}</span>
            </div>
          </div>
        </div>

        {/* Branch / Section Breakdown (Bar Chart) */}
        <div className="lg:col-span-7 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
              {isSingleBranch ? `${selectedBranch} Section Breakdown` : 'Department-wise Attendance Breakdown'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Comparative status volume across academic units
            </p>
          </div>

          <div className="h-64 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Legend />
                <Bar dataKey="Present" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Middle Row: Area & Line Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        
        {/* Session-wise Rate (Area Chart) */}
        <div className="lg:col-span-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 sm:p-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
            Lecture Session Attendance Rate (%)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-2">
            Attendance percentage by academic course session
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPct" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="session" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <YAxis stroke="#94a3b8" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Area type="monotone" dataKey="AttendancePct" name="Attendance %" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorPct)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Timeline Trends (Line Chart) */}
        <div className="lg:col-span-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 sm:p-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
            Daily Attendance Trend (%)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-2">
            Chronological compliance trajectory over selected timeframe
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData.length > 0 ? lineData : [{ date: 'Today', Rate: 100 }]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <YAxis stroke="#94a3b8" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Line type="monotone" dataKey="Rate" name="Attendance %" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Verification Modality Breakdown Cards */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5">
        <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading mb-1">
          Verification Modality Breakdown
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Distribution of biometric face AI, encrypted QR geofence scans, and fallback authentications
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {methodData.map(m => {
            const Icon = m.icon;
            const pct = totalCount > 0 ? Math.round((m.count / totalCount) * 100) : 0;
            return (
              <div key={m.name} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${m.color}15`, color: m.color }}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{m.name}</h4>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{m.count} Scans ({pct}%)</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-extrabold" style={{ color: m.color }}>{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
