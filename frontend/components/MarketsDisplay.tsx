'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, TrendingUp, Target, Shield, Activity, Clock, BarChart3 } from 'lucide-react';

interface Outcome {
  name: string;
  price: number;
  point?: number;
}

interface Market {
  key: string;
  name?: string;
  outcomes: Outcome[];
}

interface MarketsDisplayProps {
  markets: Market[];
  homeTeam: string;
  awayTeam: string;
  onSelect: (market: string, outcome: string, odds: number) => void;
  selectedBets?: Record<string, { outcome: string; odds: number }>;
}

const MARKET_GROUPS = {
  'Principali': ['h2h', '1x2', 'match_winner', 'winner'],
  'Doppia Chance': ['double_chance', 'dc', '1x', 'x2', '12'],
  'Over/Under': ['totals', 'over_under', 'ou', 'goals_over_under'],
  'Handicap': ['spreads', 'handicap', 'asian_handicap', 'ah'],
  'Goal': ['btts', 'both_teams_to_score', 'goal_no_goal', 'first_goal', 'last_goal'],
  'Tempo': ['ht_ft', 'halftime_fulltime', 'first_half', 'second_half', 'ht', '1h', '2h'],
  'Corner': ['corners', 'corner_totals', 'asian_corners'],
  'Cartellini': ['cards', 'bookings', 'total_cards'],
  'Speciali': ['correct_score', 'score', 'odd_even', 'draw_no_bet', 'dnb'],
};

const MARKET_NAMES: Record<string, string> = {
  'h2h': '1X2',
  '1x2': '1X2',
  'match_winner': 'Vincitore',
  'winner': 'Vincitore',
  'double_chance': 'Doppia Chance',
  'dc': 'Doppia Chance',
  'totals': 'Over/Under',
  'over_under': 'Over/Under',
  'ou': 'O/U',
  'goals_over_under': 'Over/Under Goal',
  'spreads': 'Handicap',
  'handicap': 'Handicap',
  'asian_handicap': 'Asian Handicap',
  'ah': 'AH',
  'btts': 'Gol/No Gol',
  'both_teams_to_score': 'Gol/No Gol',
  'goal_no_goal': 'Goal/No Goal',
  'first_goal': 'Primo Gol',
  'last_goal': 'Ultimo Gol',
  'ht_ft': '1° Tempo/Finale',
  'halftime_fulltime': 'HT/FT',
  'first_half': '1° Tempo',
  'second_half': '2° Tempo',
  'ht': '1° Tempo',
  '1h': '1H',
  '2h': '2H',
  'corners': 'Corner',
  'corner_totals': 'Corner O/U',
  'asian_corners': 'Asian Corner',
  'cards': 'Cartellini',
  'bookings': 'Cartellini',
  'total_cards': 'Totale Cartellini',
  'correct_score': 'Risultato Esatto',
  'score': 'Risultato',
  'odd_even': 'Pari/Dispari',
  'draw_no_bet': 'Draw No Bet',
  'dnb': 'DNB',
};

function getMarketIcon(key: string) {
  if (MARKET_GROUPS['Principali'].includes(key)) return <Activity className="w-4 h-4" />;
  if (MARKET_GROUPS['Over/Under'].includes(key)) return <TrendingUp className="w-4 h-4" />;
  if (MARKET_GROUPS['Handicap'].includes(key)) return <Target className="w-4 h-4" />;
  if (MARKET_GROUPS['Goal'].includes(key)) return <Shield className="w-4 h-4" />;
  if (MARKET_GROUPS['Tempo'].includes(key)) return <Clock className="w-4 h-4" />;
  if (MARKET_GROUPS['Corner'].includes(key)) return <BarChart3 className="w-4 h-4" />;
  return null;
}

function groupMarkets(markets: Market[]) {
  const grouped: Record<string, Market[]> = {
    'Principali': [],
    'Doppia Chance': [],
    'Over/Under': [],
    'Handicap': [],
    'Goal': [],
    'Tempo': [],
    'Corner': [],
    'Cartellini': [],
    'Speciali': [],
    'Altri': [],
  };

  markets.forEach(market => {
    let placed = false;
    for (const [group, keys] of Object.entries(MARKET_GROUPS)) {
      if (keys.some(k => market.key?.toLowerCase().includes(k) || market.name?.toLowerCase().includes(k))) {
        grouped[group].push(market);
        placed = true;
        break;
      }
    }
    if (!placed) {
      grouped['Altri'].push(market);
    }
  });

  return grouped;
}

