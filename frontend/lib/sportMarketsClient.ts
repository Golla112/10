/**
 * sportMarketsClient — calcola mercati sport-specifici lato frontend
 * Usato per eventi prematch non-calcio dove il backend non ha ancora calcolato i mercati
 */

type Odd = number | null;

const M = 0.07;
function toOdd(prob: number): Odd {
  if (prob <= 0.005 || prob >= 0.985) return null;
  return parseFloat((1 / (prob * (1 + M))).toFixed(2));
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function calcSportMarkets(
  sport: string,
  homeScore: number,
  awayScore: number,
  minute: number,
  homeName = 'Casa',
  awayName = 'Ospite'
): Record<string, unknown> | null {
  const hv = hashStr(homeName + awayName);
  const pH = 0.30 + (hv % 1000) / 4000;
  const pA = Math.max(0.05, 1 - pH - 0.22);

  if (sport === 'basketball') {
    const totalMinutes = 40;
    const timeLeft = Math.max(0.01, (totalMinutes - Math.min(minute, totalMinutes)) / totalMinutes);
    const diff = homeScore - awayScore;
    const sigma = Math.sqrt(timeLeft * totalMinutes * 2.0);
    const z = diff / Math.max(0.1, sigma);
    const pHome = Math.max(0.01, Math.min(0.99, 0.5 + 0.5 * Math.tanh(z * 0.9 + (pH - 0.5) * 2)));
    const pAway = 1 - pHome;
    const currentTotal = homeScore + awayScore;
    const expectedExtra = 80 * timeLeft;

    return {
      h2h: { home: toOdd(pHome), away: toOdd(pAway) },
      h2h_incl_ot: { home: toOdd(pHome * 0.97 + 0.015), away: toOdd(pAway * 0.97 + 0.015) },
      handicap: [-10.5, -7.5, -4.5, -1.5, 1.5, 4.5, 7.5, 10.5].map(line => {
        const adjZ = (diff + line) / Math.max(0.1, sigma);
        const p = Math.max(0.05, Math.min(0.95, 0.5 + 0.5 * Math.tanh(adjZ * 0.9)));
        return { line, home: toOdd(p), away: toOdd(1 - p) };
      }),
      over_under: [currentTotal + 5, currentTotal + 10, currentTotal + 15, currentTotal + 20, currentTotal + 25].map(line => ({
        line: Math.round(line / 0.5) * 0.5,
        over: toOdd(Math.max(0.05, 1 - Math.exp(-expectedExtra / (line - currentTotal + 1)))),
        under: toOdd(Math.max(0.05, Math.exp(-expectedExtra / (line - currentTotal + 1)))),
      })),
      h1: { home: toOdd(pHome), away: toOdd(pAway), ou: [{ line: currentTotal / 2 + 5, over: toOdd(0.52), under: toOdd(0.48) }] },
      q1: { home: toOdd(pHome), away: toOdd(pAway), ou: [{ line: currentTotal / 4 + 2, over: toOdd(0.52), under: toOdd(0.48) }] },
      odd_even: { odd: toOdd(0.50), even: toOdd(0.50) },
      margin: [
        { label: '1-5', odds: toOdd(0.22) }, { label: '6-10', odds: toOdd(0.20) },
        { label: '11-15', odds: toOdd(0.18) }, { label: '16-20', odds: toOdd(0.14) },
        { label: '21+', odds: toOdd(0.12) },
      ],
      combo: [
        { label: `${homeName} + Over`, odds: toOdd(pHome * 0.55) },
        { label: `${awayName} + Over`, odds: toOdd(pAway * 0.55) },
        { label: `${homeName} + Under`, odds: toOdd(pHome * 0.45) },
        { label: `${awayName} + Under`, odds: toOdd(pAway * 0.45) },
      ],
    };
  }

  if (sport === 'tennis') {
    const pP1 = Math.max(0.1, Math.min(0.9, pH));
    const pP2 = 1 - pP1;
    return {
      winner: { p1: toOdd(pP1), p2: toOdd(pP2) },
      winner_excl_ret: { p1: toOdd(pP1 * 1.02), p2: toOdd(pP2 * 1.02) },
      set_winner: [{ set: 1, p1: toOdd(pP1), p2: toOdd(pP2) }],
      ou_games: [{ line: 20.5, over: toOdd(0.52), under: toOdd(0.48) }, { line: 22.5, over: toOdd(0.45), under: toOdd(0.55) }],
      p1_wins_set: toOdd(Math.max(0.1, 1 - pP2 * pP2)),
      p2_wins_set: toOdd(Math.max(0.1, 1 - pP1 * pP1)),
      handicap_games: [-4.5, -2.5, -0.5, 0.5, 2.5, 4.5].map(line => ({
        line, p1: toOdd(Math.max(0.05, Math.min(0.95, pP1 + line * 0.03))),
        p2: toOdd(Math.max(0.05, Math.min(0.95, pP2 - line * 0.03))),
      })),
      ou_games_p1: [{ line: 3.5, over: toOdd(0.55), under: toOdd(0.45) }, { line: 4.5, over: toOdd(0.45), under: toOdd(0.55) }],
      ou_games_p2: [{ line: 3.5, over: toOdd(0.55), under: toOdd(0.45) }, { line: 4.5, over: toOdd(0.45), under: toOdd(0.55) }],
      odd_even_games: { odd: toOdd(0.50), even: toOdd(0.50) },
      set_betting: [
        { score: '2-0', odds: toOdd(pP1 * pP1) }, { score: '2-1', odds: toOdd(pP1 * pP2 * pP1 * 2) },
        { score: '0-2', odds: toOdd(pP2 * pP2) }, { score: '1-2', odds: toOdd(pP2 * pP1 * pP2 * 2) },
      ],
      total_sets: { two: toOdd(pP1 * pP1 + pP2 * pP2), three: toOdd(1 - pP1 * pP1 - pP2 * pP2) },
      exact_score: [
        { score: '2-0', odds: toOdd(pP1 * pP1) }, { score: '2-1', odds: toOdd(pP1 * pP2 * pP1 * 2) },
        { score: '0-2', odds: toOdd(pP2 * pP2) }, { score: '1-2', odds: toOdd(pP2 * pP1 * pP2 * 2) },
      ],
      combo_set1_match: [
        { label: 'P1 Vince Set 1 & Match', odds: toOdd(pP1 * pP1) },
        { label: 'P2 Vince Set 1 & Match', odds: toOdd(pP2 * pP2) },
        { label: 'P1 Vince Set 1, P2 Vince Match', odds: toOdd(pP1 * pP2) },
        { label: 'P2 Vince Set 1, P1 Vince Match', odds: toOdd(pP2 * pP1) },
      ],
    };
  }

  if (sport === 'baseball') {
    return {
      h2h: { home: toOdd(pH), away: toOdd(pA) },
      h2h_excl_extra: { home: toOdd(pH * 1.01), away: toOdd(pA * 1.01) },
      handicap: [-1.5, -0.5, 0.5, 1.5].map(line => ({
        line, home: toOdd(Math.max(0.05, Math.min(0.95, pH + line * 0.05))),
        away: toOdd(Math.max(0.05, Math.min(0.95, pA - line * 0.05))),
      })),
      over_under: [7.5, 8.5, 9.5, 10.5].map(line => ({ line, over: toOdd(0.50), under: toOdd(0.50) })),
      odd_even: { odd: toOdd(0.50), even: toOdd(0.50) },
      ou_home: [3.5, 4.5, 5.5].map(line => ({ line, over: toOdd(0.50), under: toOdd(0.50) })),
      ou_away: [3.5, 4.5, 5.5].map(line => ({ line, over: toOdd(0.50), under: toOdd(0.50) })),
      h2h_1st_inning: { home: toOdd(pH * 0.35), draw: toOdd(0.45), away: toOdd(pA * 0.35) },
      h2h_after5: { home: toOdd(pH), away: toOdd(pA) },
      ou_after5: [4.5, 5.5, 6.5].map(line => ({ line, over: toOdd(0.50), under: toOdd(0.50) })),
      total_ou_incl_ei: [8.0, 9.0, 10.0].map(line => ({ line, over: toOdd(0.50), under: toOdd(0.50) })),
      extra_inning: { yes: toOdd(0.08), no: toOdd(0.92) },
    };
  }

  if (sport === 'boxing' || sport === 'mma') {
    return {
      h2h: { home: toOdd(pH), away: toOdd(pA) },
      ou_rounds: [4.5, 6.5, 8.5].map(line => ({ line, over: toOdd(0.55), under: toOdd(0.45) })),
      method: { ko_home: toOdd(pH * 0.35), ko_away: toOdd(pA * 0.35), decision: toOdd(0.30) },
    };
  }

  return null;
}
