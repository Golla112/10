'use client';

import { useEffect, useState } from 'react';
import { useBetSlipStore, BetType, computeSystemPotentialWin } from '../lib/betSlipStore';
import { submitBet } from '../lib/api';
import BonusBadge from './BonusBadge';
import FixedOddsSelector from './FixedOddsSelector';
import SystemCalculator from './SystemCalculator';

export default function MobileCoupon() {
  const {
    selections,
    stake,
    totalOdds,
    potentialWin,
    ownerName,
    betType,
    sistemaK,
    isOpen,
    setIsOpen,
    removeSelection,
    setStake,
    setOwnerName,
    setBetType,
    setSistemaK,
    clear,
  } = useBetSlipStore();

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; codice?: string } | null>(null);
  const [stakePerCombo, setStakePerCombo] = useState(1);

  useEffect(() => {
    if (betType === 'sistema') {
      const { totalStake } = computeSystemPotentialWin(stakePerCombo, selections, sistemaK);
      setStake(totalStake);
    }
  }, [betType, stakePerCombo, sistemaK, selections, setStake]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selections.length === 0) return;
    setSubmitting(true);
    try {
      const res = await submitBet({
        nome_proprietario: ownerName,
        stake,
        selections: selections.map((s) => ({
          event_id: s.event_id,
          nome_evento: s.nome_evento,
          market: s.market,
          outcome: s.outcome,
          quota: s.quota,
          live: s.live,
        })),
      });
      setResult({
        success: true,
        message: 'Scommessa piazzata con successo',
        codice: res.codice_schedina,
      });
      clear();
    } catch (err: any) {
      setResult({
        success: false,
        message: err?.message || 'Errore',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const numCombinations = betType === 'sistema' 
    ? computeSystemPotentialWin(stakePerCombo, selections, sistemaK).numCombinations 
    : 1;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm md:hidden" onClick={() => setIsOpen(false)}>
      <div 
        className="absolute bottom-16 left-2 right-2 bg-[#1a1a1a] rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Coupon ({selections.length})</h2>
          <button 
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {selections.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-4xl mb-2">🎫</p>
              <p>Nessuna selezione</p>
              <p className="text-sm">Tocca una quota per aggiungere</p>
            </div>
          ) : (
            <>
              <BonusBadge />
              {selections.map((s) => (
                <div key={`${s.event_id}-${s.outcome}`} className="bg-white/5 rounded-xl p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{s.nome_evento}</p>
                      <p className="text-gray-400 text-xs">{s.market} • {s.outcome}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-[#14805e] font-bold">{s.quota.toFixed(2)}</span>
                      <button
                        onClick={() => removeSelection(s.event_id, s.outcome)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-red-500/20 text-red-400 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Bet Type Selector */}
              <div className="flex gap-2 mt-4">
                {(['multipla', 'singola', 'sistema'] as BetType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setBetType(type)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold capitalize transition-colors ${
                      betType === type
                        ? 'bg-[#14805e] text-white'
                        : 'bg-white/10 text-gray-300'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Sistema K selector */}
              {betType === 'sistema' && selections.length >= 3 && (
                <div className="mt-3">
                  <label className="text-xs text-gray-400 mb-2 block">Sistema</label>
                  <div className="flex gap-2 flex-wrap">
                    {Array.from({ length: selections.length - 1 }, (_, i) => i + 2).map((k) => (
                      <button
                        key={k}
                        onClick={() => setSistemaK(k)}
                        className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors ${
                          sistemaK === k
                            ? 'bg-[#14805e] text-white'
                            : 'bg-white/10 text-gray-300'
                        }`}
                      >
                        {k}/{selections.length}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {numCombinations} combinazioni × €{stakePerCombo.toFixed(2)} = €{stake.toFixed(2)} totale
                  </p>
                </div>
              )}

              {/* Stake Input */}
              <div className="mt-4">
                <label className="text-xs text-gray-400 mb-2 block">
                  {betType === 'sistema' ? 'Puntata per combinazione' : 'Puntata'} (€)
                </label>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={betType === 'sistema' ? stakePerCombo : stake}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    if (betType === 'sistema') {
                      setStakePerCombo(val);
                    } else {
                      setStake(val);
                    }
                  }}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-lg font-semibold focus:border-[#14805e] focus:outline-none"
                />
              </div>

              {/* Owner Name */}
              <div className="mt-3">
                <label className="text-xs text-gray-400 mb-2 block">Nome giocatore (opzionale)</label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Giocatore"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#14805e] focus:outline-none"
                />
              </div>

              {/* Totals */}
              <div className="mt-4 bg-[#14805e]/10 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Quota totale</span>
                  <span className="text-white font-bold">{totalOdds.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Puntata</span>
                  <span className="text-white font-bold">€{stake.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg pt-2 border-t border-white/10">
                  <span className="text-[#14805e] font-bold">Vincita potenziale</span>
                  <span className="text-[#14805e] font-bold">€{potentialWin.toFixed(2)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {selections.length > 0 && (
          <div className="p-4 border-t border-white/10 space-y-2">
            <button
              onClick={handleSubmit}
              disabled={submitting || stake <= 0}
              className="w-full bg-[#14805e] hover:bg-[#1a9c70] disabled:bg-gray-600 text-white font-bold py-4 rounded-xl transition-colors"
            >
              {submitting ? '⏳ In corso...' : `SCOMMETTI €${stake.toFixed(2)}`}
            </button>
            <button
              onClick={clear}
              className="w-full bg-white/10 hover:bg-white/20 text-gray-300 font-semibold py-3 rounded-xl transition-colors"
            >
              Svuota coupon
            </button>
          </div>
        )}

        {/* Result Message */}
        {result && (
          <div className={`mx-4 mb-4 p-3 rounded-xl text-center text-sm ${
            result.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            <p className="font-semibold">{result.success ? '✓ Successo' : '✗ Errore'}</p>
            <p>{result.message}</p>
            {result.codice && (
              <p className="mt-1 font-mono text-xs bg-black/30 px-2 py-1 rounded">{result.codice}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
