'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  isAuthenticated, setAuthenticated, storePassword, storeUser,
  loginUser, registerUser,
} from '../lib/session';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
const SITE_PASSWORD = process.env.NEXT_PUBLIC_SITE_PASSWORD ?? 'bigbet365';

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(true);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAuthed(isAuthenticated());
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) { setError('Compila tutti i campi.'); return; }
    setLoading(true);

    // Verify site password against backend
    try {
      const res = await fetch(`${API_BASE}/events`, {
        headers: { 'x-site-password': SITE_PASSWORD },
      });
      if (!res.ok && res.status === 401) {
        setError('Errore di connessione al server.');
        setLoading(false);
        return;
      }
    } catch {
      // If backend unreachable, still allow login with local credentials
    }

    const result = await loginUser(username.trim(), password);
    if (!result.ok) {
      setError(result.error ?? 'Credenziali errate.');
      setLoading(false);
      return;
    }

    storePassword(SITE_PASSWORD);
    setAuthenticated();
    storeUser(result.user!);
    setAuthed(true);
    setLoading(false);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password || !confirmPassword) { setError('Compila tutti i campi.'); return; }
    if (username.trim().length < 3) { setError('Username deve avere almeno 3 caratteri.'); return; }
    if (password.length < 6) { setError('La password deve avere almeno 6 caratteri.'); return; }
    if (password !== confirmPassword) { setError('Le password non coincidono.'); return; }
    if (username.trim().toLowerCase() === 'mirkoct') { setError('Username non disponibile.'); return; }

    setLoading(true);
    const result = await registerUser(username.trim(), password);
    if (!result.ok) {
      setError(result.error ?? 'Errore durante la registrazione.');
      setLoading(false);
      return;
    }

    // Auto-login after register
    storePassword(SITE_PASSWORD);
    setAuthenticated();
    storeUser({ username: username.trim(), isAdmin: false, role: 'user' });
    setAuthed(true);
    setLoading(false);
  }

  if (authed) return <>{children}</>;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'radial-gradient(ellipse at 50% 0%, #0a1628 0%, #04060c 70%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 400, height: 200,
        background: 'radial-gradient(ellipse, rgba(0,180,216,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%', maxWidth: 380,
        background: 'linear-gradient(180deg, #0d1220 0%, #080b14 100%)',
        border: '1px solid #1a2030',
        borderRadius: 14,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,180,216,0.08)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Top accent line */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, #00b4d8, transparent)' }} />

        {/* Logo */}
        <div style={{ padding: '28px 32px 0', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            <Image src="/logo.png" alt="BigBet365" width={140} height={42} style={{ objectFit: 'contain', width: 'auto', height: 'auto' }} priority />
          </div>
          <p style={{ fontSize: 12, color: '#344a62', marginBottom: 24 }}>
            {mode === 'login' ? 'Accedi al tuo account' : 'Crea un nuovo account'}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', margin: '0 32px', borderRadius: 8, background: '#060810', border: '1px solid #1a2030', overflow: 'hidden', marginBottom: 24 }}>
          {(['login', 'register'] as const).map(t => (
            <button key={t} onClick={() => { setMode(t); setError(''); }} style={{
              flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 700,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: mode === t ? 'linear-gradient(135deg, #005f73, #0096c7)' : 'transparent',
              color: mode === t ? '#fff' : '#344a62',
            }}>
              {t === 'login' ? 'Accedi' : 'Registrati'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#344a62', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Il tuo username"
              autoFocus
              autoComplete="username"
              style={{
                width: '100%', background: '#060810', border: '1px solid #1a2030',
                borderRadius: 7, padding: '9px 12px', fontSize: 13,
                color: '#d8e4f0', outline: 'none', fontFamily: 'inherit',
                transition: 'border-color 0.15s',
                boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = '#00b4d8'}
              onBlur={e => e.target.style.borderColor = '#1a2030'}
            />
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#344a62', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              style={{
                width: '100%', background: '#060810', border: '1px solid #1a2030',
                borderRadius: 7, padding: '9px 12px', fontSize: 13,
                color: '#d8e4f0', outline: 'none', fontFamily: 'inherit',
                transition: 'border-color 0.15s',
                boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = '#00b4d8'}
              onBlur={e => e.target.style.borderColor = '#1a2030'}
            />
          </div>

          {mode === 'register' && (
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#344a62', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
                Conferma Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                style={{
                  width: '100%', background: '#060810', border: '1px solid #1a2030',
                  borderRadius: 7, padding: '9px 12px', fontSize: 13,
                  color: '#d8e4f0', outline: 'none', fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = '#00b4d8'}
                onBlur={e => e.target.style.borderColor = '#1a2030'}
              />
            </div>
          )}

          {error && (
            <div style={{
              padding: '8px 11px', borderRadius: 7,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#fca5a5', fontSize: 11,
            }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              padding: '11px 0', borderRadius: 8, border: 'none',
              background: loading ? '#1a2540' : 'linear-gradient(135deg, #005f73, #0096c7)',
              color: loading ? '#344a62' : '#fff',
              fontSize: 13, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s', letterSpacing: '0.02em',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(0,180,216,0.3)',
            }}
          >
            {loading ? 'Attendere...' : mode === 'login' ? 'Accedi' : 'Crea Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
