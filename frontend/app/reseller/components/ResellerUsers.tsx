'use client';
import { useState, useEffect, useCallback } from 'react';
import { getUsers, createUser, updateUserBalance, setUserBlocked, ResellerUser } from '../../../lib/resellerApi';

interface Props {
  onBalanceChange: () => void;
}

export default function ResellerUsers({ onBalanceChange }: Props) {
  const [users, setUsers] = useState<ResellerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create user form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Balance transfer
  const [transferAmounts, setTransferAmounts] = useState<Record<string, string>>({});
  const [transferLoading, setTransferLoading] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore nel caricamento utenti');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) {
      setCreateError('Username e password sono obbligatori');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await createUser(newUsername.trim(), newPassword);
      setNewUsername('');
      setNewPassword('');
      await load();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Errore nella creazione');
    } finally {
      setCreating(false);
    }
  }

  async function handleTransfer(userId: string, positive: boolean) {
    const raw = transferAmounts[userId];
    const amount = parseFloat(raw);
    if (!raw || isNaN(amount) || amount <= 0) return;

    setTransferLoading(prev => ({ ...prev, [userId]: true }));
    try {
      await updateUserBalance(userId, positive ? amount : -amount);
      setTransferAmounts(prev => ({ ...prev, [userId]: '' }));
      await load();
      onBalanceChange();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Errore nel trasferimento');
    } finally {
      setTransferLoading(prev => ({ ...prev, [userId]: false }));
    }
  }

  async function handleBlock(userId: string, blocked: boolean) {
    try {
      await setUserBlocked(userId, blocked);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Errore nel blocco utente');
    }
  }

  const inputStyle: React.CSSProperties = {
    background: '#0d1018', border: '1px solid #1a2030', borderRadius: 6,
    padding: '6px 10px', color: '#d8e4f0', fontSize: 12, outline: 'none',
  };

  const btnStyle = (color: string): React.CSSProperties => ({
    padding: '5px 10px', borderRadius: 6, border: 'none', fontSize: 11,
    fontWeight: 700, cursor: 'pointer',
    background: `rgba(${color},0.12)`, color: `rgb(${color})`,
  });

  return (
    <div>
      {/* Create user form */}
      <div style={{ background: '#0d1018', border: '1px solid #1a2030', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#d8e4f0', marginBottom: 12 }}>➕ Crea nuovo utente</div>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: '#6e8aaa' }}>Username</label>
            <input
              style={inputStyle}
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              placeholder="username"
              autoComplete="off"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: '#6e8aaa' }}>Password</label>
            <input
              style={inputStyle}
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="password"
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            style={{
              padding: '6px 16px', borderRadius: 8, border: 'none',
              background: creating ? '#1a2030' : 'linear-gradient(135deg,#0077a8,#00b4d8)',
              color: '#fff', fontSize: 12, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer',
            }}
          >
            {creating ? 'Creazione...' : 'Crea'}
          </button>
        </form>
        {createError && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#f87171' }}>{createError}</div>
        )}
      </div>

      {/* Users list */}
      {loading ? (
        <div style={{ color: '#6e8aaa', fontSize: 13 }}>Caricamento...</div>
      ) : error ? (
        <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6e8aaa', fontSize: 13 }}>
          Nessun utente ancora. Crea il primo!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map(user => (
            <div key={user.id} style={{
              background: '#0d1018', border: `1px solid ${user.is_blocked ? 'rgba(239,68,68,0.2)' : '#1a2030'}`,
              borderRadius: 10, padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              {/* Avatar + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: user.is_blocked ? 'rgba(239,68,68,0.2)' : 'linear-gradient(135deg,#005f73,#0096c7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 900, color: '#fff',
                }}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#d8e4f0' }}>{user.username}</div>
                  {user.is_blocked && (
                    <div style={{ fontSize: 9, color: '#f87171', fontWeight: 700 }}>BLOCCATO</div>
                  )}
                </div>
              </div>

              {/* Balance */}
              <div style={{
                background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)',
                borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 800,
                color: '#34d399', fontFamily: 'monospace', minWidth: 80, textAlign: 'center',
              }}>
                €{user.balance.toFixed(2)}
              </div>

              {/* Transfer controls */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, minWidth: 200 }}>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Importo €"
                  value={transferAmounts[user.id] ?? ''}
                  onChange={e => setTransferAmounts(prev => ({ ...prev, [user.id]: e.target.value }))}
                  style={{ ...inputStyle, width: 90 }}
                />
                <button
                  onClick={() => handleTransfer(user.id, true)}
                  disabled={transferLoading[user.id]}
                  style={btnStyle('52,211,153')}
                  title="Ricarica"
                >
                  ➕ Ricarica
                </button>
                <button
                  onClick={() => handleTransfer(user.id, false)}
                  disabled={transferLoading[user.id]}
                  style={btnStyle('251,191,36')}
                  title="Preleva"
                >
                  ➖ Preleva
                </button>
              </div>

              {/* Block toggle */}
              <button
                onClick={() => handleBlock(user.id, !user.is_blocked)}
                style={btnStyle(user.is_blocked ? '52,211,153' : '239,68,68')}
              >
                {user.is_blocked ? '🔓 Sblocca' : '🔒 Blocca'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
