'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Search, Trophy, X, Clock, Ban,
  ChevronRight, Printer, RefreshCw, TrendingUp,
  CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import Image from 'next/image';
import {
  fetchAllBets, adminSetResult, adminSetPaid, adminSettleBet,
  adminSettleAll, adminCancelBet, fetchBetByCodice, Bet, BetsParams,
} from '../../../lib/api';
import { filterUsersByUsername } from '../../../lib/adminUtils';
import Link from 'next/link';

type FilterMode = 'day' | 'week' | 'month' | 'all' | 'custom';
type ResultFilter = 'all' | 'pending' | 'win' | 'lose' | 'cancelled';

function toDateStr(d: Date) { return d.toISOString().split('T')[0]; }
function getWeekStart() {
  const d = new Date(); const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return toDateStr(new Date(d.setDate(diff)));
}
function getMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

const STATUS = {
  win:       { color: '#10b981', glow: 'rgba(16,185,129,.3)',  bg: 'rgba(16,185,129,.08)',  border: 'rgba(16,185,129,.2)',  label: 'Vinta',     Icon: Trophy },
  lose:      { color: '#ef4444', glow: 'rgba(239,68,68,.3)',   bg: 'rgba(239,68,68,.08)',   border: 'rgba(239,68,68,.2)',   label: 'Persa',     Icon: X },
  pending:   { color: '#f59e0b', glow: 'rgba(245,158,11,.25)', bg: 'rgba(245,158,11,.07)',  border: 'rgba(245,158,11,.2)',  label: 'In attesa', Icon: Clock },
  cancelled: { color: '#64748b', glow: 'rgba(100,116,139,.2)', bg: 'rgba(100,116,139,.07)', border: 'rgba(100,116,139,.2)', label: 'Annullata', Icon: Ban },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i: number) => ({ opacity: 1, y: 0, scale: 1, transition: { delay: i * 0.05, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } }),
  exit: { opacity: 0, y: -10, scale: 0.97, transition: { duration: 0.2 } },
};

const popVariants = {
  hidden: { opacity: 0, scale: 0.85, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 22 } },
  exit: { opacity: 0, scale: 0.9, y: -8, transition: { duration: 0.15 } },
};

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(0,0,0,.25)', borderRadius: 10, padding: '8px 14px',
      border: '1px solid rgba(255,255,255,.06)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function ActionBtn({ label, bg, color, onClick, disabled, loading }: {
  label: string; bg: string; color: string;
  onClick: () => void; disabled?: boolean; loading?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.06, y: disabled ? 0 : -1 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: bg, color, border: '1px solid rgba(255,255,255,.07)',
        borderRadius: 7, padding: '5px 11px', fontSize: 11, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
        display: 'flex', alignItems: 'center', gap: 4,
        boxShadow: '0 2px 8px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.08)',
      }}
    >
      {loading ? <Loader2 size={11} style={{ animation: 'spin .7s linear infinite' }} /> : null}
      {label}
    </motion.button>
  );
}

