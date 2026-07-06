/**
 * xcodetecService — fetcha eventi e quote da api.xcodetec.com
 * Integrazione API pubblica xcodetec/betsport (prematch + live snapshot)
 */

import { BetStackEvent, OddsApiMarket } from './betStackService';
import { 
  getCachedNavbar, setCachedNavbar,
  getCachedLiveSnapshot, setCachedLiveSnapshot,
  clearXcodetecCache,
} from './xcodetecCache';
import { withRetry, getCircuitBreaker, sleep } from '../utils/backoff';

const XCODE_BASE = 'https://api.xcodetec.com/api';
const ORIGIN = process.env.XCODETEC_ORIGIN ?? 'https://www.joverbet.com';

const HEADERS = {
  'Origin': ORIGIN,
  'Referer': ORIGIN + '/',
  'Accept': 'application/json',
  'Skin-Language': process.env.XCODETEC_LANGUAGE ?? 'it-IT',
  'Skin-TZ': process.env.XCODETEC_TIMEZONE ?? 'Europe/Rome',
  'Authorization': process.env.XCODETEC_BEARER_TOKEN
    ? `Bearer ${process.env.XCODETEC_BEARER_TOKEN}`
    : 'Bearer null',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

// Cache interna
let navbarCache: XcNavbarSport[] | null = null;
let navbarCacheTs = 0;
let navbarFavourites: number[] = [];
let navbarEventMeta = new Map<string, { home: string; away: string; begin: number; league: string; sportCategory: string }>();
let navbarTournamentMeta = new Map<number, { league: string; sportCategory: string }>();
const NAVBAR_TTL = 10 * 60 * 1000; // 10 minuti

export function clearNavbarCache(): void {
  navbarCache = null;
  navbarCacheTs = 0;
  navbarFavourites = [];
  navbarEventMeta.clear();
  navbarTournamentMeta.clear();
}

// Clear all caches - call when data seems stale
export async function clearAllCaches(): Promise<void> {
  clearNavbarCache();
  await clearXcodetecCache();
  console.log('[xcodetec] All caches cleared');
}

// ── Tipi API xcodetec ─────────────────────────────────────────────────────────

// Wrapper generico per tutte le risposte xcodetec
interface XcApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

interface XcNavbarData {
  sports?: XcNavbarSport[];
  favourites?: unknown[];
  widgets?: unknown[];
  outrights?: unknown[];
}

// Struttura reale restituita da /api/sport/navbar
// { id, label, type, icon, order, children: [ { id, label, children: [ { id, label } ] } ] }
interface XcNavbarSport {
  id: number;
  label?: string;   // nome sport (es. "Calcio")
  name?: string;    // fallback
  slug?: string;
  type?: string;
  icon?: string;
  order?: number;
  children?: XcNavbarCategory[];    // struttura reale
  categories?: XcNavbarCategory[];  // struttura alternativa
}

interface XcNavbarCategory {
  id: number;
  label?: string;
  name?: string;
  children?: XcNavbarTournament[];      // struttura reale
  tournaments?: XcNavbarTournament[];   // struttura alternativa
}

interface XcNavbarTournament {
  id: number;
  label?: string;
  name?: string;
  type?: string;
  children?: Array<Record<string, unknown>>;
}

interface XcEvent {
  id: number | string;
  name?: string;
  home_team?: string | { name: string };
  away_team?: string | { name: string };
  home?: string | { name: string };
  away?: string | { name: string };
  start_time?: number | string;
  scheduled?: number | string;
  begin?: number; // Unix timestamp for event start
  live_markets?: XcMarket[]; // Live markets data
  tournament?: { name: string };
  league?: { name: string };
  sport?: { name: string } | string;
  markets?: XcMarket[];
  odds?: XcOddsBlock;
  status?: string;
  live?: boolean;
  score?: { home: number | null; away: number | null };
  participants?: Array<{ name?: string; home?: boolean; away?: boolean }>;
  competitors?: Array<{ name?: string; side?: string }>;
  teams?: Array<{ name?: string }>;
  team1?: string;
  team2?: string;
  player1?: string;
  player2?: string;
}

interface XcMarket {
  id?: number | string;
  name?: string;
  key?: string;
  outcomes?: XcOutcome[];
  selections?: XcOutcome[];
  odds?: XcOutcome[];
}

interface XcOutcome {
  id?: number | string;
  name?: string;
  label?: string;
  odds?: number;
  price?: number;
  value?: number;
  spread?: number | string;
  quick?: string;
  code?: string;
}

interface XcOddsBlock {
  h2h?: { home: number; draw?: number; away: number };
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractTeamName(val: string | { name: string } | undefined): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val.name ?? '';
}

function parseFromName(name: string): { home: string; away: string } | null {
  const n = name.trim();
  if (!n) return null;
  const separators = [' vs ', ' - ', ' v ', ' @ ', '–', '—'];
  for (const sep of separators) {
    const idx = n.toLowerCase().indexOf(sep.trim().toLowerCase());
    if (idx > 0) {
      const parts = n.split(new RegExp(sep, 'i')).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) return { home: parts[0], away: parts[1] };
    }
  }
  return null;
}

