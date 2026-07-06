'use strict';
/**
 * RISK MANAGER
 * ─────────────────────────────────────────────────────────────────
 * Sistema di gestione del rischio enterprise:
 * 
 * - Liability control: esposizione massima per evento/mercato
 * - Bet acceptance rules: accetta, riduce, rifiuta
 * - Patterned behavior detection (arbitrage, sure bet)
 * - Maximum win limits
 * - KYC/AML thresholds
 * ─────────────────────────────────────────────────────────────────
 */

const { detectSteam } = require('../live/liveOddsEngine');
const { state } = require('../db/state');

// ─── LIMITI GLOBALI ───────────────────────────────────────────────────────────
const LIMITS = {
  global: {
    maxSingleBet:        50000,
    maxPayout:          500000,
    maxDailyPerUser:    100000,
    maxLiabilityPerEvt: 200000,
    minStake:             0.10,
    minOdd:               1.01,
    maxOdd:             1000.0,
    maxAccaLegs:            20,
    maxAccaPayout:       50000,
  },
  byMarket: {
    cs:      { maxStake: 5000,  maxPayout: 30000 },
    htft:    { maxStake: 8000,  maxPayout: 40000 },
    corners: { maxStake: 10000, maxPayout: 50000 },
    cards:   { maxStake: 10000, maxPayout: 50000 },
  },
  byOdd: [
    { minOdd: 1.01, maxOdd: 1.20, maxStake: 10000 },
    { minOdd: 1.20, maxOdd: 2.00, maxStake: 30000 },
    { minOdd: 2.00, maxOdd: 5.00, maxStake: 20000 },
    { minOdd: 5.00, maxOdd: 20.0, maxStake: 10000 },
    { minOdd: 20.0, maxOdd: 999,  maxStake: 2000  },
  ],
};

// Traccia esposizione in tempo reale
const EXPOSURE = new Map(); // eventId → { total, byMarket: {}, byOutcome: {} }
const USER_DAILY = new Map(); // userId → { date, totalStake, totalPayout }
const ARBI_TRACKER = new Map(); // userId → [{ timestamp, pattern }]

/**
 * VALIDA E APPROVA UNA SCOMMESSA
 * Ritorna { accepted, stake, reason, code, adjustedStake }
 */
