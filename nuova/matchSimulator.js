'use strict';
const { v4: uuidv4 } = require('uuid');
const { state } = require('../db/state');
const { broadcast } = require('../ws/broadcaster');
const { recalcLiveOdds } = require('../live/liveOddsEngine');
const { updateElo } = require('../engine/elo');
const { compileAllOdds } = require('../engine/oddsCompiler');
const { calcProbabilities } = require('../engine/elo');
const { calcGoalModel } = require('../engine/goalModel');

// ─── INTENSITÀ EVENTI PER SPORT ───────────────────────────────────────────────
const EVENT_CONFIG = {
  football: {
    duration: 93,     // minuti
    eventsPerMinute: { goal: 0.028, yellowCard: 0.055, corner: 0.110, foul: 0.210, shot: 0.250, substitution: 0.022, redCard: 0.006, var: 0.008 },
    halfTime: 45,
  },
  basketball: {
    duration: 48,
    scoreEveryNSeconds: 18, // media un punto ogni 18s
    foulsPerMinute: 0.35,
    timeouts: 6,
  },
  tennis: {
    setsMax: 3,
    pointsPerGame: 5.5,
    acePct: 0.12,
    dfPct: 0.05,
  },
  hockey: {
    duration: 60,
    eventsPerMinute: { goal: 0.052, penalty: 0.085, shot: 0.300 },
  },
  mma: {
    maxRounds: 5,
    koProb: 0.30,
    subProb: 0.22,
  },
  esports: {
    duration: 40,
    killsPerMinute: 0.65,
  },
};

/**
 * AVVIA SIMULAZIONE MATCH LIVE
 * Chiamato quando un evento passa da prematch → live
 */
function startMatchSimulation(event) {
  const cfg = EVENT_CONFIG[event.sport];
  if (!cfg) return;

  const probs = calcProbabilities(event.homeTeam, event.awayTeam, event.sport, false);
  const goalModel = calcGoalModel(probs, event.sport);

  // Simula parametri della partita (prima di iniziare)
  const matchParams = generateMatchParams(event, probs, goalModel);

  // Salva in event per l'engine
  event.matchParams = matchParams;
  event.liveStartTime = Date.now();
  event.status = 'live';

  initLiveScore(event);

  console.log(`🔴 LIVE: ${event.homeTeam} vs ${event.awayTeam} [${event.sport}] xG: ${matchParams.xgHome?.toFixed(2)||'?'}-${matchParams.xgAway?.toFixed(2)||'?'}`);

  broadcast({
    type: 'MATCH_STARTED',
    eventId: event.id,
    event: sanitizeEvent(event),
    score: state.liveScores.get(event.id),
    timestamp: new Date().toISOString(),
  }, 'live');

  // Avvia timer tick
  scheduleMatchTick(event, matchParams, probs, goalModel);
}

function generateMatchParams(event, probs, goalModel) {
  const sport = event.sport;
  if (sport === 'football') {
    const xgHome = goalModel?.muHome || 1.3;
    const xgAway = goalModel?.muAway || 1.1;
    return {
      xgHome, xgAway,
      cornerRate: 9.5 + (probs.home - probs.away) * 4,
      cardRateHome: 1.8 + probs.away * 0.5,
      cardRateAway: 1.8 + probs.home * 0.5,
      possession: 50 + (probs.home - probs.away) * 20,
      intensityFactor: 1.0 + Math.random() * 0.3,
    };
  }
  if (sport === 'basketball') {
    const totalPts = goalModel?.totalPts || 215;
    return { totalPts, homeShare: probs.home, paceModifier: 0.9 + Math.random() * 0.2 };
  }
  return { homeStrength: probs.home, awayStrength: probs.away };
}

