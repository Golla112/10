'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { loginUser, registerUser, storeUser, setAuthenticated } from '../lib/session';

interface AuthModalProps {
  mode: 'login' | 'register';
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ mode: initialMode, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [affiliateCode, setAffiliateCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('Le password non coincidono.');
          return;
        }
        if (password.length < 6) {
          setError('La password deve essere di almeno 6 caratteri.');
          return;
        }
        const result = await registerUser(username.trim(), password, email.trim() || undefined, affiliateCode.trim() || undefined);
        if (!result.ok) {
          setError(result.error ?? 'Errore registrazione.');
          return;
        }
        // Auto-login after register
        const login = await loginUser(username.trim(), password);
        if (login.ok && login.user) {
          setAuthenticated();
          storeUser(login.user);
          onSuccess();
        } else {
          // Registration ok but login failed — show success message
          setError('');
          onSuccess();
        }
      } else {
        const result = await loginUser(username.trim(), password);
        if (!result.ok) {
          setError(result.error ?? 'Credenziali errate.');
          return;
        }
        setAuthenticated();
        storeUser(result.user!);
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9,
    padding: '11px 14px', fontSize: 13, color: '#d8e4f0',
    outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  };

  if (!mounted) return null;

  const modal = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
        overflowY: 'auto',
        padding: '20px 16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'linear-gradient(160deg, #0d1525 0%, #080e1c 100%)',
        border: '1px solid #1a2840',
        borderRadius: 16,
        width: '100%', maxWidth: 400,
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,180,216,0.1)',
        margin: '0 auto',
      }}>
        <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, #00b4d8 40%, #0077a8 70%, transparent)' }} />

        <div style={{ padding: '28px 28px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#d8e4f0', letterSpacing: '-0.01em' }}>
                {mode === 'login' ? 'Accedi' : 'Crea Account'}
              </div>
              <div style={{ fontSize: 11, color: '#344a62', marginTop: 3 }}>
                {mode === 'login' ? 'Bentornato su BigBet365' : 'Unisciti a BigBet365'}
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
              color: '#6e8aaa', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          </div>

          {/* Mode tabs */}
          <div style={{
            display: 'flex', background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
            padding: 3, marginBottom: 24, gap: 3,
          }}>
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
                background: mode === m ? 'linear-gradient(135deg, #0077a8, #00b4d8)' : 'transparent',
                color: mode === m ? '#fff' : '#6e8aaa',
                boxShadow: mode === m ? '0 2px 8px rgba(0,180,216,0.3)' : 'none',
              }}>
                {m === 'login' ? 'Accedi' : 'Registrati'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#6e8aaa', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Username
              </label>
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                required autoComplete="username" placeholder="Il tuo username"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'rgba(0,180,216,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
            </div>

            {mode === 'register' && (
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#6e8aaa', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                  Email <span style={{ color: '#1e2d45', fontWeight: 400 }}>(opzionale)</span>
                </label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  autoComplete="email" placeholder="tua@email.com"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'rgba(0,180,216,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>
            )}

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#6e8aaa', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'rgba(0,180,216,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
            </div>

            {mode === 'register' && (
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#6e8aaa', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                  Conferma Password
                </label>
                <input
                  type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  required autoComplete="new-password" placeholder="••••••••"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'rgba(0,180,216,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#6e8aaa', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                  Codice Affiliato <span style={{ color: '#1e2d45', fontWeight: 400 }}>(opzionale)</span>
                </label>
                <input
                  type="text" value={affiliateCode} onChange={e => setAffiliateCode(e.target.value.toUpperCase())}
                  autoComplete="off" placeholder="Es. A3F2B1C9"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'rgba(0,180,216,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>
            )}

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#f87171',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
                fontSize: 13, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? '#1a2540' : 'linear-gradient(135deg, #0077a8 0%, #00b4d8 100%)',
                color: loading ? '#344a62' : '#fff',
                letterSpacing: '0.03em', transition: 'all 0.15s',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(0,180,216,0.35)',
                marginTop: 4,
              }}
            >
              {loading ? 'Caricamento...' : mode === 'login' ? 'Accedi' : 'Crea Account'}
            </button>
          </form>

          {mode === 'register' && (
            <p style={{ fontSize: 10, color: '#1e2d45', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
              Registrandoti accetti i nostri{' '}
              <a href="/termini" style={{ color: '#344a62', textDecoration: 'underline' }}>Termini di Servizio</a>
              {' '}e la{' '}
              <a href="/privacy" style={{ color: '#344a62', textDecoration: 'underline' }}>Privacy Policy</a>.
              Il gioco è vietato ai minori di 18 anni.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(modal, document.body);
}
