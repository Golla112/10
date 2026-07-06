'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, DollarSign, Clock, TrendingUp, RefreshCw, Loader2 } from 'lucide-react';
import { adminGetStats, AdminStats } from '../../../lib/api';

interface MetricCard {
  label: string;
  key: keyof AdminStats;
  icon: React.ElementType;
  color: string;
  format: (v: number) => string;
}

const CARDS: MetricCard[] = [
  {
    label: 'Utenti Totali',
    key: 'totalUsers',
    icon: Users,
    color: '#3b82f6',
    format: (v) => v.toLocaleString('it-IT'),
  },
  {
    label: 'Saldo Sistema',
    key: 'totalBalance',
    icon: DollarSign,
    color: '#10b981',
    format: (v) => `€${v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
  {
    label: 'Scommesse Pending',
    key: 'pendingBets',
    icon: Clock,
    color: '#f59e0b',
    format: (v) => v.toLocaleString('it-IT'),
  },
  {
    label: 'Profitto Book',
    key: 'bookProfit',
    icon: TrendingUp,
    color: '#8b5cf6',
    format: (v) => `€${v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.07, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as number[] },
  }),
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await adminGetStats();
      setStats(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.3px' }}>
            Dashboard
          </h2>
          <p style={{ margin: 0, fontSize: 11, color: '#475569', marginTop: 2 }}>
            Metriche aggregate del sistema
          </p>
        </div>
        <motion.button
          whileHover={{ scale: loading ? 1 : 1.06 }}
          whileTap={{ scale: 0.95 }}
          onClick={load}
          disabled={loading}
          style={{
            background: 'rgba(255,255,255,.05)',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 8,
            padding: '7px 10px',
            cursor: loading ? 'not-allowed' : 'pointer',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading
            ? <Loader2 size={13} style={{ animation: 'spin .7s linear infinite' }} />
            : <RefreshCw size={13} />}
          Aggiorna
        </motion.button>
      </div>

      {/* Metric cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {CARDS.map((card, i) => {
          const Icon = card.icon;
          const rawValue = stats?.[card.key];
          const isProfit = card.key === 'bookProfit';
          const profitColor = isProfit && rawValue !== undefined
            ? rawValue >= 0 ? '#10b981' : '#ef4444'
            : card.color;
          const displayColor = isProfit ? profitColor : card.color;
          const displayValue = loading
            ? null
            : error || rawValue === undefined
              ? '—'
              : card.format(rawValue as number);

          return (
            <motion.div
              key={card.key}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              style={{
                background: 'linear-gradient(145deg,rgba(30,41,59,.9),rgba(15,23,42,.95))',
                borderRadius: 16,
                padding: '20px 22px',
                border: '1px solid rgba(59,130,246,.15)',
                boxShadow: '0 8px 32px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.04)',
                backdropFilter: 'blur(12px)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Subtle glow accent */}
              <div style={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: `${displayColor}18`,
                filter: 'blur(20px)',
                pointerEvents: 'none',
              }} />

              {/* Icon + label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{
                  background: `${displayColor}18`,
                  border: `1px solid ${displayColor}30`,
                  borderRadius: 8,
                  padding: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Icon size={14} color={displayColor} />
                </div>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}>
                  {card.label}
                </span>
              </div>

              {/* Value */}
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32 }}>
                  <Loader2 size={16} color="#334155" style={{ animation: 'spin .7s linear infinite' }} />
                  <span style={{ fontSize: 12, color: '#334155' }}>Caricamento...</span>
                </div>
              ) : (
                <div style={{
                  fontSize: 26,
                  fontWeight: 900,
                  color: displayValue === '—' ? '#334155' : displayColor,
                  letterSpacing: '-0.5px',
                  lineHeight: 1,
                }}>
                  {displayValue}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ── Come funzionano i profitti ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        style={{
          marginTop: 20,
          background: 'linear-gradient(145deg,rgba(30,41,59,.7),rgba(15,23,42,.85))',
          borderRadius: 14, padding: '18px 22px',
          border: '1px solid rgba(139,92,246,.15)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <TrendingUp size={14} color="#8b5cf6" />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Come funzionano i profitti
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {[
            {
              icon: '💰',
              title: 'Saldo Sistema',
              desc: 'Somma di tutti i saldi degli utenti registrati. Aumenta quando gli utenti ricaricano, diminuisce quando vincono.',
              color: '#10b981',
            },
            {
              icon: '📈',
              title: 'Profitto Book',
              desc: 'Totale puntate incassate meno le vincite pagate. Positivo = il book guadagna. Negativo = il book ha pagato più di quanto incassato.',
              color: '#8b5cf6',
            },
            {
              icon: '⏳',
              title: 'Scommesse Pending',
              desc: 'Schedine ancora in attesa di risultato. Il profitto finale si calcola solo dopo il settle di tutte le partite.',
              color: '#f59e0b',
            },
            {
              icon: '🎁',
              title: 'Bonus Multipla',
              desc: 'Bonus aggiuntivo sulle vincite: +5% da 2 eventi, +10% da 4 eventi, +20% da 6+ eventi. Riduce il margine del book.',
              color: '#60a5fa',
            },
          ].map(item => (
            <div key={item.title} style={{
              background: 'rgba(0,0,0,.2)', borderRadius: 10, padding: '12px 14px',
              border: `1px solid ${item.color}18`,
            }}>
              <div style={{ fontSize: 16, marginBottom: 6 }}>{item.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: item.color, marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