function initLiveScore(event) {
  const sport = event.sport;
  const base = {
    eventId: event.id, sport, status: 'live',
    minute: 0, clock: '0\'', period: 1,
    home: 0, away: 0,
  };

  const extras = {
    football:   { ht: null, extraTime: false, statistics: { corners:[0,0], cards:[[],[]], shots:[0,0], shotsOT:[0,0], possession:[50,50], fouls:[0,0] } },
    basketball: { quarters: [[0,0],[0,0],[0,0],[0,0]], quarter: 1 },
    tennis:     { sets: [], games: [0,0], points: ['0','0'], currentSet: 1 },
    hockey:     { periods: [[0,0],[0,0],[0,0]], period: 1, ot: false },
    mma:        { round: 1, time: '0:00', strikes: [0,0], takedowns: [0,0] },
    esports:    { map: 1, kills: [0,0], objectives: [0,0] },
  };

  state.liveScores.set(event.id, { ...base, ...(extras[sport] || {}) });
}

function scheduleMatchTick(event, matchParams, probs, goalModel) {
  const sport = event.sport;
  const cfg = EVENT_CONFIG[sport];
  if (!cfg) return;

  const TICK_MS = 5000; // 5 secondi reali = ~1 minuto di partita (18x accelerato)

  const interval = setInterval(() => {
    const ev = state.events.get(event.id);
    const score = state.liveScores.get(event.id);
    if (!ev || ev.status !== 'live' || !score) { clearInterval(interval); return; }

    // Avanza il clock
    score.minute = Math.min(score.minute + 1, sport === 'football' ? 95 : cfg.duration || 90);
    score.clock = formatClock(score.minute, sport, score);

    // Genera eventi casuali basati su parametri
    const matchEvents = generateTickEvents(ev, score, matchParams, probs, sport);

    matchEvents.forEach(mEvt => {
      applyMatchEvent(ev, score, mEvt, goalModel);
      broadcastMatchEvent(ev, score, mEvt);
      // Ricalcola quote solo per eventi significativi
      if (mEvt.significant) {
        recalcLiveOdds(ev.id, mEvt);
      }
    });

    // Half time (calcio)
    if (sport === 'football' && score.minute === 45 && score.period === 1) {
      score.ht = { home: score.home, away: score.away };
      score.period = 2;
      broadcast({ type: 'HALF_TIME', eventId: ev.id, score, timestamp: new Date().toISOString() }, `event:${ev.id}`);
      broadcast({ type: 'HALF_TIME', eventId: ev.id, score, timestamp: new Date().toISOString() }, 'live');
    }

    // Fine partita
    const maxMin = sport === 'football' ? 90 + Math.floor(Math.random()*5) : (cfg.duration || 40);
    if (score.minute >= maxMin) {
      clearInterval(interval);
      finishMatch(ev, score, probs);
    }

    // Update clock broadcast ogni 30s
    if (score.minute % 5 === 0) {
      broadcast({
        type: 'SCORE_UPDATE',
        eventId: ev.id,
        score: { home: score.home, away: score.away, clock: score.clock, minute: score.minute },
        timestamp: new Date().toISOString(),
      }, 'live');
    }

  }, TICK_MS);
}

