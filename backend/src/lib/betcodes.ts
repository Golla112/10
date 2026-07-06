/**
 * Codici schedina — mapping mercato/esito → betcode
 */

export type BetcodeContext = {
  marketKey: string;
  outcome: string;
  point?: number;
  homeTeam?: string;
  awayTeam?: string;
};

const H2H: Record<string, string> = { '1': '1', X: '0', '2': '2' };
const DC: Record<string, string> = { '1X': '10', '12': '12', X2: '02' };
const BTTS: Record<string, string> = { GG: 'G', NG: 'N', Yes: 'G', No: 'N', GGS: 'G', GGN: 'N' };

const TOTALS: Record<number, { over: string; under: string }> = {
  0.5: { over: 'o0', under: 'u0' },
  1.5: { over: 'o1', under: 'u1' },
  2.5: { over: 'o2', under: 'u2' },
  3.5: { over: 'o3', under: 'u3' },
  4.5: { over: 'o4', under: 'u4' },
  5.5: { over: 'o5', under: 'u5' },
};

const TOTALS_H1: Record<number, { over: string; under: string }> = {
  0.5: { over: 'o0p', under: 'u0p' },
  1.5: { over: 'o1p', under: 'u1p' },
  2.5: { over: 'o2p', under: 'u2p' },
};

const TOTALS_H2: Record<number, { over: string; under: string }> = {
  0.5: { over: 'o0s', under: 'u0s' },
  1.5: { over: 'o1s', under: 'u1s' },
  2.5: { over: 'o2s', under: 'u2s' },
};

const H1_1X2: Record<string, string> = { '1': '61', X: '60', '2': '62' };
const H2_1X2: Record<string, string> = { '1': '71', X: '70', '2': '72' };
const DC_H1: Record<string, string> = { '1X': '10p', '12': '12p', X2: '02p' };
const DC_H2: Record<string, string> = { '1X': '10s', '12': '12s', X2: '02s' };

const HTFT: Record<string, string> = {
  '1/1': '111', '1/X': '110', '1/2': '112',
  'X/1': '101', 'X/X': '100', 'X/2': '102',
  '2/1': '121', '2/X': '120', '2/2': '122',
};

const EXACT_GOALS: Record<string, string> = {
  '0': 'g0', '1': 'g1', '2': 'g2', '3': 'g3', '4': 'g4', '5': 'g5', '6+': 'g6',
};

const EXACT_H1: Record<string, string> = { '0': 'g0p', '1': 'g1p', '2+': 'g2p' };
const EXACT_H2: Record<string, string> = { '0': 'g0s', '1': 'g1s', '2+': 'g2s' };

const CORRECT_SCORE: Record<string, string> = {
  '0-0': '200', '0-1': '201', '0-2': '202', '0-3': '203', '0-4': '204',
  '1-0': '210', '1-1': '211', '1-2': '212', '1-3': '213', '1-4': '214',
  '2-0': '220', '2-1': '221', '2-2': '222', '2-3': '223', '2-4': '224',
  '3-0': '230', '3-1': '231', '3-2': '232', '3-3': '233', '3-4': '234',
  '4-0': '240', '4-1': '241', '4-2': '242', '4-3': '243', '4-4': '244',
  '5-0': '250', '5-1': '251', '5-2': '252', '5-3': '253', '5-4': '254',
  Altro: '2al', Other: '2al',
};

const CS_H1: Record<string, string> = {
  '0-0': '800', '0-1': '801', '0-2': '802',
  '1-0': '810', '1-1': '811', '1-2': '812',
  '2-0': '820', '2-1': '821', '2-2': '822',
  Altro: '8al', Other: '8al',
};

const CS_H2: Record<string, string> = {
  '0-0': '900', '0-1': '901', '0-2': '902',
  '1-0': '910', '1-1': '911', '1-2': '912',
  '2-0': '920', '2-1': '921', '2-2': '922',
  Altro: '9al', Other: '9al',
};

function normOutcome(outcome: string, home?: string, away?: string): string {
  const o = outcome.trim();
  if (home && o === home) return '1';
  if (away && o === away) return '2';
  if (/^draw$/i.test(o) || o === 'Pareggio') return 'X';
  if (/^over$/i.test(o)) return 'Over';
  if (/^under$/i.test(o)) return 'Under';
  if (/^gg$/i.test(o) || /^yes$/i.test(o) || o === 'GGS') return 'GG';
  if (/^ng$/i.test(o) || /^no$/i.test(o) || o === 'GGN') return 'NG';
  if (/^pari$/i.test(o) || /^even$/i.test(o)) return 'Pari';
  if (/^dispari$/i.test(o) || /^odd$/i.test(o)) return 'Dispari';
  return o;
}

function totalsBetcode(
  table: Record<number, { over: string; under: string }>,
  point: number | undefined,
  outcome: string
): string | undefined {
  if (point == null) return undefined;
  const row = table[point];
  if (!row) return undefined;
  if (outcome === 'Over') return row.over;
  if (outcome === 'Under') return row.under;
  return undefined;
}

