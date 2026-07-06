'use client';
import { useState } from 'react';
import SportBettingEvents, { SportBettingLiveEvents, SportBettingPrematchEvents } from '../../components/SportBettingEvents';
import CombinedOddsDisplay, { QuickOddsComparison } from '../../components/CombinedOddsDisplay';
import { Calendar, Trophy, TrendingUp, Zap, Info } from 'lucide-react';

export default function SportBettingDemo() {
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [activeView, setActiveView] = useState<'events' | 'odds'>('events');
  const [selectedSport, setSelectedSport] = useState('soccer');

  // Evento di esempio per test
  const sampleEvent = {
    id: 'sample-event-123',
    home: { name: 'Milan' },
    away: { name: 'Inter' },
    sport_id: 'soccer',
    sport_category: 'Calcio',
    league: { name: 'Serie A' },
    live: false,
    time: Date.now() + 86400000 // Domani
  };

  const sampleOdds = {
    success: true,
    data: [{
      id: 'bookmaker1',
      name: 'SportBetting Bookmaker',
      markets: [{
        key: 'h2h',
        name: '1X2',
        outcomes: [
          { name: 'Milan', price: 2.10 },
          { name: 'Draw', price: 3.40 },
          { name: 'Inter', price: 3.80 }
        ]
      }]
    }]
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Sport-Betting-API Demo</h1>
                <p className="text-sm text-gray-500">Integrazione completa con BigBet365</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                API Integrata
              </div>
              <div className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                Cache Attiva
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveView('events')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeView === 'events'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              Eventi
            </button>
            <button
              onClick={() => setActiveView('odds')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeView === 'odds'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-2" />
              Quote
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Integrazione Sport-Betting-API</h3>
              <p className="text-sm text-blue-700">
                Questa demo mostra l&apos;integrazione completa tra BigBet365 e Sport-Betting-API. 
                Puoi visualizzare eventi live e prematch, confrontare quote tra multiple API, 
                e accedere a mercati estesi con cache intelligente.
              </p>
            </div>
          </div>
        </div>

        {/* Events View */}
        {activeView === 'events' && (
          <div className="space-y-8">
            {/* Sport Selector */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Seleziona Sport</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: 'soccer', label: 'Calcio', icon: '⚽' },
                  { key: 'basketball', label: 'Basket', icon: '🏀' },
                  { key: 'tennis', label: 'Tennis', icon: '🎾' },
                  { key: 'american_football', label: 'Football', icon: '🏈' }
                ].map(sport => (
                  <button
                    key={sport.key}
                    onClick={() => setSelectedSport(sport.key)}
                    className={`p-3 rounded-lg border transition-colors ${
                      selectedSport === sport.key
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{sport.icon}</div>
                    <div className="text-sm font-medium">{sport.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Events */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                Eventi Live - {selectedSport === 'soccer' ? 'Calcio' : selectedSport}
              </h3>
              <SportBettingLiveEvents 
                sport={selectedSport}
                limit={10}
                onEventSelect={(event) => {
                  setSelectedEvent(event);
                  setActiveView('odds');
                }}
              />
            </div>

            {/* Prematch Events */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">
                Eventi Prematch - {selectedSport === 'soccer' ? 'Calcio' : selectedSport}
              </h3>
              <SportBettingPrematchEvents 
                sport={selectedSport}
                limit={15}
                onEventSelect={(event) => {
                  setSelectedEvent(event);
                  setActiveView('odds');
                }}
              />
            </div>
          </div>
        )}

        {/* Odds View */}
        {activeView === 'odds' && (
          <div className="space-y-8">
            {/* Event Selector */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Seleziona Evento</h3>
              <div className="flex gap-4">
                <button
                  onClick={() => setSelectedEvent(sampleEvent)}
                  className={`p-4 rounded-lg border transition-colors flex-1 ${
                    selectedEvent?.id === sampleEvent.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">
                    {sampleEvent.home.name} vs {sampleEvent.away.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {sampleEvent.league?.name} • Demo
                  </div>
                </button>
                
                {selectedEvent && selectedEvent.id !== sampleEvent.id && (
                  <button
                    onClick={() => setSelectedEvent(selectedEvent)}
                    className={`p-4 rounded-lg border transition-colors flex-1 ${
                      selectedEvent?.id === selectedEvent.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-900">
                      {selectedEvent.home.name} vs {selectedEvent.away.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {selectedEvent.league?.name} • {selectedEvent.live ? 'LIVE' : 'Prematch'}
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Comparison */}
            {selectedEvent && (
              <QuickOddsComparison 
                eventId={selectedEvent.id}
                sport={selectedEvent.sport_id || 'soccer'}
                existingOdds={sampleOdds}
              />
            )}

            {/* Full Odds Display */}
            {selectedEvent && (
              <CombinedOddsDisplay 
                eventId={selectedEvent.id}
                sport={selectedEvent.sport_id || 'soccer'}
                existingOdds={sampleOdds}
              />
            )}

            {!selectedEvent && (
              <div className="text-center py-12">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun Evento Selezionato</h3>
                <p className="text-gray-500 mb-4">
                  Seleziona un evento dalla tabella Events per visualizzare le quote complete
                </p>
                <button
                  onClick={() => setActiveView('events')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Vedi Eventi
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                Sport-Betting-API
              </h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Quote real-time</li>
                <li>• 200+ mercati</li>
                <li>• Multi-bookmaker</li>
                <li>• Cache intelligente</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Integrazione</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Backend Node.js + TypeScript</li>
                <li>• Frontend Next.js + React</li>
                <li>• Cache Redis</li>
                <li>• WebSocket per live</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Vantaggi</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Confronto quote automatico</li>
                <li>• Performance ottimizzata</li>
                <li>• Backup multi-API</li>
                <li>• UX migliorata</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