function extractTeams(ev: XcEvent): { home: string; away: string } {
  let home = extractTeamName(ev.home_team ?? ev.home);
  let away = extractTeamName(ev.away_team ?? ev.away);
  if (home && away) return { home, away };

  if (Array.isArray(ev.participants) && ev.participants.length >= 2) {
    const ph = ev.participants.find((p) => p.home)?.name ?? ev.participants[0]?.name ?? '';
    const pa = ev.participants.find((p) => p.away)?.name ?? ev.participants[1]?.name ?? '';
    home = home || ph || '';
    away = away || pa || '';
  }
  if ((!home || !away) && Array.isArray(ev.competitors) && ev.competitors.length >= 2) {
    const ch = ev.competitors.find((c) => (c.side ?? '').toLowerCase() === 'home')?.name ?? ev.competitors[0]?.name ?? '';
    const ca = ev.competitors.find((c) => (c.side ?? '').toLowerCase() === 'away')?.name ?? ev.competitors[1]?.name ?? '';
    home = home || ch || '';
    away = away || ca || '';
  }
  if ((!home || !away) && Array.isArray(ev.teams) && ev.teams.length >= 2) {
    home = home || (ev.teams[0]?.name ?? '');
    away = away || (ev.teams[1]?.name ?? '');
  }
  if (!home || !away) {
    home = home || ev.team1 || ev.player1 || '';
    away = away || ev.team2 || ev.player2 || '';
  }
  if ((!home || !away) && ev.name) {
    const parsed = parseFromName(ev.name);
    if (parsed) {
      home = home || parsed.home;
      away = away || parsed.away;
    }
  }
  return { home: home.trim(), away: away.trim() };
}

function extractTime(val: number | string | undefined): number {
  if (!val) return Math.floor(Date.now() / 1000);
  if (typeof val === 'number') return val;
  return Math.floor(new Date(val).getTime() / 1000);
}

