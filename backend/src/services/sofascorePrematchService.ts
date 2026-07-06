/**
 * sofascorePrematchService — eventi prematch da Sofascore (nessuna API key)
 * Copre: calcio, basket, tennis, hockey, baseball, rugby, MMA, volley, ecc.
 * Le quote vengono calcolate dal prematchOddsEngine usando le statistiche delle squadre.
 */

import { BetStackEvent } from './betStackService';

const SOFA_BASE = 'https://api.sofascore.com/api/v1';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://www.sofascore.com/',
  'Origin': 'https://www.sofascore.com',
};

// Sport supportati da Sofascore con il loro slug
const SPORTS: Array<{ slug: string; category: string; label: string }> = [
  { slug: 'football',         category: 'soccer',           label: 'Calcio' },
  { slug: 'basketball',       category: 'basketball',       label: 'Basket' },
  { slug: 'tennis',           category: 'tennis',           label: 'Tennis' },
  { slug: 'ice-hockey',       category: 'hockey',           label: 'Hockey su ghiaccio' },
  { slug: 'american-football',category: 'american_football',label: 'Football americano' },
  { slug: 'baseball',         category: 'baseball',         label: 'Baseball' },
  { slug: 'rugby',            category: 'rugby',            label: 'Rugby' },
  { slug: 'volleyball',       category: 'volleyball',       label: 'Pallavolo' },
  { slug: 'handball',         category: 'handball',         label: 'Pallamano' },
  { slug: 'mma',              category: 'mma',              label: 'MMA' },
  { slug: 'boxing',           category: 'boxing',           label: 'Boxe' },
  { slug: 'snooker',          category: 'snooker',          label: 'Snooker' },
  { slug: 'darts',            category: 'darts',            label: 'Freccette' },
  { slug: 'cycling',          category: 'cycling',          label: 'Ciclismo' },
  { slug: 'esports',          category: 'esports',          label: 'Esports' },
];

interface SofaTeam { name: string; slug?: string; }
interface SofaTournament { name: string; slug?: string; category?: { name: string } }
interface SofaEvent {
  id: number;
  slug?: string;
  homeTeam: SofaTeam;
  awayTeam: SofaTeam;
  startTimestamp: number;
  tournament: SofaTournament;
  status: { type: string; description: string };
  homeScore?: { current?: number };
  awayScore?: { current?: number };
}

function mapSofaEvent(ev: SofaEvent, sport: typeof SPORTS[0]): BetStackEvent {
  return {
    id: `sofa_${sport.slug}_${ev.id}`,
    home: { name: ev.homeTeam.name },
    away: { name: ev.awayTeam.name },
    time: ev.startTimestamp,
    sport_id: `sofa_${sport.slug}`,  // ID univoco per il frontend
    sport_category: sport.category,   // categoria corretta per il filtro frontend
    league: {
      name: (() => {
      const cat = ev.tournament.category?.name;
      const normalized = (cat === 'World' || cat === 'Europe') ? 'Europa' : cat;
      return [normalized, ev.tournament.name].filter(Boolean).join(' \u2014 ') || sport.label;
    })(),
    },
    bookmakers: [],
    live: ev.status.type === 'inprogress',
    score: ev.homeScore?.current !== undefined ? {
      home: ev.homeScore.current ?? null,
      away: ev.awayScore?.current ?? null,
    } : undefined,
  };
}

function getTodayAndTomorrow(): string[] {
  const dates: string[] = [];
  const days = Math.max(1, Number(process.env.SOFA_PREMATCH_DAYS ?? '10'));
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

async function fetchSportEvents(
  sport: typeof SPORTS[0],
  date: string
): Promise<BetStackEvent[]> {
  try {
    const url = `${SOFA_BASE}/sport/${sport.slug}/scheduled-events/${date}`;
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      if (res.status !== 404) {
        console.warn(`[sofascore-prematch] ${sport.slug} ${date} → ${res.status}`);
      }
      return [];
    }

    const data = await res.json() as { events?: SofaEvent[] };
    const events = data.events ?? [];

    if (sport.slug === 'football' && events.length > 0) {
      const topLeagues = events.filter(e => e.tournament.name.toLowerCase().includes('serie a') || e.tournament.name.toLowerCase().includes('serie b'));
      if (topLeagues.length > 0) {
        console.log(`[sofascore-debug] Found ${topLeagues.length} potential Serie A/B matches on ${date}`);
      }
    }

    // Prematch puro: solo partite non iniziate.
    const relevant = events.filter((e) => e.status.type === 'notstarted');

    return relevant.map(e => mapSofaEvent(e, sport));
  } catch (err) {
    console.warn(`[sofascore-prematch] ${sport.slug} ${date} error:`, err);
    return [];
  }
}

/**
 * Fetcha tutti gli sport prematch per oggi + domani + dopodomani.
 * Restituisce tutti gli eventi senza quote (le quote vengono da OwlsInsight/xcodetec).
 */
export async function fetchSofascorePrematch(
  onBatch?: (events: BetStackEvent[]) => Promise<void>
): Promise<BetStackEvent[]> {
  const dates = getTodayAndTomorrow();
  const allEvents: BetStackEvent[] = [];
  const seenIds = new Set<string>();
  const sportWhitelist = (process.env.SOFA_PREMATCH_SPORTS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const targetSports = sportWhitelist.length
    ? SPORTS.filter((s) => sportWhitelist.includes(s.slug.toLowerCase()) || sportWhitelist.includes(s.category.toLowerCase()))
    : SPORTS;

  for (const sport of targetSports) {
    const batchResults = await Promise.all(dates.map((date) => fetchSportEvents(sport, date)));
    for (const events of batchResults) {
      for (const e of events) {
        if (!seenIds.has(e.id)) {
          allEvents.push(e);
          seenIds.add(e.id);
        }
      }
    }

    if (onBatch && allEvents.length > 0) {
      await onBatch([...allEvents]).catch(() => {});
    }
    // Piccola pausa tra sport per ridurre burst.
    await new Promise((r) => setTimeout(r, 120));
  }

  console.log(`[sofascore-prematch] ${allEvents.length} eventi totali (${targetSports.length} sport, ${dates.length} giorni)`);

  // Quote calcolate: disabilitato per ora (troppo lento, causa instabilità cache)
  // Le quote verranno da OwlsInsight per il calcio, gli altri sport appaiono senza quote

  return allEvents;
}
