import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { ElectionResult } from '../types';

interface ResultChartsProps {
  results: ElectionResult[];
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function ResultCharts({ results }: ResultChartsProps) {
  if (!results || results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 text-center">
        <p className="text-gray-500 dark:text-gray-400">No polling data available yet.</p>
      </div>
    );
  }

  // Format data for Recharts
  const barData = results.map(r => ({
    name: r.candidate_name.split(' ').slice(-1)[0] || r.candidate_name, // Use last name to fit axis labels
    fullName: r.candidate_name,
    party: r.party_name,
    Votes: r.votes
  }));

  const pieData = results.map(r => ({
    name: r.party_name,
    value: r.votes,
    candidate: r.candidate_name
  }));

  // Filter out parties with 0 votes to make pie look nicer, or keep all if all are 0
  const activePieData = pieData.filter(d => d.value > 0);
  const finalPieData = activePieData.length > 0 ? activePieData : pieData;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-950 p-4 border border-gray-150 dark:border-gray-800 rounded-xl shadow-lg">
          <p className="font-bold text-gray-900 dark:text-white text-sm">{data.fullName || data.candidate}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{data.party || data.name}</p>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-1">
            Votes Cast: <span className="font-extrabold text-blue-600 dark:text-blue-400">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Bar Chart Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h4 className="text-base font-bold text-slate-800 dark:text-white mb-4">Vote Count Comparison</h4>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" className="dark:stroke-slate-800" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} />
              <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(37, 99, 235, 0.04)' }} />
              <Bar dataKey="Votes" radius={[6, 6, 0, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie Chart Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h4 className="text-base font-bold text-slate-800 dark:text-white mb-4">Popularity Share (by Party)</h4>
        <div className="h-72 w-full flex flex-col sm:flex-row items-center justify-center gap-4">
          <div className="h-56 w-56 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={finalPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {finalPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex flex-col gap-2.5 max-w-full overflow-hidden">
            {finalPieData.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                <span className="text-xs font-semibold text-slate-750 dark:text-slate-200 truncate max-w-[150px] sm:max-w-[180px]" title={entry.name}>
                  {entry.name}
                </span>
                <span className="text-xs text-slate-500 font-mono">({entry.value} votes)</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