// Estrae array di eventi da qualsiasi struttura di risposta
function extractEvents(raw: unknown): XcEvent[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as XcEvent[];
  const obj = raw as Record<string, unknown>;
  
  // NEW: xcodetec snapshot structure has events_labels and events_markets
  if (obj.events_labels && obj.events_markets) {
    const eventsLabels = obj.events_labels as Record<string, any>;
    const eventsMarkets = obj.events_markets as Record<string, any>;
    const markets = obj.markets as Record<string, any> || {};
    const tournaments = obj.tournaments as Record<string, any> || {};
    const sports = obj.sports as Record<string, any> || {};
    
    const events: XcEvent[] = [];
    for (const eventId of Object.keys(eventsLabels)) {
      const event = eventsLabels[eventId];
      const eventMarketsData = eventsMarkets[eventId];
      
      // Build markets array from events_markets
      const marketsList: any[] = [];
      if (eventMarketsData) {
        for (const marketId of Object.keys(eventMarketsData)) {
          const marketData = eventMarketsData[marketId];
          const marketInfo = markets[marketId];
          
          if (marketData && marketData.odds) {
            // Parse odds
            const outcomes: any[] = [];
            const oddsData = marketData.odds;
            
            if (Array.isArray(oddsData)) {
              for (const item of oddsData) {
                if (typeof item === 'object') {
                  outcomes.push({
                    name: item.name || item.label || item.outcome,
                    price: parseFloat(item.price || item.odd || item.value || item.coefficient || '0')
                  });
                }
              }
            } else if (typeof oddsData === 'object') {
              for (const key of Object.keys(oddsData)) {
                const item = oddsData[key];
                if (typeof item === 'object') {
                  outcomes.push({
                    name: item.name || item.label || item.outcome || `Outcome ${key}`,
                    price: parseFloat(item.price || item.odd || item.value || item.coefficient || '0')
                  });
                }
              }
            }
            
            if (outcomes.length > 0) {
              marketsList.push({
                key: marketInfo?.label || marketInfo?.name || marketId,
                name: marketInfo?.label || marketInfo?.name || 'Market',
                outcomes: outcomes.filter(o => o.price > 1)
              });
            }
          }
        }
      }
      
      const tournament = tournaments[event.tournament_id?.toString()] || {};
      const sport = sports[event.sport_id?.toString()] || {};
      
      events.push({
        id: event.id || eventId,
        name: `${event.home} vs ${event.away}`,
        home_team: event.home,
        away_team: event.away,
        home: event.home,
        away: event.away,
        sport: sport.label || sport.name || 'soccer',
        sport_id: event.sport_id,
        tournament: tournament.label || tournament.name,
        tournament_id: event.tournament_id,
        begin: event.begin,
        start_time: event.begin,
        scheduled: event.begin,
        score: event.score,
        timer: event.timer,
        phase: event.phase,
        live: true,
        status: event.started ? 'live' : 'upcoming',
        markets: marketsList,
        odds: { markets: marketsList }
      } as XcEvent);
    }
    return events;
  }
  
  // { success, data: [...] }
  if (obj.data !== undefined) {
    if (Array.isArray(obj.data)) return obj.data as XcEvent[];
    // { success, data: { events: [...] } }
    const inner = obj.data as Record<string, unknown>;
    if (Array.isArray(inner.events)) return inner.events as XcEvent[];
    if (inner.events && typeof inner.events === 'object') {
      return Object.values(inner.events as Record<string, unknown>) as XcEvent[];
    }
    if (Array.isArray(inner.data)) return inner.data as XcEvent[];
  }
  if (Array.isArray(obj.events)) return obj.events as XcEvent[];
  if (obj.events && typeof obj.events === 'object') {
    return Object.values(obj.events as Record<string, unknown>) as XcEvent[];
  }
  return [];
}

function mapXcEventToBetStack(
  ev: XcEvent,
  sportCategory: string,
  leagueName: string
): BetStackEvent | null {
  const { home, away } = extractTeams(ev);
  if (!home || !away) return null;

  const id = `xc_${ev.id}`;
  const time = extractTime(ev.start_time ?? ev.scheduled);

  const marketList: XcMarket[] = ev.markets ?? (ev.odds as any)?.markets ?? ev.live_markets ?? [];
  const markets = marketList
    .map((m: XcMarket) => mapXcMarketToOddsApi(m, home, away))
    .filter((m): m is OddsApiMarket => m !== null);

  if (markets.length === 0 && ev.odds?.h2h) {
    const h2h = ev.odds.h2h;
    markets.push({
      key: 'h2h',
      outcomes: [
        { name: home, price: Number(h2h.home) || 0 },
        ...(h2h.draw != null ? [{ name: 'Draw', price: Number(h2h.draw) || 0 }] : []),
        { name: away, price: Number(h2h.away) || 0 },
      ].filter((o) => o.price > 1),
    });
  }
  
  // No fallback - return empty markets if no real odds available

  const normalizedSportCategory = normalizeSportCategory(sportCategory);

  return {
    id,
    home: { name: home },
    away: { name: away },
    time,
    sport_id: normalizedSportCategory,
    sport_category: normalizedSportCategory,
    league: { name: leagueName },
    bookmakers: markets.length > 0 ? [{ key: 'xcodetec', title: 'xcodetec', markets }] : [],
    live: ev.live ?? false,
    score: ev.score ?? undefined,
  };
}

function normalizeSportCategory(value: string): string {
  const v = (value ?? '').trim().toLowerCase();
  if (!v) return 'calcio';
  if (v === 'soccer' || v === 'football' || v === 'calcio') return 'calcio';
  return v;
}

