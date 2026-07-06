'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, DollarSign, TrendingUp, Activity,
  ArrowUpRight, ArrowDownRight, Clock
} from 'lucide-react';
import { getStoredUser } from '../../../lib/session';

interface ResellerStats {
  totalUsers: number;
  activeUsers: number;
  totalBalance: number;
  monthlyStake: number;
  monthlyWin: number;
  recentTransfers: {
    id: string;
    username: string;
    amount: number;
    type: 'in' | 'out';
    date: string;
  }[];
}

export default function ResellerDashboard() {
  const [stats, setStats] = useState<ResellerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const user = getStoredUser();

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/reseller/stats');
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        setStats(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#14805e]" />
      </div>
    );
  }

  const profit = stats ? stats.monthlyStake - stats.monthlyWin : 0;
  const profitPct = stats && stats.monthlyStake > 0 
    ? ((profit / stats.monthlyStake) * 100).toFixed(1) 
    : '0';

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-[#14805e]/20 to-[#00b4d8]/20 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white">
          Benvenuto, {user?.username}
        </h2>
        <p className="text-gray-400 mt-1">
          Gestisci il tuo network di giocatori e monitora le performance
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-4">
        {[
          { 
            icon: Users, 
            label: 'Utenti Totali', 
            value: stats?.totalUsers || 0,
            sub: `${stats?.activeUsers || 0} attivi`,
            color: '#3b82f6'
          },
          { 
            icon: DollarSign, 
            label: 'Saldo Network', 
            value: `€${(stats?.totalBalance || 0).toFixed(2)}`,
            sub: 'Disponibile per ricariche',
            color: '#14805e'
          },
          { 
            icon: TrendingUp, 
            label: 'Volume Mensile', 
            value: `€${(stats?.monthlyStake || 0).toFixed(2)}`,
            sub: `${stats?.recentTransfers.length || 0} transazioni`,
            color: '#f59e0b'
          },
          { 
            icon: Activity, 
            label: 'Profitto', 
            value: `€${profit.toFixed(2)}`,
            sub: `${profitPct}% margin`,
            color: profit >= 0 ? '#22c55e' : '#ef4444'
          },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white/5 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${stat.color}20` }}
              >
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-gray-400">{stat.label}</p>
            <p className="text-xs mt-1" style={{ color: stat.color }}>{stat.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Transfers */}
        <div className="bg-white/5 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Ultimi Movimenti
          </h3>
          
          <div className="space-y-3">
            {stats?.recentTransfers.length === 0 ? (
              <p className="text-sm text-gray-400">Nessun movimento recente</p>
            ) : (
              stats?.recentTransfers.slice(0, 5).map((transfer) => (
                <div 
                  key={transfer.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center
                      ${transfer.type === 'in' ? 'bg-green-500/20' : 'bg-red-500/20'}
                    `}>
                      {transfer.type === 'in' ? (
                        <ArrowDownRight className="w-4 h-4 text-green-400" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-white">{transfer.username}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(transfer.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`
                    font-bold
                    ${transfer.type === 'in' ? 'text-green-400' : 'text-red-400'}
                  `}>
                    {transfer.type === 'in' ? '+' : '-'}€{transfer.amount.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white/5 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-4">Azioni Rapide</h3>
          
          <div className="space-y-3">
            <a
              href="/reseller?tab=users"
              className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Gestisci Utenti</p>
                  <p className="text-xs text-gray-400">Crea nuovi utenti o ricarica saldi</p>
                </div>
              </div>
              <span className="text-gray-400 group-hover:text-white">→</span>
            </a>

            <a
              href="/reseller?tab=transfers"
              className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Trasferimenti</p>
                  <p className="text-xs text-gray-400">Storico movimenti credito</p>
                </div>
              </div>
              <span className="text-gray-400 group-hover:text-white">→</span>
            </a>

            <div className="p-4 bg-[#14805e]/10 border border-[#14805e]/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#14805e]/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-[#14805e]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Suggerimento</p>
                  <p className="text-xs text-gray-400">
                    Ricarica regolarmente i tuoi utenti attivi per mantenere il volume
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
