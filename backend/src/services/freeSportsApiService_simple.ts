// Free Sports API Service - Versione Semplice e Funzionante
// Solo sport europei, senza baseball/NFL

import axios from 'axios';
import WebSocket from 'ws';

// ── Configurazione ─────────────────────────────────────────────────

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';
const THESPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/3';
const WS_PORT = 4002;

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
    this.wsServer = new WebSocket.Server({ port: WS_PORT });
    
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
    // Live events sync - ogni 10 secondi
    setInterval(() => {
      this.updateLiveEvents();
    }, 10000);

    // Prematch events sync - ogni 15 minuti
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

  private async getFootballEvents(): Promise<FreeSportsEvent[]> {
    try {
      const response = await axios.get(`${API_FOOTBALL_BASE}/fixtures`, {
        params: {
          season: new Date().getFullYear(),
          league: 39
        }
      });

      return response.data.response?.map((match: any) => ({
        id: match.fixture.id.toString(),
        sport: 'soccer',
        league: match.league.name,
        homeTeam: match.teams.home.name,
        awayTeam: match.teams.away.name,
        startTime: new Date(match.fixture.date).getTime(),
        status: match.fixture.status.short === 'LIVE' ? 'live' : 
                match.fixture.status.short === 'FT' ? 'completed' : 'prematch',
        score: match.goals ? {
          home: match.goals.home || 0,
          away: match.goals.away || 0
        } : undefined,
        minute: typeof match.fixture.status.elapsed === 'number' ? match.fixture.status.elapsed : undefined
      })) || [];
    } catch (error) {
      console.error('Error fetching football events:', error);
      return [];
    }
  }

  private async getTheSportsDBEvents(): Promise<FreeSportsEvent[]> {
    try {
      const response = await axios.get(`${THESPORTSDB_BASE}/eventsseason.php?id=4328&s=2023-2024`);
      
      return response.data.events?.map((event: any) => ({
        id: event.idEvent,
        sport: 'soccer',
        league: 'Premier League',
        homeTeam: event.strHomeTeam,
        awayTeam: event.strAwayTeam,
        startTime: new Date(event.dateEvent).getTime(),
        status: event.strStatus === 'Match Finished' ? 'completed' : 'prematch',
        score: event.intHomeScore && event.intAwayScore ? {
          home: parseInt(event.intHomeScore),
          away: parseInt(event.intAwayScore)
        } : undefined
      })).filter((event: FreeSportsEvent) => event.homeTeam && event.awayTeam) || [];
    } catch (error) {
      console.error('Error fetching TheSportsDB events:', error);
      return [];
    }
  }

  private generateSimulatedOdds(homeTeam: string, awayTeam: string): any {
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
      const footballEvents = await this.getFootballEvents();
      const filteredEvents = footballEvents.filter(event => 
        event.status === 'live' && 
        !event.league.toLowerCase().includes('american') &&
        !event.league.toLowerCase().includes('mlb') &&
        !event.league.toLowerCase().includes('nfl') &&
        !event.league.toLowerCase().includes('nba')
      );
      
      filteredEvents.forEach(event => {
        event.odds = this.generateSimulatedOdds(event.homeTeam, event.awayTeam);
        this.liveEvents.set(event.id, event);
      });
      
      this.broadcast({
        type: 'live_events_update',
        events: filteredEvents,
        count: filteredEvents.length
      });
    } catch (error) {
      console.error('Error updating live events:', error);
    }
  }

  private async updatePrematchEvents() {
    try {
      const events = await this.getTheSportsDBEvents();
      const prematchEvents = events.filter(event => 
        event.status === 'prematch' && 
        !event.league.toLowerCase().includes('american') &&
        !event.league.toLowerCase().includes('mlb') &&
        !event.league.toLowerCase().includes('nfl') &&
        !event.league.toLowerCase().includes('nba')
      );
      
      prematchEvents.forEach(event => {
        event.odds = this.generateSimulatedOdds(event.homeTeam, event.awayTeam);
        this.liveEvents.set(event.id, event);
      });
      
      this.broadcast({
        type: 'prematch_events_update',
        events: prematchEvents,
        count: prematchEvents.length
      });
    } catch (error) {
      console.error('Error updating prematch events:', error);
    }
  }

  async getAllEvents(): Promise<FreeSportsEvent[]> {
    try {
      const footballEvents = await this.getFootballEvents();
      const theSportsDBEvents = await this.getTheSportsDBEvents();
      
      const allEvents = [...footballEvents, ...theSportsDBEvents];
      const uniqueEvents = allEvents.filter((event, index, self) =>
        index === self.findIndex(e => e.id === event.id)
      );
      
      const filteredEvents = uniqueEvents.filter(event => 
        !event.league.toLowerCase().includes('american') &&
        !event.league.toLowerCase().includes('mlb') &&
        !event.league.toLowerCase().includes('nfl') &&
        !event.league.toLowerCase().includes('nba')
      );
      
      filteredEvents.forEach(event => {
        if (!event.odds) {
          event.odds = this.generateSimulatedOdds(event.homeTeam, event.awayTeam);
        }
      });
      
      return filteredEvents;
    } catch (error) {
      console.error('Error fetching all events:', error);
      return [];
    }
  }

  async getEventsBySport(sport: string): Promise<FreeSportsEvent[]> {
    const allEvents = await this.getAllEvents();
    return allEvents.filter(event => event.sport === sport);
  }

  async getLiveEvents(): Promise<FreeSportsEvent[]> {
    const allEvents = await this.getAllEvents();
    return allEvents.filter(event => event.status === 'live');
  }

  async getPrematchEvents(): Promise<FreeSportsEvent[]> {
    const allEvents = await this.getAllEvents();
    return allEvents.filter(event => event.status === 'prematch');
  }

  async getEventOdds(eventId: string): Promise<any | null> {
    const allEvents = await this.getAllEvents();
    const event = allEvents.find(e => e.id === eventId);
    return event?.odds || null;
  }

  getStats() {
    return {
      totalEvents: this.liveEvents.size,
      liveEvents: Array.from(this.liveEvents.values()).filter(e => e.status === 'live').length,
      connectedClients: this.clients.size,
      websocketPort: WS_PORT,
      uptime: process.uptime()
    };
  }
}

// ── Esportazione ───────────────────────────────────────────────────────────────

const freeSportsService = new FreeSportsApiService();

const getFreeSportsEvents = async (sport?: string) => {
  return sport ? freeSportsService.getEventsBySport(sport) : freeSportsService.getAllEvents();
};

const getFreeSportsLiveEvents = async () => {
  return freeSportsService.getLiveEvents();
};

const getFreeSportsOdds = async (eventId: string) => {
  return freeSportsService.getEventOdds(eventId);
};

export { freeSportsService, getFreeSportsEvents, getFreeSportsLiveEvents, getFreeSportsOdds };
export default freeSportsService;
