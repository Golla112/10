'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import PrintReceipt from '../../../components/PrintReceipt';
import { StoredBet } from '../../../components/BetConfirmation';
import { fetchBetByCodice } from '../../../lib/api';

export default function PrintPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const codice = params?.codice as string;
  const isPayment = searchParams?.get('type') === 'payment';

  const [bet, setBet] = useState<StoredBet | null>(null);
  const [paidAt, setPaidAt] = useState<string | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!codice) return;

    async function load() {
      try {
        const data = await fetchBetByCodice(codice);
        const stored: StoredBet = {
          codice_schedina: data.codice_schedina,
          nome_proprietario: data.nome_proprietario,
          stake: data.stake,
          selections: data.selections,
          total_odds: data.total_odds,
          potential_win: data.potential_win,
          bonus_pct: data.bonus_pct ?? 0,
          created_at: data.created_at,
          tipo_schedina: (data as { tipo_schedina?: string }).tipo_schedina,
          sistema_info: (data as { sistema_info?: StoredBet['sistema_info'] }).sistema_info,
        };
        setBet(stored);
        if (data.paid_at) setPaidAt(data.paid_at);
      } catch {
        if (typeof window === 'undefined') { setError(true); return; }
        const raw = localStorage.getItem('bb365_last_bet');
        if (!raw) { setError(true); return; }
        try {
          const stored: StoredBet = JSON.parse(raw);
          if (stored.codice_schedina !== codice) { setError(true); return; }
          setBet(stored);
        } catch { setError(true); }
      }
    }

    load();
  }, [codice]);

  if (error) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <p className="text-red-400 text-lg font-semibold">Scommessa non trovata.</p>
          <a href="/" className="inline-block mt-4 text-blue-400 hover:underline text-sm">← Torna alla home</a>
        </div>
      </main>
    );
  }

  if (!bet) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Caricamento ricevuta...</div>
      </main>
    );
  }

  function handlePrint() {
    const rcpEl = document.getElementById('rcp');
    if (!rcpEl) return;
    // Clona il nodo per manipolarlo senza toccare il DOM
    const clone = rcpEl.cloneNode(true) as HTMLElement;
    // Sostituisci eventuali img ottimizzate di Next.js con img semplici
    clone.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      // Usa URL assoluto per il logo
      const absoluteSrc = src.startsWith('http') ? src : `${window.location.origin}${src.startsWith('/') ? '' : '/'}${src}`;
      img.setAttribute('src', absoluteSrc);
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
      img.style.maxWidth = '180px';
      img.style.height = 'auto';
    });
    const html = clone.innerHTML;
    const css = `
      body { margin: 0; padding: 0; background: #fff; }
      #rcp {
        font-family: 'Courier New', Courier, monospace;
        font-size: 11px;
        line-height: 1.5;
        color: #000;
        background: #fff;
        width: 302px;
        margin: 0 auto;
        padding: 12px 10px 16px;
      }
      .r-logo { text-align: center; margin-bottom: 6px; }
      .r-logo img { max-width: 180px; height: auto; }
      .r-sep { border: none; border-top: 1px dashed #000; margin: 6px 0; }
      .r-row { display: flex; justify-content: space-between; font-size: 10px; margin: 2px 0; }
      .r-row .lbl { color: #333; }
      .r-row .val { font-weight: bold; }
      .r-sel { margin: 4px 0; }
      .r-sel-ev { font-weight: bold; font-size: 11px; }
      .r-sel-sub { font-size: 9px; color: #555; }
      .r-sel-mkt { display: flex; justify-content: space-between; font-size: 10px; margin-top: 2px; }
      .r-sel-mkt .mkt { color: #333; flex: 1; }
      .r-sel-mkt .out { font-weight: bold; flex: 1; text-align: center; }
      .r-sel-mkt .qt { font-weight: bold; text-align: right; }
      .r-totals { margin: 4px 0; }
      .r-box { border: 1px solid #000; padding: 4px 6px; margin: 6px 0; text-align: center; }
      .r-box-lbl { font-size: 9px; font-weight: bold; letter-spacing: 1px; }
      .r-box-val { font-size: 14px; font-weight: bold; letter-spacing: 2px; }
      .r-footer { margin-top: 10px; font-size: 8px; color: #333; text-align: center; line-height: 1.4; }
      .r-footer-title { font-weight: bold; font-size: 9px; margin-bottom: 2px; }
      .r-footer-sub { font-style: italic; margin-bottom: 4px; }
      @page { margin: 0; size: 80mm auto; }
    `;
    const win = window.open('', '_blank', 'width=400,height=700');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Scontrino</title><style>${css}</style></head><body><div id="rcp">${html}</div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  }

  return (
    <main style={{ background: '#d0d0d0', minHeight: '100vh', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ marginBottom: 20, display: 'flex', gap: 10 }}>
        <button
          onClick={handlePrint}
          style={{
            background: '#111', color: '#fff', border: 'none', borderRadius: 6,
            padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            letterSpacing: 1, fontFamily: 'monospace',
          }}
        >
          🖨️ STAMPA
        </button>
        <button
          onClick={() => window.history.back()}
          style={{
            background: 'transparent', color: '#555', border: '1px solid #ccc', borderRadius: 6,
            padding: '10px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'monospace',
          }}
        >
          ← Indietro
        </button>
      </div>
      <PrintReceipt bet={bet} paymentMode={isPayment} paidAt={paidAt} />
    </main>
  );
}