export function resolveBetcode(ctx: BetcodeContext): string | undefined {
  const outcome = normOutcome(ctx.outcome, ctx.homeTeam, ctx.awayTeam);
  const key = ctx.marketKey.toLowerCase();

  if (key === 'h2h' || key === '1x2') return H2H[outcome];
  if (key === 'double_chance' || key === 'dc') return DC[outcome];
  if (key === 'btts' || key === 'ggng') return BTTS[outcome];

  if (key.startsWith('totals_h1') || key === 'totals_1t') {
    return totalsBetcode(TOTALS_H1, ctx.point, outcome);
  }
  if (key.startsWith('totals_h2') || key === 'totals_2t') {
    return totalsBetcode(TOTALS_H2, ctx.point, outcome);
  }
  if (key.startsWith('totals')) {
    const point =
      ctx.point ??
      (key.match(/totals_(\d+)/)?.[1]
        ? Number(key.match(/totals_(\d+)/)![1]) + 0.5
        : key === 'totals' ? 2.5 : undefined);
    return totalsBetcode(TOTALS, point, outcome);
  }

  if (key === 'h2h_h1' || key === '1t') return H1_1X2[outcome];
  if (key === 'h2h_h2' || key === '2t') return H2_1X2[outcome];
  if (key === 'double_chance_h1' || key === 'dc_h1') return DC_H1[outcome];
  if (key === 'double_chance_h2' || key === 'dc_h2') return DC_H2[outcome];

  if (key === 'dnb') return outcome === '1' ? 'd1' : outcome === '2' ? 'd2' : undefined;
  if (key === 'dnb_h1') return outcome === '1' ? 'd1p' : outcome === '2' ? 'd2p' : undefined;
  if (key === 'dnb_h2') return outcome === '1' ? 'd1s' : outcome === '2' ? 'd2s' : undefined;

  if (key === 'btts_h1') return outcome === 'GG' ? 'ggp' : outcome === 'NG' ? 'ngp' : undefined;
  if (key === 'btts_h2') return outcome === 'GG' ? 'ggs' : outcome === 'NG' ? 'ngs' : undefined;

  if (key === 'htft') return HTFT[outcome];
  if (key === 'exact_goals') return EXACT_GOALS[outcome];
  if (key === 'exact_goals_h1') return EXACT_H1[outcome];
  if (key === 'exact_goals_h2') return EXACT_H2[outcome];
  if (key === 'correct_score') return CORRECT_SCORE[outcome];
  if (key === 'correct_score_h1') return CS_H1[outcome];
  if (key === 'correct_score_h2') return CS_H2[outcome];

  if (key === 'odd_even') return outcome === 'Pari' ? 'p' : outcome === 'Dispari' ? 'd' : undefined;

  if (key === 'hh' || key === 'tennis_h2h') return outcome === '1' ? '1hh' : outcome === '2' ? '2hh' : undefined;

  if (key === 'set_betting') {
    const map: Record<string, string> = { '2-0': 'r20', '2-1': 'r21', '0-2': 'r02', '1-2': 'r12' };
    return map[outcome];
  }

  if (key === 'set_match') {
    const map: Record<string, string> = { '1/1': 'sm11', '1/2': 'sm12', '2/1': 'sm21', '2/2': 'sm22' };
    return map[outcome];
  }

  if (key === 'handicap') {
    const map: Record<string, string> = {
      '1H(-1)': 'h1m', 'XH(-1)': 'h0m', '2H(-1)': 'h2m',
      '1H(+1)': 'h1p', 'XH(+1)': 'h0p', '2H(+1)': 'h2p',
    };
    return map[outcome];
  }

  if (key === 'tempo_gol') {
    const map: Record<string, string> = { '1': '1tg', X: '0tg', '2': '2tg' };
    return map[outcome];
  }

  return outcome;
}

export const BETCODE_MARKET_GROUPS = [
  { id: 'h2h', label: '1X2', marketKeys: ['h2h'] },
  { id: 'double_chance', label: 'Doppia Chance', marketKeys: ['double_chance'] },
  { id: 'btts', label: 'GG / NG', marketKeys: ['btts'] },
  { id: 'totals_05', label: 'U/O 0.5', marketKeys: ['totals_05'] },
  { id: 'totals_15', label: 'U/O 1.5', marketKeys: ['totals_15'] },
  { id: 'totals', label: 'U/O 2.5', marketKeys: ['totals', 'totals_25'] },
  { id: 'totals_35', label: 'U/O 3.5', marketKeys: ['totals_35'] },
  { id: 'totals_45', label: 'U/O 4.5', marketKeys: ['totals_45'] },
  { id: 'totals_55', label: 'U/O 5.5', marketKeys: ['totals_55'] },
  { id: 'h2h_h1', label: '1° Tempo', marketKeys: ['h2h_h1'] },
  { id: 'h2h_h2', label: '2° Tempo', marketKeys: ['h2h_h2'] },
  { id: 'double_chance_h1', label: 'DC 1T', marketKeys: ['double_chance_h1'] },
  { id: 'double_chance_h2', label: 'DC 2T', marketKeys: ['double_chance_h2'] },
  { id: 'dnb', label: 'Draw No Bet', marketKeys: ['dnb'] },
  { id: 'htft', label: 'HT / FT', marketKeys: ['htft'] },
  { id: 'odd_even', label: 'Pari / Dispari', marketKeys: ['odd_even'] },
  { id: 'correct_score', label: 'Ris. Esatto', marketKeys: ['correct_score'] },
  { id: 'handicap', label: 'Handicap', marketKeys: ['handicap'] },
] as const;

export type BetcodeMarketFilterId = (typeof BETCODE_MARKET_GROUPS)[number]['id'];

export function marketKeysForFilter(filterId: BetcodeMarketFilterId): string[] {
  const g = BETCODE_MARKET_GROUPS.find((x) => x.id === filterId);
  return g ? [...g.marketKeys] : [filterId];
}
