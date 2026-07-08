'use client';
import { useState, useEffect } from 'react';
import { AlertCircle, Zap, TrendingUp } from 'lucide-react';

interface LiveOdd {
  id: string;
  oddTypeId: number;
  oddName: string;
  oddGroup: string;
  rank: number;
  prank: number;
  enabled: number;
  sign: string;
  lastUpdate: string;
}

interface LiveEvent {
  idevents: number;
  event_name: string;
  team1: string;
  team2: string;
  matchScore: string;
  matchTime: string;
  matchPeriod: string;
  championshipName: string;
  oddsCount: number;
  odds: LiveOdd[];
}

interface LiveOddsDisplayProps {
  className?: string;
}

export default function LiveOddsDisplay({ className = '' }: LiveOddsDisplayProps) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);

  useEffect(() => {
    fetchLiveOdds();
  }, []);

  const fetchLiveOdds = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch da sibet90.net/live_ws.php
      const response = await fetch('https://sibet90.net/live_ws.php', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Errore HTTP: ${response.status}`);
      }

      const data = await response.json();
      
      // Filtra solo gli eventi con quote abilitate
      const eventsWithOdds = data.filter((event: LiveEvent) => 
        event.odds && event.odds.length > 0
      );

      setEvents(eventsWithOdds);
      if (eventsWithOdds.length > 0) {
        setSelectedEvent(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento delle quote');
      console.error('Errore nel fetch delle quote:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-3 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">Errore nel caricamento</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button
              onClick={fetchLiveOdds}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Riprova
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-6 text-center ${className}`}>
        <p className="text-gray-500">Nessun evento con quote disponibile al momento</p>
      </div>
    );
  }

  const currentEvent = events[selectedEvent ?? 0];
  const enabledOdds = currentEvent?.odds?.filter(odd => odd.enabled === 1) || [];

  // Raggruppa le quote per tipo (oddGroup)
  const groupedOdds = enabledOdds.reduce((acc, odd) => {
    if (!acc[odd.oddGroup]) {
      acc[odd.oddGroup] = [];
    }
    acc[odd.oddGroup].push(odd);
    return acc;
  }, {} as Record<string, LiveOdd[]>);

  const formatOddName = (name: string): string => {
    const mapping: Record<string, string> = {
      'ODD': 'Dispari',
      'EVEN': 'Pari',
      'DC1X': 'Doppia Chance 1X',
      'DC1': 'Doppia Chance 1/2',
      'DC2X': 'Doppia Chance X2',
      'DNB1': 'No Bet 1',
      'DNB2': 'No Bet 2',
      'FN1': 'Finale 1',
      'FNX': 'Finale X',
      'FN2': 'Finale 2',
      'GOAL_1_HOME': 'Gol Casa',
      'GOAL_1_AWAY': 'Gol Trasferta',
      'GOAL_2_HOME': 'Gol x2 Casa',
      'GOAL_2_AWAY': 'Gol x2 Trasferta',
    };
    return mapping[name] || name;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Event Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Seleziona Evento</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {events.map((event, idx) => (
            <button
              key={event.idevents}
              onClick={() => setSelectedEvent(idx)}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                selectedEvent === idx
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-sm font-semibold text-gray-900 truncate">
                {event.team1} vs {event.team2}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {event.matchScore} - {event.matchTime}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {event.oddsCount} quote disponibili
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Odds Display */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Header */}
        <div className="mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {currentEvent?.team1} vs {currentEvent?.team2}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {currentEvent?.matchScore} • {currentEvent?.matchPeriod} • {currentEvent?.matchTime}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {currentEvent?.championshipName} • {enabledOdds.length} quote abilitate
          </p>
        </div>

        {/* Grouped Odds */}
        <div className="space-y-6">
          {Object.entries(groupedOdds).map(([group, odds]) => (
            <div key={group}>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">
                {formatOddName(group)}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {odds.map(odd => (
                  <button
                    key={odd.id}
                    className="p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 transition-all group cursor-pointer"
                  >
                    <div className="text-xs font-medium text-gray-600 group-hover:text-blue-600 mb-2 truncate">
                      {formatOddName(odd.oddName)}
                    </div>
                    <div className="text-2xl font-bold text-gray-900 group-hover:text-blue-600">
                      {odd.rank.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Rank: {odd.prank.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-400 mt-2 group-hover:text-blue-500">
                      Aggiornato: {new Date(odd.lastUpdate).toLocaleTimeString('it-IT')}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <TrendingUp className="w-4 h-4" />
            <span>Ultimo aggiornamento: {new Date().toLocaleTimeString('it-IT')}</span>
          </div>
          <button
            onClick={fetchLiveOdds}
            className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Aggiorna Quote
          </button>
        </div>
      </div>
    </div>
  );
}