function normalizeQuick(value: string): string {
  return value.trim().toLowerCase();
}

function quickFromCode(code: string | undefined): string {
  if (!code) return '';
  const parts = code.split('|');
  return normalizeQuick(parts[parts.length - 1] ?? '');
}

function toPoint(spread: number | string | undefined): number | undefined {
  if (spread == null || spread === '') return undefined;
  const n = Number(spread);
  return Number.isFinite(n) ? n : undefined;
}

function upsertOutcome(
  sink: Array<{ name: string; price: number; point?: number }>,
  name: string,
  price: number,
  point?: number
): void {
  if (!name || !(price > 1)) return;
  const idx = sink.findIndex((o) => o.name === name && o.point === point);
  if (idx >= 0) sink[idx] = { name, price, ...(point !== undefined ? { point } : {}) };
  else sink.push({ name, price, ...(point !== undefined ? { point } : {}) });
}

function mapXcMarketToOddsApi(market: XcMarket, home: string, away: string): OddsApiMarket | null {
  const rawOutcomes = (market.outcomes ?? market.selections ?? market.odds ?? [])
    .map((o) => {
      const quickRaw = (o.quick ?? quickFromCode(o.code)) as string;
      const quick = normalizeQuick(quickRaw);
      return {
        id: String(o.id ?? ''),
        name: (o.name ?? o.label ?? '').trim(),
        quick,
        price: Number(o.odds ?? o.price ?? o.value ?? 0),
        point: toPoint(o.spread),
      };
    })
    .filter((o) => o.price > 1);

  if (rawOutcomes.length === 0) return null;

  const hasQuick1 = rawOutcomes.some((o) => o.quick === '1');
  const hasQuick2 = rawOutcomes.some((o) => o.quick === '2');
  if (hasQuick1 && hasQuick2) {
    const outcomes: Array<{ name: string; price: number; point?: number }> = [];
    for (const o of rawOutcomes) {
      if (o.quick === '1') upsertOutcome(outcomes, home, o.price, o.point);
      else if (o.quick === '2') upsertOutcome(outcomes, away, o.price, o.point);
      else if (o.quick === '0' || o.quick === 'x') upsertOutcome(outcomes, 'Draw', o.price, o.point);
    }
    if (outcomes.length > 0) return { key: 'h2h', outcomes };
  }

  const noQuick = rawOutcomes.every((o) => !o.quick);
  const noPoints = rawOutcomes.every((o) => o.point == null);
  if (noQuick && noPoints && (rawOutcomes.length === 2 || rawOutcomes.length === 3)) {
    const outcomes: Array<{ name: string; price: number; point?: number }> = [];
    upsertOutcome(outcomes, home, rawOutcomes[0].price);
    if (rawOutcomes.length === 3) upsertOutcome(outcomes, 'Draw', rawOutcomes[1].price);
    upsertOutcome(outcomes, away, rawOutcomes[rawOutcomes.length - 1].price);
    if (outcomes.length > 0) return { key: 'h2h', outcomes };
  }

  const marketKey = market.key ?? market.name ?? `xc_market_${String(market.id ?? 'unknown')}`;
  const outcomes: Array<{ name: string; price: number; point?: number }> = [];
  for (const [idx, o] of rawOutcomes.entries()) {
    const fallbackName = o.quick
      ? `q:${o.quick}`
      : o.name || `Outcome ${idx + 1}`;
    upsertOutcome(outcomes, o.name || fallbackName, o.price, o.point);
  }
  return outcomes.length > 0 ? { key: marketKey, outcomes } : null;
}

function mergeMarkets(
  base: OddsApiMarket[],
  incoming: OddsApiMarket[]
): OddsApiMarket[] {
  const out = [...base.map((m) => ({ ...m, outcomes: [...m.outcomes] }))];
  for (const next of incoming) {
    const existing = out.find((m) => m.key === next.key);
    if (!existing) {
      out.push({ ...next, outcomes: [...next.outcomes] });
      continue;
    }
    for (const o of next.outcomes) {
      const idx = existing.outcomes.findIndex((x) => x.name === o.name && x.point === o.point);
      if (idx >= 0) existing.outcomes[idx] = { ...o };
      else existing.outcomes.push({ ...o });
    }
  }
  return out;
}

