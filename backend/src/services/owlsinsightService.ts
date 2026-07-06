/**
 * owlsinsightService — fetcha eventi calcio con nomi squadra e quote da api.owlsinsight.com
 * Usato come fonte primaria per fixture + quote (sostituisce Odds API esaurita)
 * Docs: https://owlsinsight.com/docs
 */

import { BetStackEvent } from './betStackService';

const OI_BASE = 'https://api.owlsinsight.com/api/v1';
const API_KEY = process.env.OWLSINSIGHT_API_KEY ?? '';

const HEADERS = {
  'Authorization': API_KEY,
  'Accept': 'application/json',
};

// Sport supportati da OwlsInsight che vogliamo fetchare
const SPORTS: Array<{ key: string; sportId: string }> = [
  { key: 'soccer', sportId: 'soccer' },
  { key: 'basketball', sportId: 'basketball' },
  { key: 'tennis', sportId: 'tennis' },
  { key: 'mma', sportId: 'mma' },
];

// ── Tipi API OwlsInsight ──────────────────────────────────────────────────────

interface OiOutcome {
  name: string;
  price: number;
  point?: number;
}

interface OiMarket {
  key: string;
  outcomes: OiOutcome[];
  suspended?: boolean;
}

interface OiBookmaker {
  key: string;
  title: string;
  markets: OiMarket[];
}

interface OiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string; // ISO 8601
  home_team: string;
  away_team: string;
  league?: string;
  country_code?: string;
  bookmakers: OiBookmaker[];
}

// ── Mapping ───────────────────────────────────────────────────────────────────

function mapOiEventToBetStack(ev: OiEvent): BetStackEvent {
  const time = Math.floor(new Date(ev.commence_time).getTime() / 1000);

  const bookmakers = ev.bookmakers.map(bm => ({
    key: bm.key,
    title: bm.title,
    markets: bm.markets
      .filter(m => !m.suspended)
      .map(m => ({
        key: m.key,
        outcomes: m.outcomes.map(o => ({
          name: o.name,
          price: o.price,
          ...(o.point !== undefined ? { point: o.point } : {}),
        })),
      })),
  }));

  // Normalizza sport_category in minuscolo per compatibilità con il frontend
  const sportCategory = ev.sport_key.toLowerCase().replace(/-/g, '_');

  return {
    id: `oi_${ev.id}`,
    home: { name: ev.home_team },
    away: { name: ev.away_team },
    time,
    sport_id: ev.sport_key,
    sport_category: sportCategory,
    league: { name: ev.league ?? ev.sport_title },
    // Strip OwlsInsight odds because free tier returns dummy duplicate odds.
    // Fallback odds will be populated by eventRefresh.ts.
    bookmakers: [],
    live: false,
  };
}

// ── Fetch eventi per sport ────────────────────────────────────────────────────

async function fetchSportEvents(sportKey: string): Promise<BetStackEvent[]> {
  if (!API_KEY) {
    console.warn('[owlsinsight] OWLSINSIGHT_API_KEY non configurata');
    return [];
  }

  try {
    const url = `${OI_BASE}/${sportKey}/odds?books=pinnacle,bet365,1xbet&alternates=false`;
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(15000),
    });

    if (res.status === 401) {
      console.warn('[owlsinsight] API key non valida o piano scaduto');
      return [];
    }
    if (res.status === 429) {
      console.warn('[owlsinsight] Rate limit raggiunto');
      return [];
    }
    if (!res.ok) {
      console.warn(`[owlsinsight] ${sportKey} HTTP ${res.status}`);
      return [];
    }

    const events = await res.json() as OiEvent[];
    if (!Array.isArray(events)) {
      console.warn(`[owlsinsight] ${sportKey}: risposta non è un array`);
      return [];
    }

    const mapped = events.map(mapOiEventToBetStack);
    console.log(`[owlsinsight] ${sportKey}: ${mapped.length} eventi`);
    return mapped;
  } catch (err) {
    console.warn(`[owlsinsight] ${sportKey} error:`, err);
    return [];
  }
}

// ── Fetch tutti gli sport ─────────────────────────────────────────────────────

export async function fetchOwlsInsightEvents(
  onBatch?: (events: BetStackEvent[]) => Promise<void>
): Promise<BetStackEvent[]> {
  const allEvents: BetStackEvent[] = [];

  for (const sport of SPORTS) {
    const events = await fetchSportEvents(sport.key);
    if (events.length > 0) {
      allEvents.push(...events);
      if (onBatch) await onBatch([...allEvents]).catch(() => {});
    }
    // Pausa tra sport per rispettare rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[owlsinsight] totale: ${allEvents.length} eventi`);
  return allEvents;
}

// ── Fetch solo calcio (per abbinamento con xcodetec) ─────────────────────────

export async function fetchOwlsInsightSoccer(): Promise<BetStackEvent[]> {
  return fetchSportEvents('soccer');
}
