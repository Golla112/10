'use strict';
/**
 * ODDS COMPILER PROFESSIONALE
 * ─────────────────────────────────────────────────────────────────
 * Esattamente come funziona un odds compiler reale:
 * 1. Calcola probabilità "true" (da ELO + modelli statistici)
 * 2. Applica margine bookmaker (overround)
 * 3. Genera tutte le quote derivate (OU, BTTS, handicap...)
 * 4. Applica correlazioni tra mercati
 * 5. Gestisce limiti di stake per mercato
 * ─────────────────────────────────────────────────────────────────
 */

const { calcProbabilities } = require('./elo');
const { calcGoalModel } = require('./goalModel');

// Margine bookmaker per mercato (overround)
// Mercati liquidi → margine basso | mercati esotici → margine alto
const MARGINS = {
  // Mercati principali
  ft_1x2:           1.045,  // 4.5% — mercato più liquido
  dc:               1.040,
  ht_1x2:           1.065,
  btts:             1.050,
  // Over/Under
  ou_0_5:           1.060,
  ou_1_5:           1.055,
  ou_2_5:           1.050,
  ou_3_5:           1.055,
  ou_4_5:           1.060,
  ou_5_5:           1.065,
  ou_6_5:           1.070,
  // Handicap
  ah:               1.040,  // Asian handicap — mercato efficiente
  eh:               1.060,
  // Score/speciali
  cs:               1.150,  // Alta margine — molti outcomes
  htft:             1.130,
  // Cards/Corners
  cards:            1.080,
  corners:          1.070,
  // Combo
  combo:            1.090,
  // Default
  default:          1.075,
};

// Limiti stake per mercato (€)
const STAKE_LIMITS = {
  ft_1x2:     50000,
  dc:         30000,
  btts:       25000,
  ou_2_5:     30000,
  ah:         40000,
  cs:          5000,
  htft:        8000,
  cards:      10000,
  corners:    10000,
  default:    15000,
};

/**
 * COMPILER PRINCIPALE
 * Genera tutte le quote per un evento dato
 */
