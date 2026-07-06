import { BetStackEvent, OddsApiBookmaker } from './betStackService';
import { computeLiveOdds, computeAllLiveMarkets, BaseOdds, LiveMarketOdds, MatchContext } from './liveOddsEngine';
import sportBettingService from './sportBettingApiService';
import { fetchSibet90Live } from './sibet90LiveService';

export const LIVE_MARGIN = 0.12;

interface LiveCache {
  events: BetStackEvent[];
  updatedAt: number;
}

let cache: LiveCache = { events: [], updatedAt: 0 };

// Map sport-betting events to BetStackEvent with bookmakers
async function fetchSportBettingLiveEvents(): Promise<BetStackEvent[]> {
  try {
    const events = await sportBettingService.getLiveEvents();
    if (!events || events.length === 0) return [];

    // Get odds for all live events
    const odds = await sportBettingService.getLiveOdds();
    const oddsMap = new Map(odds.map(o => [o.eventId, o]));

    return events.map(event => {
      const baseEvent = sportBettingService.convertToBetStackEvent(event);
      const eventOdds = oddsMap.get(event.id);

      // Build bookmakers from odds data
      const bookmakers: OddsApiBookmaker[] = [];
      if (eventOdds?.bookmakers) {
        for (const bm of eventOdds.bookmakers) {
          bookmakers.push({
            key: bm.id,
            title: bm.name,
            markets: bm.markets.map(m => ({
              key: m.key,
              outcomes: m.outcomes.map(o => ({
                name: o.name,
                price: o.price,
                point: o.point
              }))
            }))
          });
        }
      }

      return {
        ...baseEvent,
        live: true,
        bookmakers,
        league: { name: event.league || 'Live' }
      };
    });
  } catch (error) {
    console.error('[liveService] Error fetching sport-betting live events:', error);
    return [];
  }
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function estimateBaseOdds(home: string, away: string): BaseOdds {
  const hv = hashStr(`${home}|${away}`);
  const pH = 0.36 + (hv % 1000) / 5000;
  const pD = 0.24 + ((hv >> 4) % 500) / 7000;
  const pA = Math.max(0.1, 1 - pH - pD);
  const tot = pH + pD + pA;
  const margin = 0.08;
  return {
    home: parseFloat(((1 + margin) / (pH / tot)).toFixed(2)),
    draw: parseFloat(((1 + margin) / (pD / tot)).toFixed(2)),
    away: parseFloat(((1 + margin) / (pA / tot)).toFixed(2)),
  };
}

function applyLiveMarginToOdds(odds: BaseOdds) {
  const applyMargin = (o: number) => {
    if (o <= 1) return 0;
    const prob = 1 / o;
    const adjusted = Math.min(0.97, prob * (1 + LIVE_MARGIN));
    return parseFloat((1 / adjusted).toFixed(2));
  };

  return {
    home: applyMargin(odds.home),
    draw: applyMargin(odds.draw),
    away: applyMargin(odds.away),
  };
}

export async function refreshLiveEvents(): Promise<BetStackEvent[]> {
  const now = Date.now();

  // Primary source: sibet90.net live_ws.php
  let liveEvents: BetStackEvent[] = [];
  try {
    liveEvents = await fetchSibet90Live();
    console.log(`[liveService] sibet90 live events: ${liveEvents.length}`);
  } catch (error) {
    console.error('[liveService] sibet90 error:', error);
  }

  // Fallback: sport-betting API
  if (liveEvents.length === 0) {
    liveEvents = await fetchSportBettingLiveEvents();
    console.log(`[liveService] Sport-betting fallback: ${liveEvents.length}`);
  }

  cache = { events: liveEvents, updatedAt: now };
  return liveEvents;
}

export function getCachedLiveEvents(): BetStackEvent[] {
  return cache.events;
}

export function getLiveEventOdds(eventId: string): OddsApiBookmaker[] | null {
  const event = cache.events.find((e) => e.id === eventId);
  return event?.bookmakers ?? null;
}

export function isEventLive(eventId: string): boolean {
  return cache.events.some((e) => e.id === eventId && e.live === true);
}

export interface CurrentOdds {
  home: number;
  draw: number;
  away: number;
}

export function getEventH2HOdds(eventId: string): CurrentOdds | null {
  const event = cache.events.find((e) => e.id === eventId);
  if (!event) return null;

  const bookmakers = event.bookmakers ?? [];
  for (const bk of bookmakers) {
    for (const m of bk.markets ?? []) {
      if (m.key !== 'h2h') continue;
      const oc = m.outcomes ?? [];
      const h = oc.find((o) => o.name === event.home.name)?.price ?? 0;
      const d = oc.find((o) => o.name === 'Draw')?.price ?? 0;
      const a = oc.find((o) => o.name === event.away.name)?.price ?? 0;
      if (h > 1 && a > 1) {
        return { home: h, draw: d > 1 ? d : 0, away: a };
      }
    }
  }

  const base = estimateBaseOdds(event.home.name, event.away.name);
  return { home: base.home, draw: base.draw, away: base.away };
}

export function getDynamicLiveOdds(eventId: string): CurrentOdds | null {
  const event = cache.events.find((e) => e.id === eventId);
  if (!event) return null;

  const baseH2H = getEventH2HOdds(eventId);
  if (!baseH2H) return null;

  const baseOdds: BaseOdds = {
    home: baseH2H.home,
    draw: baseH2H.draw > 1 ? baseH2H.draw : 3.2,
    away: baseH2H.away,
  };

  const homeScore = Number(event.score?.home ?? 0);
  const awayScore = Number(event.score?.away ?? 0);
  const minute = event.minute ?? 45;
  const liveOdds = computeLiveOdds(baseOdds, homeScore, awayScore, minute);

  return {
    home: liveOdds.home,
    draw: liveOdds.draw,
    away: liveOdds.away,
  };
}

export function getAllLiveMarkets(eventId: string): LiveMarketOdds | null {
  const event = cache.events.find((e) => e.id === eventId);
  if (!event) return null;

  const current = getEventH2HOdds(eventId);
  const base = current
    ? {
        home: current.home,
        draw: current.draw > 1 ? current.draw : 3.2,
        away: current.away,
      }
    : estimateBaseOdds(event.home.name, event.away.name);

  const ctx: MatchContext = {
    base,
    homeScore: Number(event.score?.home ?? 0),
    awayScore: Number(event.score?.away ?? 0),
    minute: event.minute ?? 45,
    sport: event.sport_category ?? 'soccer',
    isExtraTime: false,
  };

  return computeAllLiveMarkets(ctx);
}

export { applyLiveMarginToOdds };