function mergeEvents(existing: BetStackEvent, incoming: BetStackEvent): BetStackEvent {
  const existingBks = existing.bookmakers ?? [];
  const incomingBks = incoming.bookmakers ?? [];
  const mergedBookmakers = [...existingBks.map((bk) => ({ ...bk, markets: [...bk.markets] }))];

  for (const bk of incomingBks) {
    const target = mergedBookmakers.find((b) => b.key === bk.key);
    if (!target) {
      mergedBookmakers.push({ ...bk, markets: [...bk.markets] });
      continue;
    }
    target.markets = mergeMarkets(target.markets ?? [], bk.markets ?? []);
  }

  return {
    ...existing,
    home: existing.home?.name ? existing.home : incoming.home,
    away: existing.away?.name ? existing.away : incoming.away,
    time: existing.time ?? incoming.time,
    league: existing.league?.name ? existing.league : incoming.league,
    bookmakers: mergedBookmakers,
    live: existing.live ?? incoming.live,
    score: existing.score ?? incoming.score,
  };
}

// ── Fetch navbar ──────────────────────────────────────────────────────────────

export async function fetchNavbar(): Promise<XcNavbarSport[]> {
  // Try Redis cache first
  const cached = await getCachedNavbar();
  if (cached) {
    console.log('[xcodetec] navbar from Redis cache');
    return cached;
  }
  
  // Fall back to memory cache
  if (navbarCache && Date.now() - navbarCacheTs < NAVBAR_TTL) {
    return navbarCache;
  }
  
  const circuitBreaker = getCircuitBreaker('navbar');
  
  try {
    const json = await circuitBreaker.execute(async () => {
      return await withRetry(async () => {
        const res = await fetch(`${XCODE_BASE}/sport/navbar`, {
          headers: HEADERS,
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return (await res.json()) as XcApiResponse<XcNavbarData>;
      }, { maxRetries: 3, baseDelay: 1000 });
    });
    
    if (json?.data?.sports) {
      navbarCache = json.data.sports;
      navbarFavourites = Array.isArray(json.data.favourites)
        ? json.data.favourites.filter((x): x is number => typeof x === 'number')
        : [];
      navbarCacheTs = Date.now();
      // Cache in Redis
      await setCachedNavbar(navbarCache);
      return navbarCache;
    }
    return navbarCache ?? [];
  } catch (err) {
    console.warn('[xcodetec] navbar error:', err);
    return navbarCache ?? [];
  }
}

// ── Fetch eventi di un torneo ─────────────────────────────────────────────────

async function fetchTournamentEvents(
  tournamentId: number,
  marketType = 4,
  sportCategory: string,
  leagueName: string
): Promise<BetStackEvent[]> {
  // Retry con backoff su 429
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const url = `${XCODE_BASE}/sport/tournament/${tournamentId}/${marketType}`;
      const res = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(10000),
      });

      if (res.status === 429) {
        const wait = (attempt + 1) * 2000; // 2s, 4s, 6s
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!res.ok) {
        if (res.status !== 404) console.warn(`[xcodetec] tournament ${tournamentId} HTTP ${res.status}`);
        return [];
      }

      const raw = await res.json() as unknown;
      const events = extractEvents(raw);

      // Filter: only future events (not started yet), remove events that already started
      const now = Math.floor(Date.now() / 1000);
      const mapped = events
        .map((e) => {
          const meta = navbarEventMeta.get(String(e.id));
          if (meta) {
            return {
              ...e,
              home: (e as any).home ?? meta.home,
              away: (e as any).away ?? meta.away,
              begin: (e as any).begin ?? meta.begin,
              start_time: (e as any).start_time ?? meta.begin,
              scheduled: (e as any).scheduled ?? meta.begin,
            } as XcEvent;
          }
          return e;
        })
        .filter(e => (e.begin ?? 0) > now)
        .map(e => mapXcEventToBetStack(e, sportCategory, leagueName))
        .filter((e): e is BetStackEvent => e !== null);

      if (mapped.length > 0) {
        console.log(`[xcodetec] tournament ${tournamentId} (${leagueName}): ${mapped.length} eventi`);
      }
      return mapped;
    } catch (err) {
      if (attempt === 2) console.warn(`[xcodetec] tournament ${tournamentId} error:`, err);
    }
  }
  return [];
}

