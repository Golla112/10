import axios from 'axios';

const ODDS_API_KEY = process.env.NEXT_PUBLIC_ODDS_API_KEY || 'your_oddspapi_key_here';
const ODDS_API_BASE_URL = 'https://api.oddspapi.io/v4';

export interface Outcome {
  name: string;
  price: number;
  point?: number;
}

export interface Market {
  key: string;
  last_update: string;
  outcomes: Outcome[];
}

export interface Bookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: Market[];
}

export interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
}

export interface GoldBetOdds {
  homeWin: number;
  draw: number;
  awayWin: number;
  lastUpdate: string;
}

class OddspAPIService {
  private goldBetBookmakerKey = 'goldbet';
  private wsConnection: WebSocket | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;

  async getSports(): Promise<any[]> {
    try {
      const response = await axios.get(`${ODDS_API_BASE_URL}/sports`, {
        params: {
          apiKey: ODDS_API_KEY
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching sports:', error);
      throw error;
    }
  }

  async getOddsBySport(sportKey: string, regions: string = 'eu', markets: string = 'h2h'): Promise<OddsEvent[]> {
    try {
      const response = await axios.get(`${ODDS_API_BASE_URL}/sports/${sportKey}/odds`, {
        params: {
          apiKey: ODDS_API_KEY,
          regions,
          markets,
          bookmakers: this.goldBetBookmakerKey
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching odds for ${sportKey}:`, error);
      // Fallback to mock data if API fails
      return this.getMockOdds();
    }
  }

  async getGoldBetOdds(eventId: string): Promise<GoldBetOdds | null> {
    try {
      // Try to get specific event odds
      const response = await axios.get(`${ODDS_API_BASE_URL}/events/${eventId}/odds`, {
        params: {
          apiKey: ODDS_API_KEY,
          regions: 'eu',
          markets: 'h2h',
          bookmakers: this.goldBetBookmakerKey
        }
      });

      const event = response.data;
      const goldBetBookmaker = event.bookmakers.find((b: Bookmaker) => b.key === this.goldBetBookmakerKey);
      
      if (goldBetBookmaker) {
        const h2hMarket = goldBetBookmaker.markets.find((m: Market) => m.key === 'h2h');
        if (h2hMarket && h2hMarket.outcomes.length >= 3) {
          return {
            homeWin: h2hMarket.outcomes[0].price,
            draw: h2hMarket.outcomes[1].price,
            awayWin: h2hMarket.outcomes[2].price,
            lastUpdate: goldBetBookmaker.last_update
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error fetching GoldBet odds:', error);
      return null;
    }
  }

  // WebSocket connection for real-time odds
  connectWebSocket(onUpdate: (events: OddsEvent[]) => void): void {
    try {
      // OddspAPI doesn't provide native WebSocket, so we'll implement polling
      console.log('[WebSocket] Starting real-time odds polling...');
      this.startPolling(onUpdate);
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
    }
  }

  // Poll every 3 minutes (180000 ms)
  private startPolling(onUpdate: (events: OddsEvent[]) => void): void {
    const poll = async () => {
      try {
        console.log('[Polling] Fetching live odds...');
        const soccerLeagues = [
          'soccer_italy_serie_a',
          'soccer_spain_la_liga', 
          'soccer_germany_bundesliga',
          'soccer_france_ligue_one',
          'soccer_england_premier_league',
          'soccer_uefa_champions_league'
        ];

        const allOddsPromises = soccerLeagues.map(league => 
          this.getOddsBySport(league, 'eu', 'h2h')
        );

        const allOddsResults = await Promise.all(allOddsPromises);
        const allEvents = allOddsResults.flat();
        
        onUpdate(allEvents);
      } catch (error) {
        console.error('[Polling] Error fetching odds:', error);
      }
    };

    // Initial poll
    poll();

    // Set up polling every 3 minutes
    this.pollingInterval = setInterval(poll, 180000); // 3 minutes
  }

  disconnectWebSocket(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('[WebSocket] Disconnected');
    }

    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  async getLiveOdds(sportKey: string = 'soccer'): Promise<OddsEvent[]> {
    try {
      const response = await axios.get(`${ODDS_API_BASE_URL}/sports/${sportKey}/scores`, {
        params: {
          apiKey: ODDS_API_KEY,
          daysFrom: 0
        }
      });

      // Filter for completed or ongoing games and get their odds
      const liveEvents = response.data.filter((event: any) => 
        event.completed === false || event.scores.length > 0
      );

      // Get odds for live events
      const oddsPromises = liveEvents.map(async (event: any) => {
        try {
          const odds = await this.getOddsBySport(event.sport_key, 'eu', 'h2h');
          return odds.find(odd => odd.id === event.id);
        } catch {
          return null;
        }
      });

      const liveOdds = await Promise.all(oddsPromises);
      return liveOdds.filter(Boolean);
    } catch (error) {
      console.error('Error fetching live odds:', error);
      return this.getMockOdds();
    }
  }

  public getMockOdds(): OddsEvent[] {
    return [
      {
        id: 'mock-goldbet-1',
        sport_key: 'soccer_italy_serie_a',
        sport_title: 'Soccer',
        commence_time: new Date(Date.now() + 3600000).toISOString(),
        home_team: 'Juventus',
        away_team: 'AC Milan',
        bookmakers: [
          {
            key: 'goldbet',
            title: 'GoldBet',
            last_update: new Date().toISOString(),
            markets: [
              {
                key: 'h2h',
                last_update: new Date().toISOString(),
                outcomes: [
                  { name: 'Juventus', price: 2.15 },
                  { name: 'Draw', price: 3.40 },
                  { name: 'AC Milan', price: 3.25 }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'mock-goldbet-2',
        sport_key: 'soccer_spain_la_liga',
        sport_title: 'Soccer',
        commence_time: new Date(Date.now() + 7200000).toISOString(),
        home_team: 'Real Madrid',
        away_team: 'Barcelona',
        bookmakers: [
          {
            key: 'goldbet',
            title: 'GoldBet',
            last_update: new Date().toISOString(),
            markets: [
              {
                key: 'h2h',
                last_update: new Date().toISOString(),
                outcomes: [
                  { name: 'Real Madrid', price: 1.85 },
                  { name: 'Draw', price: 3.60 },
                  { name: 'Barcelona', price: 4.20 }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'mock-goldbet-3',
        sport_key: 'soccer_germany_bundesliga',
        sport_title: 'Soccer',
        commence_time: new Date().toISOString(),
        home_team: 'Bayern Munich',
        away_team: 'Borussia Dortmund',
        bookmakers: [
          {
            key: 'goldbet',
            title: 'GoldBet',
            last_update: new Date().toISOString(),
            markets: [
              {
                key: 'h2h',
                last_update: new Date().toISOString(),
                outcomes: [
                  { name: 'Bayern Munich', price: 1.45 },
                  { name: 'Draw', price: 4.80 },
                  { name: 'Borussia Dortmund', price: 6.50 }
                ]
              }
            ]
          }
        ]
      }
    ];
  }

  transformOddsToEvent(oddsEvent: OddsEvent): any {
    const goldBetBookmaker = oddsEvent.bookmakers.find((b: Bookmaker) => b.key === this.goldBetBookmakerKey);
    const h2hMarket = goldBetBookmaker?.markets.find((m: Market) => m.key === 'h2h');
    
    return {
      id: oddsEvent.id,
      home: { name: oddsEvent.home_team },
      away: { name: oddsEvent.away_team },
      sport_id: oddsEvent.sport_key,
      sport_category: oddsEvent.sport_title.toLowerCase(),
      league: { name: this.extractLeagueName(oddsEvent.sport_key) },
      live: new Date(oddsEvent.commence_time) <= new Date(),
      time: new Date(oddsEvent.commence_time).getTime() / 1000,
      bookmakers: oddsEvent.bookmakers
    };
  }

  private extractLeagueName(sportKey: string): string {
    const leagueMap: Record<string, string> = {
      'soccer_italy_serie_a': 'Italy — Serie A',
      'soccer_spain_la_liga': 'Spain — La Liga',
      'soccer_germany_bundesliga': 'Germany — Bundesliga',
      'soccer_france_ligue_one': 'France — Ligue 1',
      'soccer_england_premier_league': 'England — Premier League',
      'soccer_uefa_champions_league': 'UEFA Champions League'
    };
    
    return leagueMap[sportKey] || sportKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}

export const oddspAPIService = new OddspAPIService();
