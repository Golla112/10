import { OddsApiMarket } from './betStackService';
import { resolveBetcode } from '../lib/betcodes';

interface OddEntry {
  key: string;
  name: string | number;
  valore: number;
}

type Outcome = { name: string; price: number; point?: number; betcode?: string };

function pick(raw: Record<string, OddEntry>, keys: string[]): number {
  for (const k of keys) {
    const v = raw[k]?.valore;
    if (typeof v === 'number' && v > 1) return v;
  }
  return 0;
}

function attachBetcode(
  marketKey: string,
  outcomes: Outcome[],
  home: string,
  away: string
): Outcome[] {
  return outcomes.map((o) => ({
    ...o,
    betcode:
      resolveBetcode({
        marketKey,
        outcome: o.name,
        point: o.point,
        homeTeam: home,
        awayTeam: away,
      }) || o.name,
  }));
}

function lineKeyFromUo(name: string): { key: string; point: number } | null {
  const m = name.match(/^(Over|Under)_(\d)_(\d)$/i);
  if (!m) return null;
  const point = Number(`${m[2]}.${m[3]}`);
  const suffix = String(point).replace('.', '');
  return { key: `totals_${suffix === '25' ? '' : suffix}`.replace(/_$/, '') || 'totals', point };
}

function parseUoMarkets(raw: Record<string, OddEntry>, home: string, away: string): OddsApiMarket[] {
  const lines = new Map<string, { over?: number; under?: number; point: number }>();

  for (const [k, entry] of Object.entries(raw)) {
    if (!k.startsWith('1_uo:') || entry.valore <= 1) continue;
    const part = k.slice('1_uo:'.length);
    const parsed = lineKeyFromUo(part);
    if (!parsed) continue;
    const id = String(parsed.point);
    if (!lines.has(id)) lines.set(id, { point: parsed.point });
    const row = lines.get(id)!;
    if (/^over/i.test(part)) row.over = entry.valore;
    if (/^under/i.test(part)) row.under = entry.valore;
  }

  const markets: OddsApiMarket[] = [];
  for (const row of lines.values()) {
    if (!row.over || !row.under) continue;
    const marketKey =
      row.point === 2.5
        ? 'totals'
        : `totals_${String(row.point).replace('.', '')}`;
    markets.push({
      key: marketKey,
      outcomes: attachBetcode(
        marketKey,
        [
          { name: 'Over', price: row.over, point: row.point },
          { name: 'Under', price: row.under, point: row.point },
        ],
        home,
        away
      ),
    });
  }
  return markets;
}

export function parseSuperbetSoccerMarkets(
  raw: Record<string, OddEntry>,
  home: string,
  away: string
): OddsApiMarket[] {
  const markets: OddsApiMarket[] = [];

  const h = pick(raw, ['1_1x2:1']);
  const d = pick(raw, ['1_1x2:Draw']);
  const a = pick(raw, ['1_1x2:2']);
  if (h > 1 && a > 1) {
    const outcomes: Outcome[] = [{ name: home, price: h }];
    if (d > 1) outcomes.push({ name: 'Draw', price: d });
    outcomes.push({ name: away, price: a });
    markets.push({ key: 'h2h', outcomes: attachBetcode('h2h', outcomes, home, away) });
  }

  const dcOut: Outcome[] = [];
  const dc1x = pick(raw, ['1_dc:1X']);
  const dc12 = pick(raw, ['1_dc:12']);
  const dcx2 = pick(raw, ['1_dc:X2']);
  if (dc1x > 1) dcOut.push({ name: '1X', price: dc1x });
  if (dc12 > 1) dcOut.push({ name: '12', price: dc12 });
  if (dcx2 > 1) dcOut.push({ name: 'X2', price: dcx2 });
  if (dcOut.length >= 2) {
    markets.push({ key: 'double_chance', outcomes: attachBetcode('double_chance', dcOut, home, away) });
  }

  const gg = pick(raw, ['1_ggng:Yes']);
  const ng = pick(raw, ['1_ggng:No']);
  if (gg > 1 && ng > 1) {
    markets.push({
      key: 'btts',
      outcomes: attachBetcode(
        'btts',
        [
          { name: 'GG', price: gg },
          { name: 'NG', price: ng },
        ],
        home,
        away
      ),
    });
  }

  markets.push(...parseUoMarkets(raw, home, away));

  const dnb1 = pick(raw, ['1_dnb:1', '1_gnb:1']);
  const dnb2 = pick(raw, ['1_dnb:2', '1_gnb:2']);
  if (dnb1 > 1 && dnb2 > 1) {
    markets.push({
      key: 'dnb',
      outcomes: attachBetcode(
        'dnb',
        [
          { name: home, price: dnb1 },
          { name: away, price: dnb2 },
        ],
        home,
        away
      ),
    });
  }

  const h1 = pick(raw, ['1_1x2_1t:1', '12_1x2_1t:1']);
  const d1 = pick(raw, ['1_1x2_1t:Draw', '12_1x2_1t:Draw']);
  const a1 = pick(raw, ['1_1x2_1t:2', '12_1x2_1t:2']);
  if (h1 > 1 && a1 > 1) {
    const o: Outcome[] = [{ name: home, price: h1 }];
    if (d1 > 1) o.push({ name: 'Draw', price: d1 });
    o.push({ name: away, price: a1 });
    markets.push({ key: 'h2h_h1', outcomes: attachBetcode('h2h_h1', o, home, away) });
  }

  const h2 = pick(raw, ['1_1x2_2t:1']);
  const d2t = pick(raw, ['1_1x2_2t:Draw']);
  const a2 = pick(raw, ['1_1x2_2t:2']);
  if (h2 > 1 && a2 > 1) {
    const o: Outcome[] = [{ name: home, price: h2 }];
    if (d2t > 1) o.push({ name: 'Draw', price: d2t });
    o.push({ name: away, price: a2 });
    markets.push({ key: 'h2h_h2', outcomes: attachBetcode('h2h_h2', o, home, away) });
  }

  return markets;
}

