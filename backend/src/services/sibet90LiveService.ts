/**

 * Sibet90.net API Service
 * - Live: GET /live_ws.php
 * - Prematch: POST /ajax.php

 */



import { BetStackEvent, OddsApiBookmaker, OddsApiMarket } from './betStackService';



const SIBET90_BASE = process.env.SIBET90_BASE_URL ?? 'https://sibet90.net';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';


const DISCIPLINE_SPORTS: Record<number, string> = {
  1: 'soccer',
  2: 'basketball',
  4: 'tennis',
  5: 'basketball',
};

// Interfaces for Sibet90 API responses
interface SibetApiResponse<T> {
  errorCode: string;
  result?: T;
}

interface SibetPrematchOdd {
  id: string;
  oddTypeId: number;
  rank: number;
  prank: number;
  enabled: number;
  oddName: string;
  oddGroup: string;
}

interface SibetPrematchChampionship {
  name: string;
  _name: string;
  idchampionship: number;
  multiplicity: number;
  isSpecial: number;
  events_count: number;
  events?: SibetPrematchEvent[];
}

interface SibetPrematchChampionshipGroup {
  idchampionship_groups: number;
  name: string;
  country_code: string | null;
  disciplineName: string;
  iddiscipline: number;
  Tld: string;
  events_count: number;
  championships: SibetPrematchChampionship[];
}

interface SibetPrematchEvent {
  id_evento: number;
  id_disciplina: number;
  descrizione: string;
  dataora: string;
  id_campionato: number;
  championshipName?: string;
  nationName?: string;
  extCode: number;
  odds?: SibetPrematchOdd[];
}



interface SibetLiveOdd {

  oddGroup?: string;

  oddName?: string;

  rank?: number;

  enabled?: number;

}



interface SibetLiveEvent {

  idevents: number;

  team1: string;

  team2: string;

  iddiscipline: number;

  championshipName?: string;

  matchScore?: string;

  matchTime?: string;

  status?: string;

  odds?: SibetLiveOdd[];

}



function parseScore(raw?: string): { home: number; away: number } | undefined {

  if (!raw) return undefined;

  const m = raw.match(/(\d+)\s*:\s*(\d+)/);

  if (!m) return undefined;

  return { home: Number(m[1]), away: Number(m[2]) };

}



function parseMinute(raw?: string): number | null {

  if (!raw) return null;

  const m = raw.match(/(\d+)/);

  return m ? Number(m[1]) : null;

}