function compileAllOdds(event) {
  const { homeTeam, awayTeam, sport, competition } = event;
  const isNeutralVenue = ['tennis','mma','esports','formula1'].includes(sport);

  // Probabilità base da ELO
  const probs = calcProbabilities(homeTeam, awayTeam, sport, isNeutralVenue);

  // Modello goal (solo sport con punteggio continuo)
  let goalModel = null;
  if (['football','hockey','basketball','baseball','americanfootball'].includes(sport)) {
    goalModel = calcGoalModel(probs, sport);
  }

  const allOdds = {};

  // ── FOOTBALL MARKETS ──────────────────────────────────────────
  if (sport === 'football') {
    allOdds['ft_1x2'] = compile1X2(probs, '1x2');
    allOdds['ht_1x2'] = compileHT1X2(probs);
    allOdds['dc']     = compileDoubleChance(probs);
    allOdds['ht_dc']  = compileHTDC(probs);
    allOdds['no_draw']= compileNoDraw(probs);

    // Over/Under su modello Poisson
    const ouLines = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5];
    ouLines.forEach(line => {
      const id = `ou_${line.toString().replace('.','_')}`;
      allOdds[id] = compileOverUnder(goalModel, line, MARGINS.ou_2_5);
    });

    // Home/Away goals separately
    allOdds['home_ou_0_5'] = compileTeamGoals(goalModel, 'home', 0.5);
    allOdds['home_ou_1_5'] = compileTeamGoals(goalModel, 'home', 1.5);
    allOdds['home_ou_2_5'] = compileTeamGoals(goalModel, 'home', 2.5);
    allOdds['away_ou_0_5'] = compileTeamGoals(goalModel, 'away', 0.5);
    allOdds['away_ou_1_5'] = compileTeamGoals(goalModel, 'away', 1.5);
    allOdds['away_ou_2_5'] = compileTeamGoals(goalModel, 'away', 2.5);

    // BTTS
    allOdds['btts']    = compileBTTS(goalModel);
    allOdds['btts_ht'] = compileBTTSHT(goalModel);
    allOdds['btts_2h'] = compileBTTS2H(goalModel);

    // Correct Score
    allOdds['cs']   = compileCorrectScore(goalModel, MARGINS.cs);
    allOdds['ht_cs']= compileHTCorrectScore(goalModel, MARGINS.cs);

    // Asian Handicap
    [-2.5,-2,-1.5,-1,-0.5,0,0.5,1,1.5,2,2.5].forEach(h => {
      const id = `ah_${h.toString().replace('.','_').replace('-','m')}`;
      allOdds[id] = compileAsianHandicap(goalModel, h, MARGINS.ah);
    });

    // European Handicap
    [-3,-2,-1,0,1,2,3].forEach(h => {
      const id = `eh_${h.toString().replace('-','m')}`;
      allOdds[id] = compileEuropeanHandicap(probs, goalModel, h);
    });

    // HT/FT
    allOdds['htft'] = compileHTFT(probs);

    // 1X2 + BTTS
    allOdds['ft_1x2_btts'] = compile1X2BTTS(probs, goalModel);

    // 1X2 + OU 2.5
    allOdds['ft_1x2_ou25'] = compile1X2OU(probs, goalModel);

    // Exact Goals
    [0,1,2,3,4,5,6].forEach(n => {
      allOdds[`exact_goals_${n}`] = compileExactGoals(goalModel, n);
    });

    // Odd/Even
    allOdds['odd_even'] = compileOddEven(goalModel);

    // Clean Sheet
    allOdds['home_clean'] = compileCleanSheet(goalModel, 'home');
    allOdds['away_clean'] = compileCleanSheet(goalModel, 'away');

    // Win to Nil
    allOdds['win_nil'] = compileWinToNil(probs, goalModel);

    // First Goal
    allOdds['first_goal'] = compileFirstGoal(probs, goalModel);
    allOdds['last_goal']  = compileLastGoal(probs, goalModel);

    // Corners (O/U)
    [7.5,8.5,9.5,10.5,11.5,12.5].forEach(line => {
      allOdds[`corners_ou_${line.toString().replace('.','_')}`] = compileCorners(probs, line);
    });
    allOdds['first_corner'] = compileFirstCorner(probs);

    // Cards
    [2.5,3.5,4.5,5.5].forEach(line => {
      allOdds[`cards_ou_${line.toString().replace('.','_')}`] = compileCards(probs, line);
    });
    allOdds['home_card'] = compileTeamCard(probs, 'home');
    allOdds['away_card'] = compileTeamCard(probs, 'away');

    // Goal in time window
    [[1,15],[16,30],[31,45],[46,60],[61,75],[76,90]].forEach(([s,e]) => {
      allOdds[`goal_${s}_${e}`] = compileGoalInWindow(goalModel, s, e);
    });

  // ── BASKETBALL MARKETS ─────────────────────────────────────────
  } else if (sport === 'basketball') {
    allOdds['bk_ml'] = compileMoneyline(probs);
    const totalLines = [195.5,200.5,205.5,210.5,215.5,220.5,225.5,230.5,235.5,240.5];
    totalLines.forEach(line => {
      allOdds[`bk_ou_${line}`] = compileBKOverUnder(probs, goalModel, line);
    });
    [-15.5,-12.5,-9.5,-7.5,-5.5,-3.5,-1.5,1.5,3.5,5.5,7.5,9.5,12.5,15.5].forEach(h => {
      allOdds[`bk_spread_${h}`] = compileBKSpread(probs, goalModel, h);
    });
    ['q1','q2','q3','q4'].forEach(q => { allOdds[`bk_${q}`] = compileQuarter(probs); });
    allOdds['bk_ht']  = compileMoneyline(probs, 1.06);
    allOdds['bk_ot']  = compileOT(probs, 0.18);
    [22.5,24.5,26.5].forEach(l => { allOdds[`bk_3pt_${l}`] = compileSpecialBinary(0.50, l, 1.09); });
    [100.5,105.5,110.5,115.5].forEach(l => { allOdds[`bk_home_ou_${l}`] = compileTeamTotal(probs, goalModel, l, 'home'); });
    [100.5,105.5,110.5,115.5].forEach(l => { allOdds[`bk_away_ou_${l}`] = compileTeamTotal(probs, goalModel, l, 'away'); });

  // ── TENNIS MARKETS ─────────────────────────────────────────────
  } else if (sport === 'tennis') {
    allOdds['tn_ml'] = compileMoneyline(probs);
    // Sets (Bo3 or Bo5 in Grand Slam)
    const isGrandSlam = competition?.includes('grand_slam') || competition?.includes('gs');
    allOdds['tn_sets'] = compileTennisSets(probs, isGrandSlam);
    allOdds['tn_s1']   = compileMoneyline(probs, 1.05);
    allOdds['tn_s2']   = compileMoneyline(probs, 1.06);
    allOdds['tn_s3']   = compileTennisS3(probs, isGrandSlam);
    [19.5,21.5,23.5,25.5,27.5,29.5,31.5,33.5,35.5,37.5,39.5,41.5,43.5].forEach(l => {
      allOdds[`tn_ou_${l}`] = compileTennisGames(probs, l);
    });
    allOdds['tn_aces']      = compileSpecialBinary(0.50, 18.5, 1.08);
    allOdds['tn_df']        = compileSpecialBinary(0.45, 6.5, 1.08);
    allOdds['tn_tiebreak']  = compileBinary(probs.ratingDiff < 80 ? 0.62 : 0.48, 1.07);
    allOdds['tn_firstset_winner'] = compileBinary(0.68, 1.06);

  // ── HOCKEY MARKETS ─────────────────────────────────────────────
  } else if (sport === 'hockey') {
    allOdds['hk_3way'] = compile1X2(probs, 'hockey');
    allOdds['hk_ml']   = compileMoneyline(probs); // incl. OT
    [3.5,4.5,5.5,6.5,7.5,8.5].forEach(l => {
      allOdds[`hk_ou_${l}`] = compileOverUnder(goalModel, l, 1.055);
    });
    ['p1','p2','p3'].forEach(p => { allOdds[`hk_${p}`] = compile1X2(probs, 'hockey', 1.08); });
    allOdds['hk_ot']   = compileOT(probs, 0.22);
    allOdds['hk_btts'] = compileBTTS(goalModel);
    allOdds['hk_so']   = compileBinary(0.12, 1.10); // Shootout
    [3.5,4.5,5.5].forEach(l => { allOdds[`hk_pens_${l}`] = compileSpecialBinary(0.50, l, 1.10); });

  // ── MMA MARKETS ────────────────────────────────────────────────
  } else if (sport === 'mma') {
    allOdds['mma_ml']      = compileMoneyline(probs);
    allOdds['mma_method']  = compileMMAMethod(probs);
    allOdds['mma_distance']= compileBinary(0.42, 1.09);
    [1,2,3,4,5].forEach(r => { allOdds[`mma_r${r}`] = compileMMAround(probs, r); });
    allOdds['mma_ou25r']   = compileBinary(0.50, 1.07);
    allOdds['mma_winner_method'] = compileMMAWinnerMethod(probs);

  // ── ESPORTS MARKETS ────────────────────────────────────────────
  } else if (sport === 'esports') {
    allOdds['es_ml']    = compileMoneyline(probs);
    allOdds['es_maps']  = compileEsportsMaps(probs);
    ['map1','map2','map3','map4','map5'].forEach((m, i) => {
      allOdds[`es_${m}`] = compileEsportsMap(probs, i+1);
    });
    [24.5,26.5,28.5,30.5].forEach(l => { allOdds[`es_kills_${l}`] = compileSpecialBinary(0.50, l, 1.10); });
    allOdds['es_fb']   = compileMoneyline(probs, 1.07); // First blood
    allOdds['es_ot']   = compileBinary(0.18, 1.10);

  // ── FORMULA 1 MARKETS ──────────────────────────────────────────
  } else if (sport === 'formula1') {
    allOdds['f1_winner']  = compileF1Winner(probs);
    allOdds['f1_podium']  = compileF1Podium(probs);
    allOdds['f1_pole']    = compileF1Winner(probs, 1.12);
    allOdds['f1_fastest'] = compileF1Winner(probs, 1.13);
    allOdds['f1_sc']      = compileBinary(0.65, 1.09);
    allOdds['f1_dnf']     = compileBinary(0.72, 1.07);
  }

  // Aggiungi metadata a ogni mercato
  Object.keys(allOdds).forEach(mktId => {
    const mkt = allOdds[mktId];
    const margin = Object.values(mkt).reduce((s, o) => s + (1/o.odd), 0);
    mkt.__meta = {
      overround: parseFloat((margin * 100).toFixed(2)),
      stakeLimit: STAKE_LIMITS[mktId.split('_')[0]] || STAKE_LIMITS.default,
      status: 'active',
      generatedAt: Date.now(),
    };
  });

  return allOdds;
}

