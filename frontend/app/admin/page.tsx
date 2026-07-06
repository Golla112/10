'use client';
import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, FileText, Store, ChevronRight, BarChart3 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getStoredUser } from '../../lib/session';
import AdminDashboard from './components/AdminDashboard';
import AdminAnalytics from './components/AdminAnalytics';
import AdminUsers from './components/AdminUsers';
import AdminBets from './components/AdminBets';
import AdminResellers from './components/AdminResellers';

type AdminTab = 'dashboard' | 'analytics' | 'users' | 'users-v2' | 'bets' | 'resellers';

const TABS: { key: AdminTab; label: string; Icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Dashboard',  Icon: LayoutDashboard },
  { key: 'analytics', label: 'Analytics',  Icon: BarChart3 },
  { key: 'users',     label: 'Utenti',     Icon: Users },
  { key: 'users-v2',  label: 'Utenti V2',  Icon: Users },
  { key: 'bets',      label: 'Scommesse',  Icon: FileText },
  { key: 'resellers', label: 'Rivenditori', Icon: Store },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Mostra nulla finché non siamo sul client (evita hydration mismatch)
  if (!mounted) return null;

  // Admin guard
  const user = getStoredUser();
  if (!user || !user.isAdmin) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 96px)', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 32, color: '#344a62' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>Accesso riservato agli amministratori</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Effettua il login con le credenziali admin</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,.18) 0%, transparent 60%), #080c14',
      color: '#e2e8f0',
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: '28px 16px 60px',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Image src="/logo.png" alt="BigBet365" width={130} height={42} style={{ objectFit: 'contain', width: 'auto', height: 'auto' }} priority />
            <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,.08)' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px', color: '#f1f5f9' }}>
                Admin Panel
              </h1>
              <p style={{ margin: 0, fontSize: 10, color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Gestione piattaforma
              </p>
            </div>
          </div>
          <Link href="/" style={{
            color: '#94a3b8', fontSize: 12, textDecoration: 'none',
            background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 8, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <ChevronRight size={12} style={{ transform: 'rotate(180deg)' }} /> Home
          </Link>
        </div>

        {/* ── Tab navigation ── */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 24,
          background: 'rgba(15,23,42,.8)', borderRadius: 12, padding: 6,
          border: '1px solid rgba(255,255,255,.06)', backdropFilter: 'blur(8px)',
        }}>
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                flex: 1,
                background: activeTab === key
                  ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)'
                  : 'rgba(51,65,85,.5)',
                color: activeTab === key ? '#fff' : '#64748b',
                border: activeTab === key
                  ? '1px solid rgba(59,130,246,.4)'
                  : '1px solid rgba(71,85,105,.3)',
                borderRadius: 8, padding: '9px 14px', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: activeTab === key ? '0 2px 10px rgba(59,130,246,.35)' : 'none',
                transition: 'all .15s ease',
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div>
          {activeTab === 'dashboard'  && <AdminDashboard />}
          {activeTab === 'analytics'  && <AdminAnalytics />}
          {activeTab === 'users'      && <AdminUsers />}
          {activeTab === 'users-v2'   && <AdminUsers />}
          {activeTab === 'bets'       && <AdminBets />}
          {activeTab === 'resellers'  && <AdminResellers />}
        </div>

      </div>
    </div>
  );
}
