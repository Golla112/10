'use client';
import { useState, useEffect, useCallback } from 'react';
import { saApi, SAStats, SAUser, SABet, SAProfits } from '../../lib/superadminApi';
import SkinManager from './components/SkinManager';

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatCard({ label, value, color = '#00b4d8', sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div style={{ background: '#0d1320', border: '1px solid #1a2535', borderRadius: 12, padding: '16px 20px', minWidth: 140 }}>
      <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color, fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#344a62', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: color + '22', color, border: `1px solid ${color}44` }}>
      {text}
    </span>
  );
}

const TABS = [
  { key: 'dashboard', label: '📊 Dashboard' },
  { key: 'admins',    label: '👨‍💼 Admin' },
  { key: 'users',     label: '👤 Utenti' },
  { key: 'bets',      label: '🎟️ Scommesse' },
  { key: 'profits',   label: '💰 Profitti' },
  { key: 'skin',      label: '🎨 Skin' },
  { key: 'docs',      label: '📖 Guide' },
] as const;
type Tab = typeof TABS[number]['key'];

// ── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab() {
  const [stats, setStats] = useState<SAStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    saApi.getStats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: '#475569', padding: 20 }}>Caricamento...</div>;
  if (!stats) return null;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Utenti" value={stats.totalUsers} color="#00b4d8" />
        <StatCard label="Reseller" value={stats.totalResellers} color="#a78bfa" />
        <StatCard label="Admin" value={stats.totalAdmins} color="#f59e0b" />
        <StatCard label="Scommesse attive" value={stats.activeBets} color="#34d399" />
        <StatCard label="Saldo totale sistema" value={`€${stats.totalBalance.toFixed(2)}`} color="#f1f5f9" />
        <StatCard label="Profitto totale" value={`€${stats.profit.toFixed(2)}`} color={stats.profit >= 0 ? '#34d399' : '#f87171'} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <StatCard label="Totale puntato" value={`€${stats.totalStake.toFixed(2)}`} color="#94a3b8" />
        <StatCard label="Totale pagato" value={`€${stats.totalPaidOut.toFixed(2)}`} color="#94a3b8" />
      </div>
    </div>
  );
}

// ── Admins Tab ────────────────────────────────────────────────────────────────