export function parseSuperbetMarkets(
  discipline: number,
  raw: Record<string, OddEntry>,
  home: string,
  away: string
): OddsApiMarket[] {
  if (discipline === 1) return parseSuperbetSoccerMarkets(raw, home, away);

  if (discipline === 4 || discipline === 5) {
    const h = pick(raw, ['7_to_win_match:1', '7_to_win_match_ex:1', '2_to_win_match:1']);
    const a = pick(raw, ['7_to_win_match:2', '7_to_win_match_ex:2', '2_to_win_match:2']);
    if (h <= 1 || a <= 1) return [];
    return [{
      key: discipline === 4 ? 'tennis_h2h' : 'h2h',
      outcomes: attachBetcode(
        discipline === 4 ? 'hh' : 'h2h',
        [
          { name: home, price: h },
          { name: away, price: a },
        ],
        home,
        away
      ),
    }];
  }

  return [];
}

interface MarketMeta {
  key: string;
  name: string;
  group_code?: string;
  odds?: Array<{ key: string; name: string | number }>;
}

const SOCCER_KEY_MAP: Record<string, string> = {
  '1_1x2': 'h2h',
  '1_dc': 'double_chance',
  '1_ggng': 'btts',
  '1_1x2_1t': 'h2h_h1',
  '12_1x2_1t': 'h2h_h1',
  '1_1x2_2t': 'h2h_h2',
  '1_1t_ft': 'htft',
  '1_dnb': 'dnb',
  '1_gnb': 'goal_no_bet',
  '1_cs': 'correct_score',
  '1_odd_even': 'odd_even',
  '1_odd_even_1t': 'odd_even_h1',
  '1_odd_even_2t': 'odd_even_h2',
  '1_handicap': 'handicap',
  '1_handicap_1t': 'handicap_h1',
  '1_handicap_2t': 'handicap_h2',
  '1_dc_1t': 'double_chance_h1',
  '1_dc_2t': 'double_chance_h2',
  '1_ggng_1t': 'btts_h1',
  '1_ggng_2t': 'btts_h2',
};

const TENNIS_KEY_MAP: Record<string, string> = {
  '7_to_win_match': 'tennis_h2h',
  '7_to_win_match_ex': 'tennis_h2h',
  '2_to_win_match': 'tennis_h2h',
  '7_1st_set_winner': 'tennis_set1',
  '7_1st_set_winner_ex': 'tennis_set1',
  '7_set_betting': 'set_betting',
  '7_set_betting_ex': 'set_betting',
};

const BASKET_KEY_MAP: Record<string, string> = {
  '2_to_win_match': 'h2h',
  '7_to_win_match': 'h2h',
  '2_handicap': 'spread',
  '2_uo': 'totals_group',
};

function superbetKeyToInternal(sbKey: string, discipline: number): string {
  if (discipline === 1) return SOCCER_KEY_MAP[sbKey] ?? sbKey.replace(/^1_/, '');
  if (discipline === 4) return TENNIS_KEY_MAP[sbKey] ?? `tn_${sbKey}`;
  if (discipline === 5) return BASKET_KEY_MAP[sbKey] ?? `bk_${sbKey}`;
  return sbKey;
}

function betcodeKeyFor(internalKey: string, discipline: number): string {
  if (discipline === 4 && internalKey === 'tennis_h2h') return 'hh';
  if (discipline === 4 && internalKey.startsWith('tn_7_')) return internalKey.replace(/^tn_7_/, '');
  return internalKey;
}

