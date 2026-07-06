'use client';
import { useState } from 'react';
import { fetchBetByCodice } from '../../lib/api';
import type { Bet } from '../../lib/api';

export default function Verifica() {
  const [codice, setCodice] = useState('');
  const [bet, setBet] = useState<Bet | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!codice.trim()) return;
    setLoading(true); setError(''); setBet(null);
    try {
      const data = await fetchBetByCodice(codice.trim().toUpperCase());
      setBet(data);
    } catch {
      setError('Schedina non trovata. Controlla il codice e riprova.');
    } finally {
      setLoading(false);
    }
  }

  const resultColor = bet?.result === 'win' ? '#00c896' : bet?.result === 'lose' ? '#e63946' : '#f59e0b';
  const resultLabel = bet?.result === 'win' ? 'VINCENTE' : bet?.result === 'lose' ? 'PERDENTE' : bet?.result === 'cancelled' ? 'ANNULLATA' : 'IN ATTESA';

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#d8e4f0', marginBottom: 6 }}>Verifica Schedina</h1>
      <p style={{ fontSize: 12, color: '#6e8aaa', marginBottom: 28 }}>Inserisci il codice schedina per verificarne lo stato</p>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        <input
          value={codice}
          onChange={e => setCodice(e.target.value.toUpperCase())}
          placeholder="Es. BB-ABC123"
          style={{
            flex: 1, background: '#0c0f18', border: '1px solid #1a2030',
            borderRadius: 9, padding: '12px 16px', fontSize: 14, fontWeight: 700,
            color: '#d8e4f0', outline: 'none', fontFamily: 'inherit', letterSpacing: '0.05em',
          }}
        />
        <button type="submit" disabled={loading} style={{
          background: 'linear-gradient(135deg, #0077a8, #00b4d8)',
          border: 'none', borderRadius: 9, padding: '12px 24px',
          fontSize: 13, fontWeight: 800, color: '#fff', cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,180,216,0.3)',
        }}>
          {loading ? '...' : 'Verifica'}
        </button>
      </form>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 9, padding: '14px 16px', fontSize: 13, color: '#f87171' }}>
          {error}
        </div>
      )}

      {bet && (
        <div style={{ background: '#0d1220', border: '1px solid #1a2030', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${resultColor}, transparent)` }} />
          <div style={{ padding: '20px 20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: '#344a62', marginBottom: 4 }}>Codice Schedina</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#d8e4f0', letterSpacing: '0.05em' }}>{bet.codice_schedina}</div>
              </div>
              <div style={{
                background: `rgba(${bet.result === 'win' ? '0,200,150' : bet.result === 'lose' ? '230,57,70' : '245,158,11'},0.12)`,
                border: `1px solid rgba(${bet.result === 'win' ? '0,200,150' : bet.result === 'lose' ? '230,57,70' : '245,158,11'},0.25)`,
                borderRadius: 6, padding: '5px 12px',
                fontSize: 11, fontWeight: 800, color: resultColor, letterSpacing: '0.06em',
              }}>{resultLabel}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Puntata', value: `€${bet.stake.toFixed(2)}` },
                { label: 'Quota Totale', value: bet.total_odds.toFixed(2) },
                { label: 'Vincita Potenziale', value: `€${bet.potential_win.toFixed(2)}` },
              ].map(item => (
                <div key={item.label} style={{ background: '#080b14', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, color: '#344a62', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#d8e4f0' }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: '#6e8aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Selezioni</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {bet.selections.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: '#080b14', borderRadius: 7, padding: '10px 14px',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#d8e4f0' }}>{s.nome_evento}</div>
                    <div style={{ fontSize: 10, color: '#344a62', marginTop: 2 }}>{s.market} — {s.outcome}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#00b4d8' }}>{s.quota.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
