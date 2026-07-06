/**
 * sofascoreService — punteggi live gratuiti da Sofascore API non ufficiale
 * Nessuna API key richiesta. Aggiornamento ogni 60s.
 * Usa cache in-memory per il rilevamento gol (nessuna chiamata Redis).
 */

const SOFASCORE_BASE = 'https://api.sofascore.com/api/v1';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://www.sofascore.com/',
  'Origin': 'https://www.sofascore.com',
};

export interface SofascoreMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  minute: number | null;
  status: string;
  tournament: string;
  country: string;
  sport: string;
  sportCategory: string;
  startTimestamp: number;
  // Statistiche live (solo calcio)
  homeShotsOnTarget?: number;
  awayShotsOnTarget?: number;
  homeShots?: number;
  awayShots?: number;
  homePossession?: number;
  homeYellowCards?: number;
  awayYellowCards?: number;
  homeRedCards?: number;
  awayRedCards?: number;
  homeCorners?: number;
  awayCorners?: number;
}

interface SofaEvent {
  id: number;
  homeTeam: { name: string };
  awayTeam: { name: string };
  startTimestamp: number;
  homeScore: { current?: number; display?: number };
  awayScore: { current?: number; display?: number };
  time?: {
    currentPeriodStartTimestamp?: number;
    played?: number;        // minuti giocati (alcuni sport)
    initial?: number;       // minuto iniziale del periodo
    periodLength?: number;
  };
  status: { type: string; description: string; periodCount?: number };
  tournament: { name: string; category?: { name: string; slug?: string } };
  _sport?: string;
}

// Cache in memoria dei match live correnti
let liveMatchesCache: SofascoreMatch[] = [];

// Tutti gli sport live da fetchare
const LIVE_SPORTS = [
  'football', 'basketball', 'tennis', 'ice-hockey',
  'american-football', 'baseball', 'rugby', 'volleyball',
  'handball', 'mma', 'boxing', 'esports',
];

// Mappa slug Sofascore → sport_category usato nel frontend
const SPORT_CATEGORY_MAP: Record<string, string> = {
  'football':          'soccer',
  'basketball':        'basketball',
  'tennis':            'tennis',
  'ice-hockey':        'hockey',
  'american-football': 'american_football',
  'baseball':          'baseball',
  'rugby':             'rugby',
  'volleyball':        'volleyball',
  'handball':          'handball',
  'mma':               'mma',
  'boxing':            'boxing',
  'esports':           'esports',
};

