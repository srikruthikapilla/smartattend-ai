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

interface AttendanceChartsProps {
  records: AttendanceRecord[];
}

export const AttendanceCharts: React.FC<AttendanceChartsProps> = ({ records }) => {
  // 1. Status Breakdown (Pie Chart Data)
  const presentCount = records.filter(r => r.status === 'present').length;
  const lateCount = records.filter(r => r.status === 'late').length;
  const absentCount = records.filter(r => r.status === 'absent').length;

  const pieData = [
    { name: 'Present', value: presentCount, color: '#10b981' },
    { name: 'Late', value: lateCount, color: '#f59e0b' },
    { name: 'Absent', value: absentCount, color: '#ef4444' },
  ];

  // 2. Branch-wise Breakdown (Bar Chart Data)
  const branches = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AIML'];
  const barData = branches.map(branch => {
    const branchRecs = records.filter(r => r.branch === branch);
    return {
      branch,
      Present: branchRecs.filter(r => r.status === 'present').length,
      Late: branchRecs.filter(r => r.status === 'late').length,
      Absent: branchRecs.filter(r => r.status === 'absent').length,
    };
  });

  // 3. Subject-wise Rate Breakdown (Area Chart Data)
  const subjectsMap: { [key: string]: { total: number; present: number } } = {};
  records.forEach(rec => {
    const subj = rec.subject || 'General';
    if (!subjectsMap[subj]) subjectsMap[subj] = { total: 0, present: 0 };
    subjectsMap[subj].total += 1;
    if (rec.status === 'present' || rec.status === 'late') subjectsMap[subj].present += 1;
  });

  const areaData = Object.keys(subjectsMap).map(subj => {
    const item = subjectsMap[subj];
    const pct = item.total > 0 ? Math.round((item.present / item.total) * 100) : 0;
    return {
      subject: subj.length > 15 ? subj.substring(0, 15) + '...' : subj,
      AttendancePct: pct
    };
  });

  // 4. Timeline (Line Chart Data)
  const timelineMap: { [date: string]: { present: number; total: number } } = {};
  records.forEach(rec => {
    const d = new Date(rec.markedAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
    if (!timelineMap[d]) timelineMap[d] = { present: 0, total: 0 };
    timelineMap[d].total += 1;
    if (rec.status === 'present' || rec.status === 'late') timelineMap[d].present += 1;
  });

  const lineData = Object.keys(timelineMap).map(d => ({
    date: d,
    Rate: Math.round((timelineMap[d].present / timelineMap[d].total) * 100)
  }));

  return (
    <div className="space-y-6">
      
      {/* Top Row: Pie Chart & Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Overall Status Distribution (Pie Chart) */}
        <div className="lg:col-span-5 glass-panel p-5">
          <h3 className="text-base font-bold text-white light:text-slate-900 mb-4">
            Attendance Distribution (Overall)
          </h3>
          <div className="h-64">
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
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Branch-wise Breakdown (Bar Chart) */}
        <div className="lg:col-span-7 glass-panel p-5">
          <h3 className="text-base font-bold text-white light:text-slate-900 mb-4">
            Branch-wise Attendance Breakdown
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="branch" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
                <Legend />
                <Bar dataKey="Present" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Bottom Row: Area & Line Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Subject-wise Rate (Area Chart) */}
        <div className="lg:col-span-6 glass-panel p-5">
          <h3 className="text-base font-bold text-white light:text-slate-900 mb-4">
            Subject Attendance Rate (%)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPct" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="subject" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
                <Area type="monotone" dataKey="AttendancePct" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorPct)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Timeline Trends (Line Chart) */}
        <div className="lg:col-span-6 glass-panel p-5">
          <h3 className="text-base font-bold text-white light:text-slate-900 mb-4">
            Daily Attendance Trend (%)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData.length > 0 ? lineData : [{ date: 'Today', Rate: 100 }]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
                <Line type="monotone" dataKey="Rate" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
};