// ─── HELPER COMPILERS ─────────────────────────────────────────────────────────

function probToOdd(prob, margin = 1.0) {
  const marginedProb = Math.min(0.98, prob * margin);
  const odd = 1 / marginedProb;
  return Math.round(odd * 100) / 100;
}

function makeOutcome(label, prob, margin, meta = {}) {
  const odd = Math.max(1.01, Math.min(999, probToOdd(prob, margin)));
  return {
    id: label,
    label,
    odd: parseFloat(odd.toFixed(2)),
    probability: parseFloat((prob * 100).toFixed(1)),
    movement: 'stable',
    status: 'active',
    lastUpdated: new Date().toISOString(),
    ...meta,
  };
}

function compile1X2(probs, type = '1x2', margin = MARGINS.ft_1x2) {
  return {
    Home:  makeOutcome('Home', probs.home, margin),
    Draw:  makeOutcome('Draw', probs.draw, margin),
    Away:  makeOutcome('Away', probs.away, margin),
  };
}

function compileMoneyline(probs, margin = MARGINS.ft_1x2) {
  const pHome = probs.home + probs.draw * 0.5;
  const pAway = probs.away + probs.draw * 0.5;
  const t = pHome + pAway;
  return {
    Home: makeOutcome('Home', pHome/t, margin),
    Away: makeOutcome('Away', pAway/t, margin),
  };
}