async function fetchFeaturedEvents(): Promise<BetStackEvent[]> {
  try {
    const res = await fetch(`${XCODE_BASE}/sport/widget/featured`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn(`[xcodetec] featured HTTP ${res.status}`);
      return [];
    }

    const raw = await res.json() as unknown;
    const events = extractEvents(raw);
    const now = Math.floor(Date.now() / 1000);
    const mapped = events
      .map((e) => {
        const meta = navbarEventMeta.get(String(e.id));
        const tournamentId = Number((e as any).tournament_id ?? 0);
        const categoryId = Number((e as any).category_id ?? 0);
        const fallbackLeague = `Featured — T${tournamentId || 'NA'} C${categoryId || 'NA'}`;
        const leagueName = meta?.league ?? fallbackLeague;
        const sportCategory = meta?.sportCategory ?? 'soccer';

        const enriched = meta
          ? ({
              ...e,
              home: (e as any).home ?? meta.home,
              away: (e as any).away ?? meta.away,
              begin: (e as any).begin ?? meta.begin,
              start_time: (e as any).start_time ?? meta.begin,
              scheduled: (e as any).scheduled ?? meta.begin,
            } as XcEvent)
          : e;
        return mapXcEventToBetStack(enriched, sportCategory, leagueName);
      })
      .filter((ev): ev is BetStackEvent => ev !== null)
      .filter((ev) => (ev.time ?? 0) > now);

    if (mapped.length > 0) {
      console.log(`[xcodetec] featured: ${mapped.length} eventi`);
    }
    return mapped;
  } catch (err) {
    console.warn('[xcodetec] featured error:', err);
    return [];
  }
}

// ── Fetch live ────────────────────────────────────────────────────────────────

