/**
 * Prematch da superbet24.org — action oddsPrint + events
 */

import { BetStackEvent, OddsApiBookmaker } from './betStackService';
import { superbetAjax } from './superbetClient';
import { parseSuperbetMarkets } from './superbetOddsParser';

const DISCIPLINE_SPORTS: Record<number, string> = {
  1: 'soccer',
  4: 'tennis',
  5: 'basketball',
};

const DISCIPLINES = (process.env.SUPERBET_DISCIPLINES ?? '1,4,5')
  .split(',')
  .map((v) => Number(v.trim()))
  .filter((n) => Number.isFinite(n));

const MAX_CHAMPIONSHIPS = Number(process.env.SUPERBET_MAX_CHAMPIONSHIPS ?? '0');
const MAX_PER_DISCIPLINE = Number(process.env.SUPERBET_MAX_PER_DISCIPLINE ?? '0');
const DELAY_MS = Number(process.env.SUPERBET_REQUEST_DELAY_MS ?? '80');
const FETCH_CONCURRENCY = Number(process.env.SUPERBET_FETCH_CONCURRENCY ?? '4');

interface OddEntry {
  key: string;
  name: string | number;
  valore: number;
}

interface Championship {
  id_campionato: number;
  id_disciplina: number;
  descrizione: string;
  nazione?: string;
  elite?: number;
  count_events?: number;
}

interface ChampionshipGroup {
  descrizione: string;
  id_disciplina: number;
  championships?: Championship[];
}

interface PrematchEventRow {
  id_evento: number;
  id_disciplina: number;
  descrizione: string;
  dataora: string;
  id_campionato: number;
  championshipName?: string;
  nationName?: string;
  extCode: number;
  disciplineName?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseTeams(label: string): { home: string; away: string } {
  const idx = label.indexOf(' - ');
  if (idx === -1) return { home: label.trim(), away: 'Away' };
  return {
    home: label.slice(0, idx).trim(),
    away: label.slice(idx + 3).trim(),
  };
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
      if (DELAY_MS > 0) await sleep(DELAY_MS);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => next()));
}

function resolveNation(
  row: PrematchEventRow,
  nationFallback: string,
  leagueLabel: string
): string {
  const group = nationFallback?.trim();
  if (group && group.length >= 2 && !/^(one|live|match|a|i)$/i.test(group)) {
    return group;
  }
  const fromRow = row.nationName?.trim();
  if (fromRow && fromRow.length >= 2) return fromRow;
  return leagueLabel.split('—')[0]?.trim() || 'Internazionale';
}

function mapPrematchEvent(
  row: PrematchEventRow,
  oddsMap: Record<string, Record<string, OddEntry>>,
  leagueLabel: string,
  sportCategory: string,
  nationFallback: string
): BetStackEvent | null {
  const { home, away } = parseTeams(row.descrizione);
  const rawOdds = oddsMap[String(row.extCode)] ?? {};
  const markets = parseSuperbetMarkets(row.id_disciplina, rawOdds, home, away);
  const bookmakers: OddsApiBookmaker[] = markets.length
    ? [{ key: 'superbet24', title: 'SuperBet24', markets }]
    : [];

  const nation = resolveNation(row, nationFallback, leagueLabel);
  const champName =
    row.championshipName ?? leagueLabel.split('—').pop()?.trim() ?? 'Campionato';

  return {
    id: `sb_${row.id_evento}`,
    home: { name: home },
    away: { name: away },
    time: parseTimestamp(row.dataora),
    sport_category: sportCategory,
    league: { name: `${nation} — ${champName}` },
    bookmakers,
    live: false,
  };
}

async function fetchChampionshipEvents(
  championship: Championship,
  nationLabel: string
): Promise<BetStackEvent[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const json = await superbetAjax<{
        events?: { result?: PrematchEventRow[] };
        odds?: Record<string, Record<string, OddEntry>>;
        championship?: { championship_name?: string; descrizione?: string };
      }>({
        action: 'events',
        idchampionship: String(championship.id_campionato),
        discipline: String(championship.id_disciplina),
      });

      if (!json || json.errorCode !== 'success') return [];

      const rawRows = json.result?.events?.result;
      const rows = Array.isArray(rawRows) ? rawRows : [];
      const oddsMap = json.result?.odds ?? {};
      const champName =
        json.result?.championship?.championship_name ??
        championship.descrizione ??
        'Campionato';
      const leagueLabel = `${nationLabel || json.result?.championship?.descrizione || 'Internazionale'} — ${champName}`;
      const sportCategory =
        DISCIPLINE_SPORTS[championship.id_disciplina] ??
        championship.id_disciplina.toString();

      return rows
        .map((row) => mapPrematchEvent(row, oddsMap, leagueLabel, sportCategory, nationLabel))
        .filter((e): e is BetStackEvent => e !== null);
    } catch (err) {
      if (attempt === 1) {
        console.warn(`[superbet] torneo ${championship.id_campionato} fallito:`, err);
        return [];
      }
      await sleep(300);
    }
  }
  return [];
}

export async function fetchSuperbetPrematch(
  onBatch?: (events: BetStackEvent[]) => Promise<void>
): Promise<BetStackEvent[]> {
  const allById = new Map<string, BetStackEvent>();
  const toFetch: Array<{ championship: Championship; nation: string; priority: number }> = [];

  for (const discipline of DISCIPLINES) {
    const print = await superbetAjax<{ championshipGroups?: ChampionshipGroup[] }>({
      action: 'oddsPrint',
      iddiscipline: String(discipline),
      all: '1',
    });

    if (!print || print.errorCode !== 'success') {
      console.warn(`[superbet] oddsPrint disciplina ${discipline} fallita`);
      continue;
    }

    for (const group of print.result?.championshipGroups ?? []) {
      for (const c of group.championships ?? []) {
        toFetch.push({
          championship: c,
          nation: group.descrizione ?? c.nazione ?? '',
          priority: c.elite === 1 ? 0 : 1,
        });
      }
    }

    await sleep(DELAY_MS);
  }

  const finalList = toFetch;

  console.log(
    `[superbet] tornei da fetchare: ${finalList.length} (discipline: ${new Set(finalList.map((x) => x.championship.id_disciplina)).size})`
  );

  await runPool(finalList, FETCH_CONCURRENCY, async (item) => {
    try {
      const mapped = await fetchChampionshipEvents(item.championship, item.nation);
      for (const e of mapped) allById.set(e.id, e);
      if (mapped.length > 0 && onBatch) {
        await onBatch(Array.from(allById.values())).catch(() => {});
      }
    } catch (err) {
      console.warn(`[superbet] torneo ${item.championship.id_campionato}:`, err);
    }
  });

  const events = Array.from(allById.values());
  console.log(`[superbet] prematch totale: ${events.length} eventi`);
  return events;
}