function validateBet(userId, bet, userProfile) {
  const { eventId, marketId, outcome, stake, odd, type = 'single' } = bet;
  const errors = [];

  // 1. Limiti base
  if (stake < LIMITS.global.minStake) {
    return reject('STAKE_TOO_LOW', `Puntata minima: €${LIMITS.global.minStake}`);
  }
  if (stake > LIMITS.global.maxSingleBet) {
    // Tenta riduzione automatica
    return acceptReduced(LIMITS.global.maxSingleBet, 'MAX_STAKE_REDUCED', 'Puntata ridotta al limite massimo');
  }
  if (odd < LIMITS.global.minOdd || odd > LIMITS.global.maxOdd) {
    return reject('ODD_OUT_OF_RANGE', 'Quota fuori range');
  }

  const potentialWin = stake * odd;
  if (potentialWin > LIMITS.global.maxPayout) {
    const maxStake = Math.floor(LIMITS.global.maxPayout / odd);
    return acceptReduced(maxStake, 'PAYOUT_LIMIT_REDUCED', `Puntata ridotta per limite vincita massima €${LIMITS.global.maxPayout}`);
  }

  // 2. Limiti per mercato
  const mktBase = marketId.split('_')[0];
  const mktLimits = LIMITS.byMarket[mktBase] || LIMITS.byMarket[marketId];
  if (mktLimits) {
    if (stake > mktLimits.maxStake) {
      return acceptReduced(mktLimits.maxStake, 'MARKET_STAKE_REDUCED', `Limite mercato: €${mktLimits.maxStake}`);
    }
    if (potentialWin > mktLimits.maxPayout) {
      const ms = Math.floor(mktLimits.maxPayout / odd);
      return acceptReduced(ms, 'MARKET_PAYOUT_REDUCED', `Limite vincita mercato: €${mktLimits.maxPayout}`);
    }
  }

  // 3. Limiti per quota
  const oddLimit = LIMITS.byOdd.find(l => odd >= l.minOdd && odd < l.maxOdd);
  if (oddLimit && stake > oddLimit.maxStake) {
    return acceptReduced(oddLimit.maxStake, 'ODD_STAKE_REDUCED', `Limite per questa fascia di quota: €${oddLimit.maxStake}`);
  }

  // 4. Limite giornaliero utente
  const daily = getUserDaily(userId);
  if (daily.totalStake + stake > LIMITS.global.maxDailyPerUser) {
    const remaining = LIMITS.global.maxDailyPerUser - daily.totalStake;
    if (remaining < LIMITS.global.minStake) {
      return reject('DAILY_LIMIT_REACHED', 'Limite giornaliero raggiunto');
    }
    return acceptReduced(remaining, 'DAILY_LIMIT_REDUCED', `Puntata ridotta per limite giornaliero residuo: €${remaining}`);
  }

  // 5. Esposizione evento
  const expCheck = checkEventExposure(eventId, marketId, outcome, stake, odd);
  if (!expCheck.ok) {
    if (expCheck.maxStake < LIMITS.global.minStake) {
      return reject('LIABILITY_EXCEEDED', 'Esposizione massima raggiunta per questo mercato');
    }
    return acceptReduced(expCheck.maxStake, 'LIABILITY_REDUCED', 'Puntata ridotta per gestione rischio');
  }

  // 6. Profilo utente KYC
  if (userProfile.kycStatus === 'pending' && stake > 500) {
    return reject('KYC_REQUIRED', 'Verifica identità richiesta per puntate > €500');
  }

  // 7. Steam detection
  const isSteam = detectSteam(eventId, marketId, outcome, stake);
  if (isSteam && stake > 5000) {
    return acceptReduced(Math.min(stake, 2000), 'STEAM_LIMIT', 'Puntata ridotta per traffico anomalo rilevato');
  }

  // 8. Arbitrage detection (bet molto vicine ai limiti su più mercati correlati)
  const arbiRisk = detectArbitrage(userId, bet);
  if (arbiRisk.suspicious) {
    if (arbiRisk.level === 'high') {
      return reject('ARBITRAGE_SUSPECTED', 'Scommessa non accettata');
    }
    // Medium: riduci limite utente temporaneamente
    return acceptReduced(Math.min(stake, 500), 'RISK_FLAG', 'Puntata limitata temporaneamente');
  }

  return accept(stake);
}

/**
 * VALIDA MULTIPLA/ACCUMULATOR
 */
function validateMultiple(userId, selections, stake, userProfile) {
  if (selections.length > LIMITS.global.maxAccaLegs) {
    return reject('TOO_MANY_LEGS', `Massimo ${LIMITS.global.maxAccaLegs} selezioni`);
  }

  const combinedOdd = selections.reduce((p, s) => p * s.odd, 1);
  const potentialWin = stake * combinedOdd;

  // Controlla eventi correlati (stesso match in più selezioni)
  const eventIds = selections.map(s => s.eventId);
  const uniqueEvents = new Set(eventIds);
  if (uniqueEvents.size < eventIds.length) {
    return reject('CORRELATED_SELECTIONS', 'Non puoi avere più selezioni dello stesso evento nella multipla');
  }

  if (potentialWin > LIMITS.global.maxAccaPayout) {
    const maxStake = Math.floor(LIMITS.global.maxAccaPayout / combinedOdd);
    if (maxStake < LIMITS.global.minStake) {
      return reject('ACCA_PAYOUT_LIMIT', `La combinazione eccede il limite vincita multipla (€${LIMITS.global.maxAccaPayout})`);
    }
    return acceptReduced(maxStake, 'ACCA_PAYOUT_REDUCED', `Puntata ridotta: limite vincita multipla €${LIMITS.global.maxAccaPayout}`);
  }

  return accept(stake);
}

