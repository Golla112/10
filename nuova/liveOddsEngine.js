'use strict';
/**
 * LIVE ODDS MOVEMENT ENGINE
 * ─────────────────────────────────────────────────────────────────
 * Simula il comportamento reale di un trading desk live:
 * 
 * 1. BALANCE BOOK: aggiusta quote in base all'esposizione
 *    (se troppo denaro su Home, allunga la quota Home)
 * 2. MARKET EVENTS: gol/cartellino → ricalcola tutto da zero
 *    usando ELO + goal model in-play
 * 3. CLOCK FACTOR: quote cambiano in base al tempo rimasto
 * 4. LOCK/SUSPEND: sospende mercati su eventi ad alto impatto
 * 5. STEAM DETECTION: rileva movimento sospetto (sharp money)
 * ─────────────────────────────────────────────────────────────────
 */

const { calcProbabilities } = require('./elo');
const { calcGoalModel } = require('./goalModel');
const { compileAllOdds, makeOutcome } = require('./oddsCompiler');
const { broadcast } = require('../ws/broadcaster');
const { state } = require('../db/state');

// Libro delle scommesse: eventId:marketId:outcome → totalStake
const BOOK = new Map();

// Esposizione massima per mercato prima di aggiustare
const MAX_EXPOSURE = {
  ft_1x2: 50000,
  default: 20000,
};

/**
 * AGGIORNA QUOTE IN-PLAY dopo un evento di match
 * Viene chiamato ogni volta che succede qualcosa (gol, cartellino...)
 */
function recalcLiveOdds(eventId, matchEvent) {
  const event = state.events.get(eventId);
  if (!event || event.status !== 'live') return;

  const score = state.liveScores.get(eventId);
  if (!score) return;

  const elapsed = score.minute || 0;
  const remaining = Math.max(1, 90 - elapsed); // minuti rimasti (calcio)

  // Ricalcola probabilità in-play con score attuale
  const inPlayProbs = calcInPlayProbs(event, score, elapsed, remaining);
  if (!inPlayProbs) return;

  // Ricalcola goal model in-play
  const goalModel = calcGoalModel(inPlayProbs, event.sport);

  // Sospendi mercati principali per X secondi
  const suspendMs = getSuspendDuration(matchEvent.type);
  suspendMarkets(eventId, getSuspendedMarkets(matchEvent.type), suspendMs);

  // Ricalcola e pubblica nuove quote dopo sospensione
  setTimeout(() => {
    if (state.events.get(eventId)?.status !== 'live') return;

    const newOdds = compileInPlayOdds(event, inPlayProbs, goalModel, elapsed);
    updateEventOdds(eventId, newOdds, matchEvent);

    broadcast({
      type: 'ODDS_RECALC',
      eventId,
      trigger: matchEvent.type,
      score: { home: score.home, away: score.away },
      elapsed,
      timestamp: new Date().toISOString(),
    }, `event:${eventId}`);

  }, suspendMs);
}

/**
 * CALCOLA PROBABILITÀ IN-PLAY
 * Condiziona le prob. al punteggio attuale e al tempo rimasto
 */
function calcInPlayProbs(event, score, elapsed, remaining) {
  if (event.sport !== 'football') {
    // Per altri sport: aggiusta in base al punteggio
    const scoreDiff = (score.home || 0) - (score.away || 0);
    const base = calcProbabilities(event.homeTeam, event.awayTeam, event.sport, false);
    const factor = Math.exp(scoreDiff * 0.3 * (1 - elapsed/200));
    const pH = Math.min(0.97, base.home * factor);
    const pA = Math.min(0.97, base.away / factor);
    const t = pH + pA;
    return { ...base, home: pH/t, away: pA/t, draw: 0, ratingDiff: base.ratingDiff };
  }

  // CALCIO: modello completo
  const base = calcProbabilities(event.homeTeam, event.awayTeam, event.sport, false);
  const goalModel = calcGoalModel(base, 'football');
  if (!goalModel) return base;

  const hScore = score.home || 0;
  const aScore = score.away || 0;
  const scoreDiff = hScore - aScore;

  // Gol attesi rimasti (proporzionale al tempo)
  const remainingFraction = remaining / 90;
  const muHomeRem = goalModel.muHome * remainingFraction * 1.15; // leggero bias offensive late
  const muAwayRem = goalModel.muAway * remainingFraction * 1.15;

  // Calcola probabilità di vittoria finale data la situazione attuale
  let pHome = 0, pDraw = 0, pAway = 0;
  const MAX = 6;

  for (let h=0; h<=MAX; h++) {
    for (let a=0; a<=MAX; a++) {
      const pH = poissonProb(muHomeRem, h);
      const pA = poissonProb(muAwayRem, a);
      const p = pH * pA;
      const finalH = hScore + h;
      const finalA = aScore + a;
      if (finalH > finalA) pHome += p;
      else if (finalH === finalA) pDraw += p;
      else pAway += p;
    }
  }

  const total = pHome + pDraw + pAway || 1;
  return {
    home: pHome / total,
    draw: pDraw / total,
    away: pAway / total,
    ratingDiff: base.ratingDiff,
    homeName: event.homeTeam,
    awayName: event.awayTeam,
    inPlay: true,
    elapsed,
    score: { home: hScore, away: aScore },
  };
}

