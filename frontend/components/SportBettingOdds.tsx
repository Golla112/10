'use client';
import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ── Interfacce ───────────────────────────────────────────────────────────────────

interface SportBettingOutcome {
  name: string;
  price: number;
  point?: number;
}

interface SportBettingMarket {
  key: string;
  name: string;
  outcomes: SportBettingOutcome[];
}

interface SportBettingBookmaker {
  id: string;
  name: string;
  markets: SportBettingMarket[];
}

interface SportBettingOddsProps {
  eventId: string;
  sport: string;
  markets?: string[];
  className?: string;
}

interface QuoteData {
  success: boolean;
  data: SportBettingBookmaker[];
  cached: boolean;
  live?: boolean;
}

// ── Componente Principale ─────────────────────────────────────────────────────────

export default function SportBettingOdds({ 
  eventId, 
  sport, 
  markets = ['h2h'], 
  className = '' 
}: SportBettingOddsProps) {
  const [odds, setOdds] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBookmaker, setSelectedBookmaker] = useState<string>('all');

  // Fetch odds function
  const fetchOdds = useCallback(async () => {
    try {
      setLoading(true);
      const marketsQuery = markets.join(',');
      const response = await fetch(
        `/api/sport-betting/odds/event/${eventId}?markets=${marketsQuery}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setOdds(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching SportBetting odds:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch odds');
    } finally {
      setLoading(false);
    }
  }, [eventId, markets]);

  // Fetch odds from API
  useEffect(() => {
    fetchOdds();
    
    // Auto-refresh per quote live
    const interval = odds?.live ? setInterval(fetchOdds, 30000) : null;
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchOdds, odds?.live]);

  // Filtra bookmaker
  const filteredBookmakers = selectedBookmaker === 'all' 
    ? odds?.data || []
    : odds?.data.filter(b => b.id === selectedBookmaker) || [];

  // Formatta nome mercato
  const formatMarketName = (key: string): string => {
    const marketNames: Record<string, string> = {
      'h2h': '1X2',
      'spreads': 'Handicap',
      'totals': 'Over/Under',
      'h2h_lay': 'Lay 1X2',
      'spreads_lay': 'Lay Handicap',
      'totals_lay': 'Lay Over/Under',
      'btts': 'Entrambe a Segno',
      'correct_score': 'Risultato Esatto',
      'double_chance': 'Doppia Chance',
      'draw_no_bet': 'Rimborso Pareggio',
      'both_teams_to_score': 'Entrambe a Segno'
    };
    
    return marketNames[key] || key.replace(/_/g, ' ').toUpperCase();
  };

  // Formatta nome outcome
  const formatOutcomeName = (name: string, market: string): string => {
    if (market === 'h2h') {
      return name;
    }
    if (market === 'totals') {
      return name.includes('Over') ? `Over ${name.split(' ')[1]}` : `Under ${name.split(' ')[1]}`;
    }
    if (market === 'spreads') {
      return name;
    }
    return name;
  };

  // Determina trend della quota
  const getQuoteTrend = (price: number): 'up' | 'down' | 'stable' => {
    // Qui potresti implementare logica per confrontare con quote precedenti
    // Per ora restituisce stable
    return 'stable';
  };

  // Componente per singola quota
  const QuoteButton = ({ 
    outcome, 
    market, 
    bookmaker 
  }: { 
    outcome: SportBettingOutcome; 
    market: SportBettingMarket;
    bookmaker: SportBettingBookmaker;
  }) => {
    const trend = getQuoteTrend(outcome.price);
    const trendIcon = {
      up: <TrendingUp className="w-3 h-3 text-green-500" />,
      down: <TrendingDown className="w-3 h-3 text-red-500" />,
      stable: <Minus className="w-3 h-3 text-gray-400" />
    }[trend];

    const handleBet = () => {
      // Integra con il sistema di scommesse esistente
      const betData = {
        eventId,
        sport,
        bookmaker: bookmaker.name,
        market: market.key,
        marketName: market.name,
        outcome: outcome.name,
        price: outcome.price,
        point: outcome.point
      };
      
      // Emetti evento o chiama funzione per aggiungere al betslip
      window.dispatchEvent(new CustomEvent('add-to-betslip', { detail: betData }));
    };

    return (
      <button
        onClick={handleBet}
        className="relative bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 group"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">
            {formatOutcomeName(outcome.name, market.key)}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold text-gray-900 group-hover:text-blue-600">
              {outcome.price.toFixed(2)}
            </span>
            {trendIcon}
          </div>
        </div>
        {outcome.point !== undefined && (
          <div className="text-xs text-gray-500 mt-1">
            Handicap: {outcome.point}
          </div>
        )}
      </button>
    );
  };

  // Loading state
  if (loading && !odds) {
    return (
      <div className={`bg-white rounded-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <div className="flex items-center gap-2 text-red-600">
          <span className="font-medium">Errore nel caricamento quote:</span>
          <span className="text-sm">{error}</span>
        </div>
        <button
          onClick={fetchOdds}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Riprova
        </button>
      </div>
    );
  }

  // No odds available
  if (!odds || !odds.data || odds.data.length === 0) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-6 ${className}`}>
        <p className="text-gray-500 text-center">
          Nessuna quota disponibile per questo evento
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">Quote SportBetting</h3>
            {odds.cached && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                Cache
              </span>
            )}
            {odds.live && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full animate-pulse">
                LIVE
              </span>
            )}
          </div>
          
          {/* Bookmaker selector */}
          {odds.data.length > 1 && (
            <select
              value={selectedBookmaker}
              onChange={(e) => setSelectedBookmaker(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tutti i Bookmaker</option>
              {odds.data.map(bookmaker => (
                <option key={bookmaker.id} value={bookmaker.id}>
                  {bookmaker.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Markets */}
      <div className="p-4 space-y-6">
        {filteredBookmakers.map(bookmaker => (
          <div key={bookmaker.id} className="space-y-4">
            {bookmaker.name && (
              <h4 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                {bookmaker.name}
              </h4>
            )}
            
            {bookmaker.markets
              .filter(market => markets.includes(market.key))
              .map(market => (
                <div key={market.key} className="space-y-3">
                  <h5 className="text-sm font-medium text-gray-700">
                    {formatMarketName(market.key)}
                  </h5>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {market.outcomes.map((outcome, index) => (
                      <QuoteButton
                        key={`${market.key}-${outcome.name}-${index}`}
                        outcome={outcome}
                        market={market}
                        bookmaker={bookmaker}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Aggiornamento: {new Date().toLocaleTimeString('it-IT')}</span>
          <button
            onClick={fetchOdds}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Aggiorna
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componenti Specializzati ───────────────────────────────────────────────────────

export function SportBettingH2H({ eventId, sport, className }: Omit<SportBettingOddsProps, 'markets'>) {
  return (
    <SportBettingOdds 
      eventId={eventId} 
      sport={sport} 
      markets={['h2h']} 
      className={className}
    />
  );
}

export function SportBettingSpreads({ eventId, sport, className }: Omit<SportBettingOddsProps, 'markets'>) {
  return (
    <SportBettingOdds 
      eventId={eventId} 
      sport={sport} 
      markets={['spreads']} 
      className={className}
    />
  );
}

export function SportBettingTotals({ eventId, sport, className }: Omit<SportBettingOddsProps, 'markets'>) {
  return (
    <SportBettingOdds 
      eventId={eventId} 
      sport={sport} 
      markets={['totals']} 
      className={className}
    />
  );
}

export function SportBettingAllMarkets({ eventId, sport, className }: Omit<SportBettingOddsProps, 'markets'>) {
  const allMarkets = ['h2h', 'spreads', 'totals', 'btts', 'double_chance', 'draw_no_bet'];
  return (
    <SportBettingOdds 
      eventId={eventId} 
      sport={sport} 
      markets={allMarkets} 
      className={className}
    />
  );
}