async function fetchLiveSport(sport: string): Promise<SofaEvent[]> {
  try {
    const res = await fetch(`${SOFASCORE_BASE}/sport/${sport}/events/live`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { events?: SofaEvent[] };
    const events = data.events ?? [];
    return events.map(e => ({ ...e, _sport: sport }));
  } catch {
    return [];
  }
}

// Cache statistiche live per evento (aggiornata ogni ciclo)
const statsCache = new Map<string, Partial<SofascoreMatch>>();

// Fetch statistiche live per un evento football
async function fetchEventStats(eventId: string): Promise<Partial<SofascoreMatch>> {
  try {
    const res = await fetch(`${SOFASCORE_BASE}/event/${eventId}/statistics`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return {};
    const data = await res.json() as {
      statistics?: Array<{
        period: string;
        groups: Array<{
          statisticsItems: Array<{
            name: string;
            home: string | number;
            away: string | number;
          }>;
        }>;
      }>;
    };

    // Usa solo le statistiche totali (period = "ALL")
    const all = data.statistics?.find(s => s.period === 'ALL');
    if (!all) return {};

    const stats: Partial<SofascoreMatch> = {};
    for (const group of all.groups) {
      for (const item of group.statisticsItems) {
        const name = item.name.toLowerCase();
        const h = parseFloat(String(item.home)) || 0;
        const a = parseFloat(String(item.away)) || 0;
        if (name.includes('shots on target') || name.includes('tiri in porta')) {
          stats.homeShotsOnTarget = h; stats.awayShotsOnTarget = a;
        } else if (name.includes('ball possession') || name.includes('possesso')) {
          stats.homePossession = h;
        } else if (name.includes('yellow card') || name.includes('cartellino giallo')) {
          stats.homeYellowCards = h; stats.awayYellowCards = a;
        } else if (name.includes('red card') || name.includes('cartellino rosso')) {
          stats.homeRedCards = h; stats.awayRedCards = a;
        } else if (name.includes('corner') || name.includes('calcio d\'angolo')) {
          stats.homeCorners = h; stats.awayCorners = a;
        } else if ((name.includes('total shots') || name.includes('tiri totali')) && !name.includes('on target')) {
          stats.homeShots = h; stats.awayShots = a;
        }
      }
    }
    return stats;
  } catch {
    return {};
  }
}

// In-memory score cache
const scoreCache = new Map<string, { home: number; away: number }>();
const lockCache = new Map<string, NodeJS.Timeout>();

function calcMinute(e: SofaEvent, _sport: string): number | null {
  if (e.status.type !== 'inprogress') return null;

  if (e.time?.played != null) return e.time.played;

  if (e.time?.currentPeriodStartTimestamp) {
    const elapsed = Math.floor((Date.now() / 1000 - e.time.currentPeriodStartTimestamp) / 60);
    // Se elapsed è fuori range ragionevole (0-60 min per periodo), ignora
    if (elapsed < 0 || elapsed > 120) return null;
    const initial = e.time.initial != null ? Math.floor(e.time.initial / 60) : 0;
    // Clamp finale: max 120 minuti (tempi supplementari)
    return Math.min(120, Math.max(1, initial + elapsed));
  }

  return null;
}

export async function refreshSofascoreLive(): Promise<SofascoreMatch[]> {
  const allEvents = (await Promise.all(LIVE_SPORTS.map(s => fetchLiveSport(s)))).flat();

  const matches: SofascoreMatch[] = allEvents.map(e => {
    const sport = e._sport ?? 'football';
    const country = e.tournament.category?.name ?? 'Internazionale';
    const normalizedCountry = (country === 'World' || country === 'Europe') ? 'Europa' : country;
    const tournamentName = normalizedCountry !== 'Internazionale'
      ? `${normalizedCountry} \u2014 ${e.tournament.name}`
      : e.tournament.name;

    // Recupera statistiche dalla cache (aggiornate in background)
    const cached = statsCache.get(String(e.id)) ?? {};

    return {
      id: String(e.id),
      homeTeam: e.homeTeam.name,
      awayTeam: e.awayTeam.name,
      homeScore: e.homeScore?.current ?? e.homeScore?.display ?? 0,
      awayScore: e.awayScore?.current ?? e.awayScore?.display ?? 0,
      minute: calcMinute(e, sport),
      status: e.status.type,
      tournament: tournamentName,
      country: normalizedCountry,
      sport,
      sportCategory: SPORT_CATEGORY_MAP[sport] ?? sport,
      startTimestamp: e.startTimestamp,
      ...cached,
    };
  });

  // Rileva gol
  for (const m of matches) {
    const prev = scoreCache.get(m.id);
    if (prev && (prev.home !== m.homeScore || prev.away !== m.awayScore)) {
      const lockKey = `sofa:${m.id}`;
      if (lockCache.has(lockKey)) clearTimeout(lockCache.get(lockKey)!);
      lockCache.set(lockKey, setTimeout(() => lockCache.delete(lockKey), 15000));
      console.log(`[sofascore] GOL! ${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam} → mercato bloccato 15s`);
    }
    scoreCache.set(m.id, { home: m.homeScore, away: m.awayScore });
  }

  liveMatchesCache = matches;

  // Pulizia scoreCache e lockCache per eventi non più live
  const activeIds = new Set(matches.map(m => m.id));
  for (const id of scoreCache.keys()) {
    if (!activeIds.has(id)) scoreCache.delete(id);
  }
  for (const key of lockCache.keys()) {
    const id = key.replace('sofa:', '');
    if (!activeIds.has(id)) {
      clearTimeout(lockCache.get(key)!);
      lockCache.delete(key);
    }
  }

  // Aggiorna statistiche football in background (max 10 eventi per ciclo per non sovraccaricare)
  const footballIds = allEvents
    .filter(e => e._sport === 'football' && e.status.type === 'inprogress')
    .slice(0, 10)
    .map(e => String(e.id));

  if (footballIds.length > 0) {
    Promise.all(footballIds.map(async id => {
      const stats = await fetchEventStats(id);
      if (Object.keys(stats).length > 0) statsCache.set(id, stats);
    })).catch(() => {});
  }

  if (matches.length > 0) {
    const bySport = LIVE_SPORTS.map(s => `${s}:${matches.filter(m => m.sport === s).length}`).filter(x => !x.endsWith(':0')).join(', ');
    console.log(`[sofascore] ${matches.length} eventi live (${bySport})`);
  }

  return matches;
}

export function getCachedSofascoreLive(): SofascoreMatch[] {
  return liveMatchesCache;
}

/** Controlla se il mercato di un evento è bloccato (gol rilevato) */
export function isSofaEventLocked(sofaId: string): boolean {
  return lockCache.has(`sofa:${sofaId}`);
}

/**
 * Cerca una partita live per nome squadra (fuzzy match).
 * Utile per collegare eventi del nostro DB con quelli Sofascore.
 */
export function findMatchByTeams(homeTeam: string, awayTeam: string): SofascoreMatch | null {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const h = normalize(homeTeam);
  const a = normalize(awayTeam);

  return liveMatchesCache.find(m => {
    const mh = normalize(m.homeTeam);
    const ma = normalize(m.awayTeam);
    return (mh.includes(h) || h.includes(mh)) && (ma.includes(a) || a.includes(ma));
  }) ?? null;
}

/**
 * Avvia il polling Sofascore ogni 60 secondi.
 */
export function startSofascorePolling(): NodeJS.Timeout {
  // Prima chiamata immediata
  refreshSofascoreLive().catch(() => {});

  return setInterval(() => {
    refreshSofascoreLive().catch(err => {
      console.warn('[sofascore] polling error:', err);
    });
  }, 60_000);
}

/**
 * Recupera il risultato finale di una partita terminata.
 * Utile per il settlement automatico delle scommesse.
 */
export async function fetchMatchFinishedResult(home: string, away: string, dateStr: string): Promise<{ home: number, away: number } | null> {
  try {
    const res = await fetch(`${SOFASCORE_BASE}/scheduled-events/${dateStr}`, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as { events?: any[] };
    const events = data.events ?? [];

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const nh = normalize(home);
    const na = normalize(away);

    const match = events.find(e => {
      const eh = normalize(e.homeTeam.name);
      const ea = normalize(e.awayTeam.name);
      return (eh.includes(nh) || nh.includes(eh)) && (ea.includes(na) || na.includes(ea)) && (e.status.type === 'finished' || e.status.type === 'ended');
    });

    if (match && match.homeScore && match.awayScore) {
      return {
        home: match.homeScore.current ?? match.homeScore.display ?? 0,
        away: match.awayScore.current ?? match.awayScore.display ?? 0
      };
    }
  } catch (err) {
    console.warn('[sofascore] error fetching finished result:', err);
  }
  return null;
}
