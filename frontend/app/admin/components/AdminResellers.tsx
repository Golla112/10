'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Loader2, AlertCircle, RefreshCw, UserCheck } from 'lucide-react';
import { adminListUsers, adminCreateReseller, AdminUser } from '../../../lib/api';

interface NewResellerForm {
  username: string;
  password: string;
  error: string | null;
}

const defaultForm = (): NewResellerForm => ({ username: '', password: '', error: null });

export default function AdminResellers() {
  const [resellers, setResellers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewResellerForm>(defaultForm());

  const [creating, setCreating] = useState(false);

  async function loadResellers() {
    setLoading(true);
    setError(null);
    try {
      const all = await adminListUsers();
      setResellers(all.filter(u => u.role === 'reseller'));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadResellers(); }, []);

  function handleFormChange(field: 'username' | 'password', value: string) {
    setForm(prev => ({ ...prev, [field]: value, error: null }));
  }

  async function handleCreateReseller(e: React.FormEvent) {
    e.preventDefault();
    if (!form.username.trim()) {
      setForm(prev => ({ ...prev, error: 'Username obbligatorio' }));
      return;
    }
    if (!form.password.trim() || form.password.length < 6) {
      setForm(prev => ({ ...prev, error: 'Password minimo 6 caratteri' }));
      return;
    }
    setCreating(true);
    setForm(prev => ({ ...prev, error: null }));
    try {
      await adminCreateReseller(form.username.trim(), form.password);
      setShowForm(false);
      setForm(defaultForm());
      await loadResellers();
    } catch (err) {
      setForm(prev => ({ ...prev, error: String(err).replace('Error: ', '') }));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 11, color: '#475569' }}>
          {!loading && !error && `${resellers.length} rivenditore${resellers.length !== 1 ? 'i' : ''}`}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={loadResellers}
            style={{
              background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#64748b',
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
            }}
          >
            <RefreshCw size={12} /> Aggiorna
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => { setShowForm(v => !v); setForm(defaultForm()); }}
            style={{
              background: showForm ? 'rgba(99,102,241,.2)' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '6px 14px', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: showForm ? 'none' : '0 3px 12px rgba(99,102,241,.4)',
            }}
          >
            <Plus size={12} /> Nuovo rivenditore
          </motion.button>
        </div>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            key="create-form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: { duration: 0.2 } }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
            style={{ overflow: 'hidden', marginBottom: 16 }}
          >
            <form
              onSubmit={handleCreateReseller}
              style={{
                background: 'linear-gradient(145deg,rgba(30,41,59,.9),rgba(15,23,42,.95))',
                borderRadius: 14, padding: '20px 22px',
                border: '1px solid rgba(99,102,241,.2)',
                boxShadow: '0 8px 32px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.04)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                Crea nuovo rivenditore
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 140 }}>
                  <label style={{ fontSize: 11, color: '#64748b' }}>Username</label>
                  <input
                    type="text"
                    placeholder="es. rivenditore_roma"
                    value={form.username}
                    onChange={e => handleFormChange('username', e.target.value)}
                    style={{
                      background: 'rgba(8,12,20,.8)', color: '#e2e8f0',
                      border: '1px solid rgba(71,85,105,.5)', borderRadius: 8,
                      padding: '8px 12px', fontSize: 12, outline: 'none',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,.3)',
                    }}
                    onFocus={e => { e.target.style.borderColor = '#6366f1'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(71,85,105,.5)'; }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 140 }}>
                  <label style={{ fontSize: 11, color: '#64748b' }}>Password</label>
                  <input
                    type="password"
                    placeholder="Min. 6 caratteri"
                    value={form.password}
                    onChange={e => handleFormChange('password', e.target.value)}
                    style={{
                      background: 'rgba(8,12,20,.8)', color: '#e2e8f0',
                      border: '1px solid rgba(71,85,105,.5)', borderRadius: 8,
                      padding: '8px 12px', fontSize: 12, outline: 'none',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,.3)',
                    }}
                    onFocus={e => { e.target.style.borderColor = '#6366f1'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(71,85,105,.5)'; }}
                  />
                </div>
                <motion.button
                  type="submit"
                  disabled={creating}
                  whileHover={{ scale: creating ? 1 : 1.04, y: creating ? 0 : -1 }} whileTap={{ scale: 0.96 }}
                  style={{
                    background: creating ? 'rgba(99,102,241,.4)' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                    color: '#fff', border: 'none', borderRadius: 8,
                    padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                    boxShadow: creating ? 'none' : '0 3px 12px rgba(99,102,241,.4)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {creating
                    ? <><Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Creazione...</>
                    : <><UserCheck size={13} /> Crea</>
                  }
                </motion.button>
              </div>
              <AnimatePresence>
                {form.error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{
                      marginTop: 10, display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 11,
                      color: form.error.startsWith('Funzionalità') ? '#f59e0b' : '#ef4444',
                    }}
                  >
                    <AlertCircle size={11} /> {form.error}
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
            <Loader2 size={26} color="#334155" />
          </motion.div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontSize: 13, padding: '16px 0' }}>
          <AlertCircle size={15} />
          <span>{error}</span>
          <motion.button
            whileHover={{ scale: 1.04 }}
            onClick={loadResellers}
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

      {/* Empty state */}
      {!loading && !error && resellers.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{
            textAlign: 'center', padding: '48px 24px',
            background: 'linear-gradient(145deg,rgba(30,41,59,.6),rgba(15,23,42,.8))',
            borderRadius: 16, border: '1px solid rgba(255,255,255,.06)',
          }}
        >
          <Users size={36} color="#1e293b" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: '#334155', margin: '0 0 6px' }}>
            Nessun rivenditore registrato
          </p>
          <p style={{ fontSize: 12, color: '#1e293b', margin: 0 }}>
            Crea il primo rivenditore usando il pulsante &quot;Nuovo rivenditore&quot; in alto.
          </p>
        </motion.div>
      )}

      {/* Reseller list */}
      {!loading && !error && resellers.length > 0 && (
        <AnimatePresence mode="popLayout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {resellers.map((reseller, idx) => (
              <motion.div
                key={reseller.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.04, duration: 0.25 } }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                layout
                style={{
                  background: 'linear-gradient(145deg,rgba(30,41,59,.9),rgba(15,23,42,.95))',
                  borderRadius: 14, padding: '16px 20px',
                  border: '1px solid rgba(99,102,241,.15)',
                  boxShadow: '0 4px 20px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.03)',
                  backdropFilter: 'blur(10px)',
                  display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                }}
              >
                {/* Role badge */}
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                  background: 'rgba(99,102,241,.12)', color: '#818cf8',
                  border: '1px solid rgba(99,102,241,.3)', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  Rivenditore
                </span>

                {/* Username */}
                <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#f1f5f9', minWidth: 80 }}>
                  {reseller.username}
                </span>

                {/* Managed users (placeholder) */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  background: 'rgba(0,0,0,.2)', borderRadius: 8, padding: '6px 14px',
                  border: '1px solid rgba(255,255,255,.06)', minWidth: 80,
                }}>
                  <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Utenti</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#60a5fa' }}>0</span>
                </div>

                {/* Profit (placeholder) */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  background: 'rgba(0,0,0,.2)', borderRadius: 8, padding: '6px 14px',
                  border: '1px solid rgba(255,255,255,.06)', minWidth: 90,
                }}>
                  <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Profitto</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#10b981' }}>€0.00</span>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
