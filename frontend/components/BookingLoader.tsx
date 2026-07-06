'use client';
import { useState } from 'react';
import { Zap, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { fetchBookedBet } from '../lib/api';
import { useBetSlipStore } from '../lib/betSlipStore';

interface BookingLoaderProps {
  onLoaded?: () => void;
}

export default function BookingLoader({ onLoaded }: BookingLoaderProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const { setSelections, setStake, setBetType, setSistemaK } = useBetSlipStore();

  async function handleLoad() {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;
    
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      const data = await fetchBookedBet(cleanCode);
      
      // Load into store
      setSelections(data.selections || []);
      setStake(data.stake || 0);
      
      if (data.sistema_k) {
        setBetType('sistema');
        setSistemaK(data.sistema_k);
      } else {
        setBetType('multipla');
      }
      
      setSuccess(true);
      if (onLoaded) onLoaded();
      
      // Auto-clear success message
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || 'Errore nel recupero della prenotazione.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      background: 'linear-gradient(145deg,rgba(30,41,59,.9),rgba(15,23,42,.95))',
      borderRadius: 16, padding: '24px',
      border: '1px solid rgba(59,130,246,.15)',
      boxShadow: '0 8px 32px rgba(0,0,0,.4)',
      backdropFilter: 'blur(12px)',
      maxWidth: 500, margin: '0 auto'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{
          background: 'rgba(59,130,246,0.1)',
          borderRadius: 8, padding: 8, color: '#3b82f6'
        }}>
          <Zap size={20} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>Carica Prenotazione</h3>
          <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Inserisci il codice per caricare la schedina nel carrello</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <input 
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
          placeholder="Es: PR5X8Y2"
          style={{
            flex: 1,
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '12px 16px',
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            outline: 'none'
          }}
        />
        <button
          onClick={handleLoad}
          disabled={loading || !code.trim()}
          style={{
            background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
            border: 'none',
            borderRadius: 8,
            padding: '0 20px',
            color: '#fff',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : 'Carica'}
        </button>
      </div>

      {error && (
        <div style={{ 
          marginTop: 16, padding: 12, borderRadius: 8, 
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#f87171', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 
        }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {success && (
        <div style={{ 
          marginTop: 16, padding: 12, borderRadius: 8, 
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
          color: '#10b981', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 
        }}>
          <CheckCircle2 size={14} /> Prenotazione caricata con successo!
        </div>
      )}

      <div style={{ marginTop: 24, padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 10 }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Istruzioni</h4>
        <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 11, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>Chiedi all&apos;utente il codice generato dal sito</li>
          <li>Specifica l&apos;importo se non è già presente</li>
          <li>Controlla le quote e conferma la giocata dal carrello</li>
        </ul>
      </div>
    </div>
  );
}