function generateTickEvents(event, score, params, probs, sport) {
  const events = [];
  if (sport === 'football') {
    const { xgHome, xgAway, cornerRate, cardRateHome, cardRateAway } = params;
    const timeWeight = getTimeWeight(score.minute);

    if (Math.random() < xgHome / 90 * timeWeight) {
      events.push({ type: 'GOAL', team: 'home', minute: score.minute, significant: true });
    } else if (Math.random() < xgAway / 90 * timeWeight) {
      events.push({ type: 'GOAL', team: 'away', minute: score.minute, significant: true });
    }

    if (Math.random() < 0.055) {
      events.push({ type: 'YELLOW_CARD', team: Math.random() < probs.away/(probs.home+probs.away) ? 'home' : 'away', minute: score.minute, significant: false });
    }
    if (Math.random() < 0.006) {
      events.push({ type: 'RED_CARD', team: Math.random() < 0.5 ? 'home' : 'away', minute: score.minute, significant: true });
    }
    if (Math.random() < 0.11) {
      events.push({ type: 'CORNER', team: Math.random() < probs.home/(probs.home+probs.away) ? 'home' : 'away', minute: score.minute, significant: false });
    }
    if (Math.random() < 0.022 && score.minute > 46) {
      events.push({ type: 'SUBSTITUTION', team: Math.random() < 0.5 ? 'home' : 'away', minute: score.minute, significant: false });
    }
    if (Math.random() < 0.008) {
      events.push({ type: 'VAR_CHECK', team: null, minute: score.minute, significant: true });
    }
  } else if (sport === 'basketball') {
    // Score ogni ~18 secondi sim → ogni tick ~3-5 punti
    const homeScore = Math.random() < params.homeShare ? Math.random() < 0.35 ? 3 : 2 : 0;
    const awayScore = Math.random() < (1-params.homeShare) ? Math.random() < 0.30 ? 3 : 2 : 0;
    if (homeScore > 0) events.push({ type: 'SCORE', team: 'home', points: homeScore, minute: score.minute, significant: false });
    if (awayScore > 0) events.push({ type: 'SCORE', team: 'away', points: awayScore, minute: score.minute, significant: false });
  } else if (sport === 'hockey') {
    if (Math.random() < 0.052) events.push({ type: 'GOAL', team: Math.random() < probs.home/(probs.home+probs.away) ? 'home' : 'away', minute: score.minute, significant: true });
    if (Math.random() < 0.085) events.push({ type: 'PENALTY', team: Math.random() < 0.5 ? 'home' : 'away', minute: score.minute, significant: false });
  } else if (sport === 'esports') {
    if (Math.random() < 0.065) {
      events.push({ type: 'KILL', team: Math.random() < params.homeStrength/(params.homeStrength+params.awayStrength) ? 'home' : 'away', minute: score.minute, significant: false });
    }
    if (Math.random() < 0.012) {
      events.push({ type: 'OBJECTIVE', team: Math.random() < params.homeStrength/(params.homeStrength+params.awayStrength) ? 'home' : 'away', minute: score.minute, significant: true });
    }
  }
  return events;
}

function applyMatchEvent(event, score, mEvt, goalModel) {
  mEvt.id = uuidv4();
  mEvt.timestamp = new Date().toISOString();

  if (!event.matchLog) event.matchLog = [];
  event.matchLog.push(mEvt);
  if (event.matchLog.length > 100) event.matchLog = event.matchLog.slice(-100);

  const sport = event.sport;
  if (mEvt.type === 'GOAL' && ['football','hockey'].includes(sport)) {
    score[mEvt.team]++;
    if (sport === 'football') {
      score.statistics.shots[mEvt.team === 'home' ? 0 : 1]++;
      score.statistics.shotsOT[mEvt.team === 'home' ? 0 : 1]++;
    }
  } else if (mEvt.type === 'SCORE' && sport === 'basketball') {
    score[mEvt.team] += mEvt.points || 2;
  } else if (mEvt.type === 'YELLOW_CARD') {
    score.statistics?.cards[mEvt.team === 'home' ? 0 : 1].push({ type: 'yellow', minute: mEvt.minute });
  } else if (mEvt.type === 'RED_CARD') {
    score.statistics?.cards[mEvt.team === 'home' ? 0 : 1].push({ type: 'red', minute: mEvt.minute });
  } else if (mEvt.type === 'CORNER') {
    if (score.statistics) score.statistics.corners[mEvt.team === 'home' ? 0 : 1]++;
  } else if (mEvt.type === 'KILL') {
    score[mEvt.team]++;
  } else if (mEvt.type === 'OBJECTIVE') {
    score[mEvt.team === 'home' ? 'home' : 'away']++;
  }
}

function broadcastMatchEvent(event, score, mEvt) {
  const payload = {
    type: 'MATCH_EVENT',
    eventId: event.id,
    event: mEvt,
    score: { home: score.home, away: score.away, clock: score.clock, minute: score.minute },
    timestamp: mEvt.timestamp,
  };
  broadcast(payload, `event:${event.id}`);
  if (mEvt.significant) broadcast(payload, 'live');
}

