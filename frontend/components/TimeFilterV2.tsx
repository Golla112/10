'use client';

import { useState, useCallback } from 'react';
import { TIME_FILTERS, calculateTimeFilterValue, TimeFilter } from '../lib/couponUtils';

interface TimeFilterV2Props {
  value: number;
  onChange: (filter: TimeFilter) => void;
  counts?: Record<number, number>;
  disabled?: boolean;
}

export default function TimeFilterV2({ 
  value, 
  onChange, 
  counts = {},
  disabled = false 
}: TimeFilterV2Props) {
  const [isOpen, setIsOpen] = useState(false);
  
  const currentFilter = TIME_FILTERS.find(f => f.label === value) || TIME_FILTERS[4];
  
  const handleSelect = useCallback((filter: TimeFilter) => {
    const timeFilter = {
      ...filter,
      value: calculateTimeFilterValue(filter.label),
    };
    onChange(timeFilter);
    setIsOpen(false);
  }, [onChange]);

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
          transition-all duration-200
          ${disabled 
            ? 'bg-white/5 text-gray-500 cursor-not-allowed' 
            : 'bg-white/10 hover:bg-white/20 text-white cursor-pointer'
          }
        `}
      >
        <span>⏱️</span>
        <span>{currentFilter.name}</span>
        <span className="text-xs text-gray-400">
          ({counts[value] || 0})
        </span>
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-56 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
            {TIME_FILTERS.map((filter) => {
              const count = counts[filter.label] || 0;
              const isActive = value === filter.label;
              
              return (
                <button
                  key={filter.label}
                  onClick={() => handleSelect(filter)}
                  className={`
                    w-full flex items-center justify-between px-4 py-3 text-left
                    transition-colors
                    ${isActive 
                      ? 'bg-[#14805e]/20 text-[#14805e]' 
                      : 'hover:bg-white/5 text-gray-300'
                    }
                  `}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{filter.name}</span>
                    <span className="text-xs text-gray-500">
                      {filter.label === 50 ? 'Tutti gli eventi' : 
                       filter.label === 30 ? 'Fino a mezzanotte' :
                       filter.label === 10 ? 'Prossime 2 ore' :
                       filter.label === 20 ? 'Prossime 4 ore' :
                       'Prossimi 2 giorni'}
                    </span>
                  </div>
                  <span className={`
                    px-2 py-0.5 rounded text-xs font-bold
                    ${isActive ? 'bg-[#14805e] text-white' : 'bg-white/10 text-gray-400'}
                  `}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
