'use client';

import { useState, useMemo } from 'react';
import { useBetSlipStore } from '../lib/betSlipStore';
import { calculateSystem, calculateRankBonus } from '../lib/couponUtils';

export default function SystemCalculator() {
  const { selections, stake, setStake, betType, setBetType } = useBetSlipStore();
  const [k, setK] = useState(2);
  const [stakePerCombo, setStakePerCombo] = useState(1);
  const n = selections.length;
  const maxK = Math.max(2, n - 1);
  
  // Available K values (from 2 to N-1)
  const kOptions = useMemo(() => {
    return Array.from({ length: Math.max(1, maxK - 1) }, (_, i) => i + 2);
  }, [maxK]);

  // Calculate system results
  const systemResult = useMemo(() => {
    if (n < 3 || betType !== 'sistema') return null;
    return calculateSystem(selections, k, stakePerCombo, true);
  }, [selections, k, stakePerCombo, betType, n]);

  if (n < 3) return null;

  // Update global stake when changing stake per combo
  const handleStakePerComboChange = (value: number) => {
    setStakePerCombo(value);
    if (systemResult) {
      setStake(systemResult.totalStake);
    }
  };

  // Update K and recalculate
  const handleKChange = (newK: number) => {
    setK(newK);
    setBetType('sistema');
  };

  return (
    <div className="bg-white/5 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <span>🎰</span> Sistema {k}/{n}
        </h4>
        <span className="text-xs text-gray-400">
          {systemResult?.numCombinations || 0} combinazioni
        </span>
      </div>

      {/* K Selector */}
      <div className="mb-4">
        <label className="text-xs text-gray-400 mb-2 block">
          Seleziona K (numero di eventi per combinazione)
        </label>
        <div className="flex gap-2 flex-wrap">
          {kOptions.map((kValue) => (
            <button
              key={kValue}
              onClick={() => handleKChange(kValue)}
              className={`
                px-3 py-2 rounded-lg text-sm font-bold transition-colors
                ${k === kValue
                  ? 'bg-[#14805e] text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }
              `}
            >
              {kValue}/{n}
            </button>
          ))}
        </div>
      </div>

      {/* Stake per combination */}
      <div className="mb-4">
        <label className="text-xs text-gray-400 mb-2 block">
          Puntata per combinazione
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={stakePerCombo}
            onChange={(e) => handleStakePerComboChange(parseFloat(e.target.value) || 0)}
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:border-[#14805e] focus:outline-none"
          />
          <span className="text-gray-400 text-sm">€</span>
        </div>
      </div>

      {/* System breakdown */}
      {systemResult && (
        <div className="space-y-3">
          {/* Combinations count */}
          <div className="bg-white/5 rounded-lg p-3">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Combinazioni totali:</span>
              <span className="text-white font-bold">{systemResult.numCombinations}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Puntata per combo:</span>
              <span className="text-white">€{stakePerCombo.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Puntata totale:</span>
              <span className="text-[#14805e] font-bold">€{systemResult.totalStake.toFixed(2)}</span>
            </div>
          </div>

          {/* Win range */}
          <div className="bg-[#14805e]/10 border border-[#14805e]/30 rounded-lg p-3">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Vincita minima:</span>
              <span className="text-white">
                €{(systemResult.minWin + systemResult.minBonus).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Vincita massima:</span>
              <span className="text-[#14805e] font-bold">
                €{(systemResult.maxWin + systemResult.maxBonus).toFixed(2)}
              </span>
            </div>
            {systemResult.maxBonus > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Bonus incluso:</span>
                <span className="text-[#14805e]">
                  fino a €{systemResult.maxBonus.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Bonus info */}
          {(() => {
            const bonusPct = calculateRankBonus(selections);
            if (bonusPct > 0) {
              return (
                <div className="text-xs text-center text-[#14805e]">
                  ✓ Bonus {Math.round(bonusPct * 100)}% applicato
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* Risk warning */}
      <p className="mt-3 text-xs text-gray-500">
        Nel sistema {k}/{n} devi indovinare almeno {k} eventi su {n} per vincere.
      </p>
    </div>
  );
}