export default function AdminBets() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('day');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [customFrom, setCustomFrom] = useState(toDateStr(new Date()));
  const [customTo, setCustomTo] = useState(toDateStr(new Date()));
  const [settling, setSettling] = useState(false);
  const [settleMsg, setSettleMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [verificaCodice, setVerificaCodice] = useState('');
  const [verificaBet, setVerificaBet] = useState<Bet | null>(null);
  const [verificaError, setVerificaError] = useState<string | null>(null);
  const [verificaLoading, setVerificaLoading] = useState(false);
  const [usernameSearch, setUsernameSearch] = useState('');

  const buildParams = useCallback((): BetsParams => {
    const today = toDateStr(new Date());
    if (filterMode === 'day') return { date: today };
    if (filterMode === 'week') return { from: getWeekStart(), to: today };
    if (filterMode === 'month') return { from: getMonthStart(), to: today };
    if (filterMode === 'custom') return { from: customFrom, to: customTo };
    return {};
  }, [filterMode, customFrom, customTo]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setBets(await fetchAllBets(buildParams())); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, [buildParams]);

  useEffect(() => { load(); }, [load]);

  // Apply result filter then username search via filterUsersByUsername
  const byResult = resultFilter === 'all' ? bets : bets.filter(b => b.result === resultFilter);
  // filterUsersByUsername expects AdminUser[], adapt bets to match the shape
  const filtered = usernameSearch
    ? byResult.filter(b =>
        filterUsersByUsername(
          [{ id: b.id, username: b.nome_proprietario, balance: 0, is_blocked: false, created_at: b.created_at }],
          usernameSearch
        ).length > 0
      )
    : byResult;

  async function handleSettleAll() {
    setSettling(true); setSettleMsg(null);
    try {
      const r = await adminSettleAll();
      setSettleMsg(`✓ ${r.settled} risolte · ${r.skipped} saltate`);
      await load();
    } catch (e) { setSettleMsg(`✗ ${String(e)}`); }
    finally { setSettling(false); }
  }

  async function act(key: string, fn: () => Promise<void>) {
    setActionLoading(key);
    try { await fn(); await load(); }
    catch (e) { alert(String(e)); }
    finally { setActionLoading(null); }
  }

  async function handleVerifica() {
    const codice = verificaCodice.trim().toUpperCase();
    if (!codice) return;
    setVerificaLoading(true); setVerificaError(null); setVerificaBet(null);
    try { setVerificaBet(await fetchBetByCodice(codice)); }
    catch { setVerificaError('Schedina non trovata.'); }
    finally { setVerificaLoading(false); }
  }

  const isL = (bet: Bet, k: string) => actionLoading === bet.codice_schedina + ':' + k;

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Top row: Settle + Verifica ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

        {/* Settle card */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          style={{
            background: 'linear-gradient(145deg,rgba(30,41,59,.9),rgba(15,23,42,.95))',
            borderRadius: 16, padding: '20px 22px',
            border: '1px solid rgba(59,130,246,.15)',
            boxShadow: '0 8px 32px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.04)',
            backdropFilter: 'blur(12px)',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Zap size={14} color="#3b82f6" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Settle Automatico
            </span>
          </div>
          <motion.button
            whileHover={{ scale: settling ? 1 : 1.03, y: settling ? 0 : -1 }}
            whileTap={{ scale: settling ? 1 : 0.97 }}
            onClick={handleSettleAll}
            disabled={settling}
            style={{
              background: settling
                ? 'rgba(51,65,85,.6)'
                : 'linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%)',
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '11px 20px', fontWeight: 700, cursor: settling ? 'not-allowed' : 'pointer',
              fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              justifyContent: 'center',
              boxShadow: settling ? 'none' : '0 4px 20px rgba(59,130,246,.45), inset 0 1px 0 rgba(255,255,255,.2)',
            }}
          >
            {settling
              ? <><Loader2 size={14} style={{ animation: 'spin .7s linear infinite' }} /> Settle in corso...</>
              : <><Zap size={14} /> Settle Automatico</>}
          </motion.button>
          <AnimatePresence>
            {settleMsg && (
              <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{
                  marginTop: 10, fontSize: 12, fontWeight: 600,
                  color: settleMsg.startsWith('✓') ? '#10b981' : '#ef4444',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                {settleMsg.startsWith('✓') ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                {settleMsg}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Verifica card */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
          style={{
            background: 'linear-gradient(145deg,rgba(30,41,59,.9),rgba(15,23,42,.95))',
            borderRadius: 16, padding: '20px 22px',
            border: '1px solid rgba(99,102,241,.15)',
            boxShadow: '0 8px 32px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.04)',
            backdropFilter: 'blur(12px)',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Search size={14} color="#6366f1" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Verifica Schedina
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={13} color="#334155" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Codice schedina..."
                value={verificaCodice}
                onChange={e => { setVerificaCodice(e.target.value); setVerificaBet(null); setVerificaError(null); }}
                onKeyDown={e => e.key === 'Enter' && handleVerifica()}
                style={{
                  width: '100%', background: 'rgba(8,12,20,.8)', color: '#e2e8f0',
                  border: '1px solid rgba(71,85,105,.5)', borderRadius: 9,
                  padding: '9px 12px 9px 32px', fontSize: 12,
                  fontFamily: 'monospace', letterSpacing: '0.06em',
                  outline: 'none', boxSizing: 'border-box',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,.3)',
                }}
                onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,.2), inset 0 2px 4px rgba(0,0,0,.3)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(71,85,105,.5)'; e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,.3)'; }}
              />
            </div>
            <motion.button
              whileHover={{ scale: verificaLoading || !verificaCodice.trim() ? 1 : 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleVerifica}
              disabled={verificaLoading || !verificaCodice.trim()}
              style={{
                background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                color: '#fff', border: 'none', borderRadius: 9,
                padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                opacity: verificaLoading || !verificaCodice.trim() ? 0.4 : 1,
                boxShadow: '0 4px 14px rgba(99,102,241,.4), inset 0 1px 0 rgba(255,255,255,.15)',
                display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
              }}
            >
              {verificaLoading ? <Loader2 size={13} style={{ animation: 'spin .7s linear infinite' }} /> : <Search size={13} />}
              Cerca
            </motion.button>
          </div>
          <AnimatePresence>
            {verificaError && (
              <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ marginTop: 8, fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 5 }}>
                <AlertCircle size={12} /> {verificaError}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ── Verifica result ── */}
      <AnimatePresence>
        {verificaBet && (() => {
          const s = STATUS[verificaBet.result as keyof typeof STATUS] ?? STATUS.pending;
          const Icon = s.Icon;
          return (
            <motion.div key="verifica-result" variants={popVariants} initial="hidden" animate="visible" exit="exit"
              style={{
                background: `linear-gradient(145deg, ${s.bg}, rgba(8,12,20,.9))`,
                borderRadius: 16, padding: '20px 22px', marginBottom: 14,
                border: `1px solid ${s.border}`,
                boxShadow: `0 0 30px ${s.glow}, 0 8px 32px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.04)`,
                backdropFilter: 'blur(12px)',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontFamily: 'monospace', fontWeight: 900, fontSize: 16, color: '#f1f5f9',
                    background: 'rgba(0,0,0,.35)', borderRadius: 7, padding: '4px 10px',
                    border: `1px solid ${s.border}`, letterSpacing: '0.04em',
                  }}>
                    {verificaBet.codice_schedina}
                  </span>
                  <span style={{ fontSize: 11, color: '#475569' }}>
                    {new Date(verificaBet.created_at).toLocaleString('it-IT')}
                  </span>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: `${s.color}18`, color: s.color,
                  borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 700,
                  border: `1px solid ${s.border}`, boxShadow: `0 0 14px ${s.glow}`,
                }}>
                  <Icon size={13} /> {s.label}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                <StatPill label="Puntata" value={`€${Number(verificaBet.stake).toFixed(2)}`} color="#e2e8f0" />
                <StatPill label="Quota tot." value={Number(verificaBet.total_odds).toFixed(2)} color="#60a5fa" />
                <StatPill label="Vincita pot." value={`€${Number(verificaBet.potential_win).toFixed(2)}`} color="#10b981" />
                {verificaBet.paid_at && (
                  <StatPill label="Pagata" value={new Date(verificaBet.paid_at).toLocaleDateString('it-IT')} color="#10b981" />
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
                {verificaBet.selections.map((sel, i) => {
                  const ss = STATUS[sel.result as keyof typeof STATUS] ?? STATUS.pending;
                  const SIcon = ss.Icon;
                  return (
                    <motion.div key={i}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: 'rgba(0,0,0,.22)', borderRadius: 9, padding: '8px 12px',
                        border: `1px solid ${ss.border}`,
                      }}>
                      <SIcon size={12} color={ss.color} />
                      <span style={{ flex: 1, fontSize: 12, color: '#cbd5e1', fontWeight: 500 }}>{sel.nome_evento}</span>
                      <span style={{ fontSize: 10, color: '#475569', background: 'rgba(0,0,0,.3)', borderRadius: 4, padding: '2px 7px' }}>
                        {sel.market} · {sel.outcome}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', minWidth: 38, textAlign: 'right' }}>
                        @{sel.quota}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
              <Link href={`/print/${verificaBet.codice_schedina}`} target="_blank"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 11, color: '#64748b', textDecoration: 'none',
                  background: 'rgba(0,0,0,.2)', border: '1px solid rgba(255,255,255,.07)',
                  borderRadius: 7, padding: '6px 12px',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
                onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
              >
                <Printer size={11} /> Stampa ricevuta
              </Link>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── Username search ── */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <Search size={13} color="#334155" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input
          type="text"
          placeholder="Cerca per username..."
          value={usernameSearch}
          onChange={e => setUsernameSearch(e.target.value)}
          style={{
            width: '100%', background: 'rgba(8,12,20,.8)', color: '#e2e8f0',
            border: '1px solid rgba(71,85,105,.5)', borderRadius: 9,
            padding: '8px 12px 8px 32px', fontSize: 12, outline: 'none',
            boxSizing: 'border-box', boxShadow: 'inset 0 2px 4px rgba(0,0,0,.3)',
          }}
          onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,.2), inset 0 2px 4px rgba(0,0,0,.3)'; }}
          onBlur={e => { e.target.style.borderColor = 'rgba(71,85,105,.5)'; e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,.3)'; }}
        />
      </div>

      {/* ── Filters ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        style={{
          background: 'rgba(15,23,42,.8)', borderRadius: 12, padding: '12px 16px', marginBottom: 14,
          border: '1px solid rgba(255,255,255,.06)', backdropFilter: 'blur(8px)',
          display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        }}>
        {(['day', 'week', 'month', 'all', 'custom'] as FilterMode[]).map(m => (
          <motion.button key={m} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={() => setFilterMode(m)}
            style={{
              background: filterMode === m ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)' : 'rgba(51,65,85,.5)',
              color: filterMode === m ? '#fff' : '#64748b',
              border: filterMode === m ? '1px solid rgba(59,130,246,.4)' : '1px solid rgba(71,85,105,.3)',
              borderRadius: 7, padding: '5px 13px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              boxShadow: filterMode === m ? '0 2px 10px rgba(59,130,246,.35)' : 'none',
            }}>
            {{ day: 'Oggi', week: 'Settimana', month: 'Mese', all: 'Tutte', custom: 'Custom' }[m]}
          </motion.button>
        ))}
        {filterMode === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              style={{ background: 'rgba(8,12,20,.8)', color: '#e2e8f0', border: '1px solid rgba(71,85,105,.5)', borderRadius: 7, padding: '5px 10px', fontSize: 11, outline: 'none' }} />
            <span style={{ color: '#334155', fontSize: 12 }}>→</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              style={{ background: 'rgba(8,12,20,.8)', color: '#e2e8f0', border: '1px solid rgba(71,85,105,.5)', borderRadius: 7, padding: '5px 10px', fontSize: 11, outline: 'none' }} />
          </>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
          {([
            { k: 'all', label: 'Tutte' },
            { k: 'pending', label: '⏳' },
            { k: 'win', label: '🏆' },
            { k: 'lose', label: '❌' },
            { k: 'cancelled', label: '🚫' },
          ] as { k: ResultFilter; label: string }[]).map(r => (
            <motion.button key={r.k} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
              onClick={() => setResultFilter(r.k)}
              style={{
                background: resultFilter === r.k ? 'rgba(71,85,105,.8)' : 'transparent',
                color: resultFilter === r.k ? '#f1f5f9' : '#475569',
                border: '1px solid rgba(71,85,105,.35)', borderRadius: 7,
                padding: '5px 11px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              }}>
              {r.label}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ── Refresh + count ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingLeft: 2 }}>
        {!loading && !error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={12} color="#475569" />
            <span style={{ fontSize: 11, color: '#475569' }}>
              {filtered.length} schedina{filtered.length !== 1 ? 'e' : ''}
            </span>
          </div>
        )}
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={load}
          style={{
            background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#64748b',
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, marginLeft: 'auto',
          }}>
          <RefreshCw size={12} /> Aggiorna
        </motion.button>
      </div>

      {/* ── Bet list ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
            <Loader2 size={28} color="#334155" />
          </motion.div>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#ef4444', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <AlertCircle size={16} /> {error}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ textAlign: 'center', padding: 60, color: '#334155', fontSize: 13 }}>
          Nessuna schedina trovata
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((bet, idx) => {
              const s = STATUS[bet.result as keyof typeof STATUS] ?? STATUS.pending;
              const Icon = s.Icon;
              return (
                <motion.div key={bet.id}
                  custom={idx} variants={cardVariants} initial="hidden" animate="visible" exit="exit"
                  layout
                  style={{
                    background: `linear-gradient(145deg, ${s.bg}, rgba(8,12,20,.92))`,
                    borderRadius: 14, padding: '16px 18px',
                    border: `1px solid ${s.border}`,
                    boxShadow: `0 0 20px ${s.glow}, 0 4px 20px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.03)`,
                    backdropFilter: 'blur(8px)',
                  }}>

                  {/* Top row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontFamily: 'monospace', fontWeight: 900, fontSize: 13, color: '#f1f5f9',
                        background: 'rgba(0,0,0,.3)', borderRadius: 5, padding: '3px 8px',
                        border: `1px solid ${s.border}`, letterSpacing: '0.04em',
                      }}>
                        {bet.codice_schedina}
                      </span>
                      <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>
                        {bet.nome_proprietario}
                      </span>
                      <span style={{ fontSize: 10, color: '#475569' }}>
                        {new Date(bet.created_at).toLocaleString('it-IT')}
                      </span>
                      {bet.paid_at && (
                        <span style={{
                          fontSize: 10, color: '#10b981',
                          background: 'rgba(16,185,129,.1)', borderRadius: 4, padding: '2px 7px',
                          border: '1px solid rgba(16,185,129,.2)',
                          display: 'flex', alignItems: 'center', gap: 3,
                        }}>
                          <CheckCircle2 size={9} /> Pagata
                        </span>
                      )}
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: `${s.color}18`, color: s.color,
                      borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 700,
                      border: `1px solid ${s.border}`,
                    }}>
                      <Icon size={11} /> {s.label}
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    <StatPill label="Puntata" value={`€${Number(bet.stake).toFixed(2)}`} color="#e2e8f0" />
                    <StatPill label="Quota" value={Number(bet.total_odds).toFixed(2)} color="#60a5fa" />
                    <StatPill label="Vincita" value={`€${Number(bet.potential_win).toFixed(2)}`} color="#10b981" />
                  </div>

                  {/* Selections */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                    {bet.selections.map((sel, i) => {
                      const ss = STATUS[sel.result as keyof typeof STATUS] ?? STATUS.pending;
                      const SIcon = ss.Icon;
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          background: 'rgba(0,0,0,.18)', borderRadius: 7, padding: '6px 10px',
                        }}>
                          <SIcon size={11} color={ss.color} />
                          <span style={{ flex: 1, fontSize: 11, color: '#cbd5e1' }}>{sel.nome_evento}</span>
                          <span style={{ fontSize: 10, color: '#475569' }}>{sel.market} · {sel.outcome}</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa' }}>@{sel.quota}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <ActionBtn label="⚡ Settle"    bg="linear-gradient(135deg,#1d4ed8,#1e40af)" color="#fff"     onClick={() => act(bet.codice_schedina+':settle', () => adminSettleBet(bet.codice_schedina))} disabled={!!actionLoading} loading={isL(bet,'settle')} />
                    <ActionBtn label="🏆 Vinta"     bg="linear-gradient(135deg,#065f46,#064e3b)" color="#10b981"  onClick={() => act(bet.codice_schedina+':result', () => adminSetResult(bet.codice_schedina,'win'))} disabled={!!actionLoading} loading={isL(bet,'result')} />
                    <ActionBtn label="❌ Persa"     bg="linear-gradient(135deg,#7f1d1d,#6b1a1a)" color="#f87171"  onClick={() => act(bet.codice_schedina+':result', () => adminSetResult(bet.codice_schedina,'lose'))} disabled={!!actionLoading} />
                    <ActionBtn label="⏳ Pending"   bg="linear-gradient(135deg,#78350f,#6b2d0a)" color="#fbbf24"  onClick={() => act(bet.codice_schedina+':result', () => adminSetResult(bet.codice_schedina,'pending'))} disabled={!!actionLoading} />
                    {bet.result === 'win' && (
                      <ActionBtn label={bet.paid_at ? '✅ Pagata' : '💰 Paga'} bg={bet.paid_at ? 'rgba(30,41,59,.4)' : 'linear-gradient(135deg,#1e3a5f,#172d4a)'} color={bet.paid_at ? '#475569' : '#60a5fa'} onClick={() => { if (!bet.paid_at) act(bet.codice_schedina+':paid', async () => { await adminSetPaid(bet.codice_schedina, true); window.open(`/print/${encodeURIComponent(bet.codice_schedina)}?type=payment`, '_blank'); }); }} disabled={!!actionLoading || !!bet.paid_at} loading={isL(bet,'paid')} />
                    )}
                    {bet.result === 'pending' && (
                      <ActionBtn label="🚫 Annulla" bg="rgba(30,41,59,.7)" color="#64748b" onClick={() => { if(confirm(`Annullare ${bet.codice_schedina}?`)) act(bet.codice_schedina+':cancel', () => adminCancelBet(bet.codice_schedina)); }} disabled={!!actionLoading} loading={isL(bet,'cancel')} />
                    )}
                    <Link href={`/print/${bet.codice_schedina}`} target="_blank"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, color: '#64748b', textDecoration: 'none',
                        background: 'rgba(0,0,0,.2)', border: '1px solid rgba(255,255,255,.07)',
                        borderRadius: 7, padding: '5px 11px', fontWeight: 700,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
                    >
                      <Printer size={11} /> Stampa
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
