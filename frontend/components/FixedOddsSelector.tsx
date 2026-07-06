'use client';

import { useBetSlipStore } from '../lib/betSlipStore';
import { calculateWithFixedOdds } from '../lib/couponUtils';

export default function FixedOddsSelector() {
  const { selections, toggleFixedSelection, stake } = useBetSlipStore();
  
  if (selections.length < 2) return null;
  
  const fixedSelections = selections.filter(s => s.isFixed);
  const regularSelections = selections.filter(s => !s.isFixed);
  
  const result = fixedSelections.length > 0 && regularSelections.length > 0
    ? calculateWithFixedOdds(fixedSelections, regularSelections, stake)
    : null;

  return (
    <div className="bg-white/5 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <span>🎯</span> Quote Fisse (Banker)
        </h4>
        {result && (
          <span className="text-xs text-[#14805e] font-medium">
            Moltiplicatore fisso: {result.fixedMultiplier.toFixed(2)}x
          </span>
        )}
      </div>
      
      <p className="text-xs text-gray-400 mb-3">
        Seleziona gli eventi più sicuri come &quot;fissi&quot;. Questi si moltiplicano sempre nel calcolo finale.
      </p>
      
      <div className="space-y-2">
        {selections.map((selection) => (
          <button
            key={`${selection.event_id}-${selection.outcome}`}
            onClick={() => toggleFixedSelection(selection.event_id, selection.outcome)}
            className={`
              w-full flex items-center justify-between p-3 rounded-lg
              transition-all duration-200
              ${selection.isFixed 
                ? 'bg-[#14805e]/20 border border-[#14805e]/50' 
                : 'bg-white/5 border border-transparent hover:bg-white/10'
              }
            `}
          >
            <div className="flex items-center gap-3">
              <div className={`
                w-5 h-5 rounded flex items-center justify-center
                ${selection.isFixed ? 'bg-[#14805e]' : 'bg-white/10'}
              `}>
                {selection.isFixed && <span className="text-white text-xs">✓</span>}
              </div>
              <div className="text-left">
                <p className="text-sm text-white">{selection.nome_evento}</p>
                <p className="text-xs text-gray-400">
                  {selection.market} • {selection.outcome}
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <p className={`
                font-bold
                ${selection.isFixed ? 'text-[#14805e]' : 'text-white'}
              `}>
                {selection.quota.toFixed(2)}
              </p>
              {selection.isFixed && (
                <span className="text-[10px] text-[#14805e] uppercase">Fisso</span>
              )}
            </div>
          </button>
        ))}
      </div>
      
      {result && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">Quota fissa moltiplicatore:</span>
            <span className="text-[#14805e] font-bold">{result.fixedMultiplier.toFixed(2)}x</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">Quota variabili:</span>
            <span className="text-white">{result.regularOdds.toFixed(2)}x</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Quota totale:</span>
            <span className="text-white font-bold">{result.totalOdds.toFixed(2)}x</span>
          </div>
        </div>
      )}
      
      {fixedSelections.length === selections.length && (
        <p className="mt-3 text-xs text-yellow-400">
          ⚠️ Tutte le selezioni sono fisse. Aggiungi almeno una selezione variabile.
        </p>
      )}
    </div>
  );
}