function finishMatch(event, score, probs) {
  event.status = 'finished';
  event.finishedAt = new Date().toISOString();
  score.status = 'finished';

  // Aggiorna ELO
  updateElo(event.homeTeam, event.awayTeam, event.sport, score.home, score.away);

  // Settle bets
  settleEventBets(event, score);

  broadcast({
    type: 'MATCH_FINISHED',
    eventId: event.id,
    score: { home: score.home, away: score.away },
    result: score.home > score.away ? 'home' : score.away > score.home ? 'away' : 'draw',
    timestamp: new Date().toISOString(),
  }, `event:${event.id}`);

  broadcast({
    type: 'MATCH_FINISHED',
    eventId: event.id,
    homeTeam: event.homeTeam, awayTeam: event.awayTeam,
    score: { home: score.home, away: score.away },
    timestamp: new Date().toISOString(),
  }, 'live');

  console.log(`✅ FINISHED: ${event.homeTeam} ${score.home}-${score.away} ${event.awayTeam}`);
}

function settleEventBets(event, score) {
  const openBets = [...state.bets.values()].filter(b => b.eventId === event.id && b.status === 'open');
  openBets.forEach(bet => {
    const won = evaluateBetResult(bet, event, score);
    bet.status = won ? 'won' : 'lost';
    bet.settledAt = new Date().toISOString();
    if (won) {
      bet.payout = parseFloat((bet.stake * bet.odd).toFixed(2));
      const user = state.users.get(bet.userId);
      if (user) {
        user.balance = parseFloat((user.balance + bet.payout).toFixed(2));
        broadcast({ type: 'BET_SETTLED', betId: bet.id, status: 'won', payout: bet.payout, balance: user.balance }, `user:${bet.userId}`);
      }
    } else {
      broadcast({ type: 'BET_SETTLED', betId: bet.id, status: 'lost', payout: 0 }, `user:${bet.userId}`);
    }
  });
}

function evaluateBetResult(bet, event, score) {
  const h = score.home, a = score.away;
  const { marketId, outcome } = bet;
  // 1X2
  if (['ft_1x2'].includes(marketId)) {
    if (outcome === 'Home') return h > a;
    if (outcome === 'Draw') return h === a;
    if (outcome === 'Away') return a > h;
  }
  if (marketId === 'dc') {
    if (outcome === '1X') return h >= a;
    if (outcome === 'X2') return a >= h;
    if (outcome === '12') return h !== a;
  }
  if (marketId === 'btts') {
    if (outcome === 'Yes') return h > 0 && a > 0;
    if (outcome === 'No')  return h === 0 || a === 0;
  }
  if (marketId.startsWith('ou_')) {
    const line = parseFloat(marketId.replace('ou_','').replace('_','.'));
    const tot = h + a;
    if (outcome.startsWith('Over'))  return tot > line;
    if (outcome.startsWith('Under')) return tot < line;
  }
  if (marketId === 'bk_ml') {
    if (outcome === 'Home') return h > a;
    if (outcome === 'Away') return a > h;
  }
  // Mercati non implementati: random 50/50 (produzione: implementare tutti)
  return Math.random() < 0.50;
}

function formatClock(minute, sport, score) {
  if (sport === 'football') {
    if (score.period === 2 && minute >= 90) return `90+${minute-90}'`;
    return `${minute}'`;
  }
  return `${minute}'`;
}

function getTimeWeight(minute) {
  // Più gol nel finale (82-90') e inizio secondo tempo
  if (minute >= 82) return 1.35;
  if (minute >= 70) return 1.15;
  if (minute >= 46 && minute <= 52) return 1.10;
  return 1.0;
}

function sanitizeEvent(ev) {
  const { matchLog, matchParams, ...clean } = ev;
  return clean;
}

module.exports = { startMatchSimulation, settleEventBets, evaluateBetResult };
