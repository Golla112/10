/**
 * sportMarketsEngine — Mercati specifici per sport
 * Calcola quote per basket, tennis, baseball, boxe, MMA, hockey, ecc.
 */

export type Odd = number | null;

const MARGIN = 0.07;
function toOdd(prob: number, m = MARGIN): Odd {
  if (prob <= 0.001) return null;
  if (prob >= 0.985) return null;
  return parseFloat((1 / (prob * (1 + m))).toFixed(2));
}
function toOddForce(prob: number, m = MARGIN): number {
  const p = Math.max(0.001, Math.min(0.999, prob));
  return Math.max(1.01, parseFloat((1 / (p * (1 + m))).toFixed(2)));
}
function poissonPMF(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let r = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) r *= lambda / i;
  return r;
}
function pOver(line: number, lambda: number): number {
  let pu = 0;
  for (let k = 0; k <= Math.floor(line); k++) pu += poissonPMF(k, lambda);
  return Math.max(0.001, 1 - pu);
}

// ── BASKET ────────────────────────────────────────────────────────────────────

export interface BasketMarkets {
  h2h: { home: Odd; away: Odd };
  h2h_incl_ot: { home: Odd; away: Odd };
  handicap: Array<{ line: number; home: Odd; away: Odd }>;
  over_under: Array<{ line: number; over: Odd; under: Odd }>;
  h1: { home: Odd; away: Odd; ou: Array<{ line: number; over: Odd; under: Odd }> };
  q1: { home: Odd; away: Odd; ou: Array<{ line: number; over: Odd; under: Odd }> };
  odd_even: { odd: Odd; even: Odd };
  margin: Array<{ label: string; odds: Odd }>;
  combo: Array<{ label: string; odds: Odd }>;
}

export function calcBasketMarkets(
  homeScore: number, awayScore: number,
  minute: number, // minuti giocati (0-48 NBA, 0-40 Eurolega)
  totalMinutes = 40,
  base?: { home: number; away: number }
): BasketMarkets {
  const timeLeft = Math.max(0.01, (totalMinutes - Math.min(minute, totalMinutes)) / totalMinutes);
  const diff = homeScore - awayScore;

  // Stima punti rimanenti per squadra (media ~80 punti/40min = 2 pt/min)
  const ptsPerMin = 2.0;
  const expectedPtsH = ptsPerMin * timeLeft * totalMinutes * 0.5;
  const expectedPtsA = ptsPerMin * timeLeft * totalMinutes * 0.5;

  // Probabilità vittoria basata su vantaggio attuale + tempo rimanente
  // Modello: diff / sqrt(timeLeft * totalMinutes * 2) → z-score
  const sigma = Math.sqrt(timeLeft * totalMinutes * 2.0);
  const z = diff / Math.max(0.1, sigma);
  // Approssimazione normale: P(home vince) = Φ(z)
  const pH = Math.max(0.01, Math.min(0.99, 0.5 + 0.5 * Math.tanh(z * 0.9)));
  const pA = 1 - pH;

  // Handicap lines
  const hcpLines = [-10.5, -7.5, -4.5, -1.5, 1.5, 4.5, 7.5, 10.5];
  const handicap = hcpLines.map(line => {
    const adjDiff = diff + line;
    const adjZ = adjDiff / Math.max(0.1, sigma);
    const pHome = Math.max(0.01, Math.min(0.99, 0.5 + 0.5 * Math.tanh(adjZ * 0.9)));
    return { line, home: toOdd(pHome), away: toOdd(1 - pHome) };
  });

  // O/U totale
  const currentTotal = homeScore + awayScore;
  const expectedTotal = currentTotal + (expectedPtsH + expectedPtsA);
  const ouLines = [
    currentTotal + 5, currentTotal + 10, currentTotal + 15,
    currentTotal + 20, currentTotal + 25,
  ].map(l => Math.round(l / 0.5) * 0.5);

  const over_under = ouLines.map(line => ({
    line,
    over: toOdd(pOver(line - currentTotal, expectedPtsH + expectedPtsA)),
    under: toOdd(1 - pOver(line - currentTotal, expectedPtsH + expectedPtsA)),
  }));

  // Pari/Dispari
  const projTotal = Math.round(expectedTotal);
  const pOdd = projTotal % 2 !== 0 ? 0.52 : 0.48;

  // Margine vittoria
  const margins = [
    { label: '1-5', p: 0.22 }, { label: '6-10', p: 0.20 },
    { label: '11-15', p: 0.18 }, { label: '16-20', p: 0.14 },
    { label: '21+', p: 0.12 },
  ];

  // Combo
  const combos = [
    { label: `${base?.home ?? 'Casa'} + Over`, p: pH * 0.55 },
    { label: `${base?.away ?? 'Ospite'} + Over`, p: pA * 0.55 },
    { label: `${base?.home ?? 'Casa'} + Under`, p: pH * 0.45 },
    { label: `${base?.away ?? 'Ospite'} + Under`, p: pA * 0.45 },
  ];

  return {
    h2h: { home: toOdd(pH), away: toOdd(pA) },
    h2h_incl_ot: { home: toOdd(pH * 0.97 + 0.015), away: toOdd(pA * 0.97 + 0.015) },
    handicap,
    over_under,
    h1: {
      home: toOdd(pH),
      away: toOdd(pA),
      ou: [
        { line: currentTotal / 2 + 5, over: toOdd(0.52), under: toOdd(0.48) },
        { line: currentTotal / 2 + 8, over: toOdd(0.45), under: toOdd(0.55) },
      ],
    },
    q1: {
      home: toOdd(pH),
      away: toOdd(pA),
      ou: [
        { line: currentTotal / 4 + 2, over: toOdd(0.52), under: toOdd(0.48) },
      ],
    },
    odd_even: { odd: toOdd(pOdd), even: toOdd(1 - pOdd) },
    margin: margins.map(m => ({ label: m.label, odds: toOdd(m.p) })),
    combo: combos.map(c => ({ label: c.label, odds: toOdd(c.p) })),
  };
}