/**
 * COMPILA QUOTE IN-PLAY
 * Versione semplificata rispetto al prematch (solo mercati liquidi live)
 */
function compileInPlayOdds(event, probs, goalModel, elapsed) {
  const remaining = Math.max(1, 90 - elapsed);
  const timeDecayFactor = remaining / 90;
  const sport = event.sport;
  const result = {};

  // Mercati sempre presenti live
  if (sport === 'football') {
    result['ft_1x2'] = compile1X2Live(probs, 1.045);
    result['dc']     = compileDCLive(probs);
    result['btts']   = compileBTTSLive(goalModel, probs, elapsed);
    result['no_draw']= compileNoDraw(probs);

    // OU con goal model aggiornato
    [0.5,1.5,2.5,3.5,4.5].forEach(line => {
      const adjustedLine = line - (event.score?.home||0) - (event.score?.away||0) + line;
      result[`ou_${line.toString().replace('.','_')}`] = compileOULive(goalModel, line, probs);
    });

    result['next_goal']   = compileNextGoal(probs, goalModel, elapsed);
    result['home_clean']  = compileCleanSheetLive(goalModel, 'home', elapsed);
    result['away_clean']  = compileCleanSheetLive(goalModel, 'away', elapsed);
  } else if (sport === 'basketball') {
    result['bk_ml']   = compileMLLive(probs, 1.04);
    [195.5,205.5,215.5,225.5,235.5].forEach(l => {
      result[`bk_ou_${l}`] = compileBKOULive(goalModel, l, probs);
    });
  } else if (sport === 'tennis') {
    result['tn_ml']  = compileMLLive(probs, 1.04);
    result['tn_s1']  = compileMLLive(probs, 1.05);
  } else {
    result['main_ml'] = compileMLLive(probs, 1.04);
  }

  return result;
}

// ─── LIVE MARKET COMPILERS ────────────────────────────────────────────────────

function compile1X2Live(probs, margin) {
  return {
    Home: makeOutcome('Home', probs.home, margin),
    Draw: makeOutcome('Draw', probs.draw, margin),
    Away: makeOutcome('Away', probs.away, margin),
  };
}

function compileDCLive(probs) {
  return {
    '1X': makeOutcome('1X', probs.home + probs.draw, 1.04),
    '12': makeOutcome('12', probs.home + probs.away, 1.04),
    'X2': makeOutcome('X2', probs.draw + probs.away, 1.04),
  };
}

function compileNoDraw(probs) {
  const t = probs.home + probs.away;
  return {
    Home: makeOutcome('Home', probs.home/t, 1.04),
    Away: makeOutcome('Away', probs.away/t, 1.04),
  };
}

function compileBTTSLive(goalModel, probs, elapsed) {
  const remaining = (90 - elapsed) / 90;
  const score = probs.score || { home: 0, away: 0 };
  const homeScored = score.home > 0;
  const awayScored = score.away > 0;

  if (homeScored && awayScored) {
    return { Yes: makeOutcome('Yes', 0.995, 1.01), No: makeOutcome('No', 0.005, 1.01) };
  }
  const muH = goalModel ? goalModel.muHome * remaining : 0.6 * remaining;
  const muA = goalModel ? goalModel.muAway * remaining : 0.5 * remaining;

  const pHomeSc = homeScored ? 1 : 1 - Math.exp(-muH);
  const pAwaySc = awayScored ? 1 : 1 - Math.exp(-muA);
  const p = pHomeSc * pAwaySc;

  return { Yes: makeOutcome('Yes', p, 1.05), No: makeOutcome('No', 1-p, 1.05) };
}

