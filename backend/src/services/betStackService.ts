// The Odds API v4 — https://the-odds-api.com
// Piano $29/mese: crediti limitati — fetch solo sport principali, cache lunga
const ODDS_BASE = 'https://api.the-odds-api.com/v4';

// Rotate through 3 API keys to maximize quota
const API_KEYS = [
  process.env.BETSTACK_API_KEY,
  process.env.BETSTACK_API_KEY_2,
  process.env.BETSTACK_API_KEY_3,
].filter(Boolean) as string[];

let keyIndex = 0;
function getApiKey(): string | null {
  if (API_KEYS.length === 0) return null;
  return API_KEYS[keyIndex % API_KEYS.length];
}
function rotateKey(): void {
  keyIndex = (keyIndex + 1) % API_KEYS.length;
}

// ── Public interfaces ──────────────────────────────────────────────────────────

export interface BetStackEvent {
  id: string;
  home: { name: string };
  away: { name: string };
  time?: number;
  sport_id?: string;
  sport_category?: string;
  league?: { name: string };
  bookmakers?: OddsApiBookmaker[];
  live?: boolean;
  score?: { home: number | null; away: number | null };
  completed?: boolean;
  minute?: number | null; // minuto corrente per eventi live
}

export interface OddsApiBookmaker {
  key: string;
  title: string;
  markets: OddsApiMarket[];
}

export interface OddsApiMarket {
  key: string;
  name?: string;
  outcomes: { name: string; price: number; point?: number; betcode?: string }[];
}

export interface BetStackOdds {
  h2h?: { home: number; draw: number; away: number };
  totals?: { over: number; under: number; point: number };
  spreads?: { home: number; away: number; point: number };
  btts?: { yes: number; no: number };
  double_chance?: { home_draw: number; home_away: number; draw_away: number };
  draw_no_bet?: { home: number; away: number };
}

// ── The Odds API response types ───────────────────────────────────────────────

interface TOAOutcome {
  name: string;
  price: number;
  point?: number;
}

interface TOAMarket {
  key: string;
  last_update: string;
  outcomes: TOAOutcome[];
}

interface TOABookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: TOAMarket[];
}

interface TOAEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: TOABookmaker[];
}

// ── Sport list to fetch ───────────────────────────────────────────────────────
// Each sport costs 1 credit per region per market — keep list focused

const SPORTS: Array<{ key: string; category: string; league: string }> = [
  // Soccer — most popular
  { key: 'soccer_italy_serie_a',              category: 'soccer',            league: 'Serie A' },
  { key: 'soccer_italy_serie_b',              category: 'soccer',            league: 'Serie B' },
  { key: 'soccer_italy_coppa_italia',         category: 'soccer',            league: 'Coppa Italia' },
  { key: 'soccer_epl',                        category: 'soccer',            league: 'Premier League' },
  { key: 'soccer_spain_la_liga',              category: 'soccer',            league: 'La Liga' },
  { key: 'soccer_spain_segunda_division',      category: 'soccer',            league: 'Liga 2' },
  { key: 'soccer_germany_bundesliga',         category: 'soccer',            league: 'Bundesliga' },
  { key: 'soccer_france_ligue_one',           category: 'soccer',            league: 'Ligue 1' },
  { key: 'soccer_france_ligue_two',           category: 'soccer',            league: 'Ligue 2' },
  { key: 'soccer_uefa_champs_league',         category: 'soccer',            league: 'Champions League' },
  { key: 'soccer_uefa_europa_league',         category: 'soccer',            league: 'Europa League' },
  { key: 'soccer_uefa_europa_conference_league', category: 'soccer',       league: 'Conference League' },
  // Basketball
  { key: 'basketball_nba',                    category: 'basketball',        league: 'NBA' },
  { key: 'basketball_euroleague',             category: 'basketball',        league: 'Euroleague' },
  // Tennis
  { key: 'tennis_atp_french_open',            category: 'tennis',            league: 'French Open (ATP)' },
  { key: 'tennis_atp_wimbledon',              category: 'tennis',            league: 'Wimbledon (ATP)' },
  { key: 'tennis_wta_french_open',            category: 'tennis',            league: 'French Open (WTA)' },
  { key: 'tennis_wta_wimbledon',              category: 'tennis',            league: 'Wimbledon (WTA)' },
  // American football
  { key: 'americanfootball_nfl',              category: 'american_football', league: 'NFL' },
  // Hockey
  { key: 'icehockey_nhl',                     category: 'hockey',            league: 'NHL' },
  // MMA
  { key: 'mma_mixed_martial_arts',            category: 'mma',               league: 'MMA' },
];

