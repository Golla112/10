// Free Sports API Service - Versione Semplificata e Funzionante
// Solo sport europei, senza baseball/NFL

import axios from 'axios';
import WebSocket from 'ws';

// ── Interfacce ───────────────────────────────────────────────────────

export interface FreeSportsEvent {
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

export interface FreeSportsOdds {
  h2h?: {
    home: number;
    draw: number;
    away: number;
  };
  overUnder?: {
    over25: number;
    under25: number;
  };
}

// ── Service Class ───────────────────────────────────────────────────────

class FreeSportsApiService {
  private wsServer: WebSocket.Server | null = null;
  private liveEvents: Map<string, FreeSportsEvent> = new Map();
  private clients: Set<WebSocket> = new Set();

  constructor() {
    this.initWebSocketServer();
    this.startDataSync();
  }

  private initWebSocketServer() {
    this.wsServer = new WebSocket.Server({ port: 4002 });
    
    this.wsServer.on('connection', (ws) => {
      console.log('Client connected to Free Sports WebSocket');
      this.clients.add(ws);
      
      ws.send(JSON.stringify({
        type: 'initial_events',
        events: Array.from(this.liveEvents.values())
      }));
      
      ws.on('close', () => {
        this.clients.delete(ws);
      });
    });
  }

  private startDataSync() {
    setInterval(() => {
      this.updateLiveEvents();
    }, 10000);

    setInterval(() => {
      this.updatePrematchEvents();
    }, 900000);
  }

  private broadcast(message: any) {
    const data = JSON.stringify({
      ...message,
      timestamp: Date.now(),
      clientCount: this.clients.size
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  private generateSimulatedOdds(homeTeam: string, awayTeam: string): FreeSportsOdds {
    const nameHash = homeTeam.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const seed = nameHash % 100;
    
    const strongTeams = [
      'Manchester City', 'Real Madrid', 'Barcelona', 'Bayern Munich',
      'Liverpool', 'Chelsea', 'Arsenal', 'PSG', 'Juventus', 'Inter'
    ];
    
    const homeStrength = strongTeams.some(team => homeTeam.toLowerCase().includes(team.toLowerCase())) ? 85 + (seed % 10) : 50 + (seed % 30);
    const awayStrength = strongTeams.some(team => awayTeam.toLowerCase().includes(team.toLowerCase())) ? 85 + (seed % 10) : 50 + (seed % 30);
    
    const totalStrength = homeStrength + awayStrength;
    const homeProb = homeStrength / totalStrength;
    const drawProb = 0.25;
    const awayProb = awayStrength / totalStrength;
    
    const homeOdds = Math.max(1.1, Math.round((1 / homeProb) * 100) / 100);
    const drawOdds = Math.max(2.5, Math.round((1 / drawProb) * 100) / 100);
    const awayOdds = Math.max(1.1, Math.round((1 / awayProb) * 100) / 100);
    
    return {
      h2h: {
        home: homeOdds,
        draw: drawOdds,
        away: awayOdds
      },
      overUnder: {
        over25: 1.85,
        under25: 1.95
      }
    };
  }

  private async updateLiveEvents() {
    try {
      const mockLiveEvents: FreeSportsEvent[] = [
        {
          id: 'live-1',
          sport: 'soccer',
          league: 'Champions League',
          homeTeam: 'Real Madrid',
          awayTeam: 'Bayern Munich',
          startTime: Date.now() - 7200000,
          status: 'live',
          score: { home: 1, away: 0 },
          minute: 45,
          odds: this.generateSimulatedOdds('Real Madrid', 'Bayern Munich')
        }
      ];

      mockLiveEvents.forEach(event => {
        this.liveEvents.set(event.id, event);
      });
      
      this.broadcast({
        type: 'live_events_update',
        events: mockLiveEvents,
        count: mockLiveEvents.length
      });
    } catch (error) {
      console.error('Error updating live events:', error);
    }
  }

  private async updatePrematchEvents() {
    try {
      const mockPrematchEvents: FreeSportsEvent[] = [
        {
          id: 'prematch-1',
          sport: 'soccer',
          league: 'Serie A',
          homeTeam: 'Milan',
          awayTeam: 'Inter',
          startTime: Date.now() + 86400000,
          status: 'prematch',
          odds: this.generateSimulatedOdds('Milan', 'Inter')
        },
        {
          id: 'prematch-2',
          sport: 'basketball',
          league: 'EuroLeague',
          homeTeam: 'Olimpia Milano',
          awayTeam: 'Virtus Bologna',
          startTime: Date.now() + 7200000,
          status: 'prematch',
          odds: this.generateSimulatedOdds('Olimpia Milano', 'Virtus Bologna')
        }
      ];

      mockPrematchEvents.forEach(event => {
        this.liveEvents.set(event.id, event);
      });
      
      this.broadcast({
        type: 'prematch_events_update',
        events: mockPrematchEvents,
        count: mockPrematchEvents.length
      });
    } catch (error) {
      console.error('Error updating prematch events:', error);
    }
  }

  async getAllEvents(): Promise<FreeSportsEvent[]> {
    try {
      const allEvents = Array.from(this.liveEvents.values());
      return allEvents;
    } catch (error) {
      console.error('Error fetching all events:', error);
      return [];
    }
  }

  async getEventsBySport(sport: string): Promise<FreeSportsEvent[]> {
    try {
      const allEvents = await this.getAllEvents();
      return allEvents.filter(event => event.sport === sport);
    } catch (error) {
      console.error('Error fetching events by sport:', error);
      return [];
    }
  }

  async getLiveEvents(): Promise<FreeSportsEvent[]> {
    try {
      const allEvents = await this.getAllEvents();
      return allEvents.filter(event => event.status === 'live');
    } catch (error) {
      console.error('Error fetching live events:', error);
      return [];
    }
  }

  async getPrematchEvents(): Promise<FreeSportsEvent[]> {
    try {
      const allEvents = await this.getAllEvents();
      return allEvents.filter(event => event.status === 'prematch');
    } catch (error) {
      console.error('Error fetching prematch events:', error);
      return [];
    }
  }

  async getEventOdds(eventId: string): Promise<FreeSportsOdds | null> {
    try {
      const allEvents = await this.getAllEvents();
      const event = allEvents.find(e => e.id === eventId);
      return event?.odds || null;
    } catch (error) {
      console.error('Error fetching event odds:', error);
      return null;
    }
  }

  getStats() {
    return {
      totalEvents: this.liveEvents.size,
      liveEvents: Array.from(this.liveEvents.values()).filter(e => e.status === 'live').length,
      connectedClients: this.clients.size,
      websocketPort: 4002,
      uptime: process.uptime()
    };
  }
}

// ── Esportazione ───────────────────────────────────────────────────────────────

const freeSportsService = new FreeSportsApiService();

export { freeSportsService };
export default freeSportsService;
