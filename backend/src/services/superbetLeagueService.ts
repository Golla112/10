/**
 * Fetch campionati e quote complete per lega (getEventOdds all=1)
 */

import { BetStackEvent, OddsApiBookmaker } from './betStackService';
import { superbetAjax } from './superbetClient';
import { parseSuperbetMarketsFromMeta } from './superbetOddsParser';

const DISCIPLINE_SPORTS: Record<number, string> = {
  1: 'soccer',
  4: 'tennis',
  5: 'basketball',
};

const DISCIPLINES = (process.env.SUPERBET_DISCIPLINES ?? '1,4,5')
  .split(',')
  .map((v) => Number(v.trim()))
  .filter((n) => Number.isFinite(n));

const LEAGUE_ODDS_CONCURRENCY = Number(process.env.SUPERBET_LEAGUE_ODDS_CONCURRENCY ?? '4');
const LEAGUE_ODDS_DELAY_MS = Number(process.env.SUPERBET_LEAGUE_ODDS_DELAY_MS ?? '50');

export interface ChampionshipItem {
  id: number;
  discipline: number;
  sport: string;
  nation: string;
  name: string;
  label: string;
  count_events?: number;
}

interface OddEntry {
  key: string;
  name: string | number;
  valore: number;
}

interface EventRow {
  id_evento: number;
  id_disciplina: number;
  descrizione: string;
  dataora: string;
  id_campionato: number;
  championshipName?: string;
  nationName?: string;
  extCode: number;
}

interface MarketMeta {
  key: string;
  name: string;
  group_code?: string;
  odds?: Array<{ key: string; name: string | number }>;
}

const leagueCache = new Map<string, { ts: number; events: BetStackEvent[] }>();
const LEAGUE_CACHE_TTL = 90_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseTeams(label: string): { home: string; away: string } {
  const idx = label.indexOf(' - ');
  if (idx === -1) return { home: label.trim(), away: 'Away' };
  return { home: label.slice(0, idx).trim(), away: label.slice(idx + 3).trim() };
}

function parseTimestamp(dataora: string): number {
  const normalized = dataora.includes('T') ? dataora : dataora.replace(' ', 'T');
  const ts = Date.parse(normalized);
  return Number.isFinite(ts) ? Math.floor(ts / 1000) : Math.floor(Date.now() / 1000);
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  async function next(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      await worker(items[i]);
      if (LEAGUE_ODDS_DELAY_MS > 0) await sleep(LEAGUE_ODDS_DELAY_MS);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => next()));
}

async function fetchEventFullOdds(
  row: EventRow,
  idChampionship: number,
  nationLabel: string,
  champName: string
): Promise<BetStackEvent> {
  const { home, away } = parseTeams(row.descrizione);
  const discipline = row.id_disciplina;
  const sportCategory = DISCIPLINE_SPORTS[discipline] ?? String(discipline);

  const json = await superbetAjax<{
    markets?: MarketMeta[];
    odds?: Record<string, Record<string, OddEntry>>;
    championship?: { descrizione?: string; championship_name?: string };
  }>({
    action: 'getEventOdds',
    idchampionship: String(idChampionship),
    discipline: String(discipline),
    macroGroupSigns: '',
    search_code: String(row.extCode),
    all: '1',
  });

  const rawOdds = json?.result?.odds?.[String(row.extCode)] ?? {};
  const marketsMeta = json?.result?.markets ?? [];
  const parsedMarkets = parseSuperbetMarketsFromMeta(
    discipline,
    rawOdds,
    marketsMeta,
    home,
    away
  );

  const nation =
    nationLabel ||
    json?.result?.championship?.descrizione ||
    row.nationName?.trim() ||
    'Internazionale';
  const leagueName = champName || row.championshipName || 'Campionato';

  const bookmakers: OddsApiBookmaker[] = parsedMarkets.length
    ? [{ key: 'superbet24', title: 'SuperBet24', markets: parsedMarkets }]
    : [];

  return {
    id: `sb_${row.id_evento}`,
    home: { name: home },
    away: { name: away },
    time: parseTimestamp(row.dataora),
    sport_category: sportCategory,
    sport_id: String(discipline),
    league: { name: `${nation} — ${leagueName}` },
    bookmakers,
    live: false,
  };
}

export async function fetchSuperbetChampionships(): Promise<ChampionshipItem[]> {
  const items: ChampionshipItem[] = [];

  for (const discipline of DISCIPLINES) {
    const print = await superbetAjax<{
      championshipGroups?: Array<{
        descrizione: string;
        championships?: Array<{
          id_campionato: number;
          descrizione: string;
          count_events?: number;
          nazione?: string;
        }>;
      }>;
    }>({
      action: 'oddsPrint',
      iddiscipline: String(discipline),
      all: '1',
    });

    if (!print || print.errorCode !== 'success') continue;

    for (const group of print.result?.championshipGroups ?? []) {
      const nation = group.descrizione?.trim() || 'Internazionale';
      for (const c of group.championships ?? []) {
        items.push({
          id: c.id_campionato,
          discipline,
          sport: DISCIPLINE_SPORTS[discipline] ?? String(discipline),
          nation,
          name: c.descrizione,
          label: `${nation} — ${c.descrizione}`,
          count_events: c.count_events,
        });
      }
    }
    await sleep(40);
  }

  return items;
}

export async function fetchLeagueEventsFull(
  championshipId: number,
  discipline: number
): Promise<BetStackEvent[]> {
  const cacheKey = `${discipline}:${championshipId}`;
  const cached = leagueCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < LEAGUE_CACHE_TTL) {
    return cached.events;
  }

  const listJson = await superbetAjax<{
    events?: { result?: EventRow[] | Record<string, never> };
    championship?: { championship_name?: string; descrizione?: string };
  }>({
    action: 'events',
    idchampionship: String(championshipId),
    discipline: String(discipline),
  });

  if (!listJson || listJson.errorCode !== 'success') return [];

  const rawRows = listJson.result?.events?.result;
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const nationLabel = listJson.result?.championship?.descrizione ?? '';
  const champName =
    listJson.result?.championship?.championship_name ?? 'Campionato';

  const events: BetStackEvent[] = [];

  await runPool(rows, LEAGUE_ODDS_CONCURRENCY, async (row) => {
    try {
      const mapped = await fetchEventFullOdds(row, championshipId, nationLabel, champName);
      events.push(mapped);
    } catch (err) {
      console.warn(`[superbet] quote evento ${row.id_evento}:`, err);
    }
  });

  events.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  leagueCache.set(cacheKey, { ts: Date.now(), events });
  console.log(`[superbet] lega ${championshipId} (d${discipline}): ${events.length} eventi con quote complete`);
  return events;
}

export { DISCIPLINE_SPORTS };
