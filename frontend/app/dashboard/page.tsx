'use client';
import { useEffect, useState, useCallback } from 'react';
import { getStoredUser } from '../../lib/session';
import type { UserSession } from '../../lib/session';

// ── User dashboard imports ────────────────────────────────────────────────────
import { fetchBets, Bet, BetsParams } from '../../lib/api';
import BetHistoryTable from '../../components/BetHistoryTable';

// ── Admin dashboard imports ───────────────────────────────────────────────────
import { LayoutDashboard, Users, FileText, Store, Zap } from 'lucide-react';
import AdminDashboard from '../admin/components/AdminDashboard';
import AdminUsers from '../admin/components/AdminUsers';
import AdminBets from '../admin/components/AdminBets';
import AdminResellers from '../admin/components/AdminResellers';
import BookingLoader from '../../components/BookingLoader';

// ── SuperAdmin dashboard imports ──────────────────────────────────────────────
import SuperAdminPanel from '../superadmin/SuperAdminPanel';

// ── Reseller dashboard imports ────────────────────────────────────────────────
import ResellerUsers from '../reseller/components/ResellerUsers';
import ResellerBets from '../reseller/components/ResellerBets';
import ResellerStats from '../reseller/components/ResellerStats';
import { getMe } from '../../lib/resellerApi';

// ─────────────────────────────────────────────────────────────────────────────
// USER DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

type FilterMode = 'day' | 'week' | 'month' | 'custom';

