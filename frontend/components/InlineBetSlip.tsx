'use client';
import { useState, useEffect } from 'react';
import { useBetSlipStore, computeSystemPotentialWin } from '../lib/betSlipStore';
import { submitBet, BetSubmitResponse, fetchBalance } from '../lib/api';
import { getStoredUser } from '../lib/session';
import BetConfirmation, { StoredBet } from './BetConfirmation';
import AuthModal from './AuthModal';

const QUICK_STAKES = [5, 10, 20, 50];

// ── Prenota receipt shown after "Prenota" ─────────────────────────────────────
function PrenotaReceipt({ bet, onClose }: { bet: StoredBet; onClose: () => void }) {
  return (
    <div style={{ padding: 10 }}>
      <div className="prenota-receipt">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: '1px dashed #1a2535' }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>📋 Schedina Prenotata</div>
          <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 900, color: '#00b4d8', letterSpacing: '0.1em' }}>{bet.codice_schedina}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(bet.created_at).toLocaleString('it-IT')}</div>
        </div>

        {/* Selections */}
        <div style={{ marginBottom: 6 }}>
          {bet.selections.map((sel, i) => (
            <div key={i} className="prenota-receipt-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sel.nome_evento}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                  {sel.market} · <span style={{ color: '#60a5fa' }}>{sel.outcome}</span>
                  {sel.betcode && sel.betcode !== sel.outcome && (
                    <span style={{ marginLeft: 4, opacity: 0.7 }}>({sel.betcode})</span>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#34d399', marginLeft: 8, flexShrink: 0 }}>{sel.quota.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div style={{ background: '#060a0f', border: '1px solid var(--border)', borderRadius: 2, padding: '5px 8px', marginBottom: 8 }}>
          <div className="bs-summary-row">
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Quota totale</span>
            <span style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: 12 }}>{bet.total_odds.toFixed(2)}</span>
          </div>
          <div className="bs-summary-row">
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Puntata</span>
            <span style={{ fontWeight: 800, color: 'var(--text-secondary)', fontSize: 11 }}>€ {bet.stake.toFixed(2)}</span>
          </div>
          <div className="bs-summary-row" style={{ borderTop: '1px solid var(--border)', paddingTop: 3, marginTop: 2 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}>VINCITA POTENZIALE</span>
            <span style={{ fontWeight: 900, color: '#34d399', fontSize: 13 }}>€ {bet.potential_win.toFixed(2)}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => window.open(`/print/${bet.codice_schedina}`, '_blank')}
            style={{ flex: 1, padding: '6px 0', borderRadius: 2, fontSize: 10, fontWeight: 700, background: 'rgba(0,180,216,0.08)', border: '1px solid rgba(0,180,216,0.2)', color: '#00b4d8', cursor: 'pointer' }}>
            🖨 Stampa
          </button>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '6px 0', borderRadius: 2, fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Nuova
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InlineBetSlip() {
  const { selections, stake, totalOdds, setStake, removeSelection, clear } = useBetSlipStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedBet, setConfirmedBet] = useState<StoredBet | null>(null);
  const [prenotaBet, setPrenotaBet] = useState<StoredBet | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [sistemaK, setSistemaK] = useState(2);
  const [isSistema, setIsSistema] = useState(false);

  const [user, setUser] = useState<ReturnType<typeof getStoredUser>>(null);
  useEffect(() => {
    setUser(getStoredUser());
    const onStorage = () => setUser(getStoredUser());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Load balance when user is logged in
  useEffect(() => {
    if (user?.supabaseId) {
      fetchBalance(user.supabaseId).then(r => setBalance(r.balance)).catch(() => {});
    }
  }, [user?.supabaseId]);

  // Bonus auto-calcolato in base al numero di eventi
  const bonusPct = selections.length >= 6 ? 20 : selections.length >= 4 ? 10 : selections.length >= 2 ? 5 : 0;

  // Sistema: valido solo con 3+ selezioni e K < N
  const validSistema = isSistema && selections.length >= 3 && sistemaK >= 2 && sistemaK < selections.length;
  const sistemaInfo = validSistema ? computeSystemPotentialWin(stake, selections, sistemaK) : null;

  const bonusAmount = stake > 0 && totalOdds > 1 && !validSistema ? parseFloat(((stake * totalOdds * bonusPct) / 100).toFixed(2)) : 0;
  const effectiveWin = validSistema
    ? sistemaInfo!.potentialWin
    : parseFloat((stake * totalOdds + bonusAmount).toFixed(2));

  // Validation
  const stakeError = stake > 0 && (stake < 1 ? 'Puntata minima: €1,00' : stake > 100000 ? 'Puntata massima: €100.000,00' : null);
  const balanceError = user && balance !== null && stake > balance ? `Saldo insufficiente (€${balance.toFixed(2)})` : null;
  const canSubmit = selections.length > 0 && stake >= 1 && stake <= 100000 && !submitting && !balanceError && (!isSistema || validSistema);

  async function handlePrenota() {
    if (!canSubmit) return;
    setSubmitting(true); setError(null);
    try {
      // Prenota: chiamata senza x-user-id → il backend non scala il saldo
      // La schedina viene registrata come "anonima" e pagata fisicamente al banco
      const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API_BASE}/bets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-site-password': (await import('../lib/session')).getStoredPassword(),
          // Nessun x-user-id → nessuna deduzione saldo
        },
        body: JSON.stringify({
          stake,
          selections,
          nome_proprietario: user?.username ?? 'Anonimo',
          bonus_pct: bonusPct,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(text);
      }
      const response = await res.json() as BetSubmitResponse;
      const stored: StoredBet = {
        codice_schedina: response.codice_schedina,
        nome_proprietario: user?.username ?? 'Anonimo',
        stake,
        selections: selections.map(s => ({ ...s })),
        total_odds: totalOdds,
        potential_win: effectiveWin,
        bonus_pct: bonusPct,
        created_at: response.created_at,
      };
      localStorage.setItem('bb365_last_bet', JSON.stringify(stored));
      clear();
      setPrenotaBet(stored);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la prenotazione.');
    } finally { setSubmitting(false); }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    if (!user) { setShowAuthModal(true); return; }
    setSubmitting(true); setError(null);
    try {
      const payload: Parameters<typeof submitBet>[0] & { sistema_k?: number } = {
        stake, selections, nome_proprietario: user?.username ?? '', bonus_pct: validSistema ? 0 : bonusPct,
        ...(validSistema ? { sistema_k: sistemaK } : {}),
      };
      const response: BetSubmitResponse = await submitBet(payload as Parameters<typeof submitBet>[0]);
      const stored: StoredBet = {
        codice_schedina: response.codice_schedina,
        nome_proprietario: user?.username ?? '',
        stake,
        selections: selections.map(s => ({ ...s })),
        total_odds: totalOdds,
        potential_win: effectiveWin,
        bonus_pct: bonusPct,
        created_at: response.created_at,
      };
      localStorage.setItem('bb365_last_bet', JSON.stringify(stored));
      // Refresh balance
      if (user?.supabaseId) fetchBalance(user.supabaseId).then(r => setBalance(r.balance)).catch(() => {});
      setConfirmedBet(stored);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la scommessa.');
    } finally { setSubmitting(false); }
  }

  if (confirmedBet) {
    return <div style={{ padding: 10 }}><BetConfirmation bet={confirmedBet} onNewBet={() => { clear(); setConfirmedBet(null); }} /></div>;
  }

  if (prenotaBet) {
    return <PrenotaReceipt bet={prenotaBet} onClose={() => setPrenotaBet(null)} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--sidebar-bg)' }}>

      {/* Auth modal */}
      {showAuthModal && (
        <AuthModal
          mode="login"
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => { setShowAuthModal(false); window.location.reload(); }}
        />
      )}

      {/* ── Header ── */}
      <div style={{ padding: '5px 10px', borderBottom: '2px solid var(--border)', background: 'var(--header-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>📋 Schedina</span>
          {selections.length > 0 && (
            <span style={{ background: '#00b4d8', color: '#000', fontSize: 9, fontWeight: 900, borderRadius: 2, padding: '1px 5px' }}>{selections.length}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!user && (
            <button onClick={() => setShowAuthModal(true)} style={{ background: 'none', border: 'none', color: '#00b4d8', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Accedi</button>
          )}
          {selections.length > 0 && (
            <button onClick={clear} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Cancella</button>
          )}
        </div>
      </div>

      {/* ── Tipo giocata ── */}
      {selections.length > 0 && (
        <div style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', background: '#070b10' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: selections.length >= 3 ? 5 : 0 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Tipo:</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#00b4d8' }}>
              {selections.length === 1 ? 'Singola' : validSistema ? `Sistema ${sistemaK}/${selections.length}` : 'Multipla'}
            </span>
          </div>
          {/* Toggle Multipla/Sistema — solo con 3+ selezioni */}
          {selections.length >= 3 && (
            <div style={{ display: 'flex', gap: 4, marginBottom: isSistema ? 5 : 0 }}>
              {(['multipla', 'sistema'] as const).map(t => (
                <button key={t} onClick={() => setIsSistema(t === 'sistema')}
                  style={{ flex: 1, padding: '3px 0', borderRadius: 3, fontSize: 9, fontWeight: 700, cursor: 'pointer', transition: 'all .12s',
                    background: (t === 'sistema') === isSistema ? '#1d4ed8' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${(t === 'sistema') === isSistema ? '#2563eb' : 'var(--border)'}`,
                    color: (t === 'sistema') === isSistema ? '#fff' : 'var(--text-muted)',
                  }}>
                  {t === 'multipla' ? 'Multipla' : 'Sistema'}
                </button>
              ))}
            </div>
          )}
          {/* Selettore K */}
          {isSistema && selections.length >= 3 && (
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {Array.from({ length: selections.length - 2 }, (_, i) => i + 2).map(k => (
                <button key={k} onClick={() => setSistemaK(k)}
                  style={{ padding: '2px 7px', borderRadius: 3, fontSize: 9, fontWeight: 800, cursor: 'pointer',
                    background: sistemaK === k ? '#7c3aed' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${sistemaK === k ? '#7c3aed' : 'var(--border)'}`,
                    color: sistemaK === k ? '#fff' : 'var(--text-muted)',
                  }}>
                  {k}/{selections.length}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {selections.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 16px', gap: 6, textAlign: 'center' }}>
          <div style={{ fontSize: 24, opacity: 0.25 }}>📋</div>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Schedina vuota</p>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>Clicca una quota per aggiungerla</p>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* ── Selections ── */}
          <div style={{ borderBottom: '2px solid var(--border)' }}>
            {selections.map((sel, i) => (
              <div key={`${sel.event_id}-${sel.outcome}`} className="bs-sel-row">
                <div style={{ width: 15, height: 15, borderRadius: 2, background: '#0c1420', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 8, fontWeight: 900, color: 'var(--text-muted)' }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{sel.nome_evento}</p>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', background: '#090e18', borderRadius: 2, padding: '0 4px', border: '1px solid var(--border)' }}>{sel.market}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#60a5fa', background: 'rgba(59,130,246,0.07)', borderRadius: 2, padding: '0 4px', border: '1px solid rgba(59,130,246,0.12)' }}>{sel.betcode ?? sel.outcome}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: '#34d399', background: 'rgba(16,185,129,0.07)', borderRadius: 2, padding: '1px 5px', border: '1px solid rgba(16,185,129,0.12)' }}>{sel.quota.toFixed(2)}</span>
                  <button onClick={() => removeSelection(sel.event_id, sel.outcome)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, padding: 0 }}>✕</button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Quota totale / Info sistema ── */}
          <div style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', background: '#070b10' }}>
            {validSistema && sistemaInfo ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Combinazioni</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{sistemaInfo.numCombinations}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Per combo</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>€{(stake / sistemaInfo.numCombinations).toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quota Totale</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{totalOdds.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* ── Importo + Bonus ── */}
          <div style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', background: '#080c12' }}>

            {/* Importo */}
            <div style={{ marginBottom: 5 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Importo (€)</div>
              <input type="number" min="0.01" step="0.01"
                value={stake === 0 ? '' : stake}
                onChange={e => setStake(parseFloat(e.target.value) || 0)}
                placeholder="0.00" className="betslip-input" style={{ marginBottom: 3 }} />
              <div style={{ display: 'flex', gap: 3 }}>
                {QUICK_STAKES.map(q => (
                  <button key={q} onClick={() => setStake(q)} className={`stake-btn${stake === q ? ' active' : ''}`}>{q}€</button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Vincita ── */}
          <div style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', background: '#060a0f' }}>
            <div className="bs-summary-row">
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vincita Potenziale</span>
              <span style={{ fontWeight: 900, color: '#34d399', fontSize: 15, fontFamily: 'monospace' }}>€ {effectiveWin.toFixed(2)}</span>
            </div>
          </div>

          {(error || stakeError || balanceError) && (
            <div style={{ margin: '5px 10px', padding: '4px 8px', borderRadius: 2, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#fca5a5', fontSize: 10 }}>
              {error || stakeError || balanceError}
            </div>
          )}

          {/* Login prompt when not authenticated */}
          {!user && selections.length > 0 && (
            <div style={{ margin: '5px 10px', padding: '4px 8px', borderRadius: 2, background: 'rgba(0,180,216,0.06)', border: '1px solid rgba(0,180,216,0.15)', color: '#7dd3fc', fontSize: 10, textAlign: 'center' }}>
              Accedi per scommettere
            </div>
          )}

          {/* ── Buttons ── */}
          <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* SCOMMETTI */}
            <button onClick={handleSubmit} disabled={!canSubmit || submitting} style={{
              width: '100%', padding: '12px 0', borderRadius: 4, fontSize: 13, fontWeight: 900,
              background: canSubmit ? 'linear-gradient(135deg,#16a34a,#15803d)' : '#0a1018',
              border: `1px solid ${canSubmit ? '#166534' : 'var(--border)'}`,
              color: canSubmit ? '#fff' : 'var(--text-muted)',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              boxShadow: canSubmit ? '0 2px 12px rgba(22,163,74,0.35)' : 'none',
              transition: 'all .15s ease',
            }}>
              {submitting ? 'Invio...' : 'Scommetti'}
            </button>
            {/* PRENOTA */}
            <button
              onClick={handlePrenota}
              disabled={selections.length === 0 || stake < 1 || submitting}
              style={{
                width: '100%', padding: '9px 0', borderRadius: 4, fontSize: 12, fontWeight: 700,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.6)',
                cursor: (selections.length === 0 || stake < 1 || submitting) ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                opacity: (selections.length === 0 || stake < 1 || submitting) ? 0.35 : 1,
                transition: 'all .15s ease',
              }}
            >
              {submitting ? '...' : 'Prenota'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
