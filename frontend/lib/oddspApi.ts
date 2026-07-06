import axios from 'axios';

const ODDS_API_KEY = process.env.NEXT_PUBLIC_ODDS_API_KEY;
const ODDS_API_BASE_URL = 'https://api.oddspapi.io/v4';

if (!ODDS_API_KEY) {
  console.error('[OddspAPI] ERROR: API key not configured! Set NEXT_PUBLIC_ODDS_API_KEY');
}

// ============== INTERFACCE ==============

export interface Tournament {
  tournamentId: number;
  tournamentSlug: string;
  tournamentName: string;
  categorySlug: string;
  categoryName: string;
  futureFixtures: number;
  upcomingFixtures: number;
  liveFixtures: number;
}

export interface Market {
  outcomes: {
    [outcomeId: string]: {
      players: {
        [playerId: string]: {
          active: boolean;
          betslip: string | null;
          bookmakerOutcomeId: string;
          changedAt: string;
          limit: number;
          playerName: string | null;
          price: number;
          exchangeMeta: object;
        }
      }
    }
  }
  bookmakerMarketId: string;
}

export interface Fixture {
  fixtureId: string;
  participant1Id: number;
  participant2Id: number;
  sportId: number;
  tournamentId: number;
  seasonId: number;
  statusId: number;
  hasOdds: boolean;
  startTime: string;
  trueStartTime: string | null;
  trueEndTime: string | null;
  updatedAt: string;
  bookmakerOdds: {
    [bookmaker: string]: {
      bookmakerIsActive: boolean;
      bookmakerFixtureId: string;
      fixturePath: string;
      markets: {
        [marketId: string]: Market
      }
    }
  }
}

export interface SettledFixture {
  fixtureId: string;
  participant1Id: number;
  participant2Id: number;
  sportId: number;
  tournamentId: number;
  statusId: number;
  homeScore: number;
  awayScore: number;
  result: 'home' | 'draw' | 'away';
  settledAt: string;
}

export interface Event {
  id: string;
  home: { name: string };
  away: { name: string };
  sport_id: string;
  sport_category: string;
  league: { name: string };
  live: boolean;
  time: number;
  minute?: number;
  score?: { home: number; away: number };
  bookmakers: {
    key: string;
    title: string;
    last_update: string;
    markets: {
      key: string;
      name: string;
      last_update: string;
      outcomes: { name: string; price: number; point?: number }[];
    }[];
  }[];
}

// ============== SERVIZIO ==============

class OddspAPIService {
  private readonly BOOKMAKER = 'goldbet';
  private readonly SPORT_ID_SOCCER = 10;
  private pollingInterval: NodeJS.Timeout | null = null;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000;

