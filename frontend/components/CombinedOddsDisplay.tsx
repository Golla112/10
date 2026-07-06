'use client';
import { useState } from 'react';
import SportBettingOdds, { SportBettingH2H, SportBettingSpreads, SportBettingTotals } from './SportBettingOdds';
import { AlertCircle, TrendingUp, Zap } from 'lucide-react';

// ── Interfacce ───────────────────────────────────────────────────────────────────

interface CombinedOddsDisplayProps {
  eventId: string;
  sport: string;
  existingOdds?: any;
  className?: string;
}

// ── Componenti UI Semplici ─────────────────────────────────────────────────────

const Badge = ({ 
  children, 
  variant = 'outline', 
  className = '' 
}: { 
  children: React.ReactNode; 
  variant?: 'outline' | 'default'; 
  className?: string; 
}) => {
  const baseClasses = 'px-2 py-1 text-xs rounded-full font-medium';
  const variantClasses = variant === 'outline' 
    ? 'border border-gray-300 text-gray-700 bg-white' 
    : 'bg-blue-600 text-white';
  
  return (
    <span className={`${baseClasses} ${variantClasses} ${className}`}>
      {children}
    </span>
  );
};

const Tabs = ({ 
  children, 
  value, 
  onValueChange, 
  className = '' 
}: { 
  children: React.ReactNode; 
  value: string; 
  onValueChange: (val: string) => void; 
  className?: string; 
}) => {
  return <div className={className}>{children}</div>;
};

const TabsList = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={`flex gap-1 p-1 bg-gray-100 rounded-lg ${className}`}>
      {children}
    </div>
  );
};

const TabsTrigger = ({ 
  children, 
  value, 
  isActive, 
  onClick 
}: { 
  children: React.ReactNode; 
  value: string; 
  isActive: boolean; 
  onClick: () => void; 
}) => {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
        isActive 
          ? 'bg-white text-blue-600 shadow-sm' 
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  );
};

const TabsContent = ({ 
  children, 
  value, 
  isActive 
}: { 
  children: React.ReactNode; 
  value: string; 
  isActive: boolean; 
}) => {
  return isActive ? <div>{children}</div> : null;
};

// ── Componente Principale ─────────────────────────────────────────────────────────

export default function CombinedOddsDisplay({ 
  eventId, 
  sport, 
  existingOdds,
  className = '' 
}: CombinedOddsDisplayProps) {
  const [activeTab, setActiveTab] = useState('comparison');

  // Componente per confronto quote
  const OddsComparison = () => (
    <div className="space-y-6">
      {/* Intestazione confronto */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-semibold text-blue-900">Confronto Quote</h3>
            <p className="text-sm text-blue-700">
              Confronta le quote da The-Odds-API e Sport-Betting-API per trovare la migliore offerta
            </p>
          </div>
        </div>
      </div>

      {/* Tabella confronto 1X2 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 className="font-medium text-gray-900">Quote 1X2</h4>
        </div>
        
        <div className="divide-y divide-gray-200">
          {/* The-Odds-API */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="text-xs">
                The-Odds-API
              </Badge>
              <span className="text-xs text-gray-500">Quote standard</span>
            </div>
            
            {existingOdds?.bookmakers?.[0]?.markets?.[0]?.outcomes ? (
              <div className="grid grid-cols-3 gap-3">
                {existingOdds.bookmakers[0].markets[0].outcomes.map((outcome: any, index: number) => (
                  <div key={index} className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-700 mb-1">
                      {outcome.name}
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {outcome.price?.toFixed(2) || 'N/D'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">
                Nessuna quota disponibile
              </div>
            )}
          </div>

          {/* Sport-Betting-API */}
          <div className="p-4 bg-blue-50">
            <div className="flex items-center gap-2 mb-3">
              <Badge className="text-xs bg-blue-600">
                Sport-Betting-API
              </Badge>
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-blue-600" />
                <span className="text-xs text-blue-600">Quote estese</span>
              </div>
            </div>
            
            <SportBettingH2H eventId={eventId} sport={sport} className="bg-transparent border-0 p-0" />
          </div>
        </div>
      </div>

      {/* Altri mercati */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SportBettingSpreads eventId={eventId} sport={sport} />
        <SportBettingTotals eventId={eventId} sport={sport} />
      </div>
    </div>
  );

  // Componente per solo Sport-Betting
  const SportBettingOnly = () => (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-green-600" />
          <div>
            <h3 className="font-semibold text-green-900">Sport-Betting-API Completa</h3>
            <p className="text-sm text-green-700">
              Tutti i mercati disponibili da Sport-Betting-API
            </p>
          </div>
        </div>
      </div>
      
      <SportBettingOdds 
        eventId={eventId} 
        sport={sport} 
        markets={['h2h', 'spreads', 'totals', 'btts', 'double_chance']} 
      />
    </div>
  );

  // Componente per solo The-Odds-API
  const ExistingOnly = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-gray-600" />
          <div>
            <h3 className="font-semibold text-gray-900">Quote Standard</h3>
            <p className="text-sm text-gray-700">
              Quote da The-Odds-API (configurazione esistente)
            </p>
          </div>
        </div>
      </div>
      
      {existingOdds ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <pre className="text-xs text-gray-600 overflow-x-auto">
            {JSON.stringify(existingOdds, null, 2)}
          </pre>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          Nessuna quota disponibile
        </div>
      )}
    </div>
  );

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Quote Completa</h3>
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger 
                value="comparison" 
                isActive={activeTab === 'comparison'}
                onClick={() => setActiveTab('comparison')}
              >
                Confronto
              </TabsTrigger>
              <TabsTrigger 
                value="sportbetting" 
                isActive={activeTab === 'sportbetting'}
                onClick={() => setActiveTab('sportbetting')}
              >
 Sport-Betting
              </TabsTrigger>
              <TabsTrigger 
                value="existing" 
                isActive={activeTab === 'existing'}
                onClick={() => setActiveTab('existing')}
              >
                Standard
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <TabsContent value="comparison" isActive={activeTab === 'comparison'}>
            <OddsComparison />
          </TabsContent>
          
          <TabsContent value="sportbetting" isActive={activeTab === 'sportbetting'}>
            <SportBettingOnly />
          </TabsContent>
          
          <TabsContent value="existing" isActive={activeTab === 'existing'}>
            <ExistingOnly />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ── Componenti Specializzati ───────────────────────────────────────────────────────

export function QuickOddsComparison({ 
  eventId, 
  sport, 
  existingOdds 
}: Pick<CombinedOddsDisplayProps, 'eventId' | 'sport' | 'existingOdds'>) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900">Quote Rapide</h4>
        <Badge variant="outline" className="text-xs">
          Confronto
        </Badge>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {/* The-Odds-API */}
        <div>
          <div className="text-xs font-medium text-gray-600 mb-2">Standard</div>
          {existingOdds?.bookmakers?.[0]?.markets?.[0]?.outcomes?.[0]?.price ? (
            <div className="text-lg font-bold text-gray-900">
              {existingOdds.bookmakers[0].markets[0].outcomes[0].price.toFixed(2)}
            </div>
          ) : (
            <div className="text-sm text-gray-500">N/D</div>
          )}
        </div>
        
        {/* Sport-Betting-API */}
        <div>
          <div className="text-xs font-medium text-blue-600 mb-2">SportBetting</div>
          <SportBettingH2H 
            eventId={eventId} 
            sport={sport} 
            className="bg-transparent border-0 p-0" 
          />
        </div>
      </div>
    </div>
  );
}