// ── TENNIS ────────────────────────────────────────────────────────────────────

export interface TennisMarkets {
  winner: { p1: Odd; p2: Odd };
  winner_excl_ret: { p1: Odd; p2: Odd };
  set_winner: Array<{ set: number; p1: Odd; p2: Odd }>;
  ou_games: Array<{ line: number; over: Odd; under: Odd }>;
  p1_wins_set: Odd;
  p2_wins_set: Odd;
  handicap_games: Array<{ line: number; p1: Odd; p2: Odd }>;
  ou_games_p1: Array<{ line: number; over: Odd; under: Odd }>;
  ou_games_p2: Array<{ line: number; over: Odd; under: Odd }>;
  odd_even_games: { odd: Odd; even: Odd };
  set_betting: Array<{ score: string; odds: Odd }>;
  total_sets: { two: Odd; three: Odd };
  exact_score: Array<{ score: string; odds: Odd }>;
  combo_set1_match: Array<{ label: string; odds: Odd }>;
}

export function calcTennisMarkets(
  p1Sets: number, p2Sets: number,
  p1Games: number, p2Games: number,
  bestOf = 3,
  base?: { p1: number; p2: number }
): TennisMarkets {
  const setsNeeded = Math.ceil(bestOf / 2);
  const p1SetsLeft = setsNeeded - p1Sets;
  const p2SetsLeft = setsNeeded - p2Sets;

  // Probabilità base per set
  const baseP1 = base ? (1 / base.p1) / (1 / base.p1 + 1 / base.p2) : 0.5;
  const pP1Set = Math.max(0.1, Math.min(0.9, baseP1));
  const pP2Set = 1 - pP1Set;

  // Probabilità match
  function pWinMatch(pSet: number, setsNeeded: number, setsWon: number, setsLost: number): number {
    if (setsWon >= setsNeeded) return 1;
    if (setsLost >= setsNeeded) return 0;
    const remaining = (setsNeeded - setsWon) + (setsNeeded - setsLost);
    let p = 0;
    for (let w = setsNeeded - setsWon; w <= remaining; w++) {
      const l = remaining - w;
      if (l > setsNeeded - setsLost - 1) continue;
      const coeff = factorial(w + l - 1) / (factorial(w - 1) * factorial(l));
      p += coeff * Math.pow(pSet, w) * Math.pow(1 - pSet, l);
    }
    return Math.max(0.01, Math.min(0.99, p));
  }

  function factorial(n: number): number {
    if (n <= 1) return 1;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  const pH = pWinMatch(pP1Set, setsNeeded, p1Sets, p2Sets);
  const pA = 1 - pH;

  // Games totali stimati
  const avgGamesPerSet = 9.5;
  const setsPlayed = p1Sets + p2Sets;
  const setsRemaining = p1SetsLeft + p2SetsLeft;
  const currentGames = p1Games + p2Games;
  const expectedTotalGames = setsPlayed * avgGamesPerSet + setsRemaining * avgGamesPerSet + currentGames;

  const ouGamesLines = [
    Math.round(expectedTotalGames - 4),
    Math.round(expectedTotalGames - 2),
    Math.round(expectedTotalGames),
    Math.round(expectedTotalGames + 2),
  ].map(l => l + 0.5);

  // Set betting (solo per best-of-3)
  const setScores = bestOf === 3
    ? [
        { score: '2-0', p: pP1Set * pP1Set },
        { score: '2-1', p: pP1Set * pP2Set * pP1Set * 2 },
        { score: '0-2', p: pP2Set * pP2Set },
        { score: '1-2', p: pP2Set * pP1Set * pP2Set * 2 },
      ]
    : [
        { score: '3-0', p: Math.pow(pP1Set, 3) },
        { score: '3-1', p: 3 * Math.pow(pP1Set, 3) * pP2Set },
        { score: '3-2', p: 6 * Math.pow(pP1Set, 3) * Math.pow(pP2Set, 2) },
        { score: '0-3', p: Math.pow(pP2Set, 3) },
        { score: '1-3', p: 3 * Math.pow(pP2Set, 3) * pP1Set },
        { score: '2-3', p: 6 * Math.pow(pP2Set, 3) * Math.pow(pP1Set, 2) },
      ];

  // Combo set1 & match
  const combos = [
    { label: 'P1 Vince Set 1 & Match', p: pP1Set * pH },
    { label: 'P2 Vince Set 1 & Match', p: pP2Set * pA },
    { label: 'P1 Vince Set 1, P2 Vince Match', p: pP1Set * pA },
    { label: 'P2 Vince Set 1, P1 Vince Match', p: pP2Set * pH },
  ];

  return {
    winner: { p1: toOdd(pH), p2: toOdd(pA) },
    winner_excl_ret: { p1: toOdd(pH * 1.02), p2: toOdd(pA * 1.02) },
    set_winner: Array.from({ length: setsPlayed + 1 }, (_, i) => ({
      set: i + 1,
      p1: toOdd(pP1Set),
      p2: toOdd(pP2Set),
    })),
    ou_games: ouGamesLines.map(line => ({
      line,
      over: toOdd(pOver(line - currentGames, setsRemaining * avgGamesPerSet)),
      under: toOdd(1 - pOver(line - currentGames, setsRemaining * avgGamesPerSet)),
    })),
    p1_wins_set: toOdd(Math.max(0.05, 1 - Math.pow(pP2Set, p2SetsLeft))),
    p2_wins_set: toOdd(Math.max(0.05, 1 - Math.pow(pP1Set, p1SetsLeft))),
    handicap_games: [-4.5, -2.5, -0.5, 0.5, 2.5, 4.5].map(line => ({
      line,
      p1: toOdd(Math.max(0.05, Math.min(0.95, pP1Set + line * 0.03))),
      p2: toOdd(Math.max(0.05, Math.min(0.95, pP2Set - line * 0.03))),
    })),
    ou_games_p1: [3.5, 4.5, 5.5].map(line => ({
      line,
      over: toOdd(pOver(line, avgGamesPerSet * pP1Set * setsRemaining / 2)),
      under: toOdd(1 - pOver(line, avgGamesPerSet * pP1Set * setsRemaining / 2)),
    })),
    ou_games_p2: [3.5, 4.5, 5.5].map(line => ({
      line,
      over: toOdd(pOver(line, avgGamesPerSet * pP2Set * setsRemaining / 2)),
      under: toOdd(1 - pOver(line, avgGamesPerSet * pP2Set * setsRemaining / 2)),
    })),
    odd_even_games: { odd: toOdd(0.50), even: toOdd(0.50) },
    set_betting: setScores.map(s => ({ score: s.score, odds: toOdd(s.p) })),
    total_sets: {
      two: toOdd(Math.pow(pP1Set, 2) + Math.pow(pP2Set, 2)),
      three: toOdd(1 - Math.pow(pP1Set, 2) - Math.pow(pP2Set, 2)),
    },
    exact_score: [
      { score: '2-0', odds: toOdd(pP1Set * pP1Set) },
      { score: '2-1', odds: toOdd(pP1Set * pP2Set * pP1Set * 2) },
      { score: '0-2', odds: toOdd(pP2Set * pP2Set) },
      { score: '1-2', odds: toOdd(pP2Set * pP1Set * pP2Set * 2) },
    ],
    combo_set1_match: combos.map(c => ({ label: c.label, odds: toOdd(c.p) })),
  };
}

// ── BASEBALL ─────────────────────────────────────────────────────────────────

export interface BaseballMarkets {
  h2h: { home: Odd; away: Odd };
  h2h_excl_extra: { home: Odd; away: Odd };
  handicap: Array<{ line: number; home: Odd; away: Odd }>;
  over_under: Array<{ line: number; over: Odd; under: Odd }>;
  odd_even: { odd: Odd; even: Odd };
  ou_home: Array<{ line: number; over: Odd; under: Odd }>;
  ou_away: Array<{ line: number; over: Odd; under: Odd }>;
  h2h_1st_inning: { home: Odd; draw: Odd; away: Odd };
  h2h_after5: { home: Odd; away: Odd };
  ou_after5: Array<{ line: number; over: Odd; under: Odd }>;
  total_ou_incl_ei: Array<{ line: number; over: Odd; under: Odd }>;
  extra_inning: { yes: Odd; no: Odd };
}

export function calcBaseballMarkets(
  homeScore: number, awayScore: number,
  inning: number, totalInnings = 9,
  base?: { home: number; away: number }
): BaseballMarkets {
  const inningsLeft = Math.max(0, totalInnings - inning);
  const timeLeft = inningsLeft / totalInnings;
  const diff = homeScore - awayScore;

  const baseP = base ? (1 / base.home) / (1 / base.home + 1 / base.away) : 0.5;
  const runsPerInning = 0.5;
  const expectedRunsH = runsPerInning * inningsLeft * baseP;
  const expectedRunsA = runsPerInning * inningsLeft * (1 - baseP);

  const sigma = Math.sqrt(timeLeft * totalInnings * 0.8);
  const z = diff / Math.max(0.1, sigma);
  const pH = Math.max(0.01, Math.min(0.99, 0.5 + 0.5 * Math.tanh(z * 0.9)));
  const pA = 1 - pH;

  const currentTotal = homeScore + awayScore;
  const expectedTotal = currentTotal + expectedRunsH + expectedRunsA;

  const ouLines = [6.5, 7.5, 8.5, 9.5, 10.5].filter(l => l > currentTotal);

  return {
    h2h: { home: toOdd(pH), away: toOdd(pA) },
    h2h_excl_extra: { home: toOdd(pH * 1.01), away: toOdd(pA * 1.01) },
    handicap: [-1.5, -0.5, 0.5, 1.5].map(line => ({
      line,
      home: toOdd(Math.max(0.05, Math.min(0.95, pH + line * 0.05))),
      away: toOdd(Math.max(0.05, Math.min(0.95, pA - line * 0.05))),
    })),
    over_under: ouLines.map(line => ({
      line,
      over: toOdd(pOver(line - currentTotal, expectedRunsH + expectedRunsA)),
      under: toOdd(1 - pOver(line - currentTotal, expectedRunsH + expectedRunsA)),
    })),
    odd_even: { odd: toOdd(0.50), even: toOdd(0.50) },
    ou_home: [3.5, 4.5, 5.5].map(line => ({
      line,
      over: toOdd(pOver(line - homeScore, expectedRunsH)),
      under: toOdd(1 - pOver(line - homeScore, expectedRunsH)),
    })),
    ou_away: [3.5, 4.5, 5.5].map(line => ({
      line,
      over: toOdd(pOver(line - awayScore, expectedRunsA)),
      under: toOdd(1 - pOver(line - awayScore, expectedRunsA)),
    })),
    h2h_1st_inning: {
      home: toOdd(baseP * 0.35),
      draw: toOdd(0.45),
      away: toOdd((1 - baseP) * 0.35),
    },
    h2h_after5: { home: toOdd(pH), away: toOdd(pA) },
    ou_after5: [4.5, 5.5, 6.5].map(line => ({
      line,
      over: toOdd(pOver(line - currentTotal, (expectedRunsH + expectedRunsA) * 0.6)),
      under: toOdd(1 - pOver(line - currentTotal, (expectedRunsH + expectedRunsA) * 0.6)),
    })),
    total_ou_incl_ei: ouLines.map(line => ({
      line: line + 0.5,
      over: toOdd(pOver(line - currentTotal + 0.5, expectedRunsH + expectedRunsA + 0.5)),
      under: toOdd(1 - pOver(line - currentTotal + 0.5, expectedRunsH + expectedRunsA + 0.5)),
    })),
    extra_inning: {
      yes: toOdd(Math.max(0.05, 0.08 + (1 - Math.abs(diff) * 0.1) * timeLeft * 0.15)),
      no: toOdd(Math.max(0.05, 0.92 - (1 - Math.abs(diff) * 0.1) * timeLeft * 0.15)),
    },
  };
}

// ── BOXE / MMA ────────────────────────────────────────────────────────────────

export interface BoxingMarkets {
  h2h: { home: Odd; away: Odd };
  ou_rounds: Array<{ line: number; over: Odd; under: Odd }>;
  method: { ko_home: Odd; ko_away: Odd; decision: Odd };
}

export function calcBoxingMarkets(
  round: number, totalRounds: number,
  base?: { home: number; away: number }
): BoxingMarkets {
  const baseP = base ? (1 / base.home) / (1 / base.home + 1 / base.away) : 0.5;
  const roundsLeft = Math.max(0, totalRounds - round);
  const pKO = 0.35 * (roundsLeft / totalRounds);

  const ouLines = [round + 1.5, round + 2.5, round + 3.5]
    .filter(l => l < totalRounds)
    .map(l => Math.round(l * 2) / 2);

  return {
    h2h: { home: toOdd(baseP), away: toOdd(1 - baseP) },
    ou_rounds: ouLines.map(line => ({
      line,
      over: toOdd(Math.max(0.1, 1 - pKO * (line - round) / roundsLeft)),
      under: toOdd(Math.max(0.1, pKO * (line - round) / roundsLeft)),
    })),
    method: {
      ko_home: toOdd(baseP * pKO),
      ko_away: toOdd((1 - baseP) * pKO),
      decision: toOdd(1 - pKO),
    },
  };
}