function formatOutcomeName(name: string, homeTeam: string, awayTeam: string): string {
  return name
    .replace(/home/i, homeTeam)
    .replace(/away/i, awayTeam)
    .replace(/Home/i, homeTeam)
    .replace(/Away/i, awayTeam)
    .replace(/1$/i, homeTeam)
    .replace(/2$/i, awayTeam)
    .replace(/X/i, 'Pareggio')
    .replace(/Over/i, 'Over')
    .replace(/Under/i, 'Under')
    .replace(/Yes/i, 'Sì')
    .replace(/No/i, 'No');
}

export default function MarketsDisplay({ 
  markets, 
  homeTeam, 
  awayTeam, 
  onSelect,
  selectedBets = {} 
}: MarketsDisplayProps) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['Principali']);
  const [expandedMarkets, setExpandedMarkets] = useState<string[]>([]);

  const groupedMarkets = groupMarkets(markets);

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => 
      prev.includes(group) 
        ? prev.filter(g => g !== group)
        : [...prev, group]
    );
  };

  const toggleMarket = (marketKey: string) => {
    setExpandedMarkets(prev => 
      prev.includes(marketKey)
        ? prev.filter(k => k !== marketKey)
        : [...prev, marketKey]
    );
  };

  if (!markets || markets.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>Nessun mercato disponibile</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {Object.entries(groupedMarkets).map(([group, groupMarkets]) => {
        if (groupMarkets.length === 0) return null;

        const isExpanded = expandedGroups.includes(group);

        return (
          <div key={group} className="bg-white/5 rounded-lg overflow-hidden">
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(group)}
              className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-400">{getMarketIcon(groupMarkets[0]?.key)}</span>
                <span className="font-semibold text-white text-sm">{group}</span>
                <span className="text-xs text-gray-500">({groupMarkets.length})</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Markets */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-white/10"
                >
                  {groupMarkets.map((market) => {
                    const marketKey = `${market.key}`;
                    const isMarketExpanded = expandedMarkets.includes(marketKey) || groupMarkets.length <= 3;
                    
                    // For simple markets (3 or fewer outcomes), show directly
                    const isSimple = market.outcomes.length <= 3;
                    
                    return (
                      <div key={marketKey} className="border-b border-white/5 last:border-0">
                        {/* Market Header (for complex markets) */}
                        {!isSimple && (
                          <button
                            onClick={() => toggleMarket(marketKey)}
                            className="w-full flex items-center justify-between p-2 px-3 hover:bg-white/5 transition-colors"
                          >
                            <span className="text-sm text-gray-300">
                              {MARKET_NAMES[market.key] || market.name || market.key}
                            </span>
                            <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${isMarketExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        )}

                        {/* Outcomes */}
                        <AnimatePresence>
                          {(isSimple || isMarketExpanded) && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: 'auto' }}
                              exit={{ height: 0 }}
                              className="p-2"
                            >
                              <div className={`grid gap-1 ${market.outcomes.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
                                {market.outcomes.map((outcome, idx) => {
                                  const betId = `${market.key}-${outcome.name}`;
                                  const isSelected = selectedBets[betId]?.outcome === outcome.name;
                                  
                                  return (
                                    <button
                                      key={idx}
                                      onClick={() => onSelect(market.key, outcome.name, outcome.price)}
                                      className={`
                                        flex items-center justify-between p-2 rounded text-xs
                                        transition-all active:scale-95
                                        ${isSelected 
                                          ? 'bg-[#14805e] text-white' 
                                          : 'bg-white/10 hover:bg-white/20 text-gray-300'
                                        }
                                      `}
                                    >
                                      <span className="truncate flex-1 text-left">
                                        {formatOutcomeName(outcome.name, homeTeam, awayTeam)}
                                      </span>
                                      <span className={`font-bold ml-1 ${isSelected ? 'text-white' : 'text-[#14805e]'}`}>
                                        {outcome.price.toFixed(2)}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
