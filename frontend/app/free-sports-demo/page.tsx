'use client';
import { useState, useEffect } from 'react';
import { Calendar, Wifi, TrendingUp, Zap, Info, AlertCircle } from 'lucide-react';

interface FreeSportsEvent {
  id: string;
  sport: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTime: number;
  status: 'prematch' | 'live' | 'completed';
  score?: {
    home: number;
    away: number;
  };
  minute?: number;
  odds?: {
    h2h?: {
      home: number;
      draw: number;
      away: number;
    };
    overUnder?: {
      over25: number;
      under25: number;
    };
  };
}

export default function FreeSportsDemo() {
  const [events, setEvents] = useState<FreeSportsEvent[]>([]);
  const [liveEvents, setLiveEvents] = useState<FreeSportsEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<FreeSportsEvent | null>(null);
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      setWsStatus('connecting');
      const ws = new WebSocket('ws://localhost:4001');

      ws.onopen = () => {
        setWsStatus('connected');
        console.log('Connected to Free Sports WebSocket');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'live_update') {
          setLiveEvents(data.events);
        }
        if (data.type === 'initial_events') {
          setLiveEvents(data.events);
        }
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsStatus('disconnected');
      };

      return ws;
    };

    const ws = connectWebSocket();
    return () => ws.close();
  }, []);

  // Fetch initial data
  useEffect(() => {
    fetchEvents();
    fetchStats();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/free-sports/events');
      const data = await response.json();
      if (data.success) {
        setEvents(data.data);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/free-sports/stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('it-IT');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'prematch': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'live': return 'LIVE';
      case 'completed': return 'TERMINATO';
      case 'prematch': return 'PREMATCH';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-green-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Free Sports API</h1>
                <p className="text-sm text-gray-500">API gratuita con WebSocket - Nessuna API key richiesta</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 text-xs rounded-full font-medium ${
                wsStatus === 'connected' ? 'bg-green-100 text-green-800' :
                wsStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                <Wifi className="w-3 h-3 inline mr-1" />
                WS: {wsStatus === 'connected' ? 'Connesso' : wsStatus === 'connecting' ? 'Connessione...' : 'Disconnesso'}
              </div>
              <div className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                100% Gratuito
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-green-50 border border-green-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-900 mb-1">API Sport Gratuita con WebSocket</h3>
              <p className="text-sm text-green-700">
                Questa soluzione utilizza API gratuite (API-Football, TheSportsDB) con quote simulate generate da algoritmo.
                Include WebSocket per aggiornamenti real-time e non richiede alcuna API key.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar - Stats */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Statistiche Live
              </h3>
              
              {stats ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-500">Eventi Totali</div>
                    <div className="text-2xl font-bold text-gray-900">{stats.totalEvents}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Eventi Live</div>
                    <div className="text-2xl font-bold text-red-600">{stats.liveEvents}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Client Connessi</div>
                    <div className="text-2xl font-bold text-blue-600">{stats.connectedClients}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">WebSocket Port</div>
                    <div className="text-lg font-mono text-gray-900">:{stats.websocketPort}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Uptime</div>
                    <div className="text-lg font-mono text-gray-900">{Math.floor(stats.uptime / 60)}m</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
                  Caricamento statistiche...
                </div>
              )}
            </div>

            {/* Sources Info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Fonti Dati</h3>
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="font-medium text-blue-900">API-Football</div>
                  <div className="text-sm text-blue-700">100 richieste/giorno • Calcio</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="font-medium text-green-900">TheSportsDB</div>
                  <div className="text-sm text-green-700">Illimitate • Multi-sport</div>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <div className="font-medium text-yellow-900">Quote Simulate</div>
                  <div className="text-sm text-yellow-700">Algoritmo euristico</div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Live Events */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  Eventi Live ({liveEvents.length})
                </h3>
              </div>
              
              <div className="p-4">
                {liveEvents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p>Nessun evento live in questo momento</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {liveEvents.map((event) => (
                      <div 
                        key={event.id} 
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(event.status)}`}>
                            {getStatusText(event.status)}
                            {event.minute && ` ${event.minute}'`}
                          </span>
                          <span className="text-sm text-gray-500">{event.league}</span>
                        </div>
                        
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{event.homeTeam}</div>
                            <div className="font-medium text-gray-900">{event.awayTeam}</div>
                          </div>
                          {event.score && (
                            <div className="text-2xl font-bold text-gray-900">
                              {event.score.home} - {event.score.away}
                            </div>
                          )}
                        </div>

                        {event.odds && (
                          <div className="grid grid-cols-5 gap-2 text-center">
                            <div className="bg-gray-50 rounded p-2">
                              <div className="text-xs text-gray-500">1</div>
                              <div className="font-bold text-sm">{event.odds.h2h?.home.toFixed(2)}</div>
                            </div>
                            <div className="bg-gray-50 rounded p-2">
                              <div className="text-xs text-gray-500">X</div>
                              <div className="font-bold text-sm">{event.odds.h2h?.draw.toFixed(2)}</div>
                            </div>
                            <div className="bg-gray-50 rounded p-2">
                              <div className="text-xs text-gray-500">2</div>
                              <div className="font-bold text-sm">{event.odds.h2h?.away.toFixed(2)}</div>
                            </div>
                            <div className="bg-blue-50 rounded p-2">
                              <div className="text-xs text-blue-600">Ov 2.5</div>
                              <div className="font-bold text-sm text-blue-900">{event.odds.overUnder?.over25.toFixed(2)}</div>
                            </div>
                            <div className="bg-blue-50 rounded p-2">
                              <div className="text-xs text-blue-600">Un 2.5</div>
                              <div className="font-bold text-sm text-blue-900">{event.odds.overUnder?.under25.toFixed(2)}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* All Events */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Tutti gli Eventi ({events.length})</h3>
              </div>
              
              <div className="p-4">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
                    Caricamento eventi...
                  </div>
                ) : (
                  <div className="space-y-3">
                    {events.slice(0, 10).map((event) => (
                      <div 
                        key={event.id} 
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">
                              {event.homeTeam} vs {event.awayTeam}
                            </div>
                            <div className="text-sm text-gray-500">
                              {event.league} • {formatDateTime(event.startTime)}
                            </div>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(event.status)}`}>
                            {getStatusText(event.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                    {events.length > 10 && (
                      <div className="text-center py-2 text-sm text-gray-500">
                        E altri {events.length - 10} eventi...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Selected Event Modal */}
        {selectedEvent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedEvent.homeTeam} vs {selectedEvent.awayTeam}
                  </h3>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Sport:</span>
                      <span className="ml-2 font-medium">{selectedEvent.sport}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">League:</span>
                      <span className="ml-2 font-medium">{selectedEvent.league}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getStatusColor(selectedEvent.status)}`}>
                        {getStatusText(selectedEvent.status)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Start Time:</span>
                      <span className="ml-2 font-medium">{formatDateTime(selectedEvent.startTime)}</span>
                    </div>
                  </div>

                  {selectedEvent.score && (
                    <div className="text-center py-4 bg-gray-50 rounded-lg">
                      <div className="text-3xl font-bold text-gray-900">
                        {selectedEvent.score.home} - {selectedEvent.score.away}
                      </div>
                      {selectedEvent.minute && (
                        <div className="text-sm text-gray-500 mt-1">{selectedEvent.minute}&apos;</div>
                      )}
                    </div>
                  )}

                  {selectedEvent.odds && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Quote (Simulate)</h4>
                      <div className="grid grid-cols-5 gap-2 text-center">
                        <div className="bg-gray-50 rounded p-3">
                          <div className="text-xs text-gray-500">1</div>
                          <div className="font-bold">{selectedEvent.odds.h2h?.home.toFixed(2)}</div>
                        </div>
                        <div className="bg-gray-50 rounded p-3">
                          <div className="text-xs text-gray-500">X</div>
                          <div className="font-bold">{selectedEvent.odds.h2h?.draw.toFixed(2)}</div>
                        </div>
                        <div className="bg-gray-50 rounded p-3">
                          <div className="text-xs text-gray-500">2</div>
                          <div className="font-bold">{selectedEvent.odds.h2h?.away.toFixed(2)}</div>
                        </div>
                        <div className="bg-blue-50 rounded p-3">
                          <div className="text-xs text-blue-600">Ov 2.5</div>
                          <div className="font-bold text-blue-900">{selectedEvent.odds.overUnder?.over25.toFixed(2)}</div>
                        </div>
                        <div className="bg-blue-50 rounded p-3">
                          <div className="text-xs text-blue-600">Un 2.5</div>
                          <div className="font-bold text-blue-900">{selectedEvent.odds.overUnder?.under25.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                      <div className="text-sm text-yellow-700">
                        <strong>Attenzione:</strong> Queste quote sono simulate generate da algoritmo 
                        e non rappresentano quote reali da bookmaker. Usare solo a scopo dimostrativo.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