function buildLiveMarkets(

  odds: SibetLiveOdd[] | undefined,

  home: string,

  away: string,

  discipline: number

): OddsApiMarket[] {

  if (!odds?.length) return [];



  const active = odds.filter((o) => o.enabled === 1 && (o.rank ?? 0) > 1);

  const markets: OddsApiMarket[] = [];

  const oneX2 = active.filter((o) => o.oddGroup === '1X2');



  const homeOdd = oneX2.find((o) => o.oddName === '1')?.rank ?? 0;

  const drawOdd = oneX2.find((o) => o.oddName === 'X')?.rank ?? 0;

  const awayOdd = oneX2.find((o) => o.oddName === '2')?.rank ?? 0;



  if (discipline === 1 && homeOdd > 1 && awayOdd > 1) {

    const outcomes = [{ name: home, price: homeOdd }];

    if (drawOdd > 1) outcomes.push({ name: 'Draw', price: drawOdd });

    outcomes.push({ name: away, price: awayOdd });

    markets.push({ key: 'h2h', outcomes });

  } else if (homeOdd > 1 && awayOdd > 1) {

    markets.push({

      key: 'h2h',

      outcomes: [

        { name: home, price: homeOdd },

        { name: away, price: awayOdd },

      ],

    });

  }



  const dc1x = oneX2.find((o) => o.oddName === 'DC1X')?.rank ?? 0;

  const dc12 = oneX2.find((o) => o.oddName === 'DC12')?.rank ?? 0;

  const dcx2 = oneX2.find((o) => o.oddName === 'DCX2')?.rank ?? 0;

  const dcOutcomes: { name: string; price: number }[] = [];

  if (dc1x > 1) dcOutcomes.push({ name: '1X', price: dc1x });

  if (dc12 > 1) dcOutcomes.push({ name: '12', price: dc12 });

  if (dcx2 > 1) dcOutcomes.push({ name: 'X2', price: dcx2 });

  if (dcOutcomes.length >= 2) {

    markets.push({ key: 'double_chance', outcomes: dcOutcomes });

  }



  const ggYes =

    active.find((o) => o.oddGroup === 'GG' && (o.oddName === 'GGS' || o.oddName === 'Yes'))?.rank ?? 0;

  const ggNo =

    active.find((o) => o.oddGroup === 'GG' && (o.oddName === 'GGN' || o.oddName === 'No'))?.rank ?? 0;

  if (ggYes > 1 && ggNo > 1) {

    markets.push({

      key: 'btts',

      outcomes: [

        { name: 'GG', price: ggYes },

        { name: 'NG', price: ggNo },

      ],

    });

  }



  const uo15 = active.filter((o) => o.oddGroup === 'Under Over 1.5');
  const over15 = uo15.find((o) => o.oddName === 'Over')?.rank ?? 0;
  const under15 = uo15.find((o) => o.oddName === 'Under')?.rank ?? 0;
  if (over15 > 1 && under15 > 1) {
    markets.push({
      key: 'totals_15',
      outcomes: [
        { name: 'Over', price: over15, point: 1.5 },
        { name: 'Under', price: under15, point: 1.5 },
      ],
    });
  }

  const uo25 = active.filter((o) => o.oddGroup === 'Under Over 2.5');

  const over25 = uo25.find((o) => o.oddName === 'Over')?.rank ?? 0;

  const under25 = uo25.find((o) => o.oddName === 'Under')?.rank ?? 0;

  if (over25 > 1 && under25 > 1) {

    markets.push({

      key: 'totals',

      outcomes: [

        { name: 'Over', price: over25, point: 2.5 },

        { name: 'Under', price: under25, point: 2.5 },

      ],

    });

  }



  return markets;

}



function mapLiveEvent(raw: SibetLiveEvent): BetStackEvent {

  const home = raw.team1?.trim() || 'Home';

  const away = raw.team2?.trim() || 'Away';

  const score = parseScore(raw.matchScore);

  const markets = buildLiveMarkets(raw.odds, home, away, raw.iddiscipline);



  return {

    id: `sb_live_${raw.idevents}`,

    home: { name: home },

    away: { name: away },

    time: Math.floor(Date.now() / 1000),

    sport_category: DISCIPLINE_SPORTS[raw.iddiscipline] ?? 'soccer',

    league: { name: raw.championshipName ?? 'Live' },

    live: true,

    minute: parseMinute(raw.matchTime),

    score: score ?? { home: 0, away: 0 },

    bookmakers: markets.length

      ? [{ key: 'sibet90', title: 'Sibet90 Live', markets }]

      : [],

  };

}



export async function fetchSibet90Live(): Promise<BetStackEvent[]> {

  const headers: Record<string, string> = {

    Accept: 'application/json, text/javascript, */*; q=0.01',

    Referer: `${SIBET90_BASE}/index.php?action=live&task=live_ws2`,

    'X-Requested-With': 'XMLHttpRequest',

    'User-Agent': USER_AGENT,

  };



  if (process.env.SIBET90_COOKIE?.trim()) {

    headers.Cookie = process.env.SIBET90_COOKIE.trim();

  }



  const res = await fetch(`${SIBET90_BASE}/live_ws.php`, {

    headers,

    signal: AbortSignal.timeout(30_000),

  });



  if (!res.ok) {

    throw new Error(`sibet90 live_ws HTTP ${res.status}`);

  }



  const data = (await res.json()) as SibetLiveEvent[];

  if (!Array.isArray(data)) return [];



  const events = data

    .filter((e) => e.status === 'A' || !e.status)

    .map(mapLiveEvent);



  console.log(`[sibet90] live: ${events.length} eventi (${data.length} raw)`);

  return events;

}