function compileDoubleChance(probs) {
  const m = MARGINS.dc;
  return {
    '1X': makeOutcome('1X', probs.home + probs.draw, m),
    '12': makeOutcome('12', probs.home + probs.away, m),
    'X2': makeOutcome('X2', probs.draw + probs.away, m),
  };
}

function compileNoDraw(probs) {
  const t = probs.home + probs.away;
  return {
    Home: makeOutcome('Home', probs.home/t, MARGINS.dc),
    Away: makeOutcome('Away', probs.away/t, MARGINS.dc),
  };
}

function compileHT1X2(probs) {
  // HT risultato più incerto → adjustments
  const m = MARGINS.ht_1x2;
  const htHome = probs.home * 0.80;
  const htDraw = probs.draw * 1.35 + 0.10;
  const htAway = probs.away * 0.80;
  const t = htHome + htDraw + htAway;
  return {
    Home: makeOutcome('Home', htHome/t, m),
    Draw: makeOutcome('Draw', htDraw/t, m),
    Away: makeOutcome('Away', htAway/t, m),
  };
}

function compileHTDC(probs) {
  const ht = compileHT1X2(probs);
  const m = MARGINS.dc;
  return {
    '1X': makeOutcome('1X', (ht.Home.probability + ht.Draw.probability)/100, m),
    '12': makeOutcome('12', (ht.Home.probability + ht.Away.probability)/100, m),
    'X2': makeOutcome('X2', (ht.Draw.probability + ht.Away.probability)/100, m),
  };
}

function compileOverUnder(goalModel, line, margin = MARGINS.ou_2_5) {
  if (!goalModel) {
    const p = 0.48 + (Math.random()-0.5)*0.10;
    return {
      [`Over ${line}`]: makeOutcome(`Over ${line}`, p, margin),
      [`Under ${line}`]: makeOutcome(`Under ${line}`, 1-p, margin),
    };
  }
  const pOver = goalModel.cdfOver(line);
  return {
    [`Over ${line}`]:  makeOutcome(`Over ${line}`, pOver, margin),
    [`Under ${line}`]: makeOutcome(`Under ${line}`, 1-pOver, margin),
  };
}

function compileTeamGoals(goalModel, team, line) {
  if (!goalModel) return compileOverUnder(null, line, 1.07);
  const mu = team === 'home' ? goalModel.muHome : goalModel.muAway;
  const pOver = poissonCdfOver(mu, line);
  return {
    [`Over ${line}`]:  makeOutcome(`Over ${line}`, pOver, 1.065),
    [`Under ${line}`]: makeOutcome(`Under ${line}`, 1-pOver, 1.065),
  };
}

function compileBTTS(goalModel) {
  const pBTTS = goalModel
    ? (1 - Math.exp(-goalModel.muHome)) * (1 - Math.exp(-goalModel.muAway))
    : 0.53;
  return {
    Yes: makeOutcome('Yes', pBTTS, MARGINS.btts),
    No:  makeOutcome('No', 1-pBTTS, MARGINS.btts),
  };
}

function compileBTTSHT(goalModel) {
  const mu = goalModel ? { h: goalModel.muHome*0.4, a: goalModel.muAway*0.4 } : { h:0.65, a:0.55 };
  const p = (1-Math.exp(-mu.h)) * (1-Math.exp(-mu.a));
  return { Yes: makeOutcome('Yes', p, 1.075), No: makeOutcome('No', 1-p, 1.075) };
}

function compileBTTS2H(goalModel) {
  const mu = goalModel ? { h: goalModel.muHome*0.6, a: goalModel.muAway*0.6 } : { h:0.85, a:0.75 };
  const p = (1-Math.exp(-mu.h)) * (1-Math.exp(-mu.a));
  return { Yes: makeOutcome('Yes', p, 1.075), No: makeOutcome('No', 1-p, 1.075) };
}

function compileCorrectScore(goalModel, margin) {
  const scores = [
    [0,0],[1,0],[0,1],[1,1],[2,0],[0,2],[2,1],[1,2],
    [2,2],[3,0],[0,3],[3,1],[1,3],[3,2],[2,3],[4,0],[0,4],
  ];
  const result = {};
  let otherProb = 1;
  scores.forEach(([h,a]) => {
    const p = goalModel
      ? poissonProb(goalModel.muHome, h) * poissonProb(goalModel.muAway, a) * goalModel.rho(h,a)
      : 0.03 + Math.random()*0.03;
    const label = `${h}-${a}`;
    result[label] = makeOutcome(label, p, margin);
    otherProb -= p;
  });
  result['Other'] = makeOutcome('Other', Math.max(0.01, otherProb), margin);
  return result;
}

