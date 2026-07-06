'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, AlertCircle, RefreshCw, DollarSign, Lock, Unlock, ChevronDown, ChevronUp } from 'lucide-react';
import { adminListUsers, adminBlockUser, adminUpdateBalance, AdminUser } from '../../../lib/api';
import {
  filterUsersByUsername,
  validateAmount,
  calculateAddBalance,
  calculateSubtractBalance,
} from '../../../lib/adminUtils';

interface BalanceFormState {
  type: 'add' | 'subtract';
  amount: string;
  error: string | null;
  loading: boolean;
}

const defaultBalanceForm = (): BalanceFormState => ({
  type: 'add',
  amount: '',
  error: null,
  loading: false,
});

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [balanceForms, setBalanceForms] = useState<Record<string, BalanceFormState>>({});

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminListUsers();
      setUsers(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  const filtered = filterUsersByUsername(users, search);

  async function handleToggleBlock(user: AdminUser) {
    setBlockingId(user.id);
    try {
      await adminBlockUser(user.id, !user.is_blocked);
      // Optimistic update
      setUsers(prev =>
        prev.map(u => u.id === user.id ? { ...u, is_blocked: !u.is_blocked } : u)
      );
    } catch (e) {
      alert(String(e));
    } finally {
      setBlockingId(null);
    }
  }

  function toggleBalanceForm(userId: string) {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
    } else {
      setExpandedUserId(userId);
      setBalanceForms(prev => ({ ...prev, [userId]: defaultBalanceForm() }));
    }
  }

  function updateForm(userId: string, patch: Partial<BalanceFormState>) {
    setBalanceForms(prev => ({
      ...prev,
      [userId]: { ...(prev[userId] ?? defaultBalanceForm()), ...patch },
    }));
  }

  async function handleBalanceSubmit(user: AdminUser) {
    const form = balanceForms[user.id] ?? defaultBalanceForm();
    const parsed = parseFloat(form.amount);

    if (!validateAmount(parsed)) {
      updateForm(user.id, { error: 'Inserisci un importo valido (numero positivo)' });
      return;
    }

    const newBalance =
      form.type === 'add'
        ? calculateAddBalance(user.balance, parsed)
        : calculateSubtractBalance(user.balance, parsed);

    updateForm(user.id, { loading: true, error: null });
    try {
      await adminUpdateBalance(user.id, newBalance);
      // Optimistic update
      setUsers(prev =>
        prev.map(u => u.id === user.id ? { ...u, balance: newBalance } : u)
      );
      setExpandedUserId(null);
    } catch (e) {
      updateForm(user.id, { loading: false, error: String(e) });
    }
  }

  return (
    <div>
      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search
          size={14}
          color="#334155"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
        />
        <input
          type="text"
          placeholder="Cerca per username..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(8,12,20,.8)',
            color: '#e2e8f0',
            border: '1px solid rgba(71,85,105,.5)',
            borderRadius: 10,
            padding: '10px 14px 10px 36px',
            fontSize: 13,
            outline: 'none',
            boxSizing: 'border-box',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,.3)',
          }}
          onFocus={e => {
            e.target.style.borderColor = '#3b82f6';
            e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,.2), inset 0 2px 4px rgba(0,0,0,.3)';
          }}
          onBlur={e => {
            e.target.style.borderColor = 'rgba(71,85,105,.5)';
            e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,.3)';
          }}
        />
      </div>

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: '#475569' }}>
          {!loading && !error && `${filtered.length} utent${filtered.length !== 1 ? 'i' : 'e'}`}
        </span>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={loadUsers}
          style={{
            background: 'rgba(255,255,255,.05)',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 8,
            padding: '6px 10px',
            cursor: 'pointer',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
          }}
        >
          <RefreshCw size={12} /> Aggiorna
        </motion.button>
      </div>

      {/* States */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
            <Loader2 size={26} color="#334155" />
          </motion.div>
        </div>
      )}

      {!loading && error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          color: '#ef4444', fontSize: 13, padding: '16px 0',
        }}>
          <AlertCircle size={15} />
          <span>{error}</span>
          <motion.button
            whileHover={{ scale: 1.04 }}
            onClick={loadUsers}
            style={{
              marginLeft: 8, background: 'rgba(239,68,68,.1)', color: '#ef4444',
              border: '1px solid rgba(239,68,68,.3)', borderRadius: 7,
              padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
            }}
          >
            Riprova
          </motion.button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: '#334155', fontSize: 13 }}>
          Nessun utente trovato
        </div>
      )}

      {/* User list */}
      {!loading && !error && (
        <AnimatePresence mode="popLayout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((user, idx) => {
              const form = balanceForms[user.id] ?? defaultBalanceForm();
              const isExpanded = expandedUserId === user.id;
              const isBlocking = blockingId === user.id;

              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.04, duration: 0.25 } }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                  layout
                  style={{
                    background: 'linear-gradient(145deg,rgba(30,41,59,.9),rgba(15,23,42,.95))',
                    borderRadius: 14,
                    border: user.is_blocked
                      ? '1px solid rgba(239,68,68,.2)'
                      : '1px solid rgba(16,185,129,.15)',
                    boxShadow: '0 4px 20px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.03)',
                    backdropFilter: 'blur(10px)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Main row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 18px',
                    flexWrap: 'wrap',
                  }}>
                    {/* Status badge */}
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: 20,
                      background: user.is_blocked ? 'rgba(239,68,68,.12)' : 'rgba(16,185,129,.12)',
                      color: user.is_blocked ? '#ef4444' : '#10b981',
                      border: user.is_blocked ? '1px solid rgba(239,68,68,.3)' : '1px solid rgba(16,185,129,.3)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}>
                      {user.is_blocked ? 'Bloccato' : 'Attivo'}
                    </span>

                    {/* Username */}
                    <span style={{
                      flex: 1,
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#f1f5f9',
                      minWidth: 80,
                    }}>
                      {user.username}
                    </span>

                    {/* Balance */}
                    <span style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#10b981',
                      background: 'rgba(16,185,129,.08)',
                      borderRadius: 8,
                      padding: '4px 10px',
                      border: '1px solid rgba(16,185,129,.15)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}>
                      €{Number(user.balance).toFixed(2)}
                    </span>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {/* Balance button */}
                      <motion.button
                        whileHover={{ scale: 1.05, y: -1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => toggleBalanceForm(user.id)}
                        style={{
                          background: isExpanded ? 'rgba(99,102,241,.2)' : 'rgba(99,102,241,.1)',
                          color: '#818cf8',
                          border: '1px solid rgba(99,102,241,.3)',
                          borderRadius: 8,
                          padding: '5px 11px',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <DollarSign size={11} />
                        Saldo
                        {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </motion.button>

                      {/* Block/Unblock button */}
                      <motion.button
                        whileHover={{ scale: isBlocking ? 1 : 1.05, y: isBlocking ? 0 : -1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleToggleBlock(user)}
                        disabled={isBlocking}
                        style={{
                          background: user.is_blocked ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)',
                          color: user.is_blocked ? '#10b981' : '#ef4444',
                          border: user.is_blocked ? '1px solid rgba(16,185,129,.3)' : '1px solid rgba(239,68,68,.3)',
                          borderRadius: 8,
                          padding: '5px 11px',
                          cursor: isBlocking ? 'not-allowed' : 'pointer',
                          fontSize: 11,
                          fontWeight: 700,
                          opacity: isBlocking ? 0.5 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {isBlocking
                          ? <Loader2 size={11} style={{ animation: 'spin .7s linear infinite' }} />
                          : user.is_blocked
                            ? <><Unlock size={11} /> Sblocca</>
                            : <><Lock size={11} /> Blocca</>
                        }
                      </motion.button>
                    </div>
                  </div>

                  {/* Balance form (inline, collapsible) */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        key="balance-form"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1, transition: { duration: 0.2 } }}
                        exit={{ height: 0, opacity: 0, transition: { duration: 0.15 } }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{
                          padding: '14px 18px 16px',
                          borderTop: '1px solid rgba(255,255,255,.06)',
                          background: 'rgba(0,0,0,.2)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}>
                          <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Modifica saldo
                          </div>

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                            {/* Operation type */}
                            <div style={{ display: 'flex', gap: 4 }}>
                              {(['add', 'subtract'] as const).map(t => (
                                <motion.button
                                  key={t}
                                  whileHover={{ scale: 1.04 }}
                                  whileTap={{ scale: 0.96 }}
                                  onClick={() => updateForm(user.id, { type: t, error: null })}
                                  style={{
                                    background: form.type === t
                                      ? t === 'add' ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.2)'
                                      : 'rgba(51,65,85,.4)',
                                    color: form.type === t
                                      ? t === 'add' ? '#10b981' : '#ef4444'
                                      : '#64748b',
                                    border: form.type === t
                                      ? t === 'add' ? '1px solid rgba(16,185,129,.4)' : '1px solid rgba(239,68,68,.4)'
                                      : '1px solid rgba(71,85,105,.3)',
                                    borderRadius: 7,
                                    padding: '6px 14px',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 700,
                                  }}
                                >
                                  {t === 'add' ? '+ Aggiungi' : '− Sottrai'}
                                </motion.button>
                              ))}
                            </div>

                            {/* Amount input */}
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              placeholder="Importo €"
                              value={form.amount}
                              onChange={e => updateForm(user.id, { amount: e.target.value, error: null })}
                              onKeyDown={e => e.key === 'Enter' && handleBalanceSubmit(user)}
                              style={{
                                background: 'rgba(8,12,20,.8)',
                                color: '#e2e8f0',
                                border: form.error ? '1px solid rgba(239,68,68,.6)' : '1px solid rgba(71,85,105,.5)',
                                borderRadius: 8,
                                padding: '6px 12px',
                                fontSize: 13,
                                outline: 'none',
                                width: 120,
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,.3)',
                              }}
                            />

                            {/* Confirm button */}
                            <motion.button
                              whileHover={{ scale: form.loading ? 1 : 1.05, y: form.loading ? 0 : -1 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleBalanceSubmit(user)}
                              disabled={form.loading}
                              style={{
                                background: form.type === 'add'
                                  ? 'linear-gradient(135deg,#10b981,#059669)'
                                  : 'linear-gradient(135deg,#ef4444,#dc2626)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 8,
                                padding: '6px 16px',
                                cursor: form.loading ? 'not-allowed' : 'pointer',
                                fontSize: 12,
                                fontWeight: 700,
                                opacity: form.loading ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                boxShadow: form.type === 'add'
                                  ? '0 3px 12px rgba(16,185,129,.4)'
                                  : '0 3px 12px rgba(239,68,68,.4)',
                              }}
                            >
                              {form.loading
                                ? <Loader2 size={12} style={{ animation: 'spin .7s linear infinite' }} />
                                : null}
                              Conferma
                            </motion.button>
                          </div>

                          {/* Validation error */}
                          <AnimatePresence>
                            {form.error && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 6,
                                  fontSize: 11, color: '#ef4444',
                                }}
                              >
                                <AlertCircle size={11} />
                                {form.error}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Preview */}
                          {form.amount && !isNaN(parseFloat(form.amount)) && parseFloat(form.amount) > 0 && (
                            <div style={{ fontSize: 11, color: '#475569' }}>
                              Nuovo saldo:{' '}
                              <span style={{ color: '#e2e8f0', fontWeight: 700 }}>
                                €{(form.type === 'add'
                                  ? calculateAddBalance(user.balance, parseFloat(form.amount))
                                  : calculateSubtractBalance(user.balance, parseFloat(form.amount))
                                ).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
