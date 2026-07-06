'use client';

import { useMemo } from 'react';
import { useBetSlipStore } from '../lib/betSlipStore';
import { calculateRankBonus, qualifiesForBonus } from '../lib/couponUtils';

export default function BonusBadge() {
  const { selections, betType } = useBetSlipStore();

  const { bonusPct, validEvents, needed } = useMemo(() => {
    const validEvents = selections.filter(qualifiesForBonus).length;
    const bonusPct = calculateRankBonus(selections);
    
    let needed = 0;
    if (validEvents < 5) needed = 5 - validEvents;
    else if (validEvents === 5) needed = 0;
    
    return { bonusPct, validEvents, needed };
  }, [selections]);

  const bonusLevel = useMemo(() => {
    if (bonusPct === 0.05) return { label: '5%', color: '#22c55e' };
    if (bonusPct === 0.10) return { label: '10%', color: '#3b82f6' };
    if (bonusPct === 0.20) return { label: '20%', color: '#a855f7' };
    if (bonusPct === 0.30) return { label: '30%', color: '#f59e0b' };
    return { label: '0%', color: '#6b7280' };
  }, [bonusPct]);

  if (selections.length === 0) return null;

  // No bonus applicable
  if (bonusPct === 0 && selections.length < 5) {
    return (
      <div className="bg-white/5 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <span>🎁</span>
          <span>Aggiungi {5 - selections.length} eventi per il bonus</span>
        </div>
      </div>
    );
  }

  // Not enough qualifying events
  if (bonusPct === 0 && needed > 0) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2 text-yellow-400 text-sm">
          <span>⚠️</span>
          <span>
            Solo {validEvents} eventi validi. Aggiungi {needed} eventi con quota ≥1.25
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Gli eventi con quota inferiore a 1.25 non contano per il bonus
        </p>
      </div>
    );
  }

  return (
    <div 
      className="rounded-lg p-3 mb-4 border"
      style={{ 
        backgroundColor: `${bonusLevel.color}15`,
        borderColor: `${bonusLevel.color}40` 
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎁</span>
          <div>
            <p className="text-sm font-bold" style={{ color: bonusLevel.color }}>
              Bonus {bonusLevel.label} Attivo!
            </p>
            <p className="text-xs text-gray-400">
              {validEvents} eventi validi (quota ≥1.25)
            </p>
          </div>
        </div>
        
        <div 
          className="px-3 py-1 rounded-full text-sm font-bold"
          style={{ 
            backgroundColor: bonusLevel.color,
            color: 'white'
          }}
        >
          {bonusLevel.label}
        </div>
      </div>
      
      {bonusPct < 0.30 && (
        <p className="text-xs text-gray-500 mt-2">
          Aggiungi altri eventi validi per aumentare il bonus fino al 30%
        </p>
      )}
    </div>
  );
}