function compileOULive(goalModel, line, probs) {
  const scoredSoFar = (probs.score?.home||0) + (probs.score?.away||0);
  const remaining = line - scoredSoFar;

  if (scoredSoFar > line) {
    return { [`Over ${line}`]: makeOutcome(`Over ${line}`, 0.997, 1.01), [`Under ${line}`]: makeOutcome(`Under ${line}`, 0.003, 1.01) };
  }
  if (remaining <= 0) {
    return { [`Over ${line}`]: makeOutcome(`Over ${line}`, 0.003, 1.01), [`Under ${line}`]: makeOutcome(`Under ${line}`, 0.997, 1.01) };
  }

  const p = goalModel ? goalModel.cdfOver(remaining - 0.5) : 0.50;
  return {
    [`Over ${line}`]:  makeOutcome(`Over ${line}`, p, 1.05),
    [`Under ${line}`]: makeOutcome(`Under ${line}`, 1-p, 1.05),
  };
}

function compileNextGoal(probs, goalModel, elapsed) {
  const muH = goalModel?.muHome * ((90-elapsed)/90) || 0.6;
  const muA = goalModel?.muAway * ((90-elapsed)/90) || 0.5;
  const pNG  = Math.exp(-(muH+muA));
  const pHome = muH/(muH+muA) * (1-pNG);
  const pAway = muA/(muH+muA) * (1-pNG);
  return {
    Home:     makeOutcome('Home', pHome, 1.09),
    Away:     makeOutcome('Away', pAway, 1.09),
    'No Goal': makeOutcome('No Goal', pNG, 1.09),
  };
}

function compileCleanSheetLive(goalModel, team, elapsed) {
  const remaining = (90 - elapsed) / 90;
  const mu = (team === 'home' ? goalModel?.muAway : goalModel?.muHome) || 1.0;
  const muRem = mu * remaining;
  const p = Math.exp(-muRem);
  return { Yes: makeOutcome('Yes', p, 1.07), No: makeOutcome('No', 1-p, 1.07) };
}

function compileMLLive(probs, margin) {
  const t = probs.home + probs.away;
  return {
    Home: makeOutcome('Home', probs.home/t, margin),
    Away: makeOutcome('Away', probs.away/t, margin),
  };
}

function compileBKOULive(goalModel, line, probs) {
  const p = goalModel ? goalModel.cdfOver(line - 0.5) : 0.50;
  return {
    [`Over ${line}`]:  makeOutcome(`Over ${line}`, p, 1.05),
    [`Under ${line}`]: makeOutcome(`Under ${line}`, 1-p, 1.05),
  };
}

// ─── BALANCE BOOK ─────────────────────────────────────────────────────────────
/**
 * Aggiusta le quote in base all'esposizione del book
 * Se molti soldi su Home → allunga la quota Home, accorcia Away
 */
function balanceBook(eventId, marketId, newStake, outcome) {
  const key = `${eventId}:${marketId}:${outcome}`;
  const current = BOOK.get(key) || 0;
  BOOK.set(key, current + newStake);

  // Calcola esposizione totale per questo mercato
  const mktOdds = state.odds.get(eventId)?.[marketId];
  if (!mktOdds) return null;

  const outcomes = Object.keys(mktOdds).filter(k => k !== '__meta');
  const totalStake = outcomes.reduce((s, o) => s + (BOOK.get(`${eventId}:${marketId}:${o}`) || 0), 0);
  if (totalStake < 1000) return null; // Aggiusta solo sopra 1k€

  const maxExp = MAX_EXPOSURE[marketId] || MAX_EXPOSURE.default;
  const exposurePct = totalStake / maxExp;
  if (exposurePct < 0.1) return null; // Meno del 10% → non fare nulla

  // Calcola adjustments
  const adjustments = {};
  outcomes.forEach(o => {
    const stakeO = BOOK.get(`${eventId}:${marketId}:${o}`) || 0;
    const stakePct = stakeO / totalStake;
    const currentOdd = mktOdds[o]?.odd || 2.0;
    
    // Se troppo stake su questo outcome → abbassa la quota (più attraente per counterpart)
    const adjust = 1 + (stakePct - 1/outcomes.length) * 0.15 * exposurePct;
    const newOdd = Math.max(1.01, Math.min(999, currentOdd / adjust));
    
    if (Math.abs(newOdd - currentOdd) > 0.01) {
      adjustments[o] = {
        ...mktOdds[o],
        odd: parseFloat(newOdd.toFixed(2)),
        previousOdd: currentOdd,
        movement: newOdd < currentOdd ? 'down' : 'up',
        lastUpdated: new Date().toISOString(),
      };
    }
  });

  return Object.keys(adjustments).length > 0 ? adjustments : null;
}