function compileHTCorrectScore(goalModel, margin) {
  const mu = { h: goalModel?.muHome*0.42 || 0.7, a: goalModel?.muAway*0.42 || 0.6 };
  const scores = [[0,0],[1,0],[0,1],[1,1],[2,0],[0,2],[2,1],[1,2]];
  const result = {};
  let other = 1;
  scores.forEach(([h,a]) => {
    const p = poissonProb(mu.h, h) * poissonProb(mu.a, a);
    const label = `${h}-${a}`;
    result[label] = makeOutcome(label, p, margin);
    other -= p;
  });
  result['Other'] = makeOutcome('Other', Math.max(0.01, other), margin);
  return result;
}

function compileAsianHandicap(goalModel, handicap, margin) {
  // Asian handicap: se handicap positivo, home dà vantaggio all'away
  const mu = { h: goalModel?.muHome || 1.3, a: goalModel?.muAway || 1.1 };
  let pHome = 0;
  for (let h=0; h<=8; h++) {
    for (let a=0; a<=8; a++) {
      const p = poissonProb(mu.h, h) * poissonProb(mu.a, a);
      const diff = h - a + handicap;
      if (diff > 0) pHome += p;
      else if (diff === 0) pHome += p * 0.5; // push
    }
  }
  const pAway = 1 - pHome;
  return {
    Home: makeOutcome(`Home ${handicap >= 0 ? '+' : ''}${handicap}`, pHome, margin),
    Away: makeOutcome(`Away ${-handicap >= 0 ? '+' : ''}${-handicap}`, pAway, margin),
  };
}

function compileEuropeanHandicap(probs, goalModel, handicap) {
  const mu = { h: goalModel?.muHome || 1.3, a: goalModel?.muAway || 1.1 };
  const m = MARGINS.eh;
  // Shift probabilities based on handicap goals
  const adjMuH = mu.h + handicap;
  const pOver = goalModel ? goalModel.cdfOver(0.5) : 0.70;

  // Semplificazione: shift delle probabilità 1X2 in base all'handicap
  const factor = Math.exp(handicap * 0.2);
  let pH = probs.home * factor, pD = probs.draw, pA = probs.away / factor;
  const t = pH + pD + pA;
  return {
    Home: makeOutcome(`Home ${handicap > 0 ? '+' : ''}${handicap}`, pH/t, m),
    Draw: makeOutcome('Draw', pD/t, m),
    Away: makeOutcome(`Away ${-handicap > 0 ? '+' : ''}${-handicap}`, pA/t, m),
  };
}

function compileHTFT(probs) {
  const htH = probs.home*0.75, htD = probs.draw*1.3+0.08, htA = probs.away*0.75;
  const htT = htH+htD+htA;
  const m = MARGINS.htft;
  const combos = {
    '1/1': htH/htT * probs.home,
    '1/X': htH/htT * probs.draw * 0.4,
    '1/2': htH/htT * probs.away * 0.3,
    'X/1': htD/htT * probs.home * 0.6,
    'X/X': htD/htT * probs.draw,
    'X/2': htD/htT * probs.away * 0.6,
    '2/1': htA/htT * probs.home * 0.3,
    '2/X': htA/htT * probs.draw * 0.4,
    '2/2': htA/htT * probs.away,
  };
  const result = {};
  Object.entries(combos).forEach(([k,v]) => { result[k] = makeOutcome(k, v, m); });
  return result;
}

function compile1X2BTTS(probs, goalModel) {
  const pBTTS = goalModel
    ? (1-Math.exp(-goalModel.muHome)) * (1-Math.exp(-goalModel.muAway))
    : 0.53;
  const m = MARGINS.combo;
  return {
    'Home & Yes': makeOutcome('Home & Yes', probs.home * pBTTS, m),
    'Home & No':  makeOutcome('Home & No',  probs.home * (1-pBTTS), m),
    'Draw & Yes': makeOutcome('Draw & Yes', probs.draw * pBTTS, m),
    'Draw & No':  makeOutcome('Draw & No',  probs.draw * (1-pBTTS), m),
    'Away & Yes': makeOutcome('Away & Yes', probs.away * pBTTS, m),
    'Away & No':  makeOutcome('Away & No',  probs.away * (1-pBTTS), m),
  };
}

