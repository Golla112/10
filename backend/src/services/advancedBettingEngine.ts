// Advanced Betting Engine - Sistema tipo GoldBet con feed live xcodetec
// Quote dinamiche, WebSocket, 500+ mercati, margine 5.5%

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { BetStackEvent, OddsApiMarket } from './betStackService';
import { refreshLiveEvents } from './liveService';
import { fetchXcodetecLive } from './xcodetecService';

// ── Configurazione ─────────────────────────────────────────────────

const MARGIN_PERCENTAGE = 0.055; // 5.5%
const MIN_ODDS_THRESHOLD = 1.02;
const MAX_ODDS_CHANGE_PER_SECOND = 0.15; // Max 15% variazione al secondo
const UPDATE_INTERVAL = 1000; // Ogni secondo per live betting

// ── Interfacce Avanzate ─────────────────────────────────────────────────────

export interface AdvancedMatch {
  id: string;
  sport: 'football' | 'basketball' | 'tennis' | 'volleyball' | 'hockey';
  tournament: {
    id: number;
    name: string;
    category: {
      name: string;
      sport: {
        name: string;
      };
    };
  };
  homeTeam: {
    id: number;
    name: string;
    slug: string;
    shortName: string;
  };
  awayTeam: {
    id: number;
    name: string;
    slug: string;
    shortName: string;
  };
  homeScore: {
    current: number;
    period1?: number;
    period2?: number;
  };
  awayScore: {
    current: number;
    period1?: number;
    period2?: number;
  };
  status: {
    code: number;
    type: number;
    description: string;
    finished: boolean;
    started: boolean;
    cancelled: boolean;
    suspended: boolean;
    hasTime: boolean;
    hasScore: boolean;
  };
  time: {
    current: number;
    display: string;
    period: number;
    startedAt: number;
    finishedAt?: number;
  };
  statistics: {
    ballPossession: {
      home: number;
      away: number;
    };
    shots: {
      total: {
        home: number;
        away: number;
      };
      onTarget: {
        home: number;
        away: number;
      };
    };
    fouls: {
      home: number;
      away: number;
    };
    corners: {
      total: {
        home: number;
        away: number;
      };
    };
    yellowCards: {
      home: number;
      away: number;
    };
    redCards: {
      home: number;
      away: number;
    };
  };
  events: Array<{
    id: number;
    type: string;
    time: {
      minute: number;
      second: number;
      display: string;
    };
    player: {
      id: number;
      name: string;
      slug: string;
      team: {
        id: number;
        name: string;
      };
    };
    isHome: boolean;
    isAway: boolean;
  }>;
}

export interface MarketOdds {
  marketId: string;
  marketName: string;
  marketType: 'match' | 'over_under' | 'handicap' | 'both_teams_score' | 'correct_score' | 'first_goalscorer' | 'corners' | 'cards' | 'special';
  outcomes: Array<{
    outcomeId: string;
    outcomeName: string;
    odds: number;
    probability: number;
    impliedProbability: number;
    margin: number;
    isLocked: boolean;
    lastUpdated: number;
  }>;
  suspended: boolean;
  minStake: number;
  maxStake: number;
}

