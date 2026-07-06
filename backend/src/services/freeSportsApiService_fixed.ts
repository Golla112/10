// Free Sports API Service - Soluzione gratuita con WebSocket
// Aggrega dati da multiple fonti gratuite - SOLO SPORT EUROPEI

import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

// ── Configurazione Fonti Gratuite ─────────────────────────────────────────────────

// API-Football (piano gratuito)
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || 'free';
const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';

// TheSportsDB (completamente gratuita)
const THESPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/3';

// WebSocket configuration
const WS_CONFIG = {
  port: parseInt(process.env.PRO_WS_PORT || '4002'),
  heartbeatInterval: 30000,
  reconnectInterval: 5000
};

// ── Interfacce ───────────────────────────────────────────────────────────────

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

// ── Service Class ───────────────────────────────────────────────────────────────

class FreeSportsApiService extends EventEmitter {
  private wsServer: WebSocket.Server | null = null;
  private liveEvents: Map<string, FreeSportsEvent> = new Map();
  private clients: Set<WebSocket> = new Set();

  constructor() {
    super();
    this.initWebSocketServer();
    this.initializeDataSync();
  }

  /**
   * Inizializza server WebSocket per aggiornamenti live
   */
  private initWebSocketServer() {
    this.wsServer = new WebSocket.Server({ 
      port: WS_CONFIG.port,
      perMessageDeflate: false
    });
    
    this.wsServer.on('connection', (ws) => {
      console.log('Client connected to Free Sports WebSocket');
      this.clients.add(ws);
      
      // Invia eventi live attuali
      ws.send(JSON.stringify({
        type: 'initial_events',
        events: Array.from(this.liveEvents.values())
      }));
      
      ws.on('close', () => {
        this.clients.delete(ws);
      });
    });
    
    // Start heartbeat
    this.startHeartbeat();
  }

  /**
   * Inizializza sincronizzazione dati
   */
  private initializeDataSync() {
    // Live events sync - ogni 10 secondi
    setInterval(async () => {
      await this.updateLiveEvents();
    }, 10000);

    // Prematch events sync - ogni 15 minuti (ridotto da 5)
    setInterval(async () => {
      await this.updatePrematchEvents();
    }, 900000); // 15 minuti invece di 5
  }

