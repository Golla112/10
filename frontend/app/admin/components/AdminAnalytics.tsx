'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { it } from 'date-fns/locale';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface AnalyticsData {
  dailyBets: { date: string; count: number; stake: number; win: number }[];
  bySport: { sport: string; count: number; stake: number }[];
  byResult: { result: string; count: number; amount: number }[];
  topUsers: { username: string; bets: number; stake: number }[];
}

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await fetch(`/api/analytics/dashboard?days=${days}`);
        if (!res.ok) throw new Error('Failed to load');
        const analytics = await res.json();
        setData(analytics);
      } catch (err) {
        console.error('Analytics error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, [days]);

  const lineChartData = useMemo(() => {
    if (!data?.dailyBets) return null;
    return {
      labels: data.dailyBets.map(d => format(new Date(d.date), 'dd/MM', { locale: it })),
      datasets: [
        {
          label: 'Puntato',
          data: data.dailyBets.map(d => d.stake),
          borderColor: '#14805e',
          backgroundColor: 'rgba(20, 128, 94, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Vinto',
          data: data.dailyBets.map(d => d.win),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    };
  }, [data]);

  const sportChartData = useMemo(() => {
    if (!data?.bySport) return null;
    return {
      labels: data.bySport.map(s => s.sport),
      datasets: [{
        label: 'Volume',
        data: data.bySport.map(s => s.stake),
        backgroundColor: [
          '#14805e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7',
          '#06b6d4', '#84cc16', '#f97316',
        ],
      }],
    };
  }, [data]);

  const resultChartData = useMemo(() => {
    if (!data?.byResult) return null;
    return {
      labels: data.byResult.map(r => r.result === 'win' ? 'Vinte' : r.result === 'lose' ? 'Perse' : 'In attesa'),
      datasets: [{
        data: data.byResult.map(r => r.count),
        backgroundColor: ['#14805e', '#ef4444', '#f59e0b'],
        borderWidth: 0,
      }],
    };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#14805e]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">📊 Analytics</h2>
        <div className="flex gap-2">
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                days === d
                  ? 'bg-[#14805e] text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              {d} giorni
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Totale Scommesse', value: data?.dailyBets.reduce((a, b) => a + b.count, 0) || 0 },
          { label: 'Volume Puntato', value: `€${(data?.dailyBets.reduce((a, b) => a + b.stake, 0) || 0).toFixed(2)}` },
          { label: 'Vincite Totali', value: `€${(data?.dailyBets.reduce((a, b) => a + b.win, 0) || 0).toFixed(2)}` },
          { label: 'GGR', value: `€${((data?.dailyBets.reduce((a, b) => a + b.stake, 0) || 0) - (data?.dailyBets.reduce((a, b) => a + b.win, 0) || 0)).toFixed(2)}` },
        ].map((stat, i) => (
          <div key={i} className="bg-white/5 rounded-xl p-4">
            <p className="text-xs text-gray-400">{stat.label}</p>
            <p className="text-lg font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Line Chart */}
        <div className="bg-white/5 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-4">Trend Scommesse</h3>
          {lineChartData && (
            <Line
              data={lineChartData}
              options={{
                responsive: true,
                plugins: {
                  legend: { position: 'bottom', labels: { color: '#9ca3af' } },
                },
                scales: {
                  x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                  y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                },
              }}
            />
          )}
        </div>

        {/* Sport Distribution */}
        <div className="bg-white/5 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-4">Per Sport</h3>
          {sportChartData && (
            <Bar
              data={sportChartData}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false },
                },
                scales: {
                  x: { ticks: { color: '#9ca3af' }, grid: { display: false } },
                  y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                },
              }}
            />
          )}
        </div>

        {/* Result Distribution */}
        <div className="bg-white/5 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-4">Risultati</h3>
          {resultChartData && (
            <div className="h-48">
              <Doughnut
                data={resultChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom', labels: { color: '#9ca3af' } },
                  },
                }}
              />
            </div>
          )}
        </div>

        {/* Top Users */}
        <div className="bg-white/5 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-4">Top Utenti</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data?.topUsers.map((user, i) => (
              <div
                key={user.username}
                className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#14805e] text-white text-xs flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-sm text-white">{user.username}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white">€{user.stake.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{user.bets} scomm.</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
