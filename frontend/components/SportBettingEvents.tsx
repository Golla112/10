'use client';
import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Trophy, Users, Filter, RefreshCw } from 'lucide-react';

// ── Interfacce ───────────────────────────────────────────────────────────────────

interface SportBettingEvent {
  id: string;
  home: { name: string };
  away: { name: string };
  time?: number;
  sport_id?: string;
  sport_category?: string;
  league?: { name: string };
  live?: boolean;
  score?: { home: number | null; away: number | null };
  completed?: boolean;
  minute?: number | null;
}

interface SportBettingEventsProps {
  sport?: string;
  type?: 'prematch' | 'live' | 'all';
  limit?: number;
  className?: string;
  onEventSelect?: (event: SportBettingEvent) => void;
}

interface EventsResponse {
  success: boolean;
  data: SportBettingEvent[];
  sport: string;
  type: string;
  count: number;
}

// ── Componente Principale ─────────────────────────────────────────────────────────

export default function SportBettingEvents({ 
  sport = 'soccer', 
  type = 'prematch', 
  limit = 20,
  className = '',
  onEventSelect
}: SportBettingEventsProps) {
  const [events, setEvents] = useState<SportBettingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState(sport);
  const [selectedType, setSelectedType] = useState<'prematch' | 'live' | 'all'>(type);
  const [refreshing, setRefreshing] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

  const [sports, setSports] = useState<Array<{ key: string; label: string; icon?: string }>>([
    { key: 'soccer', label: 'Calcio', icon: '⚽' },
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadSports() {
      try {
        const r = await fetch(`${API_BASE}/api/sport-betting/sports`);
        if (!r.ok) return;
        const data = (await r.json()) as { success?: boolean; data?: Array<{ id: string; name: string; active?: boolean }> };
        if (cancelled) return;
        const list = (data.data ?? [])
          .filter((s) => s.active !== false)
          .map((s) => ({ key: s.id, label: s.name }));
        if (list.length > 0) setSports(list);
      } catch {
        // ignore
      }
    }

    loadSports();
    return () => {
      cancelled = true;
    };
  }, [API_BASE]);

  // Fetch events function
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setRefreshing(false);
      
      let url = `${API_BASE}/api/sport-betting/events/${selectedType}/${selectedSport}`;
      if (limit) {
        url += `?limit=${limit}`;
      }

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: EventsResponse = await response.json();
      
      if (data.success) {
        setEvents(data.data);
        setError(null);
      } else {
        throw new Error('Failed to fetch events');
      }
    } catch (err) {
      console.error('Error fetching SportBetting events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [API_BASE, selectedType, selectedSport, limit]);

  // Fetch events
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Auto-refresh per eventi live
  useEffect(() => {
    const intervalMs = selectedType === 'prematch' ? 120000 : 30000;
    const interval = setInterval(fetchEvents, intervalMs);
    return () => clearInterval(interval);
  }, [fetchEvents, selectedType]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchEvents();
  };

  // Formatta data
  const formatDateTime = (timestamp?: number): string => {
    if (!timestamp) return 'N/D';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 24) {
      return date.toLocaleTimeString('it-IT', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return date.toLocaleDateString('it-IT', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  // Filtra eventi per tipo
  const filteredEvents = events.filter(event => {
    if (selectedType === 'all') return true;
    if (selectedType === 'live') return event.live;
    if (selectedType === 'prematch') return !event.live;
    return true;
  });

  // Componente card evento
  const EventCard = ({ event }: { event: SportBettingEvent }) => {
    const isLive = event.live;
    const hasScore = event.score && event.score.home !== null && event.score.away !== null;

    return (
      <div 
        className={`bg-white border rounded-lg p-4 hover:shadow-md transition-all duration-200 cursor-pointer ${
          isLive ? 'border-red-200 bg-red-50' : 'border-gray-200'
        }`}
        onClick={() => onEventSelect?.(event)}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="px-2 py-1 bg-red-600 text-white text-xs rounded-full animate-pulse">
                LIVE
              </span>
            )}
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              {event.league?.name || 'Generic League'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>{formatDateTime(event.time)}</span>
          </div>
        </div>

        {/* Teams */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900">{event.home.name}</span>
            {hasScore && (
              <span className="text-lg font-bold text-gray-900">
                {event.score?.home}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900">{event.away.name}</span>
            {hasScore && (
              <span className="text-lg font-bold text-gray-900">
                {event.score?.away}
              </span>
            )}
          </div>
        </div>

        {/* Live info */}
        {isLive && event.minute && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="font-medium">{event.minute}&apos;</span>
            {hasScore && (
              <span>Risultato: {event.score?.home} - {event.score?.away}</span>
            )}
          </div>
        )}

        {/* Sport icon */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            {sports.find(s => s.key === event.sport_id)?.icon || '🏆'}{' '}
            {sports.find(s => s.key === event.sport_id)?.label || event.sport_category}
          </span>
          <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
            Visualizza Quote →
          </button>
        </div>
      </div>
    );
  };

  // Loading state
  if (loading && events.length === 0) {
    return (
      <div className={`bg-white rounded-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Eventi SportBetting
          </h3>
          
          <div className="flex items-center gap-3">
            {/* Sport selector */}
            <select
              value={selectedSport}
              onChange={(e) => setSelectedSport(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {sports.map(s => (
                <option key={s.key} value={s.key}>
                  {s.icon} {s.label}
                </option>
              ))}
            </select>

            {/* Type selector */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="prematch">Prematch</option>
              <option value="live">Live</option>
              <option value="all">Tutti</option>
            </select>

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-600 hover:text-blue-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <div className="flex items-center justify-between">
            <span className="text-red-600 text-sm">{error}</span>
            <button
              onClick={fetchEvents}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
            >
              Riprova
            </button>
          </div>
        </div>
      )}

      {/* Events grid */}
      <div className="p-4">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">
              Nessun evento {selectedType === 'live' ? 'live' : 'disponibile'} 
              {selectedSport !== 'all' && ` per ${sports.find(s => s.key === selectedSport)?.label}`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredEvents.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {filteredEvents.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              {filteredEvents.length} eventi trovati
              {selectedType === 'live' && ' • Aggiornamento automatico ogni 30 secondi'}
            </span>
            <button
              onClick={fetchEvents}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Aggiorna
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componenti Specializzati ───────────────────────────────────────────────────────

export function SportBettingLiveEvents({ 
  sport = 'soccer', 
  limit = 20,
  className = '',
  onEventSelect 
}: Omit<SportBettingEventsProps, 'type'>) {
  return (
    <SportBettingEvents 
      sport={sport} 
      type="live" 
      limit={limit}
      className={className}
      onEventSelect={onEventSelect}
    />
  );
}

export function SportBettingPrematchEvents({ 
  sport = 'soccer', 
  limit = 20,
  className = '',
  onEventSelect 
}: Omit<SportBettingEventsProps, 'type'>) {
  return (
    <SportBettingEvents 
      sport={sport} 
      type="prematch" 
      limit={limit}
      className={className}
      onEventSelect={onEventSelect}
    />
  );
}

export function SportBettingAllEvents({ 
  sport = 'soccer', 
  limit = 20,
  className = '',
  onEventSelect 
}: Omit<SportBettingEventsProps, 'type'>) {
  return (
    <SportBettingEvents 
      sport={sport} 
      type="all" 
      limit={limit}
      className={className}
      onEventSelect={onEventSelect}
    />
  );
}
