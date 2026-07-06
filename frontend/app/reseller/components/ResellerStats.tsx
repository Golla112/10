'use client';
import { useEffect, useState } from 'react';
import { getMe, getStats, type ResellerInfo, type ResellerStats as ResellerStatsData } from '../../../lib/resellerApi';

interface StatCardProps {
  label: string;
  value: string;
  color: string;
  icon: string;
}

function StatCard({ label, value, color, icon }: StatCardProps) {
  return (
    <div style={{
      background: '#0d1018', border: `1px solid ${color}20`,
      borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 140,
    }}>
      <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color, fontFamily: 'monospace', marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#6e8aaa' }}>{label}</div>
    </div>
  );
}

interface Props {
  refreshKey?: number;
}

export default function ResellerStats({ refreshKey }: Props) {
  const [stats, setStats] = useState<ResellerStatsData | null>(null);
  const [info, setInfo] = useState<ResellerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([getStats(), getMe()])
      .then(([s, i]) => { setStats(s); setInfo(i); })
      .catch(e => setError(e instanceof Error ? e.message : 'Errore'))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return <div style={{ color: '#6e8aaa', fontSize: 13 }}>Caricamento statistiche...</div>;
  if (error) return <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>;
  if (!stats) return null;

  const profitColor = stats.profit_from_users >= 0 ? '#34d399' : '#f87171';

  function copyCode() {
    if (info?.affiliate_code) {
      navigator.clipboard.writeText(info.affiliate_code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Affiliate code banner */}
      {info?.affiliate_code && (
        <div style={{
          background: 'linear-gradient(135deg, #0d1a2e, #0a1520)',
          border: '1px solid rgba(0,180,216,0.3)',
          borderRadius: 12, padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6e8aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Il tuo Codice Affiliato
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#00b4d8', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
              {info.affiliate_code}
            </div>
            <div style={{ fontSize: 11, color: '#344a62', marginTop: 4 }}>
              Condividilo con i tuoi utenti durante la registrazione
            </div>
          </div>
          <button
            onClick={copyCode}
            style={{
              background: copied ? 'rgba(52,211,153,0.15)' : 'rgba(0,180,216,0.1)',
              border: `1px solid ${copied ? 'rgba(52,211,153,0.4)' : 'rgba(0,180,216,0.3)'}`,
              borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
              color: copied ? '#34d399' : '#00b4d8', fontSize: 12, fontWeight: 700,
              transition: 'all 0.2s',
            }}
          >
            {copied ? '✓ Copiato' : '📋 Copia'}
          </button>
        </div>
      )}

      {/* Stats cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard icon="💰" label="Saldo corrente" value={`€${stats.reseller_balance.toFixed(2)}`} color="#34d399" />
        <StatCard
          icon="📈" label="Profitto da utenti"
          value={`${stats.profit_from_users >= 0 ? '+' : ''}€${stats.profit_from_users.toFixed(2)}`}
          color={profitColor}
        />
        <StatCard icon="👥" label="Totale utenti" value={String(stats.total_users)} color="#00b4d8" />
        <StatCard icon="🎯" label="Utenti attivi" value={String(stats.active_users)} color="#818cf8" />
        <StatCard icon="⏳" label="Scommesse in corso" value={String(stats.pending_bets_count)} color="#fbbf24" />
      </div>

      {/* ── Come funzionano i profitti ── */}
      <div style={{
        background: 'linear-gradient(145deg,rgba(13,16,24,.9),rgba(8,12,20,.95))',
        borderRadius: 14, padding: '18px 20px',
        border: '1px solid rgba(52,211,153,.12)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6e8aaa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
          📊 Come funzionano i profitti
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {[
            {
              icon: '📈',
              title: 'Profitto da utenti',
              desc: 'Differenza tra le puntate dei tuoi utenti e le vincite pagate. Se i tuoi utenti perdono, il tuo profitto aumenta.',
              color: '#34d399',
            },
            {
              icon: '💰',
              title: 'Saldo corrente',
              desc: 'Il tuo saldo disponibile come rivenditore. Aumenta quando i tuoi utenti perdono, diminuisce quando vinci o ricarichi utenti.',
              color: '#00b4d8',
            },
            {
              icon: '👥',
              title: 'Utenti attivi',
              desc: 'Utenti che hanno piazzato almeno una scommessa. Più utenti attivi = più volume = più profitto potenziale.',
              color: '#818cf8',
            },
            {
              icon: '⏳',
              title: 'Scommesse in corso',
              desc: 'Schedine ancora da risolvere. Il profitto finale si aggiorna automaticamente dopo il settle delle partite.',
              color: '#fbbf24',
            },
          ].map(item => (
            <div key={item.title} style={{
              background: 'rgba(0,0,0,.25)', borderRadius: 10, padding: '12px 14px',
              border: `1px solid ${item.color}15`,
            }}>
              <div style={{ fontSize: 16, marginBottom: 6 }}>{item.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: item.color, marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