function compile1X2OU(probs, goalModel) {
  const pOver = goalModel ? goalModel.cdfOver(2.5) : 0.52;
  const m = MARGINS.combo;
  return {
    'Home & Over':  makeOutcome('Home & Over',  probs.home * pOver, m),
    'Home & Under': makeOutcome('Home & Under', probs.home * (1-pOver), m),
    'Draw & Over':  makeOutcome('Draw & Over',  probs.draw * pOver, m),
    'Draw & Under': makeOutcome('Draw & Under', probs.draw * (1-pOver), m),
    'Away & Over':  makeOutcome('Away & Over',  probs.away * pOver, m),
    'Away & Under': makeOutcome('Away & Under', probs.away * (1-pOver), m),
  };
}

function compileExactGoals(goalModel, n) {
  const mu = goalModel ? goalModel.muHome + goalModel.muAway : 2.5;
  const p = poissonProb(mu, n);
  return {
    Yes: makeOutcome('Yes', p, MARGINS.ou_4_5),
    No:  makeOutcome('No', 1-p, MARGINS.ou_4_5),
  };
}

function compileOddEven(goalModel) {
  const mu = goalModel ? goalModel.muHome + goalModel.muAway : 2.5;
  let pEven = 0;
  for (let n=0; n<=12; n+=2) pEven += poissonProb(mu, n);
  return {
    Odd:  makeOutcome('Odd', 1-pEven, 1.07),
    Even: makeOutcome('Even', pEven, 1.07),
  };
}

function compileCleanSheet(goalModel, team) {
  const mu = team === 'home' ? goalModel?.muAway || 1.1 : goalModel?.muHome || 1.3;
  const p = Math.exp(-mu); // P(0 gol) = e^(-mu)
  return {
    Yes: makeOutcome('Yes', p, 1.07),
    No:  makeOutcome('No', 1-p, 1.07),
  };
}

function compileWinToNil(probs, goalModel) {
  const pHome0 = Math.exp(-(goalModel?.muAway||1.1));
  const pAway0 = Math.exp(-(goalModel?.muHome||1.3));
  const pHomWTN = probs.home * pHome0;
  const pAwaWTN = probs.away * pAway0;
  const m = MARGINS.combo;
  return {
    Home:    makeOutcome('Home', pHomWTN, m),
    Away:    makeOutcome('Away', pAwaWTN, m),
    Neither: makeOutcome('Neither', 1-pHomWTN-pAwaWTN, m),
  };
}

function compileFirstGoal(probs, goalModel) {
  const muH = goalModel?.muHome || 1.3, muA = goalModel?.muAway || 1.1;
  const pHome = muH/(muH+muA), pAway = muA/(muH+muA);
  const pNG = Math.exp(-(muH+muA));
  const m = MARGINS.combo;
  return {
    Home:    makeOutcome('Home', pHome*(1-pNG), m),
    Away:    makeOutcome('Away', pAway*(1-pNG), m),
    'No Goal': makeOutcome('No Goal', pNG, m),
  };
}

function compileLastGoal(probs, goalModel) {
  // Simile ma invertito leggermente
  const muH = goalModel?.muHome || 1.3, muA = goalModel?.muAway || 1.1;
  const pHome = muH/(muH+muA+0.2), pAway = muA/(muH+muA+0.2);
  const pNG = Math.exp(-(muH+muA));
  const m = MARGINS.combo;
  return {
    Home:    makeOutcome('Home', pHome*(1-pNG), m),
    Away:    makeOutcome('Away', pAway*(1-pNG), m),
    'No Goal': makeOutcome('No Goal', pNG, m),
  };
}

function compileCorners(probs, line) {
  // Media angoli: 9.5 + offset per dominio
  const avgCorners = 9.5 + (probs.home - probs.away) * 4;
  const p = poissonCdfOver(avgCorners, line);
  return {
    [`Over ${line}`]:  makeOutcome(`Over ${line}`, p, MARGINS.corners),
    [`Under ${line}`]: makeOutcome(`Under ${line}`, 1-p, MARGINS.corners),
  };
}

function compileFirstCorner(probs) {
  const pHome = 0.48 + (probs.home - probs.away) * 0.15;
  return {
    Home: makeOutcome('Home', Math.min(0.75, Math.max(0.25, pHome)), 1.08),
    Away: makeOutcome('Away', 1 - Math.min(0.75, Math.max(0.25, pHome)), 1.08),
  };
}

function compileCards(probs, line) {
  const avgCards = 3.8 + Math.abs(probs.home - probs.away) * 1.5;
  const p = poissonCdfOver(avgCards, line);
  return {
    [`Over ${line}`]:  makeOutcome(`Over ${line}`, p, MARGINS.cards),
    [`Under ${line}`]: makeOutcome(`Under ${line}`, 1-p, MARGINS.cards),
  };
}