  private async apiCall(endpoint: string, params: any): Promise<any> {
    if (!ODDS_API_KEY) {
      console.error('[OddspAPI] CRITICAL: API key missing! Add NEXT_PUBLIC_ODDS_API_KEY to .env.local');
      throw new Error('API key not configured. Please add NEXT_PUBLIC_ODDS_API_KEY to your .env.local file. Get your key from https://oddspapi.io/');
    }

    const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const response = await axios.get(`${ODDS_API_BASE_URL}${endpoint}`, {
        params: { ...params, apiKey: ODDS_API_KEY },
        timeout: 15000
      });

      this.cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
      return response.data;
    } catch (error: any) {
      console.error(`[OddspAPI] Error calling ${endpoint}:`, error.message);
      throw error;
    }
  }

  private mapMarketIdToName(marketId: string): string {
    const marketNames: { [key: string]: string } = {
      '101': '1X2',
      '102': 'Double Chance',
      '103': 'Over/Under 2.5',
      '104': 'Both Teams to Score',
      '105': 'Asian Handicap',
      '106': 'Correct Score',
      '107': 'First Half 1X2',
      '108': 'Second Half 1X2',
      '109': 'First Goal Scorer',
      '110': 'Anytime Goal Scorer',
      '111': 'Draw No Bet',
      '112': 'European Handicap',
      '113': 'Over/Under 1.5',
      '114': 'Over/Under 3.5',
      '115': 'Half Time/Full Time',
      '116': 'Exact Goals',
      '117': 'Odd/Even',
      '118': 'Team 1 Over/Under',
      '119': 'Team 2 Over/Under'
    };
    return marketNames[marketId] || `Market ${marketId}`;
  }

  private transformBookmakerOdds(fixture: Fixture): Event['bookmakers'] {
    const bookmakerData = fixture.bookmakerOdds[this.BOOKMAKER];
    
    if (!bookmakerData || !bookmakerData.markets) {
      return [];
    }

    const markets: Event['bookmakers'][0]['markets'] = [];

    Object.entries(bookmakerData.markets).forEach(([marketId, market]) => {
      const outcomes: { name: string; price: number; point?: number }[] = [];

      Object.entries(market.outcomes).forEach(([outcomeId, outcomeData]) => {
        Object.entries(outcomeData.players).forEach(([playerId, player]) => {
          if (player.active) {
            outcomes.push({
              name: player.bookmakerOutcomeId,
              price: player.price
            });
          }
        });
      });

      if (outcomes.length > 0) {
        markets.push({
          key: marketId,
          name: this.mapMarketIdToName(marketId),
          last_update: fixture.updatedAt,
          outcomes
        });
      }
    });

    if (markets.length === 0) {
      return [];
    }

    return [{
      key: this.BOOKMAKER,
      title: 'GoldBet',
      last_update: fixture.updatedAt,
      markets
    }];
  }

  async getTournaments(sportId: number = this.SPORT_ID_SOCCER): Promise<Tournament[]> {
    // Delay iniziale per evitare 429
    await new Promise(r => setTimeout(r, 5000));
    
    const allTournaments = await this.apiCall('/tournaments', { sportId });
    
    // Prendi solo top 20 tornei con più partite
    if (Array.isArray(allTournaments)) {
      return allTournaments
        .sort((a, b) => (b.upcomingFixtures + b.liveFixtures) - (a.upcomingFixtures + a.liveFixtures))
        .slice(0, 20);
    }
    return allTournaments || [];
  }

  async getOddsByTournaments(tournamentIds: number[], maxBatchSize: number = 20): Promise<Fixture[]> {
    if (tournamentIds.length === 0) return [];
    
    const fixtures: Fixture[] = [];
    const batches: number[][] = [];
    
    // Dividi in batch di max 20 tornei
    for (let i = 0; i < tournamentIds.length; i += maxBatchSize) {
      batches.push(tournamentIds.slice(i, i + maxBatchSize));
    }
    
    console.log(`[OddspAPI] Fetching odds in ${batches.length} batches of max ${maxBatchSize} tournaments`);
    
    // Delay iniziale per evitare 429 all'avvio
    await new Promise(r => setTimeout(r, 3000));
    
    // Processa i batch con delay per evitare rate limit
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          // Delay tra i batch
          if (i > 0 || retries > 0) {
            await new Promise(r => setTimeout(r, 2000));
          }
          
          const result = await this.apiCall('/odds-by-tournaments', {
            bookmaker: this.BOOKMAKER,
            tournamentIds: batch.join(',')
          });
          
          if (Array.isArray(result)) {
            fixtures.push(...result);
          }
          break; // Success, exit retry loop
        } catch (error: any) {
          retries++;
          
          if (error.response?.status === 429) {
            console.warn(`[OddspAPI] Rate limit (429), waiting ${retries * 5}s before retry ${retries}/${maxRetries}...`);
            await new Promise(r => setTimeout(r, retries * 5000));
          } else if (error.response?.status === 400) {
            console.error(`[OddspAPI] Bad request (400), skipping batch ${i + 1}`);
            break; // Don't retry 400
          } else {
            console.error(`[OddspAPI] Batch ${i + 1}/${batches.length} failed:`, error.message);
            break;
          }
        }
      }
    }
    
    console.log(`[OddspAPI] Total fixtures fetched: ${fixtures.length}`);
    return fixtures;
  }

  async getLiveFixtures(sportId: number = this.SPORT_ID_SOCCER): Promise<Fixture[]> {
    const tournaments = await this.getTournaments(sportId);
    const tournamentIds = tournaments
      .filter(t => t.liveFixtures > 0)
      .map(t => t.tournamentId);
    
    if (tournamentIds.length === 0) return [];
    
    const fixtures = await this.getOddsByTournaments(tournamentIds);
    return fixtures.filter(f => f.statusId === 1 && f.hasOdds);
  }

  async getPrematchFixtures(sportId: number = this.SPORT_ID_SOCCER): Promise<Fixture[]> {
    const tournaments = await this.getTournaments(sportId);
    const tournamentIds = tournaments
      .filter(t => t.upcomingFixtures > 0 || t.futureFixtures > 0)
      .map(t => t.tournamentId);
    
    if (tournamentIds.length === 0) return [];
    
    const fixtures = await this.getOddsByTournaments(tournamentIds);
    return fixtures.filter(f => f.statusId === 0 && f.hasOdds);
  }

  async getAllFixtures(sportId: number = this.SPORT_ID_SOCCER): Promise<Fixture[]> {
    const tournaments = await this.getTournaments(sportId);
    const tournamentIds = tournaments.map(t => t.tournamentId);
    
    if (tournamentIds.length === 0) return [];
    
    const fixtures = await this.getOddsByTournaments(tournamentIds);
    return fixtures.filter(f => f.hasOdds);
  }

  async getSettledFixtures(
    sportId: number = this.SPORT_ID_SOCCER,
    fromDate?: string,
    toDate?: string
  ): Promise<SettledFixture[]> {
    const params: any = { sportId };
    if (fromDate) params.from = fromDate;
    if (toDate) params.to = toDate;
    
    return this.apiCall('/settle', params);
  }

  async getFixtureById(fixtureId: string): Promise<Fixture | null> {
    try {
      const result = await this.apiCall('/fixture', { fixtureId });
      return result;
    } catch {
      return null;
    }
  }

  transformFixtureToEvent(fixture: Fixture): Event {
    const bookmakers = this.transformBookmakerOdds(fixture);

    return {
      id: fixture.fixtureId,
      home: { name: `Team ${fixture.participant1Id}` },
      away: { name: `Team ${fixture.participant2Id}` },
      sport_id: `sport_${fixture.sportId}`,
      sport_category: 'soccer',
      league: { name: `Tournament ${fixture.tournamentId}` },
      live: fixture.statusId === 1,
      time: new Date(fixture.startTime).getTime() / 1000,
      bookmakers
    };
  }

  transformOddsToEvent(fixture: Fixture): Event {
    return this.transformFixtureToEvent(fixture);
  }

  getMockOdds(): Fixture[] {
    return [];
  }

  startLiveUpdates(
    onUpdate: (fixtures: Fixture[]) => void,
    intervalMs: number = 180000
  ): void {
    this.stopLiveUpdates();
    
    const fetchLive = async () => {
      try {
        const fixtures = await this.getLiveFixtures();
        onUpdate(fixtures);
      } catch (error) {
        console.error('[OddspAPI] Live update error:', error);
      }
    };

    fetchLive();
    this.pollingInterval = setInterval(fetchLive, intervalMs);
    
    console.log(`[OddspAPI] Live polling started (${intervalMs}ms)`);
  }

  stopLiveUpdates(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('[OddspAPI] Live polling stopped');
    }
  }

  startAllUpdates(
    onUpdate: (fixtures: Fixture[]) => void,
    intervalMs: number = 180000
  ): void {
    this.stopLiveUpdates();
    
    const fetchAll = async () => {
      try {
        const fixtures = await this.getAllFixtures();
        onUpdate(fixtures);
      } catch (error) {
        console.error('[OddspAPI] Update error:', error);
      }
    };

    fetchAll();
    this.pollingInterval = setInterval(fetchAll, intervalMs);
    
    console.log(`[OddspAPI] All fixtures polling started (${intervalMs}ms)`);
  }

  checkBetResult(
    fixture: SettledFixture,
    selection: 'home' | 'draw' | 'away'
  ): 'win' | 'loss' | 'void' {
    if (fixture.result === selection) return 'win';
    return 'loss';
  }

  calculateWinnings(stake: number, odds: number): number {
    return stake * odds;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const oddspAPIService = new OddspAPIService();