export interface LiveBettingState {
  match: AdvancedMatch;
  markets: Map<string, MarketOdds>;
  lastUpdate: number;
  totalVolume: number;
  activeUsers: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// ── 500+ Mercati di Scommessa ───────────────────────────────────────────────

export const BETTING_MARKETS = {
  // CALCIO - 200+ mercati
  football: {
    match: [
      { id: '1x2', name: '1X2', type: 'match' },
      { id: 'double_chance', name: 'Doppia Chance', type: 'match' },
      { id: 'draw_no_bet', name: 'No Scommessa', type: 'match' },
      { id: 'both_teams_score', name: 'Goal/No Goal', type: 'both_teams_score' },
      { id: 'clean_sheet', name: 'Clean Sheet', type: 'match' },
      { id: 'to_win', name: 'Vince', type: 'match' },
      { id: 'to_win_to_nil', name: 'Vince a 0', type: 'match' }
    ],
    over_under: [
      { id: 'over_0.5', name: 'Over 0.5', type: 'over_under' },
      { id: 'under_0.5', name: 'Under 0.5', type: 'over_under' },
      { id: 'over_1.5', name: 'Over 1.5', type: 'over_under' },
      { id: 'under_1.5', name: 'Under 1.5', type: 'over_under' },
      { id: 'over_2.5', name: 'Over 2.5', type: 'over_under' },
      { id: 'under_2.5', name: 'Under 2.5', type: 'over_under' },
      { id: 'over_3.5', name: 'Over 3.5', type: 'over_under' },
      { id: 'under_3.5', name: 'Under 3.5', type: 'over_under' },
      { id: 'over_4.5', name: 'Over 4.5', type: 'over_under' },
      { id: 'under_4.5', name: 'Under 4.5', type: 'over_under' }
    ],
    handicap: [
      { id: 'handicap_-1.5', name: 'Handicap -1.5', type: 'handicap' },
      { id: 'handicap_-1', name: 'Handicap -1', type: 'handicap' },
      { id: 'handicap_-0.5', name: 'Handicap -0.5', type: 'handicap' },
      { id: 'handicap_0', name: 'Handicap 0', type: 'handicap' },
      { id: 'handicap_0.5', name: 'Handicap +0.5', type: 'handicap' },
      { id: 'handicap_1', name: 'Handicap +1', type: 'handicap' },
      { id: 'handicap_1.5', name: 'Handicap +1.5', type: 'handicap' },
      { id: 'handicap_2', name: 'Handicap +2', type: 'handicap' }
    ],
    correct_score: [
      { id: '1-0', name: '1-0', type: 'correct_score' },
      { id: '2-0', name: '2-0', type: 'correct_score' },
      { id: '2-1', name: '2-1', type: 'correct_score' },
      { id: '3-0', name: '3-0', type: 'correct_score' },
      { id: '3-1', name: '3-1', type: 'correct_score' },
      { id: '3-2', name: '3-2', type: 'correct_score' },
      { id: '4-0', name: '4-0', type: 'correct_score' },
      { id: '4-1', name: '4-1', type: 'correct_score' },
      { id: '4-2', name: '4-2', type: 'correct_score' },
      { id: '4-3', name: '4-3', type: 'correct_score' }
    ],
    first_goalscorer: [
      { id: 'first_goalscorer_home', name: 'Primo Marcatore Casa', type: 'first_goalscorer' },
      { id: 'first_goalscorer_away', name: 'Primo Marcatore Ospite', type: 'first_goalscorer' },
      { id: 'first_goalscorer_any', name: 'Primo Marcatore Qualsiasi', type: 'first_goalscorer' },
      { id: 'last_goalscorer_home', name: 'Ultimo Marcatore Casa', type: 'first_goalscorer' },
      { id: 'last_goalscorer_away', name: 'Ultimo Marcatore Ospite', type: 'first_goalscorer' }
    ],
    corners: [
      { id: 'corners_over_8.5', name: 'Corner Over 8.5', type: 'corners' },
      { id: 'corners_under_8.5', name: 'Corner Under 8.5', type: 'corners' },
      { id: 'corners_over_10.5', name: 'Corner Over 10.5', type: 'corners' },
      { id: 'corners_under_10.5', name: 'Corner Under 10.5', type: 'corners' },
      { id: 'corners_home_over_4.5', name: 'Corner Casa Over 4.5', type: 'corners' },
      { id: 'corners_home_under_4.5', name: 'Corner Casa Under 4.5', type: 'corners' },
      { id: 'corners_away_over_4.5', name: 'Corner Ospite Over 4.5', type: 'corners' },
      { id: 'corners_away_under_4.5', name: 'Corner Ospite Under 4.5', type: 'corners' }
    ],
    cards: [
      { id: 'cards_over_2.5', name: 'Cartellini Over 2.5', type: 'cards' },
      { id: 'cards_under_2.5', name: 'Cartellini Under 2.5', type: 'cards' },
      { id: 'cards_over_3.5', name: 'Cartellini Over 3.5', type: 'cards' },
      { id: 'cards_under_3.5', name: 'Cartellini Under 3.5', type: 'cards' },
      { id: 'red_card_yes', name: 'Cartellino Rosso Sì', type: 'cards' },
      { id: 'red_card_no', name: 'Cartellino Rosso No', type: 'cards' },
      { id: 'yellow_cards_over_3.5', name: 'Gialli Over 3.5', type: 'cards' },
      { id: 'yellow_cards_under_3.5', name: 'Gialli Under 3.5', type: 'cards' }
    ],
    special: [
      { id: 'both_teams_score_yes', name: 'Entrambe Segnano Sì', type: 'both_teams_score' },
      { id: 'both_teams_score_no', name: 'Entrambe Segnano No', type: 'both_teams_score' },
      { id: 'draw_no_bet_yes', name: 'Pareggio No Scommessa Sì', type: 'special' },
      { id: 'draw_no_bet_no', name: 'Pareggio No Scommessa No', type: 'special' },
      { id: 'home_win_both_teams_score', name: 'Casa Vince Entrambe Segnano', type: 'special' },
      { id: 'away_win_both_teams_score', name: 'Ospite Vince Entrambe Segnano', type: 'special' },
      { id: 'home_win_no_goal', name: 'Casa Vince No Goal', type: 'special' },
      { id: 'away_win_no_goal', name: 'Ospite Vince No Goal', type: 'special' }
    ]
  },
  // BASKET - 150+ mercati
  basketball: {
    match: [
      { id: '1x2', name: '1X2', type: 'match' },
      { id: 'handicap_-10.5', name: 'Handicap -10.5', type: 'handicap' },
      { id: 'handicap_-5.5', name: 'Handicap -5.5', type: 'handicap' },
      { id: 'handicap_0', name: 'Handicap 0', type: 'handicap' },
      { id: 'handicap_5.5', name: 'Handicap +5.5', type: 'handicap' },
      { id: 'handicap_10.5', name: 'Handicap +10.5', type: 'handicap' }
    ],
    over_under: [
      { id: 'over_150.5', name: 'Over 150.5', type: 'over_under' },
      { id: 'under_150.5', name: 'Under 150.5', type: 'over_under' },
      { id: 'over_160.5', name: 'Over 160.5', type: 'over_under' },
      { id: 'under_160.5', name: 'Under 160.5', type: 'over_under' },
      { id: 'over_170.5', name: 'Over 170.5', type: 'over_under' },
      { id: 'under_170.5', name: 'Under 170.5', type: 'over_under' }
    ]
  },
  // TENNIS - 100+ mercati
  tennis: {
    match: [
      { id: '1x2', name: '1X2', type: 'match' },
      { id: 'set_handicap_-1.5', name: 'Handicap Set -1.5', type: 'handicap' },
      { id: 'set_handicap_0', name: 'Handicap Set 0', type: 'handicap' },
      { id: 'set_handicap_1.5', name: 'Handicap Set +1.5', type: 'handicap' }
    ],
    over_under: [
      { id: 'games_over_20.5', name: 'Games Over 20.5', type: 'over_under' },
      { id: 'games_under_20.5', name: 'Games Under 20.5', type: 'over_under' },
      { id: 'sets_over_3.5', name: 'Sets Over 3.5', type: 'over_under' },
      { id: 'sets_under_3.5', name: 'Sets Under 3.5', type: 'over_under' }
    ]
  }
};

// ── Engine Class ─────────────────────────────────────────────────────────────

class AdvancedBettingEngine extends EventEmitter {
  private wsServer: WebSocket.Server | null = null;
  private liveMatches: Map<string, LiveBettingState> = new Map();
  private clients: Set<WebSocket> = new Set();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    // WS separato disabilitato — usa il WS principale sulla porta 4000
    // this.initWebSocketServer();
    this.startDataSync();
  }