function formatOutcomeLabel(
  rawName: string | number,
  oddKey: string,
  home: string,
  away: string
): string {
  const part = oddKey.includes(':') ? oddKey.split(':').pop() ?? '' : String(rawName);
  const name = String(rawName || part).trim();
  if (name === '1' || part === '1') return home;
  if (name === '2' || part === '2') return away;
  if (/^draw$/i.test(name) || part === 'X' || name === 'X') return 'Draw';
  if (/^yes$/i.test(name) || name === 'GG') return 'GG';
  if (/^no$/i.test(name) || name === 'NG') return 'NG';
  if (/^over/i.test(name) || /^over/i.test(part)) return 'Over';
  if (/^under/i.test(name) || /^under/i.test(part)) return 'Under';
  if (name === '1X' || name === '12' || name === 'X2') return name;
  if (part.includes('_')) {
    return part.replace(/_/g, '/').replace(/M/g, '-').trim();
  }
  return name || part;
}

function extractPointFromOddKey(oddKey: string): number | undefined {
  const m = oddKey.match(/(?:Over|Under)_(\d)_(\d)/i);
  if (!m) return undefined;
  return Number(`${m[1]}.${m[2]}`);
}

function parseAllUoLines(
  raw: Record<string, OddEntry>,
  home: string,
  away: string,
  uoPrefix: string
): OddsApiMarket[] {
  const lines = new Map<string, { over?: number; under?: number; point: number }>();

  for (const [k, entry] of Object.entries(raw)) {
    if (!k.startsWith(`${uoPrefix}:`) || entry.valore <= 1) continue;
    const part = k.slice(`${uoPrefix}:`.length);
    const parsed = lineKeyFromUo(part);
    if (!parsed) continue;
    const id = String(parsed.point);
    if (!lines.has(id)) lines.set(id, { point: parsed.point });
    const row = lines.get(id)!;
    if (/^over/i.test(part)) row.over = entry.valore;
    if (/^under/i.test(part)) row.under = entry.valore;
  }

  const markets: OddsApiMarket[] = [];
  for (const row of lines.values()) {
    if (!row.over || !row.under) continue;
    const marketKey =
      row.point === 2.5 ? 'totals' : `totals_${String(row.point).replace('.', '')}`;
    markets.push({
      key: marketKey,
      name: `U/O ${row.point}`,
      outcomes: attachBetcode(
        marketKey,
        [
          { name: 'Over', price: row.over, point: row.point },
          { name: 'Under', price: row.under, point: row.point },
        ],
        home,
        away
      ),
    });
  }
  return markets;
}

function uoPrefixesForDiscipline(discipline: number): string[] {
  if (discipline === 1) return ['1_uo', '1_uo_1t', '1_uo_2t'];
  if (discipline === 4) return ['7_uo', '7_total_games', '7_1st_set_total_games'];
  if (discipline === 5) return ['2_uo', '5_uo'];
  return [];
}

export function parseSuperbetMarketsFromMeta(
  discipline: number,
  raw: Record<string, OddEntry>,
  marketsMeta: MarketMeta[],
  home: string,
  away: string
): OddsApiMarket[] {
  const markets: OddsApiMarket[] = [];
  const byInternal = new Map<string, OddsApiMarket>();

  for (const prefix of uoPrefixesForDiscipline(discipline)) {
    markets.push(...parseAllUoLines(raw, home, away, prefix));
  }

  for (const meta of marketsMeta) {
    if (/(_uo|total)/i.test(meta.key) && meta.key !== '1_odd_even') continue;

    const internalKey = superbetKeyToInternal(meta.key, discipline);
    const outcomes: Outcome[] = [];

    for (const ref of meta.odds ?? []) {
      const entry = raw[ref.key];
      if (!entry || entry.valore <= 1) continue;
      outcomes.push({
        name: formatOutcomeLabel(ref.name, ref.key, home, away),
        price: entry.valore,
        point: extractPointFromOddKey(ref.key),
      });
    }

    if (outcomes.length < 1) continue;
    if (outcomes.length === 1 && !internalKey.includes('correct') && !internalKey.includes('score')) {
      continue;
    }

    const bcKey = betcodeKeyFor(internalKey, discipline);
    const parsed: OddsApiMarket = {
      key: internalKey,
      name: meta.name,
      outcomes: attachBetcode(bcKey, outcomes, home, away),
    };

    const existing = byInternal.get(internalKey);
    if (!existing) {
      byInternal.set(internalKey, parsed);
    } else {
      const merged = [...existing.outcomes];
      for (const o of parsed.outcomes) {
        if (!merged.some((m) => m.name === o.name && m.point === o.point)) merged.push(o);
      }
      existing.outcomes = attachBetcode(bcKey, merged, home, away);
    }
  }

  markets.push(...byInternal.values());

  if (markets.length === 0) {
    return parseSuperbetMarkets(discipline, raw, home, away);
  }

  return dedupeMarkets(markets);
}

function dedupeMarkets(markets: OddsApiMarket[]): OddsApiMarket[] {
  const map = new Map<string, OddsApiMarket>();
  for (const m of markets) {
    const existing = map.get(m.key);
    if (!existing || existing.outcomes.length < m.outcomes.length) {
      map.set(m.key, m);
    }
  }
  return Array.from(map.values());
}