// ── Fetch a single sport ──────────────────────────────────────────────────────

async function fetchSport(sport: typeof SPORTS[0]): Promise<BetStackEvent[]> {
  const key = getApiKey();
  if (!key) return [];

  const url = `${ODDS_BASE}/sports/${sport.key}/odds?apiKey=${key}&regions=eu&markets=h2h,totals,spreads,btts&oddsFormat=decimal&dateFormat=unix`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  } catch (err) {
    console.warn(`[odds-api] ${sport.key}: fetch error`, err);
    return [];
  }

  // Log remaining quota from headers
  const remaining = res.headers.get('x-requests-remaining');
  const used = res.headers.get('x-requests-used');
  if (remaining) console.log(`[odds-api] ${sport.key}: ${res.status} | quota remaining: ${remaining} used: ${used}`);
  else console.log(`[odds-api] ${sport.key}: ${res.status}`);

  if (res.status === 401 || res.status === 403) {
    console.warn(`[odds-api] ${sport.key}: auth error ${res.status}, rotating key`);
    rotateKey();
    return [];
  }

  if (res.status === 422) {
    // Sport not in season — skip silently
    return [];
  }

  if (!res.ok) {
    console.warn(`[odds-api] ${sport.key}: HTTP ${res.status}`);
    return [];
  }

  let events: TOAEvent[];
  try {
    events = await res.json() as TOAEvent[];
  } catch {
    console.error(`[odds-api] ${sport.key}: JSON parse error`);
    return [];
  }

  if (!Array.isArray(events)) {
    console.warn(`[odds-api] ${sport.key}: response is not array`, typeof events);
    return [];
  }

  console.log(`[odds-api] ${sport.key}: ${events.length} events`);

  return events.map((e): BetStackEvent => ({
    id: e.id,
    home: { name: e.home_team },
    away: { name: e.away_team },
    time: typeof e.commence_time === 'number' ? e.commence_time : Math.floor(new Date(e.commence_time).getTime() / 1000),
    sport_id: e.sport_key,
    sport_category: sport.category,
    league: { name: sport.league },
    bookmakers: (e.bookmakers ?? []).map(bk => ({
      key: bk.key,
      title: bk.title,
      markets: bk.markets.map(m => ({
        key: m.key,
        outcomes: m.outcomes.map(o => ({
          name: o.name,
          price: o.price,
          ...(o.point !== undefined ? { point: o.point } : {}),
        })),
      })),
    })),
  }));
}

// ── Main fetch ────────────────────────────────────────────────────────────────

export async function fetchEvents(
  onBatch?: (events: BetStackEvent[]) => Promise<void>
): Promise<BetStackEvent[] | null> {
  const key = getApiKey();
  if (!key) {
    console.error('[odds-api] No API key configured');
    return null;
  }

  console.log(`[odds-api] Fetching ${SPORTS.length} sports...`);

  const allEvents: BetStackEvent[] = [];

  // Fetch sequentially to avoid hammering quota — each call costs credits
  for (const sport of SPORTS) {
    const events = await fetchSport(sport);
    if (events.length > 0) {
      allEvents.push(...events);
      if (onBatch) await onBatch([...allEvents]).catch(() => {});
    }
    // Small delay between requests
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[odds-api] Total: ${allEvents.length} events`);
  return allEvents;
}

export async function fetchOdds(_eventId: string): Promise<BetStackOdds | null> {
  return null;
}

export async function fetchLiveScores(): Promise<BetStackEvent[]> {
  return [];
}
