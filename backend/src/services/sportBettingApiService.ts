// Sport-Betting-API Service - Integrazione completa per BigBet365
// Fornisce quote prematch, live, e tutti i mercati disponibili

import axios, { AxiosInstance } from 'axios';

// ── Configurazione ─────────────────────────────────────────────────────────────

const SPORT_BETTING_BASE = 'https://api.sport-betting.com/v1';
const API_KEYS = [
  process.env.SPORT_BETTING_API_KEY,
  process.env.SPORT_BETTING_API_KEY_2,
  process.env.SPORT_BETTING_API_KEY_3,
].filter(Boolean) as string[];

let keyIndex = 0;
function getApiKey(): string | null {
  if (API_KEYS.length === 0) return null;
  return API_KEYS[keyIndex % API_KEYS.length];
}
function rotateKey(): void {
  keyIndex = (keyIndex + 1) % API_KEYS.length;
}

// ── Interfacce Pubbliche ────────────────────────────────────────────────────────

export interface SportBettingEvent {
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
}

export interface SportBettingMarket {
  key: string;
  name: string;
  outcomes: SportBettingOutcome[];
}

export interface SportBettingOutcome {
  name: string;
  price: number;
  point?: number;
}

export interface SportBettingBookmaker {
  id: string;
  name: string;
  markets: SportBettingMarket[];
}

export interface SportBettingOdds {
  eventId: string;
  bookmakers: SportBettingBookmaker[];
  lastUpdate: number;
}

export interface SportBettingSport {
  id: string;
  name: string;
  active: boolean;
  leagues: SportBettingLeague[];
}

export interface SportBettingLeague {
  id: string;
  name: string;
  country: string;
  sport: string;
}

// ── Service Class ───────────────────────────────────────────────────────────────

class SportBettingApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: SPORT_BETTING_BASE,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor per API key
    this.client.interceptors.request.use((config) => {
      const apiKey = getApiKey();
      if (apiKey) {
        config.headers['X-API-Key'] = apiKey;
      }
      return config;
    });

    // Response interceptor per retry con altra API key
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 429 || error.response?.status === 401) {
          rotateKey();
          const newApiKey = getApiKey();
          if (newApiKey) {
            error.config.headers['X-API-Key'] = newApiKey;
            return this.client.request(error.config);
          }
        }
        throw error;
      }
    );
  }

  // ── Metodi Principali ─────────────────────────────────────────────────────────

  /**
   * Ottiene tutti gli sport disponibili
   */
  async getSports(): Promise<SportBettingSport[]> {
    try {
      const response = await this.client.get('/sports');
      return response.data.sports || [];
    } catch (error) {
      console.error('SportBetting API - getSports error:', error);
      return [];
    }
  }

  /**
   * Ottiene eventi prematch per uno sport specifico
   */
  async getPrematchEvents(sportId: string, limit: number = 50): Promise<SportBettingEvent[]> {
    try {
      const response = await this.client.get(`/events/prematch`, {
        params: { sport: sportId, limit }
      });
      return response.data.events || [];
    } catch (error) {
      console.error('SportBetting API - getPrematchEvents error:', error);
      return [];
    }
  }

  /**
   * Ottiene eventi live per uno sport specifico
   */
  async getLiveEvents(sportId?: string): Promise<SportBettingEvent[]> {
    try {
      const params = sportId ? { sport: sportId } : {};
      const response = await this.client.get('/events/live', { params });
      return response.data.events || [];
    } catch (error) {
      console.error('SportBetting API - getLiveEvents error:', error);
      return [];
    }
  }

  /**
   * Ottiene quote per un evento specifico
   */
  async getEventOdds(eventId: string): Promise<SportBettingOdds | null> {
    try {
      const response = await this.client.get(`/odds/${eventId}`);
      return response.data;
    } catch (error) {
      console.error('SportBetting API - getEventOdds error:', error);
      return null;
    }
  }

  /**
   * Ottiene quote prematch per più eventi
   */
  async getPrematchOdds(sportId: string, markets: string[] = ['h2h']): Promise<SportBettingOdds[]> {
    try {
      const response = await this.client.get('/odds/prematch', {
        params: { sport: sportId, markets: markets.join(',') }
      });
      return response.data.odds || [];
    } catch (error) {
      console.error('SportBetting API - getPrematchOdds error:', error);
      return [];
    }
  }

  /**
   * Ottiene quote live per più eventi
   */
  async getLiveOdds(sportId?: string): Promise<SportBettingOdds[]> {
    try {
      const params = sportId ? { sport: sportId } : {};
      const response = await this.client.get('/odds/live', { params });
      return response.data.odds || [];
    } catch (error) {
      console.error('SportBetting API - getLiveOdds error:', error);
      return [];
    }
  }

  /**
   * Ottiene tutti i mercati disponibili per uno sport
   */
  async getSportMarkets(sportId: string): Promise<string[]> {
    try {
      const response = await this.client.get(`/markets/${sportId}`);
      return response.data.markets || [];
    } catch (error) {
      console.error('SportBetting API - getSportMarkets error:', error);
      return [];
    }
  }

  // ── Metodi Specializzati per BigBet365 ───────────────────────────────────────────

  /**
   * Converte evento SportBetting in formato BigBet365
   */
  convertToBetStackEvent(event: SportBettingEvent): any {
    return {
      id: event.id,
      home: { name: event.homeTeam },
      away: { name: event.awayTeam },
      time: event.startTime,
      sport_id: event.sport,
      sport_category: this.getSportCategory(event.sport),
      league: { name: event.league },
      live: event.status === 'live',
      score: event.score,
      completed: event.status === 'completed',
      minute: event.minute,
    };
  }

  /**
   * Converte quote SportBetting in formato BigBet365
   */
  convertToBetStackOdds(odds: SportBettingOdds): any {
    const bookmakers = odds.bookmakers.map(bookmaker => ({
      key: bookmaker.id,
      title: bookmaker.name,
      markets: bookmaker.markets.map(market => ({
        key: market.key,
        outcomes: market.outcomes.map(outcome => ({
          name: outcome.name,
          price: outcome.price,
          point: outcome.point
        }))
      }))
    }));

    return {
      eventId: odds.eventId,
      bookmakers,
      lastUpdate: odds.lastUpdate
    };
  }

  /**
   * Mappa sport ID a categoria per compatibilità
   */
  private getSportCategory(sportId: string): string {
    const sportMap: Record<string, string> = {
      'soccer': 'Calcio',
      'basketball': 'Basket',
      'tennis': 'Tennis',
      'american_football': 'Football Am.',
      'baseball': 'Baseball',
      'hockey': 'Hockey',
      'mma': 'MMA',
      'boxing': 'Boxe',
      'volleyball': 'Pallavolo',
      'handball': 'Pallamano',
      'rugby': 'Rugby',
      'cricket': 'Cricket',
      'darts': 'Freccette',
      'snooker': 'Snooker',
      'f1': 'Formula 1',
      'moto': 'MotoGP'
    };
    
    return sportMap[sportId] || sportId;
  }

  /**
   * Ottiene quote per mercati specifici (es. h2h, spreads, totals)
   */
  async getMarketsOdds(eventId: string, markets: string[]): Promise<any> {
    try {
      const response = await this.client.get(`/odds/${eventId}/markets`, {
        params: { markets: markets.join(',') }
      });
      return response.data;
    } catch (error) {
      console.error('SportBetting API - getMarketsOdds error:', error);
      return null;
    }
  }

  /**
   * Verifica se un mercato è disponibile per un evento
   */
  async isMarketAvailable(eventId: string, marketKey: string): Promise<boolean> {
    try {
      const odds = await this.getEventOdds(eventId);
      if (!odds) return false;
      
      return odds.bookmakers.some(bookmaker => 
        bookmaker.markets.some(market => market.key === marketKey)
      );
    } catch (error) {
      return false;
    }
  }
}

// ── Esportazione ───────────────────────────────────────────────────────────────

export const sportBettingService = new SportBettingApiService();

// Funzioni helper per uso rapido
export const getSportBettingPrematchOdds = async (sportId: string) => {
  return await sportBettingService.getPrematchOdds(sportId);
};

export const getSportBettingLiveOdds = async (sportId?: string) => {
  return await sportBettingService.getLiveOdds(sportId);
};

export const getSportBettingEvents = async (sportId: string, type: 'prematch' | 'live' = 'prematch') => {
  if (type === 'live') {
    return await sportBettingService.getLiveEvents(sportId);
  } else {
    return await sportBettingService.getPrematchEvents(sportId);
  }
};

export default sportBettingService;