export async function fetchXcodetecLive(): Promise<BetStackEvent[]> {
  // Try Redis cache first for fast response
  const cached = await getCachedLiveSnapshot();
  
  const circuitBreaker = getCircuitBreaker('live');
  
  try {
    const raw = await circuitBreaker.execute(async () => {
      return await withRetry(async () => {
        const res = await fetch(`${XCODE_BASE}/live/snapshot`, {
          headers: HEADERS,
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          // Prova endpoint alternativo
          const res2 = await fetch(`${XCODE_BASE}/sport/live`, {
            headers: HEADERS,
            signal: AbortSignal.timeout(10000),
          });
          if (!res2.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          return await res2.json();
        }
        return await res.json();
      }, { maxRetries: 3, baseDelay: 500, maxDelay: 5000 });
    });

    const events = extractEvents(raw);
    const mapped = events
      .map(e => mapXcEventToBetStack(e, 'soccer', e.tournament?.name ?? 'Live'))
      .filter((e): e is BetStackEvent => e !== null)
      .map(e => ({ ...e, live: true }));

    // Cache in Redis
    await setCachedLiveSnapshot({ events: mapped, raw });
    
    console.log(`[xcodetec] live: ${mapped.length} eventi`);
    return mapped;
  } catch (err) {
    console.warn('[xcodetec] live error:', err);
    // Return cached data on error
    if (cached?.events) {
      console.log('[xcodetec] live: returning cached data');
      return cached.events;
    }
    return [];
  }
}

// Sport da fetchare (label lowercase) — limitiamo per evitare 429
const SPORT_WHITELIST = (process.env.XCODETEC_SPORT_WHITELIST ?? 'calcio,basket,tennis,hockey ghiaccio,pallavolo,rugby,baseball,pallamano,calcio a 5,football americano,pugilato,mma')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const SPORT_LIMIT = Number(process.env.XCODETEC_SPORT_LIMIT ?? '0');
const TOURNAMENT_MARKET_GROUPS = (process.env.XCODETEC_MARKET_GROUPS ?? '4')
  .split(',')
  .map((v) => Number(v.trim()))
  .filter((v) => Number.isFinite(v));

// ── Fetch prematch completo ───────────────────────────────────────────────────

export async function fetchXcodetecPrematch(
  onBatch?: (events: BetStackEvent[]) => Promise<void>
): Promise<BetStackEvent[]> {
  const allEventsById = new Map<string, BetStackEvent>();

  // Navbar → tutti i tornei (struttura: sport.children = categorie, categoria.children = tornei)
  const navbar = await fetchNavbar();
  if (!navbar.length) {
    console.warn('[xcodetec] navbar vuota');
    return [];
  }

  console.log(`[xcodetec] navbar: ${navbar.length} sport`);

  // Build event metadata map from navbar tree (contains home/away/begin).
  navbarEventMeta.clear();
  navbarTournamentMeta.clear();
  for (const sport of navbar) {
    const sportName = sport.label ?? sport.name ?? 'sport';
    const sc = sport.slug ?? sportName.toLowerCase().replace(/\s+/g, '_');
    for (const category of (sport.children ?? sport.categories ?? [])) {
      const categoryName = category.label ?? category.name ?? '';
      for (const tournament of (category.children ?? category.tournaments ?? [])) {
        if (tournament.type && tournament.type !== 't') continue;
        const tournamentName = tournament.label ?? tournament.name ?? '';
        const league = `${categoryName} — ${tournamentName}`;
        navbarTournamentMeta.set(Number(tournament.id), { league, sportCategory: sc });
        const evs = (tournament as any).children ?? [];
        for (const ev of evs) {
          if (!ev?.id) continue;
          if (!ev.home || !ev.away || !ev.begin) continue;
          navbarEventMeta.set(String(ev.id), {
            home: String(ev.home),
            away: String(ev.away),
            begin: Number(ev.begin),
            league,
            sportCategory: sc,
          });
        }
      }
    }
  }

  // Primary source: featured widget (contains real odds and market groups)
  const featuredEvents = await fetchFeaturedEvents();
  if (featuredEvents.length > 0) {
    for (const e of featuredEvents) {
      const prev = allEventsById.get(e.id);
      if (!prev) allEventsById.set(e.id, e);
      else allEventsById.set(e.id, mergeEvents(prev, e));
    }
    if (onBatch) await onBatch(Array.from(allEventsById.values())).catch(() => {});
  }

  // Prima prova i tornei preferiti (tipicamente quelli con quote attive)
  if (navbarFavourites.length > 0) {
    console.log(`[xcodetec] favourites: ${navbarFavourites.length} tornei`);
    for (const tournamentId of navbarFavourites) {
      const tMeta = navbarTournamentMeta.get(Number(tournamentId));
      const batchedEvents: BetStackEvent[] = [];
      for (const marketGroup of TOURNAMENT_MARKET_GROUPS) {
        const events = await fetchTournamentEvents(
          tournamentId,
          marketGroup,
          tMeta?.sportCategory ?? 'calcio',
          tMeta?.league ?? `Fav — ${tournamentId}`
        );
        if (events.length > 0) batchedEvents.push(...events);
      }
      if (batchedEvents.length > 0) {
        for (const e of batchedEvents) {
          const prev = allEventsById.get(e.id);
          if (!prev) allEventsById.set(e.id, e);
          else allEventsById.set(e.id, mergeEvents(prev, e));
        }
      }
      await sleep(120 + Math.random() * 80);
    }
    console.log(`[xcodetec] da favourites: ${allEventsById.size} eventi`);
  }

  const sportsToFetch = SPORT_WHITELIST.length > 0
    ? navbar.filter(sport => {
        const name = (sport.label ?? sport.name ?? '').toLowerCase();
        return SPORT_WHITELIST.some(w => name.includes(w));
      })
    : navbar;

  const targetSportsBase = sportsToFetch.length > 0 ? sportsToFetch : navbar;
  const targetSports = SPORT_LIMIT > 0 ? targetSportsBase.slice(0, SPORT_LIMIT) : targetSportsBase;
  console.log(`[xcodetec] sport selezionati: ${targetSports.map(s => s.label ?? s.name).join(', ')}`);

  // Itera sport → categorie (children) → tornei (children)
  // Limite tornei per categoria per evitare refresh infiniti
  const MAX_TOURNAMENTS_PER_CATEGORY = Number(process.env.XCODETEC_MAX_TOURNAMENTS ?? '80');
    const runPass = async (
    tournamentsPerCategory: number,
    categoriesPerSport: number,
    skipAlreadyFetched: boolean
  ) => {
    for (const sport of targetSports) {
      const sportName = sport.label ?? sport.name ?? 'sport';
      const sportCategory = sport.slug ?? sportName.toLowerCase().replace(/\s+/g, '_');
      const categories = (sport.children ?? sport.categories ?? []).slice(0, categoriesPerSport);

      for (const category of categories) {
        const categoryName = category.label ?? category.name ?? '';
        const tournaments = (category.children ?? category.tournaments ?? [])
          .filter((t) => !t.type || t.type === 't')
          .slice(0, tournamentsPerCategory);

        for (const tournament of tournaments) {
          if (skipAlreadyFetched) {
            const alreadyHasEvents = Array.from(allEventsById.values()).some(
              e => e.league?.name?.includes(tournament.label ?? tournament.name ?? '')
            );
            if (alreadyHasEvents) continue;
          }

          const tournamentName = tournament.label ?? tournament.name ?? '';
          const leagueName = `${categoryName} — ${tournamentName}`;
          const batchedEvents: BetStackEvent[] = [];
          for (const marketGroup of TOURNAMENT_MARKET_GROUPS) {
            const events = await fetchTournamentEvents(
              tournament.id,
              marketGroup,
              sportCategory,
              leagueName
            );
            if (events.length > 0) batchedEvents.push(...events);
          }
          if (batchedEvents.length > 0) {
            for (const e of batchedEvents) {
              const prev = allEventsById.get(e.id);
              if (!prev) allEventsById.set(e.id, e);
              else allEventsById.set(e.id, mergeEvents(prev, e));
            }
            if (onBatch) await onBatch(Array.from(allEventsById.values())).catch(() => {});
          }
          await sleep(200 + Math.random() * 100);
        }
      }
    }
  };

  await runPass(MAX_TOURNAMENTS_PER_CATEGORY, Infinity, false);

  const allEvents = Array.from(allEventsById.values());
  console.log(`[xcodetec] prematch totale: ${allEvents.length} eventi`);
  return allEvents;
}


// ── Esporta funzione per normalizzare evento xcodetec in bookmakers ───────────

export function mergeXcBookmakers(
  existing: Array<{ key: string; title: string; markets: OddsApiMarket[] }>,
  incoming: Array<{ key: string; title: string; markets: OddsApiMarket[] }>
): Array<{ key: string; title: string; markets: OddsApiMarket[] }> {
  if (existing.length === 0) return incoming;
  const result = existing.map(bk => ({ ...bk, markets: [...bk.markets] }));
  for (const bk of incoming) {
    const target = result.find(b => b.key === bk.key);
    if (!target) { result.push({ ...bk, markets: [...bk.markets] }); continue; }
    target.markets = mergeMarkets(target.markets, bk.markets);
  }
  return result;
}

export function mapXcEventToBookmakers(raw: Record<string, unknown>): Array<{ key: string; title: string; markets: OddsApiMarket[] }> {
  // Struttura xcodetec: { data: { markets: [...] } } oppure { markets: [...] } oppure { data: { event: { markets: [...] } } }
  const data = (raw.data ?? raw) as Record<string, unknown>;
  
  // Prova varie strutture
  let xcEvent = data as unknown as XcEvent;
  
  // Se data ha una chiave 'event', usala
  if (data.event && typeof data.event === 'object') {
    xcEvent = data.event as unknown as XcEvent;
  }

  const home = extractTeams(xcEvent).home || 'Casa';
  const away = extractTeams(xcEvent).away || 'Ospite';

  // Cerca i mercati in varie posizioni
  const marketList: XcMarket[] = 
    xcEvent.markets ?? 
    (xcEvent.odds as Record<string, unknown>)?.markets as XcMarket[] ?? 
    (data.markets as XcMarket[]) ?? 
    [];

  console.log(`[xcodetec] mapXcEventToBookmakers: home=${home} away=${away} markets=${marketList.length}`);

  const markets = marketList
    .map((m: XcMarket) => mapXcMarketToOddsApi(m, home, away))
    .filter((m): m is OddsApiMarket => m !== null);

  if (markets.length === 0) return [];
  return [{ key: 'xcodetec', title: 'xcodetec', markets }];
}

