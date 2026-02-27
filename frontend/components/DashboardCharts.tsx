'use client';

import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const revenueData = [
  { month: 'Sep', revenue: 3200000 },
  { month: 'Oct', revenue: 4800000 },
  { month: 'Nov', revenue: 5100000 },
  { month: 'Dec', revenue: 6700000 },
  { month: 'Jan', revenue: 5900000 },
  { month: 'Feb', revenue: 7200000 },
];

const dealsData = [
  { stage: 'Lead', count: 25 },
  { stage: 'Qualified', count: 18 },
  { stage: 'Meeting', count: 12 },
  { stage: 'Proposal', count: 8 },
  { stage: 'Negotiation', count: 5 },
  { stage: 'Won', count: 3 },
];

const leadSourceData = [
  { name: 'Referral', value: 35 },
  { name: 'Social Media', value: 25 },
  { name: 'Website', value: 20 },
  { name: 'Cold Call', value: 12 },
  { name: 'Event', value: 8 },
];

const taskData = [
  { name: 'To Do', value: 15, color: '#C9A96E' },
  { name: 'In Progress', value: 8, color: '#131B2B' },
  { name: 'Done', value: 22, color: '#10b981' },
];

const COLORS = ['#C9A96E', '#131B2B', '#8A6F2F', '#1e2a3d', '#6B7280'];

const formatRevenue = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toString();
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border rounded-xl p-3 shadow-xl" style={{ borderColor: '#E5E7EB' }}>
        <p className="text-xs font-semibold mb-1" style={{ color: '#131B2B' }}>{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-medium" style={{ color: '#C9A96E' }}>
            {entry.name === 'revenue' ? `AED ${formatRevenue(entry.value)}` : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardCharts() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

      {/* Revenue Trend */}
      <div className="bg-white p-6 rounded-xl border" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#131B2B' }}>Revenue Trend</h3>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Last 6 months (AED)</p>
          </div>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(201,169,110,0.12)' }}
          >
            <span style={{ fontSize: '16px' }}>📈</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatRevenue} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#C9A96E"
              strokeWidth={2.5}
              dot={{ fill: '#C9A96E', strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, fill: '#8A6F2F' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Deals Pipeline */}
      <div className="bg-white p-6 rounded-xl border" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#131B2B' }}>Deals Pipeline</h3>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>By stage</p>
          </div>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(19,27,43,0.08)' }}
          >
            <span style={{ fontSize: '16px' }}>🔄</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={dealsData} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="stage" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[5, 5, 0, 0]}>
              {dealsData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={index === dealsData.length - 1 ? '#C9A96E' : '#131B2B'}
                  fillOpacity={index === dealsData.length - 1 ? 1 : 0.7 + (index * 0.05)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Lead Sources */}
      <div className="bg-white p-6 rounded-xl border" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#131B2B' }}>Lead Sources</h3>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Distribution by channel</p>
          </div>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(201,169,110,0.12)' }}
          >
            <span style={{ fontSize: '16px' }}>🎯</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ResponsiveContainer width="45%" height={190}>
            <PieChart>
              <Pie data={leadSourceData} cx="50%" cy="50%" outerRadius={80} paddingAngle={2} dataKey="value">
                {leadSourceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value}%`, 'Share']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {leadSourceData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[index % COLORS.length] }} />
                <span className="text-xs flex-1" style={{ color: '#6B7280' }}>{entry.name}</span>
                <span className="text-xs font-semibold" style={{ color: '#131B2B' }}>{entry.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Task Completion */}
      <div className="bg-white p-6 rounded-xl border" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#131B2B' }}>Task Completion</h3>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Current task breakdown</p>
          </div>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.1)' }}
          >
            <span style={{ fontSize: '16px' }}>✅</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ResponsiveContainer width="45%" height={190}>
            <PieChart>
              <Pie data={taskData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {taskData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-3">
            {taskData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
                <span className="text-xs flex-1" style={{ color: '#6B7280' }}>{entry.name}</span>
                <span className="text-xs font-bold" style={{ color: entry.color }}>{entry.value}</span>
              </div>
            ))}
            <div className="pt-2 border-t" style={{ borderColor: '#F3F4F6' }}>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>
                {Math.round((taskData[2].value / taskData.reduce((s, d) => s + d.value, 0)) * 100)}% completion rate
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
