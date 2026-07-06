'use client';
import { useState } from 'react';
import { useBetSlipStore, computeSystemPotentialWin, calculateMultipleBonus } from '../lib/betSlipStore';
import { submitBet, BetSubmitResponse, bookBet, fetchBookedBet } from '../lib/api';
import { getStoredPassword } from '../lib/session';
import BetConfirmation, { StoredBet } from './BetConfirmation';
import LiveBetStatus from './LiveBetStatus';
import type { Selection } from '../lib/betSlipStore';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
const LIVE_MAX_STAKE = 20;

async function submitLiveBetDirect(payload: {
  stake: number;
  selections: Selection[];
  accepted_odds: Record<string, number>;
}): Promise<{ pending_id: string; delay_ms: number }> {
  const res = await fetch(`${API_BASE}/bet/live`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-site-password': getStoredPassword(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Live bet failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{ pending_id: string; delay_ms: number }>;
}

export default function BetSlip() {
  const {
    selections, stake, totalOdds, potentialWin,
    betType, sistemaK,
    setStake, removeSelection, clear, setBetType, setSistemaK,
  } = useBetSlipStore();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedBet, setConfirmedBet] = useState<StoredBet | null>(null);
  const [livePending, setLivePending] = useState<{ pendingId: string; delayMs: number } | null>(null);

  const hasLiveSelections = selections.some((s) => s.live === true);
  const liveStakeExceeded = hasLiveSelections && stake > LIVE_MAX_STAKE;
  const oddsUnavailable = selections.some((s) => !s.quota || s.quota <= 0);

  // Sistema: serve almeno 3 selezioni e K valido
  const isSystem = betType === 'sistema';
  const validSistemaK = isSystem && sistemaK >= 2 && sistemaK < selections.length;
  const sistemaInfo = validSistemaK
    ? computeSystemPotentialWin(stake, selections, sistemaK)
    : null;
  // totalStake: per sistema = stake × combo, per multipla = stake
  const totalStake = isSystem && sistemaInfo ? sistemaInfo.totalStake : stake;

  const canSubmit =
    !oddsUnavailable &&
    selections.length > 0 &&
    stake > 0 &&
    !submitting &&
    !liveStakeExceeded &&
    (!isSystem || validSistemaK) &&
    totalStake <= 100000;

  const [bookingCode, setBookingCode] = useState<string | null>(null);

  async function handleBook() {
    if (selections.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: any = { stake: isSystem && sistemaInfo ? sistemaInfo.totalStake : stake, selections };
      if (isSystem && validSistemaK) {
        payload.sistema_k = sistemaK;
      }
      const res = await bookBet(payload);
      setBookingCode(res.booking_code);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      if (hasLiveSelections) {
        const accepted_odds: Record<string, number> = {};
        for (const sel of selections) accepted_odds[sel.event_id] = sel.quota;
        const result = await submitLiveBetDirect({ stake, selections, accepted_odds });
        setLivePending({ pendingId: result.pending_id, delayMs: result.delay_ms });
      } else {
        const payload: Parameters<typeof submitBet>[0] & { sistema_k?: number; stake_per_combo?: number } = {
          stake: isSystem && sistemaInfo ? sistemaInfo.totalStake : stake,
          selections,
        };
        if (isSystem && validSistemaK) {
          payload.sistema_k = sistemaK;
          payload.stake_per_combo = stake; // puntata per singola combo
        }

        const response: BetSubmitResponse = await submitBet(payload as Parameters<typeof submitBet>[0]);
        const stored: StoredBet = {
          codice_schedina: response.codice_schedina,
          nome_proprietario: '',
          stake: isSystem && sistemaInfo ? sistemaInfo.totalStake : stake,
          selections: selections.map((s) => ({
            event_id: s.event_id,
            nome_evento: s.nome_evento,
            quota: s.quota,
            market: s.market,
            outcome: s.outcome,
          })),
          total_odds: totalOdds,
          potential_win: potentialWin,
          created_at: response.created_at,
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem('bb365_last_bet', JSON.stringify(stored));
        }
        setConfirmedBet(stored);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore durante la scommessa.');
    } finally {
      setSubmitting(false);
    }
  }

  if (livePending) {
    return (
      <LiveBetStatus
        pendingId={livePending.pendingId}
        delayMs={livePending.delayMs}
        stake={stake}
        onNewBet={() => { setLivePending(null); clear(); }}
      />
    );
  }

  if (confirmedBet) return <BetConfirmation bet={confirmedBet} onNewBet={clear} />;

  if (selections.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-center text-gray-400 text-sm">
        Nessuna selezione. Aggiungi quote dalla pagina evento.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-4">
      <h2 className="text-lg font-bold text-white">Schedina</h2>

      {/* Selezioni */}
      <div className="space-y-2">
        {selections.map((sel) => (
          <div key={sel.event_id} className="flex items-start justify-between rounded bg-gray-800 px-3 py-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium text-white truncate">{sel.nome_evento}</p>
                {sel.live && (
                  <span className="shrink-0 rounded bg-red-700 px-1 py-0.5 text-[10px] font-bold text-white uppercase">LIVE</span>
                )}
              </div>
              <p className="text-xs text-gray-400">{sel.market} &middot; {sel.outcome}</p>
            </div>
            <div className="flex items-center gap-2 ml-2 shrink-0">
              <span className="text-sm font-bold text-blue-400">{sel.quota.toFixed(2)}</span>
              <button
                onClick={() => removeSelection(sel.event_id)}
                className="text-gray-500 hover:text-red-400 text-xs transition"
                aria-label="Rimuovi"
              >&#x2715;</button>
            </div>
          </div>
        ))}
      </div>

      {/* Tipo scommessa — mostra solo se ci sono 3+ selezioni */}
      {selections.length >= 3 && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">Tipo scommessa</label>
          <div className="flex gap-2">
            {(['multipla', 'sistema'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setBetType(type)}
                className={`flex-1 rounded py-1.5 text-xs font-semibold transition ${
                  betType === type
                    ? 'bg-blue-700 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {type === 'multipla' ? 'Multipla' : 'Sistema'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selettore K per sistema */}
      {isSystem && selections.length >= 3 && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Sistema K/{selections.length} — scegli K
          </label>
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: selections.length - 2 }, (_, i) => i + 2).map((k) => (
              <button
                key={k}
                onClick={() => setSistemaK(k)}
                className={`rounded px-3 py-1 text-xs font-bold transition ${
                  sistemaK === k
                    ? 'bg-purple-700 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {k}/{selections.length}
              </button>
            ))}
          </div>
          {sistemaInfo && (
            <p className="mt-1 text-xs text-gray-500">
              {sistemaInfo.numCombinations} combinazioni &middot; €{(stake / sistemaInfo.numCombinations).toFixed(2)} per combo
            </p>
          )}
          {isSystem && !validSistemaK && (
            <p className="mt-1 text-xs text-orange-400">
              Aggiungi almeno 3 selezioni per usare il sistema.
            </p>
          )}
        </div>
      )}

      {hasLiveSelections && (
        <div className="rounded border border-yellow-500 bg-yellow-900/30 p-2 text-xs text-yellow-300">
          Scommessa live &mdash; puntata massima: &euro;{LIVE_MAX_STAKE.toFixed(2)}
        </div>
      )}

      {oddsUnavailable && (
        <div className="rounded border border-yellow-600 bg-yellow-900/30 p-2 text-xs text-yellow-400">
          Quote non disponibili. Impossibile scommettere.
        </div>
      )}

      {/* Importo */}
      <div>
        <label className="block text-xs text-gray-400 mb-1" htmlFor="stake">
          {isSystem ? 'Importo per combinazione (€)' : 'Importo (€)'}
        </label>
        <input
          id="stake"
          type="number"
          min="1"
          max="100000"
          step="0.01"
          value={stake === 0 ? '' : stake}
          onChange={(e) => setStake(parseFloat(e.target.value) || 0)}
          placeholder="0.00"
          className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Riepilogo */}
      <div className="rounded bg-gray-800 px-3 py-2 space-y-1 text-sm">
        {!isSystem && (
          <div className="flex justify-between">
            <span className="text-gray-400">Quota totale</span>
            <span className="font-bold text-white">{totalOdds.toFixed(2)}</span>
          </div>
        )}
        {isSystem && sistemaInfo && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-400">Combinazioni</span>
              <span className="font-bold text-white">{sistemaInfo.numCombinations}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Puntata per combo</span>
              <span className="font-bold text-white">€ {stake.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-700 pt-1">
              <span className="text-gray-400">Totale speso</span>
              <span className="font-bold text-yellow-400">€ {sistemaInfo.totalStake.toFixed(2)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between">
          <span className="text-gray-400">
            {isSystem ? 'Vincita max (tutte vincenti)' : 'Vincita potenziale'}
          </span>
          <span className="font-bold text-green-400">€ {potentialWin.toFixed(2)}</span>
        </div>
        {!isSystem && calculateMultipleBonus(selections) > 0 && (
          <div className="flex justify-between border-t border-gray-700 pt-1 mt-1">
            <span className="text-green-500 font-medium">Bonus Multipla</span>
            <span className="font-bold text-green-500">
              + € {(potentialWin - (stake * totalOdds)).toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {liveStakeExceeded && (
        <div className="rounded border border-orange-600 bg-orange-900/30 p-2 text-xs text-orange-400">
          Puntata massima per scommesse live: &euro;{LIVE_MAX_STAKE.toFixed(2)}.
        </div>
      )}

      {error && (
        <div className="rounded border border-red-600 bg-red-900/30 p-2 text-xs text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full rounded py-3 text-sm font-bold transition mb-2 ${
          canSubmit
            ? 'bg-blue-700 text-white hover:bg-blue-600'
            : 'cursor-not-allowed bg-gray-700 text-gray-500'
        }`}
      >
        {submitting ? 'Invio in corso...' : 'Scommetti'}
      </button>

      <button
        onClick={handleBook}
        disabled={selections.length === 0 || submitting}
        className={`w-full rounded py-2 text-xs font-bold transition border ${
          selections.length > 0 && !submitting
            ? 'border-blue-500 text-blue-400 hover:bg-blue-500/10'
            : 'border-gray-700 text-gray-600 cursor-not-allowed'
        }`}
      >
        {submitting ? '...' : 'Prenota'}
      </button>

      {bookingCode && (
        <div className="mt-3 p-3 bg-blue-900/40 border border-blue-500 rounded text-center">
          <p className="text-[10px] text-blue-300 uppercase font-bold mb-1">Codice Prenotazione</p>
          <p className="text-xl font-black text-white tracking-widest">{bookingCode}</p>
          <p className="text-[9px] text-blue-400 mt-1">Comunicalo in cassa per scommettere</p>
          <button 
            onClick={() => setBookingCode(null)}
            className="mt-2 text-[10px] text-white/50 hover:text-white"
          >
            Chiudi
          </button>
        </div>
      )}
    </div>
  );
}