function compileTeamCard(probs, team) {
  const dominance = team === 'home' ? probs.away : probs.home;
  const p = 0.15 + dominance * 0.20;
  return {
    Yes: makeOutcome('Yes', Math.min(0.45, p), 1.09),
    No:  makeOutcome('No', 1 - Math.min(0.45, p), 1.09),
  };
}

function compileGoalInWindow(goalModel, startMin, endMin) {
  const fraction = (endMin - startMin) / 90;
  const mu = (goalModel?.muHome + goalModel?.muAway || 2.4) * fraction * 1.1; // +10% late goals
  const p = 1 - Math.exp(-mu);
  return {
    Yes: makeOutcome('Yes', p, 1.09),
    No:  makeOutcome('No', 1-p, 1.09),
  };
}

// Basketball helpers
function compileBKOverUnder(probs, goalModel, line) {
  const avg = goalModel?.totalPts || (210 + (probs.ratingDiff||0) * 0.05);
  const std = 12;
  const p = normalCdfOver(avg, std, line);
  return {
    [`Over ${line}`]:  makeOutcome(`Over ${line}`, p, 1.05),
    [`Under ${line}`]: makeOutcome(`Under ${line}`, 1-p, 1.05),
  };
}

function compileBKSpread(probs, goalModel, spread) {
  const expDiff = (probs.home - probs.away) * 25 + 2;
  const std = 10;
  const p = normalCdfOver(expDiff, std, -spread);
  return {
    [`Home ${spread > 0 ? '+' : ''}${spread}`]: makeOutcome(`Home ${spread > 0 ? '+' : ''}${spread}`, p, 1.05),
    [`Away ${-spread > 0 ? '+' : ''}${-spread}`]: makeOutcome(`Away ${-spread > 0 ? '+' : ''}${-spread}`, 1-p, 1.05),
  };
}

function compileQuarter(probs) {
  const m = 1.07;
  return {
    Home: makeOutcome('Home', probs.home, m),
    Draw: makeOutcome('Draw', 0.15, m),
    Away: makeOutcome('Away', probs.away, m),
  };
}

function compileOT(probs, basePct) {
  const p = basePct + (1 - Math.abs(probs.home - probs.away)) * 0.05;
  return {
    Yes: makeOutcome('Yes', p, 1.09),
    No:  makeOutcome('No', 1-p, 1.09),
  };
}

function compileTeamTotal(probs, goalModel, line, team) {
  const avg = (goalModel?.totalPts || 210) * (team === 'home' ? 0.515 : 0.485);
  const p = normalCdfOver(avg, 8, line);
  return {
    [`Over ${line}`]:  makeOutcome(`Over ${line}`, p, 1.07),
    [`Under ${line}`]: makeOutcome(`Under ${line}`, 1-p, 1.07),
  };
}

function compileTennisSets(probs, grandSlam) {
  const pW = (probs.home + probs.draw*0.5);
  const m = MARGINS.combo;
  if (grandSlam) {
    return {
      '3-0': makeOutcome('3-0', pW*0.38, m),
      '3-1': makeOutcome('3-1', pW*0.32, m),
      '3-2': makeOutcome('3-2', pW*0.30, m),
      '0-3': makeOutcome('0-3', (1-pW)*0.38, m),
      '1-3': makeOutcome('1-3', (1-pW)*0.32, m),
      '2-3': makeOutcome('2-3', (1-pW)*0.30, m),
    };
  }
  return {
    '2-0': makeOutcome('2-0', pW*0.52, m),
    '2-1': makeOutcome('2-1', pW*0.48, m),
    '0-2': makeOutcome('0-2', (1-pW)*0.52, m),
    '1-2': makeOutcome('1-2', (1-pW)*0.48, m),
  };
}

function compileTennisS3(probs, grandSlam) {
  const pS3 = grandSlam ? 0.70 : 0.45;
  return {
    'Player 1':  makeOutcome('Player 1', probs.home * pS3, 1.08),
    'Player 2':  makeOutcome('Player 2', probs.away * pS3, 1.08),
    'No Set 3':  makeOutcome('No Set 3', 1-pS3, 1.08),
  };
}

function compileTennisGames(probs, line) {
  const avgGames = 22 + probs.ratingDiff * 0.02 + Math.random()*4;
  const p = normalCdfOver(avgGames, 4, line);
  return {
    [`Over ${line}`]:  makeOutcome(`Over ${line}`, p, 1.08),
    [`Under ${line}`]: makeOutcome(`Under ${line}`, 1-p, 1.08),
  };
}

