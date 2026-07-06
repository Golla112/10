import { BetStackEvent } from './betStackService';
import { getEvents } from './cacheService';

/** Mercati necessari per la lista prematch (tab filtri) */
const LIST_MARKET_KEYS = new Set([
  'h2h',
  'tennis_h2h',
  'double_chance',
  'btts',
  'totals',
  'totals_15',
  'totals_25',
  'totals_35',
  'totals_45',
  'totals_55',
  'totals_05',
  'h2h_h1',
  'h2h_h2',
  'double_chance_h1',
  'double_chance_h2',
  'spread',
  'tennis_set1',
  'set_betting',
]);

export type SportStats = {
  events: number;
  leagues: number;
};

type IndexSnapshot = {
  ts: number;
  bySport: Map<string, BetStackEvent[]>;
  stats: Record<string, SportStats>;
};

let snapshot: IndexSnapshot | null = null;
const INDEX_TTL_MS = 45_000;

function trimMarkets(event: BetStackEvent): BetStackEvent {
  const rawMarkets = event.bookmakers?.flatMap((bk) => bk.markets ?? []) ?? [];
  const markets = rawMarkets.filter((m) => LIST_MARKET_KEYS.has(m.key));
  if (!markets.length) return event;

  return {
    ...event,
    bookmakers: [{ key: 'superbet24', title: 'SuperBet24', markets }],
  };
}

async function buildSnapshot(): Promise<IndexSnapshot> {
  const raw = (await getEvents()) as BetStackEvent[] | null;
  const all = (raw ?? []).filter((e) => !e.live);
  const bySport = new Map<string, BetStackEvent[]>();
  const stats: Record<string, SportStats> = {};

  for (const event of all) {
    const sport = (event.sport_category ?? 'soccer').toLowerCase();
    const trimmed = trimMarkets(event);
    if (!bySport.has(sport)) bySport.set(sport, []);
    bySport.get(sport)!.push(trimmed);
  }

  for (const [sport, events] of bySport) {
    events.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
    const leagues = new Set(events.map((e) => e.league?.name ?? 'Prematch'));
    stats[sport] = { events: events.length, leagues: leagues.size };
  }

  return { ts: Date.now(), bySport, stats };
}

async function getSnapshot(): Promise<IndexSnapshot> {
  if (snapshot && Date.now() - snapshot.ts < INDEX_TTL_MS) {
    return snapshot;
  }
  snapshot = await buildSnapshot();
  return snapshot;
}

export function invalidateEventsIndex(): void {
  snapshot = null;
}

export async function getSportEvents(sport: string): Promise<{
  events: BetStackEvent[];
  meta: SportStats;
}> {
  const idx = await getSnapshot();
  const key = sport.toLowerCase();
  const events = idx.bySport.get(key) ?? [];
  const meta = idx.stats[key] ?? {
    events: events.length,
    leagues: new Set(events.map((e) => e.league?.name)).size,
  };
  return { events, meta };
}

export async function getEventsStats(): Promise<Record<string, SportStats>> {
  const idx = await getSnapshot();
  return idx.stats;
}