export async function fetchSibet90LiveRaw(): Promise<SibetLiveEvent[]> {

  const res = await fetch(`${SIBET90_BASE}/live_ws.php`, {

    headers: {

      Accept: 'application/json',

      Referer: `${SIBET90_BASE}/index.php?action=live&task=live_ws2`,

      'X-Requested-With': 'XMLHttpRequest',

      'User-Agent': USER_AGENT,

      ...(process.env.SIBET90_COOKIE?.trim()

        ? { Cookie: process.env.SIBET90_COOKIE.trim() }

        : {}),

    },

    signal: AbortSignal.timeout(30_000),

  });

  if (!res.ok) throw new Error(`sibet90 live_ws HTTP ${res.status}`);

  const data = await res.json();

  return Array.isArray(data) ? data : [];

}



// Helper functions for prematch
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

function buildPrematchMarkets(
  odds: SibetPrematchOdd[] | undefined,
  home: string,
  away: string,
  discipline: number
): OddsApiMarket[] {
  if (!odds?.length) return [];

  const active = odds.filter((o) => o.enabled === 1 && o.rank > 1);
  const markets: OddsApiMarket[] = [];

  // 1X2
  const oneX2 = active.filter((o) => o.oddGroup === '1X2' || o.oddGroup === 'FN1X2');
  const homeOdd = oneX2.find((o) => o.oddName === '1')?.rank ?? 0;
  const drawOdd = oneX2.find((o) => o.oddName === 'X')?.rank ?? 0;
  const awayOdd = oneX2.find((o) => o.oddName === '2')?.rank ?? 0;

  if (discipline === 1 && homeOdd > 1 && awayOdd > 1) {
    const outcomes = [{ name: home, price: homeOdd }];
    if (drawOdd > 1) outcomes.push({ name: 'Draw', price: drawOdd });
    outcomes.push({ name: away, price: awayOdd });
    markets.push({ key: 'h2h', outcomes });
  } else if (homeOdd > 1 && awayOdd > 1) {
    markets.push({
      key: 'h2h',
      outcomes: [
        { name: home, price: homeOdd },
        { name: away, price: awayOdd },
      ],
    });
  }

  // Double Chance
  const dc1x = oneX2.find((o) => o.oddName === 'DC1X')?.rank ?? 0;
  const dc12 = oneX2.find((o) => o.oddName === 'DC12')?.rank ?? 0;
  const dcx2 = oneX2.find((o) => o.oddName === 'DCX2')?.rank ?? 0;
  const dcOutcomes: { name: string; price: number }[] = [];
  if (dc1x > 1) dcOutcomes.push({ name: '1X', price: dc1x });
  if (dc12 > 1) dcOutcomes.push({ name: '12', price: dc12 });
  if (dcx2 > 1) dcOutcomes.push({ name: 'X2', price: dcx2 });
  if (dcOutcomes.length >= 2) {
    markets.push({ key: 'double_chance', outcomes: dcOutcomes });
  }

  // BTTS (GG/NG)
  const ggYes = active.find((o) => o.oddGroup === 'GG' && (o.oddName === 'GGS' || o.oddName === 'Yes'))?.rank ?? 0;
  const ggNo = active.find((o) => o.oddGroup === 'GG' && (o.oddName === 'GGN' || o.oddName === 'No'))?.rank ?? 0;
  if (ggYes > 1 && ggNo > 1) {
    markets.push({
      key: 'btts',
      outcomes: [
        { name: 'GG', price: ggYes },
        { name: 'NG', price: ggNo },
      ],
    });
  }

  // Under/Over 2.5
  const uo25 = active.filter((o) => o.oddGroup?.startsWith('Under Over 2.5') || o.oddGroup?.startsWith('UNDER_OVER_2'));
  const over25 = uo25.find((o) => o.oddName === 'Over' || o.oddName?.includes('OVER'))?.rank ?? 0;
  const under25 = uo25.find((o) => o.oddName === 'Under' || o.oddName?.includes('UNDER'))?.rank ?? 0;
  if (over25 > 1 && under25 > 1) {
    markets.push({
      key: 'totals',
      outcomes: [
        { name: 'Over', price: over25, point: 2.5 },
        { name: 'Under', price: under25, point: 2.5 },
      ],
    });
  }

  return markets;
}