// ─── GESTIONE ESPOSIZIONE ─────────────────────────────────────────────────────
function checkEventExposure(eventId, marketId, outcome, stake, odd) {
  if (!EXPOSURE.has(eventId)) {
    EXPOSURE.set(eventId, { total: 0, byMarket: {}, byOutcome: {} });
  }

  const exp = EXPOSURE.get(eventId);
  const potentialWin = stake * odd;
  const newTotal = exp.total + potentialWin;

  if (newTotal > LIMITS.global.maxLiabilityPerEvt) {
    const remaining = LIMITS.global.maxLiabilityPerEvt - exp.total;
    const maxStake = Math.floor(remaining / odd);
    return { ok: false, maxStake: Math.max(0, maxStake) };
  }

  return { ok: true };
}

function recordBet(userId, bet, finalStake) {
  const potentialWin = finalStake * bet.odd;

  // Aggiorna esposizione
  const exp = EXPOSURE.get(bet.eventId) || { total: 0, byMarket: {}, byOutcome: {} };
  exp.total += potentialWin;
  if (!exp.byMarket[bet.marketId]) exp.byMarket[bet.marketId] = 0;
  exp.byMarket[bet.marketId] += potentialWin;
  EXPOSURE.set(bet.eventId, exp);

  // Aggiorna limite giornaliero
  const daily = getUserDaily(userId);
  daily.totalStake += finalStake;
  daily.totalPayout += potentialWin;
  USER_DAILY.set(`${userId}:${getToday()}`, daily);
}

function releaseExposure(eventId, winAmount) {
  const exp = EXPOSURE.get(eventId);
  if (exp) {
    exp.total = Math.max(0, exp.total - winAmount);
    EXPOSURE.set(eventId, exp);
  }
}

function getUserDaily(userId) {
  const today = getToday();
  const key = `${userId}:${today}`;
  if (!USER_DAILY.has(key)) {
    USER_DAILY.set(key, { date: today, totalStake: 0, totalPayout: 0 });
  }
  return USER_DAILY.get(key);
}

function getExposureReport(eventId) {
  return EXPOSURE.get(eventId) || { total: 0, byMarket: {}, byOutcome: {} };
}

// ─── ARBITRAGE DETECTION ──────────────────────────────────────────────────────
function detectArbitrage(userId, bet) {
  const key = userId;
  const now = Date.now();
  const history = ARBI_TRACKER.get(key) || [];

  // Pulisci storico > 5 minuti
  const recent = history.filter(h => now - h.timestamp < 300000);
  recent.push({ timestamp: now, eventId: bet.eventId, marketId: bet.marketId, odd: bet.odd });
  ARBI_TRACKER.set(key, recent);

  // Check: stesso evento, mercati opposti
  const sameEvent = recent.filter(h => h.eventId === bet.eventId);
  if (sameEvent.length >= 3) {
    return { suspicious: true, level: 'medium' };
  }

  // Check: pattern di scommesse su quote molto basse (< 1.10)
  const lowOddBets = recent.filter(h => h.odd < 1.10);
  if (lowOddBets.length >= 5) {
    return { suspicious: true, level: 'high' };
  }

  return { suspicious: false };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function accept(stake) {
  return { accepted: true, stake, code: 'ACCEPTED', reason: null, adjusted: false };
}

function acceptReduced(stake, code, reason) {
  return { accepted: true, stake: Math.max(0, parseFloat(stake.toFixed(2))), code, reason, adjusted: true };
}

function reject(code, reason) {
  return { accepted: false, stake: 0, code, reason, adjusted: false };
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

module.exports = { validateBet, validateMultiple, recordBet, releaseExposure, getExposureReport, getUserDaily };