  /**
   * Start WebSocket heartbeat
   */
  private startHeartbeat() {
    setInterval(() => {
      this.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.ping();
        }
      });
    }, WS_CONFIG.heartbeatInterval);
  }

  /**
   * Broadcast message a tutti i client WebSocket
   */
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

  /**
   * Ottieni eventi calcio da API-Football (gratuito)
   */
  async getFootballEvents(): Promise<FreeSportsEvent[]> {
    try {
      const response = await axios.get(`${API_FOOTBALL_BASE}/fixtures`, {
        params: {
          season: new Date().getFullYear(),
          league: 39 // Premier League come esempio
        },
        headers: {
          'x-apisports-key': API_FOOTBALL_KEY
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

  /**
   * Ottieni eventi da TheSportsDB (gratuito)
   */
  async getTheSportsDBEvents(): Promise<FreeSportsEvent[]> {
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

  /**
   * Genera quote simulate (realistiche ma fittizie)
   */
  private generateSimulatedOdds(homeTeam: string, awayTeam: string): any {
    // Algoritmo per quote realistiche basate sui nomi delle squadre
    const homeStrength = this.calculateTeamStrength(homeTeam);
    const awayStrength = this.calculateTeamStrength(awayTeam);
    
    const totalStrength = homeStrength + awayStrength;
    const homeProb = homeStrength / totalStrength;
    const drawProb = 0.25; // 25% probabilità pareggio
    const awayProb = awayStrength / totalStrength;
    
    // Converti probabilità in quote (1/probabilità)
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

  /**
   * Calcola forza squadra basata sul nome (deterministico)
   */
  private calculateTeamStrength(teamName: string): number {
    // Usa hash del nome per consistenza
    const nameHash = teamName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const seed = nameHash % 100;
    
    const strongTeams = [
      'Manchester City', 'Real Madrid', 'Barcelona', 'Bayern Munich',
      'Liverpool', 'Chelsea', 'Arsenal', 'PSG', 'Juventus', 'Inter',
      'Milan', 'Napoli', 'Dortmund', 'Tottenham', 'Atletico Madrid'
    ];
    
    const mediumTeams = [
      'Manchester United', 'Roma', 'Lazio', 'Valencia', 'Sevilla',
      'Leverkusen', 'Leipzig', 'Porto', 'Ajax', 'Benfica'
    ];
    
    if (strongTeams.some(team => teamName.toLowerCase().includes(team.toLowerCase()))) {
      return 85 + (seed % 10);
    }
    if (mediumTeams.some(team => teamName.toLowerCase().includes(team.toLowerCase()))) {
      return 70 + (seed % 10);
    }
    
    return 50 + (seed % 30);
  }

  /**
   * Aggiorna eventi live (solo sport europei)
   */
  private async updateLiveEvents() {
    try {
      const footballEvents = await this.getFootballEvents();
      // Filtra solo calcio, basket, tennis, pallavolo, pallamano - rimuovo americani
      const filteredEvents = footballEvents.filter(event => 
        event.status === 'live' && 
        !event.league.toLowerCase().includes('american') &&
        !event.league.toLowerCase().includes('mlb') &&
        !event.league.toLowerCase().includes('nfl') &&
        !event.league.toLowerCase().includes('nba')
      );
      
      // Aggiungi quote simulate
      filteredEvents.forEach(event => {
        event.odds = this.generateSimulatedOdds(event.homeTeam, event.awayTeam);
        this.liveEvents.set(event.id, event);
      });
      
      // Broadcast updates
      this.broadcast({
        type: 'live_events_update',
        events: filteredEvents,
        count: filteredEvents.length
      });
      
    } catch (error) {
      console.error('Error updating live events:', error);
    }
  }

  /**
   * Aggiorna eventi prematch (solo sport europei)
   */
  private async updatePrematchEvents() {
    try {
      const events = await this.getTheSportsDBEvents();
      const prematchEvents = events.filter(event => 
        event.status === 'prematch' && 
        (event.sport === 'soccer' || event.sport === 'basketball' || 
         event.sport === 'tennis' || event.sport === 'volleyball' || 
         event.sport === 'handball') &&
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

  /**
   * Ottieni tutti gli eventi attuali (solo sport europei)
   */
  async getAllEvents(): Promise<FreeSportsEvent[]> {
    try {
      const footballEvents = await this.getFootballEvents();
      const theSportsDBEvents = await this.getTheSportsDBEvents();
      
      // Combina e rimuovi duplicati
      const allEvents = [...footballEvents, ...theSportsDBEvents];
      const uniqueEvents = allEvents.filter((event, index, self) =>
        index === self.findIndex(e => e.id === event.id)
      );
      
      // Filtra solo sport europei e rimuovi americani
      const filteredEvents = uniqueEvents.filter(event => 
        (event.sport === 'soccer' || event.sport === 'basketball' || 
         event.sport === 'tennis' || event.sport === 'volleyball' || 
         event.sport === 'handball') &&
        !event.league.toLowerCase().includes('american') &&
        !event.league.toLowerCase().includes('mlb') &&
        !event.league.toLowerCase().includes('nfl') &&
        !event.league.toLowerCase().includes('nba')
      );
      
      // Aggiungi quote a tutti gli eventi
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

  /**
   * Ottieni eventi per sport specifico
   */
  async getEventsBySport(sport: string): Promise<FreeSportsEvent[]> {
    const allEvents = await this.getAllEvents();
    return allEvents.filter(event => event.sport === sport);
  }

  /**
   * Ottieni eventi live
   */
  async getLiveEventsMethod(): Promise<FreeSportsEvent[]> {
    const allEvents = await this.getAllEvents();
    return allEvents.filter(event => event.status === 'live');
  }

  /**
   * Ottieni eventi prematch
   */
  async getPrematchEventsMethod(): Promise<FreeSportsEvent[]> {
    const allEvents = await this.getAllEvents();
    return allEvents.filter(event => event.status === 'prematch');
  }

  /**
   * Ottieni quote per evento specifico
   */
  async getEventOdds(eventId: string): Promise<any | null> {
    const allEvents = await this.getAllEvents();
    const event = allEvents.find(e => e.id === eventId);
    
    return event?.odds || null;
  }

  /**
   * Statistiche del servizio
   */
  getStats() {
    return {
      totalEvents: this.liveEvents.size,
      liveEvents: Array.from(this.liveEvents.values()).filter(e => e.status === 'live').length,
      connectedClients: this.clients.size,
      websocketPort: WS_CONFIG.port,
      uptime: process.uptime()
    };
  }
}

// ── Esportazione ───────────────────────────────────────────────────────────────

export const freeSportsService = new FreeSportsApiService();

// Funzioni helper
export const getFreeSportsEvents = async (sport?: string) => {
  return sport ? await freeSportsService.getEventsBySport(sport) : await freeSportsService.getAllEvents();
};

export const getFreeSportsLiveEvents = async () => {
  return await freeSportsService.getLiveEventsMethod();
};

export const getFreeSportsOdds = async (eventId: string) => {
  return await freeSportsService.getEventOdds(eventId);
};

export default freeSportsService;