function toDateStr(d: Date): string { return d.toISOString().split('T')[0]; }
function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return toDateStr(new Date(d.setDate(diff)));
}
function getMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function UserDashboard({ user }: { user: UserSession }) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const buildParams = useCallback((): BetsParams => {
    const today = toDateStr(new Date());
    if (filterMode === 'day') return { date: today };
    if (filterMode === 'week') return { from: getWeekStart(), to: today };
    if (filterMode === 'month') return { from: getMonthStart(), to: today };
    const params: BetsParams = {};
    if (customFrom) params.from = customFrom;
    if (customTo) params.to = customTo;
    return params;
  }, [filterMode, customFrom, customTo]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const all = await fetchBets(buildParams());
      const mine = all.filter(b => b.nome_proprietario.toLowerCase() === user.username.toLowerCase());
      setBets(mine);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore nel caricamento.');
    } finally { setLoading(false); }
  }, [buildParams, user.username]);

  useEffect(() => { load(); }, [load]);

  const filterButtons: { mode: FilterMode; label: string }[] = [
    { mode: 'day', label: 'Oggi' }, { mode: 'week', label: 'Settimana' },
    { mode: 'month', label: 'Mese' }, { mode: 'custom', label: 'Personalizzato' },
  ];

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: '#d8e4f0', marginBottom: 4 }}>Le mie scommesse</h1>
        <p style={{ fontSize: 12, color: '#344a62' }}>
          Storico scommesse di <span style={{ color: '#00b4d8' }}>{user.username}</span>
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {filterButtons.map(({ mode, label }) => (
          <button key={mode} onClick={() => setFilterMode(mode)} style={{
            padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            border: filterMode === mode ? '1px solid #00b4d8' : '1px solid #1a2030',
            background: filterMode === mode ? 'rgba(0,180,216,0.12)' : '#0d1018',
            color: filterMode === mode ? '#00b4d8' : '#6e8aaa',
            cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      {filterMode === 'custom' && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: '#6e8aaa' }}>Dal
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              style={{ marginLeft: 8, background: '#0d1018', border: '1px solid #1a2030', borderRadius: 6, padding: '4px 8px', color: '#d8e4f0', fontSize: 12 }} />
          </label>
          <label style={{ fontSize: 12, color: '#6e8aaa' }}>Al
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              style={{ marginLeft: 8, background: '#0d1018', border: '1px solid #1a2030', borderRadius: 6, padding: '4px 8px', color: '#d8e4f0', fontSize: 12 }} />
          </label>
          <button onClick={load} style={{
            padding: '6px 16px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg,#0077a8,#00b4d8)', color: '#fff',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>Applica</button>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height: 48, borderRadius: 10, background: '#0d1018', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : error ? (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13 }}>{error}</div>
      ) : bets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#0d1018', border: '1px solid #1a2030', borderRadius: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎫</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#6e8aaa', marginBottom: 6 }}>Nessuna scommessa trovata</div>
          <div style={{ fontSize: 12, color: '#344a62' }}>Le tue scommesse appariranno qui</div>
        </div>
      ) : (
        <BetHistoryTable bets={bets} onRefresh={load} userRole={user.role} />
      )}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

type AdminTab = 'dashboard' | 'users' | 'bets' | 'resellers' | 'booking';
const ADMIN_TABS: { key: AdminTab; label: string; Icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { key: 'users',     label: 'Utenti',    Icon: Users },
  { key: 'bets',      label: 'Scommesse', Icon: FileText },
  { key: 'resellers', label: 'Rivenditori', Icon: Store },
  { key: 'booking',   label: 'Prenotazioni', Icon: Zap },
];

function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 16px 60px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Admin Panel</h1>
        <p style={{ fontSize: 10, color: '#475569', margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gestione piattaforma</p>
      </div>

      <div style={{
        display: 'flex', gap: 6, marginBottom: 24,
        background: 'rgba(15,23,42,.8)', borderRadius: 12, padding: 6,
        border: '1px solid rgba(255,255,255,.06)',
      }}>
        {ADMIN_TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            flex: 1,
            background: activeTab === key ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)' : 'rgba(51,65,85,.5)',
            color: activeTab === key ? '#fff' : '#64748b',
            border: activeTab === key ? '1px solid rgba(59,130,246,.4)' : '1px solid rgba(71,85,105,.3)',
            borderRadius: 8, padding: '9px 14px', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all .15s ease',
          }}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard'  && <AdminDashboard />}
      {activeTab === 'users'      && <AdminUsers />}
      {activeTab === 'bets'       && <AdminBets />}
      {activeTab === 'resellers'  && <AdminResellers />}
      {activeTab === 'booking'    && <BookingLoader onLoaded={() => {}} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESELLER DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

type ResellerTab = 'stats' | 'users' | 'bets' | 'booking';

function ResellerPanel({ user }: { user: UserSession }) {
  const [activeTab, setActiveTab] = useState<ResellerTab>('stats');
  const [balance, setBalance] = useState<number | null>(null);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);

  const refreshBalance = useCallback(async () => {
    try {
      const info = await getMe();
      setBalance(info.balance);
      setStatsRefreshKey(k => k + 1);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  const tabs: { key: ResellerTab; label: string; icon: string }[] = [
    { key: 'stats', label: 'Statistiche', icon: '📊' },
    { key: 'users', label: 'Utenti',      icon: '👥' },
    { key: 'bets',  label: 'Scommesse',   icon: '🎫' },
    { key: 'booking', label: 'Prenotazioni', icon: '⚡' },
  ];

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 16px 60px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>
            Pannello Rivenditore
          </h1>
          <p style={{ fontSize: 11, color: '#475569', margin: '4px 0 0' }}>
            Benvenuto, <span style={{ color: '#00b4d8' }}>{user.username}</span>
          </p>
        </div>
        {balance !== null && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
            borderRadius: 10, padding: '10px 16px',
          }}>
            <span style={{ fontSize: 11, color: '#6e8aaa' }}>Saldo</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#34d399', fontFamily: 'monospace' }}>
              €{balance.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 24,
        background: 'rgba(15,23,42,.8)', borderRadius: 12, padding: 6,
        border: '1px solid rgba(255,255,255,.06)',
      }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            flex: 1,
            background: activeTab === t.key ? 'linear-gradient(135deg,#0077a8,#00b4d8)' : 'rgba(51,65,85,.5)',
            color: activeTab === t.key ? '#fff' : '#64748b',
            border: activeTab === t.key ? '1px solid rgba(0,180,216,.4)' : '1px solid rgba(71,85,105,.3)',
            borderRadius: 8, padding: '9px 14px', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all .15s ease',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'stats' && <ResellerStats refreshKey={statsRefreshKey} />}
      {activeTab === 'users' && <ResellerUsers onBalanceChange={refreshBalance} />}
      {activeTab === 'bets'  && <ResellerBets />}
      {activeTab === 'booking' && <BookingLoader onLoaded={() => {}} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED DASHBOARD — role switch
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 96px)', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 32, color: '#344a62' }}>🔒</div>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#6e8aaa' }}>Accedi per vedere la dashboard</p>
      </div>
    );
  }

  if (user.role === 'superadmin') return <SuperAdminPanel />;
  if (user.role === 'admin' || user.isAdmin) return <AdminPanel />;
  if (user.role === 'reseller') return <ResellerPanel user={user} />;
  return <UserDashboard user={user} />;
}
