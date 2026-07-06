'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getStoredUser, logoutUser, UserSession } from '../lib/session';
import { fetchBalance } from '../lib/api';
import AuthModal from './AuthModal';

export default function UserMenu() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [modal, setModal] = useState<'login' | 'register' | null>(null);

  useEffect(() => {
    const u = getStoredUser();
    setUser(u);
    if (u?.supabaseId) {
      fetchBalance(u.supabaseId).then(r => setBalance(r.balance)).catch(() => {});
    }
  }, []);

  async function handleLogout() {
    await logoutUser();
    window.location.reload();
  }

  function handleSuccess() {
    setModal(null);
    window.location.reload();
  }

  if (user) {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>


          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(0,180,216,0.08)', border: '1px solid rgba(0,180,216,0.15)',
            borderRadius: 8, padding: '5px 11px',
          }}>
            <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: user.isAdmin
                ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                : user.role === 'reseller'
                  ? 'linear-gradient(135deg, #0077a8, #00b4d8)'
                  : 'linear-gradient(135deg, #005f73, #0096c7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 900, color: '#fff', flexShrink: 0,
            }}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {user.username}
            </span>
            {user.isAdmin && (
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#f59e0b',
                background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 3, padding: '1px 5px',
              }}>ADMIN</span>
            )}
            {!user.isAdmin && user.role === 'reseller' && (
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#00b4d8',
                background: 'rgba(0,180,216,0.12)', border: '1px solid rgba(0,180,216,0.2)',
                borderRadius: 3, padding: '1px 5px',
              }}>RESELLER</span>
            )}
            </Link>
          </div>
          <button onClick={handleLogout} style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: 7, padding: '5px 10px', color: '#f87171',
            fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'; }}
          >
            Esci
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginLeft: 8 }}>
        <button
          onClick={() => setModal('login')}
          style={{
            background: 'transparent',
            border: '1px solid rgba(0,180,216,0.3)',
            borderRadius: 8, padding: '6px 14px',
            fontSize: 12, fontWeight: 700, color: '#00b4d8',
            cursor: 'pointer', transition: 'all 0.15s',
            letterSpacing: '0.02em',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,180,216,0.1)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,180,216,0.5)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,180,216,0.3)';
          }}
        >
          Accedi
        </button>
        <button
          onClick={() => setModal('register')}
          style={{
            background: 'linear-gradient(135deg, #0077a8 0%, #00b4d8 100%)',
            border: 'none', borderRadius: 8, padding: '6px 14px',
            fontSize: 12, fontWeight: 700, color: '#fff',
            cursor: 'pointer', transition: 'all 0.15s',
            letterSpacing: '0.02em',
            boxShadow: '0 2px 10px rgba(0,180,216,0.3)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(0,180,216,0.45)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 10px rgba(0,180,216,0.3)';
          }}
        >
          Registrati
        </button>
      </div>

      {modal && (
        <AuthModal
          mode={modal}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