function compileMMAMethod(probs) {
  const pW = probs.home;
  const m = MARGINS.combo;
  return {
    'KO/TKO':    makeOutcome('KO/TKO',   pW*0.32 + (1-pW)*0.28, m),
    'Submission': makeOutcome('Submission', pW*0.22 + (1-pW)*0.20, m),
    'Decision':  makeOutcome('Decision',  pW*0.42 + (1-pW)*0.48, m),
    'Draw/NC':   makeOutcome('Draw/NC',   0.02, m),
  };
}

function compileMMAround(probs, round) {
  const base = [0.28,0.22,0.18,0.12,0.08][round-1] || 0.05;
  return {
    Yes: makeOutcome('Yes', base, 1.10),
    No:  makeOutcome('No', 1-base, 1.10),
  };
}

function compileMMAWinnerMethod(probs) {
  const pW = probs.home;
  const m = MARGINS.htft;
  return {
    'F1 KO/TKO':    makeOutcome('F1 KO/TKO',    pW*0.32, m),
    'F1 Sub':       makeOutcome('F1 Sub',        pW*0.22, m),
    'F1 Dec':       makeOutcome('F1 Dec',        pW*0.44, m),
    'F2 KO/TKO':   makeOutcome('F2 KO/TKO',    (1-pW)*0.32, m),
    'F2 Sub':       makeOutcome('F2 Sub',        (1-pW)*0.22, m),
    'F2 Dec':       makeOutcome('F2 Dec',        (1-pW)*0.44, m),
    'Draw':         makeOutcome('Draw',           0.02, m),
  };
}

function compileEsportsMaps(probs) {
  const pW = probs.home;
  const m = MARGINS.combo;
  return {
    '2-0': makeOutcome('2-0', pW*0.46, m),
    '2-1': makeOutcome('2-1', pW*0.54, m),
    '0-2': makeOutcome('0-2', (1-pW)*0.46, m),
    '1-2': makeOutcome('1-2', (1-pW)*0.54, m),
  };
}

function compileEsportsMap(probs, mapNum) {
  const uncertainty = 1 + (mapNum-1) * 0.05;
  const pHome = 0.45 + probs.home * 0.20 / uncertainty;
  return {
    'Team 1': makeOutcome('Team 1', pHome, 1.07),
    'Team 2': makeOutcome('Team 2', 1-pHome, 1.07),
  };
}

function compileF1Winner(probs, margin = 1.10) {
  const pW = probs.home, pR = probs.away;
  const pOther = 1 - pW - pR;
  return {
    'Driver 1': makeOutcome('Driver 1', pW, margin),
    'Driver 2': makeOutcome('Driver 2', pR, margin),
    'Driver 3': makeOutcome('Driver 3', pOther*0.35, margin),
    'Other':    makeOutcome('Other', pOther*0.65, margin),
  };
}

function compileF1Podium(probs) {
  const pW = probs.home;
  return {
    Yes: makeOutcome('Yes', Math.min(0.88, pW*2.2), 1.09),
    No:  makeOutcome('No', Math.max(0.12, 1-pW*2.2), 1.09),
  };
}

function compileBinary(prob, margin) {
  return {
    Yes: makeOutcome('Yes', prob, margin),
    No:  makeOutcome('No', 1-prob, margin),
  };
}

function compileSpecialBinary(basePct, line, margin) {
  return compileBinary(basePct + (Math.random()-0.5)*0.10, margin);
}

// ─── MATH HELPERS ─────────────────────────────────────────────────────────────

// Poisson PMF: P(X=k) = e^(-mu) * mu^k / k!
function poissonProb(mu, k) {
  if (mu <= 0) return k === 0 ? 1 : 0;
  let logP = -mu + k * Math.log(mu) - logFactorial(k);
  return Math.exp(logP);
}

function logFactorial(n) {
  if (n <= 1) return 0;
  let s = 0;
  for (let i=2; i<=n; i++) s += Math.log(i);
  return s;
}

// P(X > line) da Poisson
function poissonCdfOver(mu, line) {
  let pUnder = 0;
  const maxK = Math.ceil(mu * 4 + 10);
  for (let k=0; k<=Math.floor(line); k++) pUnder += poissonProb(mu, k);
  return Math.max(0.01, Math.min(0.99, 1 - pUnder));
}

// P(X > line) da distribuzione normale
function normalCdfOver(mean, std, line) {
  const z = (line - mean) / std;
  const p = 1 - normalCdf(z);
  return Math.max(0.01, Math.min(0.99, p));
}

function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t*(0.319381530 + t*(-0.356563782 + t*(1.781477937 + t*(-1.821255978 + t*1.330274429))));
  const p = 1 - (1/Math.sqrt(2*Math.PI)) * Math.exp(-0.5*z*z) * poly;
  return z >= 0 ? p : 1 - p;
}

module.exports = { compileAllOdds, probToOdd, makeOutcome, poissonProb, poissonCdfOver };
