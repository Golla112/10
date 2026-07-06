import axios from 'axios';
import WebSocket from 'ws';

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';
const THESPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/3';
const WS_PORT = 4002;

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
  odds?: FreeSportsOdds;
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
      this.clients.add(ws);

      ws.send(JSON.stringify({
        type: 'initial_events',
        events: Array.from(this.liveEvents.values()),
      }));

      ws.on('close', () => {
        this.clients.delete(ws);
      });
    });
  }

  private startDataSync() {
    setInterval(() => {
      void this.updateLiveEvents();
    }, 10000);

    setInterval(() => {
      void this.updatePrematchEvents();
    }, 900000);
  }

  private broadcast(message: unknown) {
    const data = JSON.stringify({
      ...((typeof message === 'object' && message !== null) ? message : { message }),
      timestamp: Date.now(),
      clientCount: this.clients.size,
    });

    this.clients.forEach((client) => {
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
          league: 39,
        },
      });

      return response.data.response?.map((match: any) => ({
        id: String(match.fixture.id),
        sport: 'soccer',
        league: String(match.league.name),
        homeTeam: String(match.teams.home.name),
        awayTeam: String(match.teams.away.name),
        startTime: new Date(match.fixture.date).getTime(),
        status:
          match.fixture.status.short === 'LIVE'
            ? 'live'
            : match.fixture.status.short === 'FT'
              ? 'completed'
              : 'prematch',
        score: match.goals
          ? {
              home: Number(match.goals.home) || 0,
              away: Number(match.goals.away) || 0,
            }
          : undefined,
        minute: typeof match.fixture.status.elapsed === 'number' ? match.fixture.status.elapsed : undefined,
      })) || [];
    } catch {
      return [];
    }
  }

  private async getTheSportsDBEvents(): Promise<FreeSportsEvent[]> {
    try {
      const response = await axios.get(`${THESPORTSDB_BASE}/eventsseason.php?id=4328&s=2023-2024`);

      return response.data.events
        ?.map((event: any) => ({
          id: String(event.idEvent),
          sport: 'soccer',
          league: 'Premier League',
          homeTeam: String(event.strHomeTeam || ''),
          awayTeam: String(event.strAwayTeam || ''),
          startTime: new Date(event.dateEvent).getTime(),
          status: event.strStatus === 'Match Finished' ? 'completed' : 'prematch',
          score:
            event.intHomeScore && event.intAwayScore
              ? {
                  home: parseInt(event.intHomeScore, 10),
                  away: parseInt(event.intAwayScore, 10),
                }
              : undefined,
        }))
        .filter((event: FreeSportsEvent) => event.homeTeam && event.awayTeam) || [];
    } catch {
      return [];
    }
  }

  private generateSimulatedOdds(homeTeam: string, awayTeam: string): FreeSportsOdds {
    const nameHash = homeTeam.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const seed = nameHash % 100;

    const strongTeams = [
      'Manchester City',
      'Real Madrid',
      'Barcelona',
      'Bayern Munich',
      'Liverpool',
      'Chelsea',
      'Arsenal',
      'PSG',
      'Juventus',
      'Inter',
    ];

    const homeStrength = strongTeams.some((team) => homeTeam.toLowerCase().includes(team.toLowerCase()))
      ? 85 + (seed % 10)
      : 50 + (seed % 30);
    const awayStrength = strongTeams.some((team) => awayTeam.toLowerCase().includes(team.toLowerCase()))
      ? 85 + (seed % 10)
      : 50 + (seed % 30);

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
        away: awayOdds,
      },
      overUnder: {
        over25: 1.85,
        under25: 1.95,
      },
    };
  }

  private async updateLiveEvents() {
    try {
      const footballEvents = await this.getFootballEvents();
      const filteredEvents = footballEvents.filter(
        (event) =>
          event.status === 'live' &&
          !event.league.toLowerCase().includes('american') &&
          !event.league.toLowerCase().includes('mlb') &&
          !event.league.toLowerCase().includes('nfl') &&
          !event.league.toLowerCase().includes('nba'),
      );

      filteredEvents.forEach((event) => {
        event.odds = this.generateSimulatedOdds(event.homeTeam, event.awayTeam);
        this.liveEvents.set(event.id, event);
      });

      this.broadcast({
        type: 'live_events_update',
        events: filteredEvents,
        count: filteredEvents.length,
      });
    } catch {
      // ignore refresh errors
    }
  }

  private async updatePrematchEvents() {
    try {
      const events = await this.getTheSportsDBEvents();
      const prematchEvents = events.filter(
        (event) =>
          event.status === 'prematch' &&
          !event.league.toLowerCase().includes('american') &&
          !event.league.toLowerCase().includes('mlb') &&
          !event.league.toLowerCase().includes('nfl') &&
          !event.league.toLowerCase().includes('nba'),
      );

      prematchEvents.forEach((event) => {
        event.odds = this.generateSimulatedOdds(event.homeTeam, event.awayTeam);
        this.liveEvents.set(event.id, event);
      });

      this.broadcast({
        type: 'prematch_events_update',
        events: prematchEvents,
        count: prematchEvents.length,
      });
    } catch {
      // ignore refresh errors
    }
  }

  async getAllEvents(): Promise<FreeSportsEvent[]> {
    try {
      const footballEvents = await this.getFootballEvents();
      const theSportsDBEvents = await this.getTheSportsDBEvents();

      const allEvents = [...footballEvents, ...theSportsDBEvents];
      const uniqueEvents = allEvents.filter(
        (event, index, self) => index === self.findIndex((e) => e.id === event.id),
      );

      const filteredEvents = uniqueEvents.filter(
        (event) =>
          !event.league.toLowerCase().includes('american') &&
          !event.league.toLowerCase().includes('mlb') &&
          !event.league.toLowerCase().includes('nfl') &&
          !event.league.toLowerCase().includes('nba'),
      );

      filteredEvents.forEach((event) => {
        if (!event.odds) {
          event.odds = this.generateSimulatedOdds(event.homeTeam, event.awayTeam);
        }
      });

      return filteredEvents;
    } catch {
      return [];
    }
  }

  async getEventsBySport(sport: string): Promise<FreeSportsEvent[]> {
    const allEvents = await this.getAllEvents();
    return allEvents.filter((event) => event.sport === sport);
  }

  async getLiveEvents(): Promise<FreeSportsEvent[]> {
    const allEvents = await this.getAllEvents();
    return allEvents.filter((event) => event.status === 'live');
  }

  async getPrematchEvents(): Promise<FreeSportsEvent[]> {
    const allEvents = await this.getAllEvents();
    return allEvents.filter((event) => event.status === 'prematch');
  }

  async getEventOdds(eventId: string): Promise<FreeSportsOdds | null> {
    const allEvents = await this.getAllEvents();
    const event = allEvents.find((e) => e.id === eventId);
    return event?.odds || null;
  }

  getStats() {
    return {
      totalEvents: this.liveEvents.size,
      liveEvents: Array.from(this.liveEvents.values()).filter((e) => e.status === 'live').length,
      connectedClients: this.clients.size,
      websocketPort: WS_PORT,
      uptime: process.uptime(),
    };
  }
}

const freeSportsService = new FreeSportsApiService();

export const getFreeSportsEvents = async (sport?: string) => {
  return sport ? freeSportsService.getEventsBySport(sport) : freeSportsService.getAllEvents();
};

export const getFreeSportsLiveEvents = async () => {
  return freeSportsService.getLiveEvents();
};

export const getFreeSportsOdds = async (eventId: string) => {
  return freeSportsService.getEventOdds(eventId);
};

export { freeSportsService };
export default freeSportsService;