function AdminsTab() {
  const [admins, setAdmins] = useState<SAUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    saApi.getAdmins().then(setAdmins).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!newUser.trim() || !newPass.trim()) return;
    setCreating(true); setMsg('');
    try {
      await saApi.createAdmin(newUser.trim(), newPass.trim());
      setMsg('Admin creato'); setNewUser(''); setNewPass(''); load();
    } catch (e) { setMsg((e as Error).message); }
    finally { setCreating(false); }
  }

  async function toggleBlock(id: string, blocked: boolean) {
    await saApi.blockAdmin(id, !blocked).catch(console.error);
    load();
  }

  async function del(id: string) {
    if (!confirm('Eliminare questo admin?')) return;
    await saApi.deleteAdmin(id).catch(console.error);
    load();
  }

  return (
    <div>
      {/* Crea admin */}
      <div style={{ background: '#0d1320', border: '1px solid #1a2535', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 12 }}>Crea nuovo Admin</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={newUser} onChange={e => setNewUser(e.target.value)} placeholder="Username"
            style={{ flex: 1, minWidth: 120, background: '#060a0f', border: '1px solid #1a2535', borderRadius: 8, padding: '8px 12px', color: '#d8e4f0', fontSize: 12 }} />
          <input value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Password" type="password"
            style={{ flex: 1, minWidth: 120, background: '#060a0f', border: '1px solid #1a2535', borderRadius: 8, padding: '8px 12px', color: '#d8e4f0', fontSize: 12 }} />
          <button onClick={create} disabled={creating}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {creating ? '...' : 'Crea'}
          </button>
        </div>
        {msg && <div style={{ fontSize: 11, color: msg.includes('creato') ? '#34d399' : '#f87171', marginTop: 8 }}>{msg}</div>}
      </div>

      {loading ? <div style={{ color: '#475569' }}>Caricamento...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {admins.map(a => (
            <div key={a.id} style={{ background: '#0d1320', border: '1px solid #1a2535', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#d8e4f0', flex: 1 }}>{a.username}</span>
              <span style={{ fontSize: 12, color: '#6e8aaa', fontFamily: 'monospace' }}>€{Number(a.balance).toFixed(2)}</span>
              <Badge text={a.is_blocked ? 'Bloccato' : 'Attivo'} color={a.is_blocked ? '#f87171' : '#34d399'} />
              <button onClick={() => toggleBlock(a.id, a.is_blocked)}
                style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #1a2535', background: '#060a0f', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>
                {a.is_blocked ? 'Sblocca' : 'Blocca'}
              </button>
              <button onClick={() => del(a.id)}
                style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(248,113,113,.3)', background: 'rgba(248,113,113,.08)', color: '#f87171', fontSize: 11, cursor: 'pointer' }}>
                Elimina
              </button>
            </div>
          ))}
          {admins.length === 0 && <div style={{ color: '#475569', fontSize: 12 }}>Nessun admin</div>}
        </div>
      )}
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<SAUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'reseller' | 'admin'>('all');
  const [pwdModal, setPwdModal] = useState<{ id: string; username: string } | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [balModal, setBalModal] = useState<{ id: string; username: string; balance: number } | null>(null);
  const [balAmount, setBalAmount] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    saApi.getUsers().then(setUsers).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u =>
    (roleFilter === 'all' || u.role === roleFilter) &&
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const roleColor = (r: string) =>
    r === 'admin' ? '#f59e0b' : r === 'reseller' ? '#a78bfa' : '#00b4d8';

  async function toggleBlock(id: string, blocked: boolean) {
    await saApi.blockUser(id, !blocked).catch(console.error);
    load();
  }

  async function changePassword() {
    if (!pwdModal || !newPwd || newPwd.length < 6) return;
    try {
      await saApi.changePassword(pwdModal.id, newPwd);
      setMsg('Password aggiornata'); setPwdModal(null); setNewPwd('');
    } catch (e) { setMsg((e as Error).message); }
  }

  async function adjustBalance() {
    if (!balModal) return;
    const amount = parseFloat(balAmount);
    if (isNaN(amount)) return;
    try {
      const r = await saApi.adjustBalance(balModal.id, amount);
      setMsg(`Saldo aggiornato: €${r.new_balance.toFixed(2)}`);
      setBalModal(null); setBalAmount(''); load();
    } catch (e) { setMsg((e as Error).message); }
  }

  return (
    <div>
      {msg && <div style={{ fontSize: 11, color: msg.includes('aggiornato') ? '#34d399' : '#f87171', marginBottom: 12, padding: '8px 12px', background: 'rgba(52,211,153,.08)', borderRadius: 8 }}>{msg}</div>}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca utente..."
        style={{ width: '100%', marginBottom: 10, background: '#060a0f', border: '1px solid #1a2535', borderRadius: 8, padding: '8px 12px', color: '#d8e4f0', fontSize: 12, boxSizing: 'border-box' }} />

      {/* Filtro ruolo */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['all', 'user', 'reseller', 'admin'] as const).map(r => (
          <button key={r} onClick={() => setRoleFilter(r)} style={{
            padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            border: roleFilter === r ? '1px solid #00b4d8' : '1px solid #1a2535',
            background: roleFilter === r ? 'rgba(0,180,216,0.12)' : '#060a0f',
            color: roleFilter === r ? '#00b4d8' : '#475569',
          }}>
            {r === 'all' ? 'Tutti' : r === 'admin' ? '👨‍💼 Admin' : r === 'reseller' ? '🏪 Reseller' : '👤 Utenti'}
          </button>
        ))}
      </div>

      {loading ? <div style={{ color: '#475569' }}>Caricamento...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(u => (
            <div key={u.id} style={{ background: '#0d1320', border: '1px solid #1a2535', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#d8e4f0', flex: 1, minWidth: 100 }}>{u.username}</span>
              <Badge text={u.role} color={roleColor(u.role)} />
              <span style={{ fontSize: 12, color: '#34d399', fontFamily: 'monospace' }}>€{Number(u.balance).toFixed(2)}</span>
              <Badge text={u.is_blocked ? 'Bloccato' : 'Attivo'} color={u.is_blocked ? '#f87171' : '#34d399'} />
              <button onClick={() => toggleBlock(u.id, u.is_blocked)}
                style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #1a2535', background: '#060a0f', color: '#94a3b8', fontSize: 10, cursor: 'pointer' }}>
                {u.is_blocked ? 'Sblocca' : 'Blocca'}
              </button>
              <button onClick={() => { setPwdModal({ id: u.id, username: u.username }); setMsg(''); }}
                style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(251,191,36,.3)', background: 'rgba(251,191,36,.08)', color: '#fbbf24', fontSize: 10, cursor: 'pointer' }}>
                Password
              </button>
              <button onClick={() => { setBalModal({ id: u.id, username: u.username, balance: Number(u.balance) }); setMsg(''); }}
                style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(52,211,153,.3)', background: 'rgba(52,211,153,.08)', color: '#34d399', fontSize: 10, cursor: 'pointer' }}>
                Saldo
              </button>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ color: '#475569', fontSize: 12 }}>Nessun utente trovato</div>}
        </div>
      )}

      {/* Password modal */}
      {pwdModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#0d1320', border: '1px solid #1a2535', borderRadius: 14, padding: 24, width: 320 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#d8e4f0', marginBottom: 16 }}>Cambia password — {pwdModal.username}</div>
            <input value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Nuova password" type="password"
              style={{ width: '100%', background: '#060a0f', border: '1px solid #1a2535', borderRadius: 8, padding: '8px 12px', color: '#d8e4f0', fontSize: 12, marginBottom: 12, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={changePassword} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Salva</button>
              <button onClick={() => setPwdModal(null)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #1a2535', background: '#060a0f', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* Balance modal */}
      {balModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#0d1320', border: '1px solid #1a2535', borderRadius: 14, padding: 24, width: 320 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#d8e4f0', marginBottom: 4 }}>Modifica saldo — {balModal.username}</div>
            <div style={{ fontSize: 12, color: '#6e8aaa', marginBottom: 16 }}>Saldo attuale: €{balModal.balance.toFixed(2)}</div>
            <input value={balAmount} onChange={e => setBalAmount(e.target.value)} placeholder="Importo (es. 50 o -20)" type="number"
              style={{ width: '100%', background: '#060a0f', border: '1px solid #1a2535', borderRadius: 8, padding: '8px 12px', color: '#d8e4f0', fontSize: 12, marginBottom: 12, boxSizing: 'border-box' }} />
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 12 }}>Positivo = aggiungi, negativo = togli</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={adjustBalance} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#34d399,#059669)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Salva</button>
              <button onClick={() => setBalModal(null)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #1a2535', background: '#060a0f', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>Annulla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bets Tab ──────────────────────────────────────────────────────────────────

function BetsTab() {
  const [bets, setBets] = useState<SABet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<SABet | null>(null);

  useEffect(() => {
    saApi.getBets().then(setBets).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = bets.filter(b =>
    b.nome_proprietario.toLowerCase().includes(search.toLowerCase()) ||
    b.codice_schedina.toLowerCase().includes(search.toLowerCase())
  );

  const resultColor = (r: string) =>
    r === 'win' ? '#34d399' : r === 'lose' ? '#f87171' : r === 'cancelled' ? '#94a3b8' : '#fbbf24';
  const resultLabel = (r: string) =>
    r === 'win' ? 'Vinta' : r === 'lose' ? 'Persa' : r === 'cancelled' ? 'Annullata' : 'In corso';

  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per utente o codice..."
        style={{ width: '100%', marginBottom: 16, background: '#060a0f', border: '1px solid #1a2535', borderRadius: 8, padding: '8px 12px', color: '#d8e4f0', fontSize: 12, boxSizing: 'border-box' }} />

      {loading ? <div style={{ color: '#475569' }}>Caricamento...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.slice(0, 200).map(b => (
            <div key={b.id} style={{ background: '#0d1320', border: '1px solid #1a2535', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer' }}
              onClick={() => setDetail(b)}>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#00b4d8', minWidth: 90 }}>{b.codice_schedina}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#d8e4f0', flex: 1 }}>{b.nome_proprietario}</span>
              <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>€{Number(b.stake).toFixed(2)}</span>
              <span style={{ fontSize: 11, color: '#6e8aaa' }}>×{Number(b.total_odds).toFixed(2)}</span>
              <span style={{ fontSize: 12, color: '#34d399', fontFamily: 'monospace' }}>€{Number(b.potential_win).toFixed(2)}</span>
              <Badge text={resultLabel(b.result)} color={resultColor(b.result)} />
              <span style={{ fontSize: 10, color: '#344a62' }}>{new Date(b.created_at).toLocaleDateString('it-IT')}</span>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ color: '#475569', fontSize: 12 }}>Nessuna scommessa</div>}
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#0d1320', border: '1px solid #1a2535', borderRadius: 14, padding: 24, width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#d8e4f0' }}>Schedina {detail.codice_schedina}</div>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#6e8aaa' }}>Utente: <span style={{ color: '#d8e4f0' }}>{detail.nome_proprietario}</span></div>
              <div style={{ fontSize: 11, color: '#6e8aaa' }}>Puntata: <span style={{ color: '#d8e4f0', fontFamily: 'monospace' }}>€{Number(detail.stake).toFixed(2)}</span></div>
              <div style={{ fontSize: 11, color: '#6e8aaa' }}>Quota tot.: <span style={{ color: '#d8e4f0', fontFamily: 'monospace' }}>×{Number(detail.total_odds).toFixed(2)}</span></div>
              <div style={{ fontSize: 11, color: '#6e8aaa' }}>Vincita pot.: <span style={{ color: '#34d399', fontFamily: 'monospace' }}>€{Number(detail.potential_win).toFixed(2)}</span></div>
              <div style={{ fontSize: 11, color: '#6e8aaa' }}>Data: <span style={{ color: '#d8e4f0' }}>{new Date(detail.created_at).toLocaleString('it-IT')}</span></div>
              <div style={{ fontSize: 11, color: '#6e8aaa' }}>Stato: <Badge text={detail.result === 'win' ? 'Vinta' : detail.result === 'lose' ? 'Persa' : detail.result === 'cancelled' ? 'Annullata' : 'In corso'} color={detail.result === 'win' ? '#34d399' : detail.result === 'lose' ? '#f87171' : '#fbbf24'} /></div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Selezioni</div>
            {(detail.selections as Array<{ nome_evento?: string; market?: string; outcome?: string; quota?: number; result?: string }>).map((s, i) => (
              <div key={i} style={{ background: '#060a0f', borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#d8e4f0' }}>{s.nome_evento ?? '—'}</div>
                <div style={{ fontSize: 11, color: '#6e8aaa', marginTop: 2 }}>{s.market} · {s.outcome} · <span style={{ color: '#00b4d8' }}>×{s.quota?.toFixed(2) ?? '—'}</span></div>
                {s.result && <div style={{ fontSize: 10, marginTop: 2 }}><Badge text={s.result} color={s.result === 'win' ? '#34d399' : s.result === 'lose' ? '#f87171' : '#fbbf24'} /></div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Profits Tab ───────────────────────────────────────────────────────────────

function ProfitsTab() {
  const [data, setData] = useState<SAProfits | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    saApi.getProfits().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: '#475569' }}>Caricamento...</div>;
  if (!data) return null;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Profitto totale" value={`€${data.globalProfit.toFixed(2)}`} color={data.globalProfit >= 0 ? '#34d399' : '#f87171'} />
        <StatCard label="Totale puntato" value={`€${data.totalStake.toFixed(2)}`} color="#94a3b8" />
        <StatCard label="Totale pagato" value={`€${data.totalPaidOut.toFixed(2)}`} color="#94a3b8" />
        <StatCard label="Profitto oggi" value={`€${data.todayProfit.toFixed(2)}`} color={data.todayProfit >= 0 ? '#34d399' : '#f87171'} sub={`Puntato: €${data.todayStake.toFixed(2)}`} />
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Saldo Reseller</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.resellers.map(r => (
          <div key={r.id} style={{ background: '#0d1320', border: '1px solid #1a2535', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#d8e4f0' }}>{r.username}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa', fontFamily: 'monospace' }}>€{r.balance.toFixed(2)}</span>
          </div>
        ))}
        {data.resellers.length === 0 && <div style={{ color: '#475569', fontSize: 12 }}>Nessun reseller</div>}
      </div>
    </div>
  );
}

// ── Docs Tab ──────────────────────────────────────────────────────────────────

const DOC_FILES = [
  { key: 'pannello-admin',      label: '🛡️ Pannello Admin' },
  { key: 'pannello-reseller',   label: '🏪 Pannello Reseller' },
  { key: 'pannello-superadmin', label: '👑 Pannello SuperAdmin' },
];

function DocsTab() {
  const [selected, setSelected] = useState(DOC_FILES[0].key);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null); setContent(null);
      try {
        const session = await import('../../lib/session');
        const user = session.getStoredUser();
        const token = await session.getAccessToken();
        const res = await fetch(`${API_BASE}/superadmin/docs/${selected}`, {
          headers: {
            'x-site-password': session.getStoredPassword(),
            'x-user-id': user?.supabaseId ?? '',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) throw new Error('Documento non disponibile');
        const data = await res.json() as { content: string };
        setContent(data.content);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Errore');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selected, API_BASE]);

  // Minimal markdown renderer (headers, bold, tables, code, lists)
  function renderMd(md: string) {
    const lines = md.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // H1
      if (line.startsWith('# ')) {
        elements.push(<h1 key={i} style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: '24px 0 8px', borderBottom: '1px solid #1a2535', paddingBottom: 8 }}>{line.slice(2)}</h1>);
      }
      // H2
      else if (line.startsWith('## ')) {
        elements.push(<h2 key={i} style={{ fontSize: 15, fontWeight: 800, color: '#00b4d8', margin: '20px 0 6px' }}>{line.slice(3)}</h2>);
      }
      // H3
      else if (line.startsWith('### ')) {
        elements.push(<h3 key={i} style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: '14px 0 4px' }}>{line.slice(4)}</h3>);
      }
      // Code block
      else if (line.startsWith('```')) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        elements.push(
          <pre key={i} style={{ background: '#060a0f', border: '1px solid #1a2535', borderRadius: 8, padding: '10px 14px', fontSize: 11, color: '#34d399', overflowX: 'auto', margin: '8px 0', fontFamily: 'monospace' }}>
            {codeLines.join('\n')}
          </pre>
        );
      }
      // Table
      else if (line.startsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].startsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        const rows = tableLines.filter(l => !l.match(/^\|[-| ]+\|$/));
        elements.push(
          <div key={i} style={{ overflowX: 'auto', margin: '8px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} style={{ background: ri === 0 ? '#0d1320' : ri % 2 === 0 ? '#080c12' : 'transparent' }}>
                    {row.split('|').filter((_, ci) => ci > 0 && ci < row.split('|').length - 1).map((cell, ci) => {
                      const Tag = ri === 0 ? 'th' : 'td';
                      return <Tag key={ci} style={{ padding: '6px 12px', border: '1px solid #1a2535', color: ri === 0 ? '#94a3b8' : '#d8e4f0', textAlign: 'left', fontWeight: ri === 0 ? 700 : 400 }}>{cell.trim().replace(/\*\*(.*?)\*\*/g, '$1')}</Tag>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
      // Blockquote
      else if (line.startsWith('> ')) {
        elements.push(
          <div key={i} style={{ borderLeft: '3px solid #f59e0b', paddingLeft: 12, margin: '6px 0', color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>
            {line.slice(2)}
          </div>
        );
      }
      // List item
      else if (line.match(/^[-*] /)) {
        elements.push(
          <div key={i} style={{ display: 'flex', gap: 8, margin: '2px 0', fontSize: 12, color: '#d8e4f0' }}>
            <span style={{ color: '#475569', flexShrink: 0 }}>•</span>
            <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong style="color:#f1f5f9">$1</strong>').replace(/`(.*?)`/g, '<code style="background:#0d1320;padding:1px 5px;border-radius:3px;font-size:11px;color:#34d399">$1</code>') }} />
          </div>
        );
      }
      // Horizontal rule
      else if (line.startsWith('---')) {
        elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid #1a2535', margin: '16px 0' }} />);
      }
      // Empty line
      else if (line.trim() === '') {
        elements.push(<div key={i} style={{ height: 4 }} />);
      }
      // Paragraph
      else {
        elements.push(
          <p key={i} style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7, margin: '2px 0' }}
            dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#f1f5f9">$1</strong>').replace(/`(.*?)`/g, '<code style="background:#0d1320;padding:1px 5px;border-radius:3px;font-size:11px;color:#34d399">$1</code>') }}
          />
        );
      }
      i++;
    }
    return elements;
  }

  return (
    <div>
      {/* Doc selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {DOC_FILES.map(d => (
          <button key={d.key} onClick={() => setSelected(d.key)} style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: selected === d.key ? 'rgba(124,58,237,0.15)' : '#0d1320',
            border: selected === d.key ? '1px solid rgba(124,58,237,0.4)' : '1px solid #1a2535',
            color: selected === d.key ? '#a78bfa' : '#475569',
            transition: 'all .15s',
          }}>{d.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ background: '#080c12', border: '1px solid #1a2535', borderRadius: 14, padding: '24px 28px', minHeight: 300 }}>
        {loading && <div style={{ color: '#475569', fontSize: 13 }}>Caricamento...</div>}
        {error && <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>}
        {content && !loading && renderMd(content)}
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function SuperAdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 16px 60px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          👑 SuperAdmin Panel
        </h1>
        <p style={{ fontSize: 10, color: '#475569', margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Controllo completo del sistema
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(15,23,42,.8)', borderRadius: 12, padding: 5, border: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            flex: 1, minWidth: 80,
            background: activeTab === t.key ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'rgba(51,65,85,.5)',
            color: activeTab === t.key ? '#fff' : '#64748b',
            border: activeTab === t.key ? '1px solid rgba(124,58,237,.4)' : '1px solid rgba(71,85,105,.3)',
            borderRadius: 8, padding: '9px 10px', cursor: 'pointer',
            fontSize: 11, fontWeight: 600,
            transition: 'all .15s ease',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'dashboard' && <DashboardTab />}
      {activeTab === 'admins'    && <AdminsTab />}
      {activeTab === 'users'     && <UsersTab />}
      {activeTab === 'bets'      && <BetsTab />}
      {activeTab === 'profits'   && <ProfitsTab />}
      {activeTab === 'skin'      && <SkinManager />}
      {activeTab === 'docs'      && <DocsTab />}
    </div>
  );
}