// ─── STEAM DETECTION ──────────────────────────────────────────────────────────
const STAKE_HISTORY = new Map(); // marketKey → [{ timestamp, amount }]

function detectSteam(eventId, marketId, outcome, amount) {
  const key = `${eventId}:${marketId}:${outcome}`;
  const now = Date.now();
  const history = STAKE_HISTORY.get(key) || [];
  history.push({ timestamp: now, amount });
  
  // Mantieni solo ultimi 60 secondi
  const recent = history.filter(h => now - h.timestamp < 60000);
  STAKE_HISTORY.set(key, recent);

  const totalRecent = recent.reduce((s, h) => s + h.amount, 0);
  const isSteam = recent.length >= 3 && totalRecent >= 5000;
  
  if (isSteam) {
    console.log(`⚡ STEAM DETECTED: ${key} — €${totalRecent} in 60s`);
    // Notifica il risk manager
    broadcast({
      type: 'STEAM_ALERT',
      eventId, marketId, outcome,
      totalAmount: totalRecent,
      bets: recent.length,
      timestamp: new Date().toISOString(),
    }, 'risk');
  }

  return isSteam;
}

// ─── SUSPEND/RESUME ───────────────────────────────────────────────────────────
function suspendMarkets(eventId, marketIds, durationMs) {
  const eventOdds = state.odds.get(eventId);
  if (!eventOdds) return;

  marketIds.forEach(mid => {
    if (!eventOdds[mid]) return;
    Object.keys(eventOdds[mid]).filter(k => k !== '__meta').forEach(k => {
      eventOdds[mid][k] = { ...eventOdds[mid][k], status: 'suspended' };
    });
  });

  broadcast({
    type: 'MARKETS_SUSPENDED',
    eventId, marketIds,
    reason: 'match_event',
    duration: durationMs,
    timestamp: new Date().toISOString(),
  }, `event:${eventId}`);

  broadcast({
    type: 'MARKETS_SUSPENDED',
    eventId, marketIds,
    timestamp: new Date().toISOString(),
  }, 'live');
}

function updateEventOdds(eventId, newOdds, trigger) {
  const eventOdds = state.odds.get(eventId) || {};
  const updates = [];

  Object.entries(newOdds).forEach(([marketId, mktOdds]) => {
    const prev = eventOdds[marketId] || {};
    const changes = [];

    Object.entries(mktOdds).forEach(([outcome, data]) => {
      if (outcome === '__meta') return;
      const prevOdd = prev[outcome]?.odd;
      if (prevOdd && Math.abs(data.odd - prevOdd) > 0.01) {
        changes.push({ outcome, from: prevOdd, to: data.odd, movement: data.movement });
      }
    });

    eventOdds[marketId] = { ...prev, ...mktOdds };
    if (changes.length > 0) updates.push({ marketId, odds: mktOdds, changes });
  });

  state.odds.set(eventId, eventOdds);

  if (updates.length > 0) {
    broadcast({
      type: 'ODDS_UPDATE',
      eventId,
      updates,
      trigger: trigger?.type,
      timestamp: new Date().toISOString(),
    }, `event:${eventId}`);
  }
}

function getSuspendDuration(eventType) {
  const durations = {
    GOAL:             8000,
    PENALTY_AWARDED:  12000,
    RED_CARD:         6000,
    VAR_CHECK:        20000,
    PENALTY_MISSED:   5000,
    INJURY:           3000,
    default:          2000,
  };
  return durations[eventType] || durations.default;
}

function getSuspendedMarkets(eventType) {
  const critical = ['ft_1x2','ht_1x2','dc','htft','cs','no_draw','win_nil','btts'];
  const all = [...critical,'ou_0_5','ou_1_5','ou_2_5','ou_3_5','next_goal','home_clean','away_clean'];
  if (['GOAL','PENALTY_AWARDED','RED_CARD'].includes(eventType)) return all;
  return critical;
}

function poissonProb(mu, k) {
  if (mu <= 0) return k === 0 ? 1 : 0;
  let logP = -mu + k * Math.log(mu);
  for (let i=2; i<=k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

module.exports = { recalcLiveOdds, balanceBook, detectSteam, suspendMarkets, updateEventOdds, compileInPlayOdds, calcInPlayProbs };
