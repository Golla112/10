'use client';
import { useState } from 'react';
import { Bet, adminSetPaid, adminSetResult, fetchBetByCodice } from '../lib/api';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

async function triggerSettle(codice: string): Promise<Bet> {
  // Trigger settle then fetch updated bet
  await fetch(`${API_BASE}/bets/${encodeURIComponent(codice)}/settle`, { method: 'POST' }).catch(() => {});
  return fetchBetByCodice(codice);
}

function selectionResultIcon(r?: string) {
  if (r === 'win') return '✅';
  if (r === 'lose') return '❌';
  return '⏳';
}

function BetDetailModal({ bet: initialBet, onClose, onRefresh }: { bet: Bet; onClose: () => void; onRefresh?: () => void }) {
  const [bet, setBet] = useState<Bet>(initialBet);
  const [loading, setLoading] = useState(false);

  // Auto-trigger settle on open if pending
  useState(() => {
    if (initialBet.result === 'pending') {
      setLoading(true);
      triggerSettle(initialBet.codice_schedina)
        .then(updated => { setBet(updated); onRefresh?.(); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  });

  const isWin = bet.result === 'win';
  const isLose = bet.result === 'lose';
  const accentColor = isWin ? '#34d399' : isLose ? '#f87171' : '#f59e0b';
  const bgAccent = isWin ? 'rgba(52,211,153,0.08)' : isLose ? 'rgba(248,113,113,0.08)' : 'rgba(245,158,11,0.08)';
  const borderAccent = isWin ? 'rgba(52,211,153,0.25)' : isLose ? 'rgba(248,113,113,0.25)' : 'rgba(245,158,11,0.25)';
  const resultLabel = isWin ? '🏆 VINCENTE' : isLose ? '❌ PERDENTE' : '⏳ IN ATTESA';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0d1220', border: `1px solid ${borderAccent}`,
          borderRadius: 16, width: '100%', maxWidth: 480,
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: `0 0 40px ${accentColor}22`,
        }}
      >
        {/* Top accent bar */}
        <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`, borderRadius: '16px 16px 0 0' }} />

        <div style={{ padding: '20px 20px 24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 10, color: '#344a62', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Codice Schedina</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#d8e4f0', letterSpacing: '0.05em', fontFamily: 'monospace' }}>{bet.codice_schedina}</div>
              <div style={{ fontSize: 11, color: '#344a62', marginTop: 4 }}>{new Date(bet.created_at).toLocaleString('it-IT')}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <div style={{
                background: bgAccent, border: `1px solid ${borderAccent}`,
                borderRadius: 6, padding: '5px 12px',
                fontSize: 11, fontWeight: 800, color: accentColor, letterSpacing: '0.06em',
              }}>
                {loading ? '🔄 Verifica...' : resultLabel}
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Puntata', value: `€${bet.stake.toFixed(2)}` },
              { label: 'Quota Tot.', value: `${bet.total_odds.toFixed(2)}x` },
              { label: 'Vincita Pot.', value: `€${bet.potential_win.toFixed(2)}`, color: isWin ? '#34d399' : undefined },
            ].map(item => (
              <div key={item.label} style={{ background: '#080b14', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, color: '#344a62', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: item.color ?? '#d8e4f0' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Selections */}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6e8aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Selezioni ({bet.selections.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {bet.selections.map((s, i) => {
              const selWin = s.result === 'win';
              const selLose = s.result === 'lose';
              const selColor = selWin ? '#34d399' : selLose ? '#f87171' : '#6e8aaa';
              const selBg = selWin ? 'rgba(52,211,153,0.06)' : selLose ? 'rgba(248,113,113,0.06)' : '#080b14';
              const selBorder = selWin ? 'rgba(52,211,153,0.2)' : selLose ? 'rgba(248,113,113,0.2)' : 'transparent';
              return (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: selBg, border: `1px solid ${selBorder}`,
                  borderRadius: 8, padding: '10px 14px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#d8e4f0', marginBottom: 2 }}>{s.nome_evento}</div>
                    <div style={{ fontSize: 10, color: '#344a62' }}>{s.market} — {s.outcome}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#00b4d8' }}>{s.quota.toFixed(2)}</span>
                    <span style={{ fontSize: 14, color: selColor }}>{selectionResultIcon(s.result)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <Link href={`/print/${bet.codice_schedina}`}
              style={{
                flex: 1, textAlign: 'center', padding: '10px', borderRadius: 8,
                border: '1px solid #1a2030', background: 'rgba(255,255,255,0.03)',
                color: '#6e8aaa', fontSize: 12, fontWeight: 700, textDecoration: 'none',
              }}>
              🖨️ Stampa ricevuta
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

type SortField = 'date' | 'stake' | 'potential_win';
type SortDir = 'asc' | 'desc';

function resultBadge(result: Bet['result']) {
  if (result === 'win') return <span className="rounded px-2 py-0.5 text-xs font-semibold bg-green-900 text-green-400 result-win">🏆 Vinto</span>;
  if (result === 'lose') return <span className="rounded px-2 py-0.5 text-xs font-semibold bg-red-900 text-red-400 result-lose">❌ Perso</span>;
  return <span className="rounded px-2 py-0.5 text-xs font-semibold bg-gray-700 text-gray-400 result-pending">⏳ Attesa</span>;
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <span className="ml-1 text-gray-600">↕</span>;
  return <span className="ml-1 text-blue-400">{sortDir === 'asc' ? '↑' : '↓'}</span>;
}

export default function BetHistoryTable({ bets, onRefresh, userRole }: { bets: Bet[]; onRefresh?: () => void; userRole?: string }) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [selectedBet, setSelectedBet] = useState<Bet | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  function handleSort(field: SortField) {
    if (field === sortField) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  }

  async function handlePay(codice: string) {
    setBusy(b => ({ ...b, [codice]: true }));
    try {
      await adminSetPaid(codice, true);
      showToast(`✅ ${codice} pagata`);
      onRefresh?.();
      // Apri ricevuta di pagamento in nuova tab
      window.open(`/print/${encodeURIComponent(codice)}?type=payment`, '_blank');
    } catch {
      showToast('Errore pagamento');
    } finally {
      setBusy(b => ({ ...b, [codice]: false }));
    }
  }

  async function handleResult(codice: string, result: 'win' | 'lose' | 'pending') {
    setBusy(b => ({ ...b, [`r-${codice}`]: true }));
    try {
      await adminSetResult(codice, result);
      showToast(`${codice} → ${result}`);
      onRefresh?.();
    } catch {
      showToast('Errore');
    } finally {
      setBusy(b => ({ ...b, [`r-${codice}`]: false }));
    }
  }

  const sorted = [...bets].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'date') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    else if (sortField === 'stake') cmp = a.stake - b.stake;
    else cmp = a.potential_win - b.potential_win;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  if (bets.length === 0) return <p className="py-8 text-center text-gray-500">Nessuna scommessa trovata.</p>;

  return (
    <div style={{ position: 'relative' }}>
      {selectedBet && (
        <BetDetailModal
          bet={selectedBet}
          onClose={() => setSelectedBet(null)}
          onRefresh={onRefresh}
        />
      )}
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
          {toast}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="bg-gray-800 text-xs uppercase text-gray-400">
            <tr>
              <th className="px-4 py-3">Codice</th>
              <th className="px-4 py-3 cursor-pointer select-none hover:text-white" onClick={() => handleSort('date')}>
                Data<SortIcon field="date" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className="px-4 py-3 cursor-pointer select-none hover:text-white" onClick={() => handleSort('stake')}>
                Puntata<SortIcon field="stake" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className="px-4 py-3">Quota</th>
              <th className="px-4 py-3 cursor-pointer select-none hover:text-white" onClick={() => handleSort('potential_win')}>
                Vincita pot.<SortIcon field="potential_win" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className="px-4 py-3">Risultato</th>
              <th className="px-4 py-3">Pagamento</th>
              <th className="px-4 py-3">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((bet, i) => {
              const isPaid = !!bet.paid_at;
              const canPay = ['admin', 'reseller', 'superadmin'].includes(userRole ?? '');
              return (
                <tr key={bet.id} className={`border-t border-gray-700 ${i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-950'}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedBet(bet)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-blue-400">{bet.codice_schedina}</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(bet.created_at).toLocaleString('it-IT')}</td>
                  <td className="px-4 py-3">€{bet.stake.toFixed(2)}</td>
                  <td className="px-4 py-3">{bet.total_odds.toFixed(2)}x</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: bet.result === 'win' ? '#34d399' : undefined }}>
                    €{bet.potential_win.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">{resultBadge(bet.result)}</td>
                  <td className="px-4 py-3">
                    {bet.result === 'win' && (canPay || isPaid) ? (
                      isPaid ? (
                        <span style={{
                          padding: '4px 12px', borderRadius: 6, border: '1px solid #334155',
                          background: 'rgba(255,255,255,.04)', color: '#64748b',
                          fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block',
                        }}>
                          ✅ Pagata
                        </span>
                      ) : (
                        <button
                          disabled={busy[bet.codice_schedina]}
                          onClick={(e) => { e.stopPropagation(); handlePay(bet.codice_schedina); }}
                          style={{
                            padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(52,211,153,.4)',
                            background: 'rgba(52,211,153,.12)', color: '#34d399',
                            fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          {busy[bet.codice_schedina] ? '...' : '💰 Paga'}
                        </button>
                      )
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button disabled={busy[`r-${bet.codice_schedina}`]} onClick={() => handleResult(bet.codice_schedina, 'win')}
                        style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(52,211,153,.3)', background: 'rgba(52,211,153,.08)', color: '#34d399', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓</button>
                      <button disabled={busy[`r-${bet.codice_schedina}`]} onClick={() => handleResult(bet.codice_schedina, 'lose')}
                        style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(248,113,113,.3)', background: 'rgba(248,113,113,.08)', color: '#f87171', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✗</button>
                      <Link href={`/print/${bet.codice_schedina}`}
                        style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid #334155', background: 'rgba(255,255,255,.03)', color: '#64748b', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>🖨️</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