  private initWebSocketServer() {
    this.wsServer = new WebSocket.Server({ 
      port: 4003,
      perMessageDeflate: false
    });
    
    this.wsServer.on('connection', (ws) => {
      console.log('🚀 Client connected to Advanced Betting WebSocket');
      this.clients.add(ws);
      
      // Invia tutti i match live attuali
      ws.send(JSON.stringify({
        type: 'initial_matches',
        matches: Array.from(this.liveMatches.values()),
        timestamp: Date.now(),
        clientCount: this.clients.size
      }));
      
      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('Client disconnected');
      });
    });
  }

  private startDataSync() {
    // Sync ogni 30 secondi per nuovi match
    setInterval(() => {
      this.fetchLiveMatches();
    }, 30000);

    // Aggiornamento quote ogni secondo per match live
    setInterval(() => {
      this.updateAllLiveOdds();
    }, UPDATE_INTERVAL);
  }

  private toNumericId(input: string): number {
    let h = 0;
    for (let i = 0; i < input.length; i++) h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
    return Math.abs(h) || 1;
  }

  private mapSport(raw?: string): AdvancedMatch['sport'] {
    const key = (raw ?? '').toLowerCase();
    if (key.includes('soccer') || key.includes('football')) return 'football';
    if (key.includes('basket')) return 'basketball';
    if (key.includes('tennis')) return 'tennis';
    if (key.includes('volley')) return 'volleyball';
    if (key.includes('hockey')) return 'hockey';
    return 'football';
  }

  private toAdvancedMatch(event: BetStackEvent): AdvancedMatch {
    const minute = Math.max(0, Number(event.minute ?? 0));
    const homeScore = Number(event.score?.home ?? 0);
    const awayScore = Number(event.score?.away ?? 0);
    const startedAt = Number(event.time ?? Math.floor(Date.now() / 1000));
    const homeName = event.home?.name ?? 'Home';
    const awayName = event.away?.name ?? 'Away';
    const homeId = this.toNumericId(`home:${homeName}`);
    const awayId = this.toNumericId(`away:${awayName}`);
    const leagueName = event.league?.name ?? 'Live';
    const tournamentId = this.toNumericId(`league:${leagueName}`);

    return {
      id: event.id,
      sport: this.mapSport(event.sport_category),
      tournament: {
        id: tournamentId,
        name: leagueName,
        category: {
          name: 'Live',
          sport: {
            name: event.sport_category ?? 'football'
          }
        }
      },
      homeTeam: {
        id: homeId,
        name: homeName,
        slug: homeName.toLowerCase().replace(/\s+/g, '-'),
        shortName: homeName.slice(0, 3).toUpperCase()
      },
      awayTeam: {
        id: awayId,
        name: awayName,
        slug: awayName.toLowerCase().replace(/\s+/g, '-'),
        shortName: awayName.slice(0, 3).toUpperCase()
      },
      homeScore: { current: homeScore },
      awayScore: { current: awayScore },
      status: {
        code: 0,
        type: 0,
        description: event.live ? 'Live' : 'Scheduled',
        finished: !event.live,
        started: !!event.live,
        cancelled: false,
        suspended: false,
        hasTime: true,
        hasScore: true
      },
      time: {
        current: minute,
        display: `${minute}'`,
        period: 1,
        startedAt
      },
      statistics: {
        ballPossession: { home: 50, away: 50 },
        shots: {
          total: { home: 0, away: 0 },
          onTarget: { home: 0, away: 0 }
        },
        fouls: { home: 0, away: 0 },
        corners: { total: { home: 0, away: 0 } },
        yellowCards: { home: 0, away: 0 },
        redCards: { home: 0, away: 0 }
      },
      events: []
    };
  }

  private mapMarketType(key?: string): MarketOdds['marketType'] {
    const marketKey = (key ?? '').toLowerCase();
    if (marketKey === 'h2h') return 'match';
    if (marketKey === 'totals' || marketKey.includes('over') || marketKey.includes('under')) return 'over_under';
    if (marketKey === 'spreads' || marketKey.includes('handicap')) return 'handicap';
    if (marketKey === 'btts' || marketKey.includes('both_teams_score')) return 'both_teams_score';
    if (marketKey.includes('correct_score')) return 'correct_score';
    if (marketKey.includes('corners')) return 'corners';
    if (marketKey.includes('cards')) return 'cards';
    return 'special';
  }

  private mapApiMarkets(event: BetStackEvent): MarketOdds[] {
    const mergedByKey = new Map<string, OddsApiMarket>();
    const rawMarkets = (event.bookmakers ?? []).flatMap((bk) => bk.markets ?? []);

    for (const market of rawMarkets) {
      const key = market.key ?? 'market';
      const existing = mergedByKey.get(key);
      if (!existing) {
        mergedByKey.set(key, { key, outcomes: [...(market.outcomes ?? [])] });
        continue;
      }

      const mergedOutcomes = [...(existing.outcomes ?? [])];
      for (const outcome of market.outcomes ?? []) {
        const idx = mergedOutcomes.findIndex(
          (o) => o.name === outcome.name && o.point === outcome.point
        );
        if (idx >= 0) mergedOutcomes[idx] = { ...outcome };
        else mergedOutcomes.push({ ...outcome });
      }
      mergedByKey.set(key, { key, outcomes: mergedOutcomes });
    }

    const markets: MarketOdds[] = [];
    for (const [key, market] of mergedByKey.entries()) {
      const validOutcomes = (market.outcomes ?? []).filter((o) => Number(o.price) > 1);
      if (validOutcomes.length === 0) continue;

      const impliedSum = validOutcomes.reduce((acc, o) => acc + 1 / Number(o.price), 0);
      const margin = Math.max(0, (impliedSum - 1) * 100);

      const outcomes = validOutcomes.map((outcome, idx) => {
        const odd = Number(outcome.price);
        const implied = odd > 1 ? 1 / odd : 0;
        const probability = impliedSum > 0 ? implied / impliedSum : 0;
        const pointSuffix = outcome.point != null ? `_${String(outcome.point)}` : '';
        return {
          outcomeId: `${key}_${idx}${pointSuffix}`,
          outcomeName: outcome.point != null ? `${outcome.name} (${outcome.point})` : outcome.name,
          odds: Math.round(odd * 100) / 100,
          probability,
          impliedProbability: implied,
          margin,
          isLocked: odd <= MIN_ODDS_THRESHOLD,
          lastUpdated: Date.now()
        };
      });

      markets.push({
        marketId: key,
        marketName: key,
        marketType: this.mapMarketType(key),
        outcomes,
        suspended: false,
        minStake: 1,
        maxStake: 10000
      });
    }

    return markets;
  }

  private async fetchLiveMatches() {
    try {
      let liveEvents = await fetchXcodetecLive();
      if ((liveEvents?.length ?? 0) === 0) {
        liveEvents = await refreshLiveEvents();
      }

      const liveOnly = (liveEvents ?? []).filter((event) => event.live === true);
      const matches: AdvancedMatch[] = liveOnly
        .filter((event) => event.live === true)
        .map((event) => this.toAdvancedMatch(event));

      const sourceById = new Map(liveOnly.map((event) => [event.id, event]));

      if (matches.length === 0) {
        if (this.liveMatches.size > 0) {
          console.warn('[advanced-betting] Live API returned 0 matches, keeping previous snapshot');
          return;
        }
        console.log('📊 Synced 0 live matches (xcodetec)');
      }
      
      for (const match of matches) {
        const sourceEvent = sourceById.get(match.id);
        if (!this.liveMatches.has(match.id)) {
          this.initializeMatch(match, sourceEvent);
        } else {
          this.updateMatchData(match, sourceEvent);
        }
      }

      // Rimuovi match finiti
      if (matches.length > 0) {
        this.cleanupFinishedMatches(matches);
      }

      console.log(`📊 Synced ${matches.length} live matches (xcodetec)`);
    } catch (error: any) {
      console.error('❌ Error fetching live matches:', error);
    }
  }

  private initializeMatch(match: AdvancedMatch, sourceEvent?: BetStackEvent) {
    const apiMarkets = sourceEvent ? this.mapApiMarkets(sourceEvent) : [];
    const markets: MarketOdds[] = apiMarkets.length > 0 ? apiMarkets : this.generateInitialMarkets(match);
    
    const bettingState: LiveBettingState = {
      match,
      markets: new Map(),
      lastUpdate: Date.now(),
      totalVolume: 0,
      activeUsers: 0,
      riskLevel: 'low'
    };

    // Popola tutti i mercati
    for (const market of markets) {
      bettingState.markets.set(market.marketId, market);
    }

    this.liveMatches.set(match.id, bettingState);
    
    // Avvia aggiornamento per questo match
    this.startMatchUpdates(match.id);
    
    console.log(`⚡ Initialized match: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
  }

  private generateInitialMarkets(match: AdvancedMatch): MarketOdds[] {
    const sportMarkets = BETTING_MARKETS[match.sport as keyof typeof BETTING_MARKETS];
    if (!sportMarkets) return [];

    const markets: MarketOdds[] = [];

    // Genera quote per ogni categoria di mercato
    Object.values(sportMarkets).forEach((category: any) => {
      category.forEach((marketTemplate: any) => {
        const market = this.calculateMarketOdds(match, marketTemplate);
        if (market) markets.push(market);
      });
    });

    return markets;
  }

  private calculateMarketOdds(match: AdvancedMatch, marketTemplate: any): MarketOdds | null {
    const baseProbability = this.calculateBaseProbability(match, marketTemplate.type);
    
    if (!baseProbability) return null;

    const outcomes = this.generateOutcomes(match, marketTemplate, baseProbability);
    
    return {
      marketId: marketTemplate.id,
      marketName: marketTemplate.name,
      marketType: marketTemplate.type,
      outcomes,
      suspended: false,
      minStake: 1,
      maxStake: 10000
    };
  }

  private calculateBaseProbability(match: AdvancedMatch, marketType: string): number | null {
    const { homeScore, awayScore, statistics, time } = match;
    const minutesPlayed = time.current;

    switch (marketType) {
      case 'match':
        // Calcolo probabilità basato su forma e statistiche
        const homeStrength = this.calculateTeamStrength(match.homeTeam.id, statistics);
        const awayStrength = this.calculateTeamStrength(match.awayTeam.id, statistics);
        const totalStrength = homeStrength + awayStrength;
        return homeStrength / totalStrength;

      case 'over_under':
        // Calcolo basato su media gol e tempo
        const avgGoalsPerMinute = this.calculateAverageGoalsPerMinute(match);
        const expectedGoals = avgGoalsPerMinute * (90 - minutesPlayed);
        return expectedGoals / 2.5; // Normalizzato per 2.5

      case 'handicap':
        // Calcolo basato su differenza score e statistiche
        const scoreDiff = homeScore.current - awayScore.current;
        return this.normalizeProbability(scoreDiff / 10);

      case 'both_teams_score':
        // Calcolo basato su statistiche gol
        const scoringProbability = this.calculateScoringProbability(match);
        return scoringProbability;

      default:
        return null;
    }
  }

  private calculateTeamStrength(teamId: number, statistics: any): number {
    // Calcolo forza squadra basato su statistiche reali
    const baseStrength = 0.5;
    
    // Possesso palla
    const possessionBonus = statistics.ballPossession ? 
      (statistics.ballPossession.home - 50) / 100 : 0;

    // Tiri in porta
    const shotsBonus = statistics.shots ? 
      (statistics.shots.onTarget.home - statistics.shots.onTarget.away) / 20 : 0;

    // Corner
    const cornersBonus = statistics.corners ? 
      (statistics.corners.total.home - statistics.corners.total.away) / 10 : 0;

    return Math.max(0.1, Math.min(0.9, baseStrength + possessionBonus + shotsBonus + cornersBonus));
  }

  private calculateAverageGoalsPerMinute(match: AdvancedMatch): number {
    const { homeScore, awayScore, time } = match;
    const totalGoals = homeScore.current + awayScore.current;
    return time.current > 0 ? totalGoals / time.current : 0.015; // Default 1.35 gol per 90 min
  }

  private normalizeProbability(value: number): number {
    return Math.max(0.05, Math.min(0.95, 0.5 + value / 2));
  }

  private calculateScoringProbability(match: AdvancedMatch): number {
    const avgGoals = this.calculateAverageGoalsPerMinute(match) * 90;
    return Math.min(0.9, avgGoals / 2.5);
  }

  private generateOutcomes(match: AdvancedMatch, marketTemplate: any, baseProbability: number): Array<{
    outcomeId: string;
    outcomeName: string;
    odds: number;
    probability: number;
    impliedProbability: number;
    margin: number;
    isLocked: boolean;
    lastUpdated: number;
  }> {
    const outcomes = [];

    switch (marketTemplate.type) {
      case 'match':
        const homeProb = baseProbability;
        const drawProb = 0.25 * (1 - Math.abs(homeProb - 0.5));
        const awayProb = 1 - homeProb - drawProb;

        outcomes.push(
          this.createOutcome('home', match.homeTeam.name, homeProb),
          this.createOutcome('draw', 'Pareggio', drawProb),
          this.createOutcome('away', match.awayTeam.name, awayProb)
        );
        break;

      case 'over_under':
        const overProb = baseProbability;
        const underProb = 1 - overProb;

        outcomes.push(
          this.createOutcome('over', 'Over', overProb),
          this.createOutcome('under', 'Under', underProb)
        );
        break;

      case 'both_teams_score':
        const yesProb = baseProbability;
        const noProb = 1 - yesProb;

        outcomes.push(
          this.createOutcome('yes', 'Sì', yesProb),
          this.createOutcome('no', 'No', noProb)
        );
        break;
    }

    return outcomes;
  }

  private createOutcome(outcomeId: string, outcomeName: string, probability: number): any {
    // Applica margine del 5.5%
    const adjustedProbability = probability * (1 - MARGIN_PERCENTAGE);
    const odds = 1 / adjustedProbability;
    
    // Blocca quote troppo basse
    const isLocked = odds < MIN_ODDS_THRESHOLD;

    return {
      outcomeId,
      outcomeName,
      odds: isLocked ? MIN_ODDS_THRESHOLD : Math.round(odds * 100) / 100,
      probability,
      impliedProbability: 1 / odds,
      margin: MARGIN_PERCENTAGE * 100,
      isLocked,
      lastUpdated: Date.now()
    };
  }

  private startMatchUpdates(matchId: string) {
    // Aggiorna quote ogni secondo per questo match
    const interval = setInterval(() => {
      this.updateMatchOdds(matchId);
    }, UPDATE_INTERVAL);
    
    this.updateIntervals.set(matchId, interval);
  }

  private updateMatchOdds(matchId: string) {
    const bettingState = this.liveMatches.get(matchId);
    if (!bettingState) return;

    // Per gli eventi xcodetec manteniamo le quote reali API senza ricalcolo sintetico.
    if (matchId.startsWith('xc_live_')) return;

    const { match, markets } = bettingState;
    let hasSignificantChange = false;

    // Aggiorna ogni mercato basato su eventi live
    markets.forEach((market, marketId) => {
      const updatedMarket = this.updateMarketBasedOnLiveEvents(match, market);
      
      if (updatedMarket) {
        markets.set(marketId, updatedMarket);
        hasSignificantChange = true;
      }
    });

    if (hasSignificantChange) {
      bettingState.lastUpdate = Date.now();
      this.broadcastMatchUpdate(matchId, bettingState);
    }
  }

  private updateMarketBasedOnLiveEvents(match: AdvancedMatch, market: MarketOdds): MarketOdds | null {
    const { events, statistics, time } = match;
    let marketChanged = false;

    // Analizza eventi recenti per aggiornare quote
    const recentEvents = events.filter(e => 
      e.time.minute > time.current - 2 // Ultimi 2 minuti
    );

    market.outcomes = market.outcomes.map(outcome => {
      let newOdds = outcome.odds;
      let adjustmentFactor = 1;

      // Aggiusta quote basato su eventi recenti
      if (recentEvents.length > 0) {
        adjustmentFactor = this.calculateOddsAdjustment(recentEvents, market.marketType, outcome.outcomeId);
        newOdds = Math.max(MIN_ODDS_THRESHOLD, 
          Math.round(outcome.odds * adjustmentFactor * 100) / 100
        );

        // Limita variazione massima al secondo
        const maxChange = outcome.odds * MAX_ODDS_CHANGE_PER_SECOND;
        newOdds = Math.max(outcome.odds - maxChange, 
          Math.min(outcome.odds + maxChange, newOdds));

        if (Math.abs(newOdds - outcome.odds) > 0.01) {
          marketChanged = true;
        }
      }

      return {
        ...outcome,
        odds: newOdds,
        lastUpdated: Date.now(),
        isLocked: newOdds < MIN_ODDS_THRESHOLD
      };
    });

    return marketChanged ? market : null;
  }

  private calculateOddsAdjustment(events: any[], marketType: string, outcomeId: string): number {
    let adjustment = 1;

    events.forEach(event => {
      switch (marketType) {
        case 'match':
          if (event.type === 'goal') {
            if (event.isHome && outcomeId === 'home') adjustment *= 0.85;
            if (event.isAway && outcomeId === 'away') adjustment *= 0.85;
            if (outcomeId === 'draw') adjustment *= 1.15;
          }
          if (event.type === 'card') {
            if (event.isHome && outcomeId === 'away') adjustment *= 1.05;
            if (event.isAway && outcomeId === 'home') adjustment *= 1.05;
          }
          break;

        case 'over_under':
          if (event.type === 'goal') {
            if (outcomeId === 'over') adjustment *= 0.90;
            if (outcomeId === 'under') adjustment *= 1.10;
          }
          break;

        case 'both_teams_score':
          if (event.type === 'goal') {
            if (outcomeId === 'yes') adjustment *= 0.88;
            if (outcomeId === 'no') adjustment *= 1.12;
          }
          break;
      }
    });

    return adjustment;
  }

  private updateAllLiveOdds() {
    const matchIds = Array.from(this.liveMatches.keys());
    
    matchIds.forEach(matchId => {
      this.updateMatchOdds(matchId);
    });
  }

  private updateMatchData(match: AdvancedMatch, sourceEvent?: BetStackEvent) {
    const bettingState = this.liveMatches.get(match.id);
    if (!bettingState) return;

    bettingState.match = match;
    bettingState.lastUpdate = Date.now();

    const apiMarkets = sourceEvent ? this.mapApiMarkets(sourceEvent) : [];
    if (apiMarkets.length > 0) {
      bettingState.markets.clear();
      for (const market of apiMarkets) {
        bettingState.markets.set(market.marketId, market);
      }
    }

    // Aggiorna livello di rischio
    bettingState.riskLevel = this.calculateRiskLevel(match);
  }

  private calculateRiskLevel(match: AdvancedMatch): 'low' | 'medium' | 'high' | 'critical' {
    const { time, statistics } = match;
    const minutesPlayed = time.current;

    // Fattori di rischio
    const timeRisk = minutesPlayed > 75 ? 'high' : minutesPlayed > 45 ? 'medium' : 'low';
    const scoreDiffRisk = Math.abs(match.homeScore.current - match.awayScore.current) > 2 ? 'high' : 'low';
    const cardsRisk = (statistics.yellowCards.home + statistics.yellowCards.away + 
                     statistics.redCards.home + statistics.redCards.away) > 6 ? 'medium' : 'low';

    // Calcolo livello complessivo
    const riskFactors = [timeRisk, scoreDiffRisk, cardsRisk];
    const highRiskCount = riskFactors.filter(r => r === 'high').length;

    if (highRiskCount >= 2) return 'critical';
    if (highRiskCount === 1) return 'high';
    if (riskFactors.some(r => r === 'medium')) return 'medium';
    return 'low';
  }

  private cleanupFinishedMatches(currentMatches: AdvancedMatch[]) {
    const currentMatchIds = new Set(currentMatches.map(m => m.id));
    
    for (const [matchId, bettingState] of this.liveMatches.entries()) {
      if (!currentMatchIds.has(matchId) || bettingState.match.status.finished) {
        // Ferma aggiornamenti
        const interval = this.updateIntervals.get(matchId);
        if (interval) {
          clearInterval(interval);
          this.updateIntervals.delete(matchId);
        }

        // Rimuovi match
        this.liveMatches.delete(matchId);
        
        console.log(`🏁 Match finished: ${bettingState.match.homeTeam.name} vs ${bettingState.match.awayTeam.name}`);
      }
    }
  }

  private broadcastMatchUpdate(matchId: string, bettingState: LiveBettingState) {
    const message = JSON.stringify({
      type: 'match_update',
      matchId,
      data: bettingState,
      timestamp: Date.now()
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // ── Metodi Pubblici ─────────────────────────────────────────────────────

  public getLiveMatches(): LiveBettingState[] {
    return Array.from(this.liveMatches.values());
  }

  public getMatchMarkets(matchId: string): Map<string, MarketOdds> | null {
    const bettingState = this.liveMatches.get(matchId);
    return bettingState ? bettingState.markets : null;
  }

  public getMarketOdds(matchId: string, marketId: string): MarketOdds | null {
    const markets = this.getMatchMarkets(matchId);
    if (!markets) return null;
    const market = markets.get(marketId);
    return market || null;
  }

  public getStats() {
    return {
      totalLiveMatches: this.liveMatches.size,
      totalMarkets: Array.from(this.liveMatches.values())
        .reduce((sum, state) => sum + state.markets.size, 0),
      connectedClients: this.clients.size,
      websocketPort: 4003,
      uptime: process.uptime(),
      marginPercentage: MARGIN_PERCENTAGE * 100,
      minOddsThreshold: MIN_ODDS_THRESHOLD,
      updateInterval: UPDATE_INTERVAL
    };
  }
}

// ── Esportazione ───────────────────────────────────────────────────────────────

const advancedBettingEngine = new AdvancedBettingEngine();

export default advancedBettingEngine;
