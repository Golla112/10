'use client';
import { useEffect, useRef, useState } from 'react';
import BetConfirmation, { StoredBet } from './BetConfirmation';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

interface LiveBetStatusProps {
  pendingId: string;
  delayMs: number;
  stake: number;
  onNewBet: () => void;
}

type BetStatus = 'pending' | 'accepted' | 'rejected';

interface StatusResponse {
  status: BetStatus;
  remaining_ms?: number;
  codice_schedina?: string;
  rejection_reason?: string;
  new_odds?: Record<string, number>;
}

function getRejectionMessage(reason: string | undefined): string {
  switch (reason) {
    case 'event_not_live':
      return "L'evento non è più live. Scommessa annullata.";
    case 'market_locked':
      return 'Mercato temporaneamente sospeso. Riprova tra qualche secondo.';
    case 'stake_exceeded':
      return 'Puntata massima superata.';
    default:
      return 'Scommessa rifiutata. Riprova.';
  }
}

export default function LiveBetStatus({ pendingId, delayMs, stake, onNewBet }: LiveBetStatusProps) {
  const [status, setStatus] = useState<BetStatus>('pending');
  const [remainingMs, setRemainingMs] = useState<number>(delayMs);
  const [codiceschedina, setCodiceschedina] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | undefined>(undefined);
  const [newOdds, setNewOdds] = useState<Record<string, number> | undefined>(undefined);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  function clearIntervals() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }

  useEffect(() => {
    startTimeRef.current = Date.now();

    // Countdown aggiornato ogni secondo
    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, delayMs - elapsed);
      setRemainingMs(remaining);
    }, 1000);

    // Polling ogni 1000 ms
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/bet/live/status/${encodeURIComponent(pendingId)}`);
        if (res.status === 404) {
          clearIntervals();
          setStatus('rejected');
          setRejectionReason(undefined);
          return;
        }
        if (!res.ok) return;

        const data = (await res.json()) as StatusResponse;

        if (data.remaining_ms !== undefined) {
          setRemainingMs(data.remaining_ms);
        }

        if (data.status === 'accepted') {
          clearIntervals();
          setCodiceschedina(data.codice_schedina ?? '');
          setStatus('accepted');
        } else if (data.status === 'rejected') {
          clearIntervals();
          setRejectionReason(data.rejection_reason);
          setNewOdds(data.new_odds);
          setStatus('rejected');
        }
      } catch {
        // silent — riprova al prossimo tick
      }
    }, 1000);

    return () => {
      clearIntervals();
    };
  }, [pendingId, delayMs]);

  const countdownSec = Math.ceil(remainingMs / 1000);

  // ── Stato: accepted ──────────────────────────────────────────────────────
  if (status === 'accepted' && codiceschedina) {
    const stored: StoredBet = {
      codice_schedina: codiceschedina,
      nome_proprietario: '',
      stake,
      selections: [],
      total_odds: 0,
      potential_win: 0,
      created_at: new Date().toISOString(),
    };
    return <BetConfirmation bet={stored} onNewBet={onNewBet} />;
  }

  // ── Stato: rejected con odds_changed ────────────────────────────────────
  if (status === 'rejected' && rejectionReason === 'odds_changed') {
    return (
      <div className="rounded-lg border border-yellow-700 bg-gray-900 p-4 space-y-4">
        <div className="text-center">
          <span className="text-yellow-400 text-2xl">⚠</span>
          <h2 className="mt-1 text-lg font-bold text-white">Quote aggiornate</h2>
          <p className="text-sm text-gray-400 mt-1">
            Le quote sono cambiate durante la verifica. Vuoi confermare con le nuove quote?
          </p>
        </div>

        {newOdds && Object.keys(newOdds).length > 0 && (
          <div className="rounded bg-gray-800 p-3 space-y-1">
            <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Nuove quote</p>
            {Object.entries(newOdds).map(([eventId, quota]) => (
              <div key={eventId} className="flex justify-between text-sm">
                <span className="text-gray-300 truncate">{eventId}</span>
                <span className="font-bold text-blue-400 ml-2">{(quota as number).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onNewBet}
            className="flex-1 rounded bg-yellow-600 py-2 text-sm font-bold text-white hover:bg-yellow-500 transition"
          >
            Conferma con nuove quote
          </button>
          <button
            onClick={onNewBet}
            className="flex-1 rounded border border-gray-600 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 transition"
          >
            Annulla
          </button>
        </div>
      </div>
    );
  }

  // ── Stato: rejected (altri motivi) ───────────────────────────────────────
  if (status === 'rejected') {
    return (
      <div className="rounded-lg border border-red-700 bg-gray-900 p-4 space-y-4">
        <div className="text-center">
          <span className="text-red-400 text-2xl">✕</span>
          <h2 className="mt-1 text-lg font-bold text-white">Scommessa rifiutata</h2>
          <p className="text-sm text-gray-400 mt-1">{getRejectionMessage(rejectionReason)}</p>
        </div>
        <button
          onClick={onNewBet}
          className="w-full rounded border border-gray-600 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 transition"
        >
          Nuova Scommessa
        </button>
      </div>
    );
  }

  // ── Stato: pending (countdown) ───────────────────────────────────────────
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-4">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          <svg
            className="animate-spin h-5 w-5 text-blue-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-white font-medium">
            Verifica in corso... {countdownSec > 0 ? `${countdownSec}s` : ''}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Stiamo verificando le quote e lo stato dell&apos;evento.
        </p>
      </div>
    </div>
  );
}
