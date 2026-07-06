'use client';
import { useState, useEffect, useCallback } from 'react';
import { getBets, ResellerBet } from '../../../lib/resellerApi';

type StatusFilter = 'all' | 'pending' | 'win' | 'lose' | 'cancelled';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'In corso', color: '#fbbf24' },
  win:     { label: 'Vinta',    color: '#34d399' },
  lose:    { label: 'Persa',    color: '#f87171' },
  cancelled: { label: 'Annullata', color: '#6e8aaa' },
};

export default function ResellerBets() {
  const [bets, setBets] = useState<ResellerBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBets(filter === 'all' ? undefined : filter);
      setBets(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore nel caricamento scommesse');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Tutte' },
    { key: 'pending', label: 'In corso' },
    { key: 'win', label: 'Vinte' },
    { key: 'lose', label: 'Perse' },
  ];

  return (
    <div>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
              border: filter === f.key ? '1px solid #00b4d8' : '1px solid #1a2030',
              background: filter === f.key ? 'rgba(0,180,216,0.12)' : '#0d1018',
              color: filter === f.key ? '#00b4d8' : '#6e8aaa',
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#6e8aaa', fontSize: 13 }}>Caricamento...</div>
      ) : error ? (
        <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>
      ) : bets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6e8aaa', fontSize: 13 }}>
          Nessuna scommessa trovata
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {bets.map(bet => {
            const status = STATUS_LABELS[bet.result] ?? { label: bet.result, color: '#6e8aaa' };
            const isMine = bet.tipo === 'reseller';
            return (
              <div key={bet.codice_schedina} style={{
                background: '#0d1018', border: '1px solid #1a2030', borderRadius: 10,
                padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              }}>
                {/* Tipo badge */}
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                  background: isMine ? 'rgba(99,102,241,0.15)' : 'rgba(0,180,216,0.1)',
                  color: isMine ? '#818cf8' : '#00b4d8',
                  border: `1px solid ${isMine ? 'rgba(99,102,241,0.3)' : 'rgba(0,180,216,0.2)'}`,
                  flexShrink: 0,
                }}>
                  {isMine ? 'MIA' : 'UTENTE'}
                </span>

                {/* Codice */}
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#6e8aaa', minWidth: 90 }}>
                  {bet.codice_schedina}
                </span>

                {/* Proprietario */}
                <span style={{ fontSize: 11, color: '#d8e4f0', flex: 1, minWidth: 80 }}>
                  {bet.nome_proprietario}
                </span>

                {/* Stake */}
                <span style={{ fontSize: 11, color: '#6e8aaa', minWidth: 60 }}>
                  €{bet.stake.toFixed(2)}
                </span>

                {/* Quota */}
                <span style={{
                  fontSize: 11, fontWeight: 700, color: '#fbbf24',
                  background: 'rgba(251,191,36,0.08)', borderRadius: 4, padding: '2px 6px',
                }}>
                  {bet.total_odds.toFixed(2)}x
                </span>

                {/* Vincita potenziale */}
                <span style={{ fontSize: 11, color: '#34d399', minWidth: 70, textAlign: 'right' }}>
                  €{bet.potential_win.toFixed(2)}
                </span>

                {/* Status */}
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                  background: `${status.color}18`, color: status.color,
                  border: `1px solid ${status.color}30`,
                }}>
                  {status.label}
                </span>

                {/* Date */}
                <span style={{ fontSize: 10, color: '#344a62', minWidth: 80, textAlign: 'right' }}>
                  {new Date(bet.created_at).toLocaleDateString('it-IT')}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