async function sibetAjax<T>(payload: any): Promise<SibetApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': USER_AGENT,
    Referer: `${SIBET90_BASE}/index.php?action=sport`,
  };

  if (process.env.SIBET90_COOKIE?.trim()) {
    headers.Cookie = process.env.SIBET90_COOKIE.trim();
  }

  const res = await fetch(`${SIBET90_BASE}/ajax.php`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`sibet90 ajax HTTP ${res.status}`);
  }

  return (await res.json()) as SibetApiResponse<T>;
}

export async function fetchSibet90Prematch(): Promise<BetStackEvent[]> {
  const allById = new Map<string, BetStackEvent>();
  const disciplines = [1, 5]; // Soccer and Tennis

  for (const discipline of disciplines) {
    try {
      const response = await sibetAjax<{
        championshipGroups: SibetPrematchChampionshipGroup[];
      }>({
        action: 'oddsPrint',
        iddiscipline: discipline,
      });

      if (response.errorCode !== 'success') {
        console.warn(`[sibet90] oddsPrint disciplina ${discipline} fallita: ${response.errorCode}`);
        continue;
      }

      const championshipGroups = response.result?.championshipGroups ?? [];

      for (const group of championshipGroups) {
        for (const championship of group.championships) {
          try {
            // Fetch events for this championship
            const eventsResponse = await sibetAjax<{
              events?: { result?: any[] };
              odds?: Record<string, SibetPrematchOdd[]>;
            }>({
              action: 'events',
              idchampionship: String(championship.idchampionship),
              discipline: String(discipline),
            });

            if (eventsResponse.errorCode !== 'success') {
              console.warn(`[sibet90] events campionato ${championship.idchampionship} fallito`);
              continue;
            }

            const rawEvents = eventsResponse.result?.events?.result ?? [];
            const oddsMap = eventsResponse.result?.odds ?? {};

            for (const rawEvent of rawEvents) {
              const { home, away } = parseTeams(rawEvent.descrizione);
              const eventOdds = oddsMap[String(rawEvent.extCode)] ?? [];
              const markets = buildPrematchMarkets(eventOdds, home, away, discipline);
              const bookmakers: OddsApiBookmaker[] = markets.length
                ? [{ key: 'sibet90', title: 'Sibet90', markets }]
                : [];

              const nation = group.name || 'Internazionale';
              const leagueName = championship._name || championship.name;

              const event: BetStackEvent = {
                id: `sb_prematch_${rawEvent.id_evento}`,
                home: { name: home },
                away: { name: away },
                time: parseTimestamp(rawEvent.dataora),
                sport_category: DISCIPLINE_SPORTS[discipline] ?? 'soccer',
                league: { name: `${nation} — ${leagueName}` },
                bookmakers,
                live: false,
              };

              allById.set(event.id, event);
            }
          } catch (err) {
            console.warn(`[sibet90] errore campionato ${championship.idchampionship}:`, err);
          }

          await sleep(50); // Rate limiting
        }
      }

      await sleep(100);
    } catch (err) {
      console.error(`[sibet90] errore disciplina ${discipline}:`, err);
    }
  }

  const events = Array.from(allById.values());
  console.log(`[sibet90] prematch: ${events.length} eventi`);
  return events;
}

export { SIBET90_BASE };


