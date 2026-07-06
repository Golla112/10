/**
 * liveOddsScheduler — Aggiorna le quote live ogni 3 secondi
 * 
 * - Calcola quote con liveOddsEngine (Poisson bivariato + Dixon-Coles)
 * - Rileva gol e cambiamenti importanti → blocca mercati automaticamente
 * - Emette eventi via callback per broadcast WebSocket
 */

import { computeAllLiveMarkets, LiveMarketOdds, MatchContext, BaseOdds } from './liveOddsEngine';
import { calcBasketMarkets, calcTennisMarkets, calcBaseballMarkets, calcBoxingMarkets } from './sportMarketsEngine';
import { getCachedLiveEvents } from './liveService';
import { BetStackEvent } from './betStackService';
import { refreshLiabilityCache, getLiabilitySync, calculateMarketAdjustment } from './liabilityEngine';

// ── Stato interno ─────────────────────────────────────────────────────────────

interface EventOddsState {
  odds: LiveMarketOdds;
  sportMarkets?: Record<string, unknown>; // mercati sport-specifici
  lockedUntil: number;
  lastScore: { home: number; away: number };
  lastMinute: number;
  consecutiveNoChange: number;
}

const oddsCache = new Map<string, EventOddsState>();
const LOCK_DURATION_MS = 12000; // 12 secondi di blocco al gol
const IMPORTANT_CHANGE_LOCK_MS = 6000; // 6 secondi per cambiamenti minori

// ── Callback per broadcast ────────────────────────────────────────────────────

type OddsUpdateCallback = (eventId: string, odds: LiveMarketOdds, locked: boolean, sportMarkets?: Record<string, unknown>) => void;
const callbacks: OddsUpdateCallback[] = [];

export function onOddsUpdate(cb: OddsUpdateCallback) {
  callbacks.push(cb);
}

function emit(eventId: string, odds: LiveMarketOdds, locked: boolean, sportMarkets?: Record<string, unknown>) {
  for (const cb of callbacks) cb(eventId, odds, locked, sportMarkets);
}

// ── Stima quote base da nome squadra (fallback senza bookmakers) ──────────────

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function estimateBaseOdds(home: string, away: string): BaseOdds {
  const h = hashStr(home + away);
  const pH = 0.30 + (h % 1000) / 4000;
  const pD = 0.22 + ((h >> 4) % 500) / 5000;
  const pA = Math.max(0.05, 1 - pH - pD);
  const tot = pH + pD + pA;
  const m = 0.08;
  const toOdd = (p: number) => parseFloat(((1 + m) / Math.max(0.01, p)).toFixed(2));
  return {
    home: toOdd(pH / tot),
    draw: toOdd(pD / tot),
    away: toOdd(pA / tot),
  };
}

// ── Estrai quote base dall'evento ─────────────────────────────────────────────

function extractBaseOdds(event: BetStackEvent): BaseOdds {
  for (const bk of event.bookmakers ?? []) {
    const h2h = bk.markets?.find(m => m.key === 'h2h');
    if (!h2h) continue;
    const oc = h2h.outcomes ?? [];
    const home = oc.find(o => o.name === event.home.name || o.name === 'home')?.price ?? 0;
    const draw = oc.find(o => o.name === 'Draw')?.price ?? 0;
    const away = oc.find(o => o.name === event.away.name || o.name === 'away')?.price ?? 0;
    if (home > 1 && away > 1) {
      return {
        home: Math.min(home, 20),
        draw: draw > 1 ? Math.min(draw, 20) : 3.5,
        away: Math.min(away, 20),
      };
    }
  }
  // Nessun bookmaker — stima da nome squadra
  return estimateBaseOdds(event.home.name, event.away.name);
}

// ── Rileva cambiamenti importanti ─────────────────────────────────────────────

interface ChangeDetection {
  isGoal: boolean;
  isImportant: boolean;
  description: string;
}

function detectChanges(
  event: BetStackEvent,
  prev: EventOddsState
): ChangeDetection {
  const score = event.score ?? { home: 0, away: 0 };
  const homeScore = score.home ?? 0;
  const awayScore = score.away ?? 0;
  const minute = estimateMinute(event);

  // Gol
  if (homeScore !== prev.lastScore.home || awayScore !== prev.lastScore.away) {
    const scorer = homeScore > prev.lastScore.home ? event.home.name : event.away.name;
    return {
      isGoal: true,
      isImportant: true,
      description: `GOL ${scorer} ${homeScore}-${awayScore} (${minute}')`,
    };
  }

  // Cambio minuto significativo (ogni 5 minuti)
  if (minute > 0 && prev.lastMinute > 0) {
    const minuteDiff = minute - prev.lastMinute;
    if (minuteDiff >= 5) {
      return {
        isGoal: false,
        isImportant: true,
        description: `Aggiornamento minuto ${minute}'`,
      };
    }
  }

  return { isGoal: false, isImportant: false, description: '' };
}

// ── Calcola contesto per il motore ────────────────────────────────────────────

function estimateMinute(event: BetStackEvent): number {
  // Se il minuto è ragionevole, usalo
  if (event.minute != null && event.minute > 0 && event.minute <= 120) return event.minute;
  
  const sport = event.sport_category ?? 'soccer';
  const isHockey = sport === 'hockey';
  const maxMins = isHockey ? 60 : 90;

  // Stima dal timestamp di inizio partita
  if (event.time && event.time > 0) {
    const elapsed = Math.floor((Date.now() / 1000 - event.time) / 60);

    if (isHockey) {
      // Hockey: 3 periodi da 20 min + ~18 min di pausa totale
      // Periodo 1: elapsed 0-20 → minuto 1-20
      // Pausa 1: elapsed 20-28 → minuto 20
      // Periodo 2: elapsed 28-48 → minuto 21-40
      // Pausa 2: elapsed 48-56 → minuto 40
      // Periodo 3: elapsed 56-76 → minuto 41-60
      if (elapsed <= 20) return Math.min(20, Math.max(1, elapsed));
      if (elapsed <= 28) return 20;
      if (elapsed <= 48) return Math.min(40, 20 + (elapsed - 28));
      if (elapsed <= 56) return 40;
      return Math.min(60, 40 + (elapsed - 56));
    }

    // Soccer & altri: pausa intervallo ~15 min
    // Se è passata più di un'ora, sottrarre i 15m di pausa.
    // Clamp finale al 90° (non mandarlo oltre altrimenti chiude i mercati ingiustificatamente!)
    if (elapsed > 45) {
      const secondHalf = elapsed - 15;
      return Math.min(maxMins, Math.max(45, secondHalf));
    }
    
    return Math.min(45, Math.max(1, elapsed));
  }
  
  return maxMins / 2;
}

function buildContext(event: BetStackEvent, base: BaseOdds): MatchContext {
  const score = event.score ?? { home: 0, away: 0 };
  const minute = estimateMinute(event);
  const sport = event.sport_category ?? 'soccer';
  return {
    base,
    homeScore: score.home ?? 0,
    awayScore: score.away ?? 0,
    minute,
    sport,
    isExtraTime: sport === 'hockey' ? minute > 60 : minute > 90,
    // Statistiche live
    homeShotsOnTarget: (event as BetStackEvent & { homeShotsOnTarget?: number }).homeShotsOnTarget,
    awayShotsOnTarget: (event as BetStackEvent & { awayShotsOnTarget?: number }).awayShotsOnTarget,
    homePossession: (event as BetStackEvent & { homePossession?: number }).homePossession,
    homeYellowCards: (event as BetStackEvent & { homeYellowCards?: number }).homeYellowCards,
    awayYellowCards: (event as BetStackEvent & { awayYellowCards?: number }).awayYellowCards,
    homeRedCards: (event as BetStackEvent & { homeRedCards?: number }).homeRedCards,
    awayRedCards: (event as BetStackEvent & { awayRedCards?: number }).awayRedCards,
  };
}

// ── Tick principale (ogni 3 secondi) ─────────────────────────────────────────

export function tickLiveOdds(): void {
  const events = getCachedLiveEvents();
  const now = Date.now();

  for (const event of events) {
    if (!event.live) continue;

    const base = extractBaseOdds(event);

    const score = event.score ?? { home: 0, away: 0 };
    const homeScore = score.home ?? 0;
    const awayScore = score.away ?? 0;
    const minute = event.minute ?? 0;

    const prev = oddsCache.get(event.id);
    let locked = false;
    let lockUntil = prev?.lockedUntil ?? 0;

    // Rileva cambiamenti
    if (prev) {
      const change = detectChanges(event, prev);

      if (change.isGoal) {
        lockUntil = now + LOCK_DURATION_MS;
        console.log(`[odds-scheduler] 🔒 ${change.description} → blocco ${LOCK_DURATION_MS / 1000}s`);
      } else if (change.isImportant) {
        lockUntil = Math.max(lockUntil, now + IMPORTANT_CHANGE_LOCK_MS);
      }
    }

    locked = now < lockUntil;

    // Calcola nuove quote
    let odds: LiveMarketOdds;
    let sportMarkets: Record<string, unknown> | undefined;
    try {
      const ctx = buildContext(event, base);
      odds = computeAllLiveMarkets(ctx);

      // --- APPLICAZIONE LIABILITY (ECONOMIA MERCATO) ---
      try {
        const h2hState = getLiabilitySync(event.id, 'h2h');
        if (h2hState.totalStake > 10) {
          if (odds.h2h.home) odds.h2h.home *= calculateMarketAdjustment('home', 1 / odds.h2h.home, h2hState);
          if (odds.h2h.draw) odds.h2h.draw *= calculateMarketAdjustment('draw', 1 / odds.h2h.draw, h2hState);
          if (odds.h2h.away) odds.h2h.away *= calculateMarketAdjustment('away', 1 / odds.h2h.away, h2hState);
        }
        
        const totalsState = getLiabilitySync(event.id, 'totals');
        if (totalsState.totalStake > 10) {
          if (odds.over_under.over25) odds.over_under.over25 *= calculateMarketAdjustment('over', 1 / odds.over_under.over25, totalsState);
          if (odds.over_under.under25) odds.over_under.under25 *= calculateMarketAdjustment('under', 1 / odds.over_under.under25, totalsState);
        }
      } catch (err) {
        // Ignora errori liability, mantiene le quote true-math
      }

      // Mercati sport-specifici
      const sport = event.sport_category ?? 'soccer';
      const score = event.score ?? { home: 0, away: 0 };
      const minute = estimateMinute(event);

      if (sport === 'basketball') {
        sportMarkets = calcBasketMarkets(
          score.home ?? 0, score.away ?? 0, minute, 40
        ) as unknown as Record<string, unknown>;
      } else if (sport === 'tennis') {
        sportMarkets = calcTennisMarkets(
          score.home ?? 0, score.away ?? 0, 0, 0, 3,
          { p1: base.home, p2: base.away }
        ) as unknown as Record<string, unknown>;
      } else if (sport === 'baseball') {
        sportMarkets = calcBaseballMarkets(
          score.home ?? 0, score.away ?? 0,
          Math.floor(minute / 10) + 1, 9,
          { home: base.home, away: base.away }
        ) as unknown as Record<string, unknown>;
      } else if (sport === 'boxing' || sport === 'mma') {
        sportMarkets = calcBoxingMarkets(
          Math.floor(minute / 3) + 1, 12,
          { home: base.home, away: base.away }
        ) as unknown as Record<string, unknown>;
      }
    } catch {
      continue;
    }

    // Aggiorna stato
    oddsCache.set(event.id, {
      odds,
      sportMarkets,
      lockedUntil: lockUntil,
      lastScore: { home: homeScore, away: awayScore },
      lastMinute: minute,
      consecutiveNoChange: prev ? (prev.consecutiveNoChange + 1) : 0,
    });

    // Emetti aggiornamento
    emit(event.id, odds, locked, sportMarkets);
  }

  // Pulisci eventi non più live
  for (const [id] of oddsCache) {
    if (!events.find(e => e.id === id)) {
      oddsCache.delete(id);
    }
  }
}

// ── API pubblica ──────────────────────────────────────────────────────────────

export function getLiveOdds(eventId: string): LiveMarketOdds | null {
  return oddsCache.get(eventId)?.odds ?? null;
}

export function getSportMarkets(eventId: string): Record<string, unknown> | undefined {
  return oddsCache.get(eventId)?.sportMarkets;
}

export function isMarketLocked(eventId: string): boolean {
  const state = oddsCache.get(eventId);
  if (!state) return false;
  return Date.now() < state.lockedUntil;
}

export function getLockCountdown(eventId: string): number {
  const state = oddsCache.get(eventId);
  if (!state) return 0;
  return Math.max(0, Math.ceil((state.lockedUntil - Date.now()) / 1000));
}

export function getAllLiveOdds(): Map<string, { odds: LiveMarketOdds; locked: boolean; countdown: number; sportMarkets?: Record<string, unknown> }> {
  const result = new Map<string, { odds: LiveMarketOdds; locked: boolean; countdown: number; sportMarkets?: Record<string, unknown> }>();
  const now = Date.now();
  for (const [id, state] of oddsCache) {
    result.set(id, {
      odds: state.odds,
      sportMarkets: state.sportMarkets,
      locked: now < state.lockedUntil,
      countdown: Math.max(0, Math.ceil((state.lockedUntil - now) / 1000)),
    });
  }
  return result;
}

// ── Avvio scheduler ───────────────────────────────────────────────────────────

let schedulerInterval: NodeJS.Timeout | null = null;
let liabilityInterval: NodeJS.Timeout | null = null;

export function startLiveOddsScheduler(): void {
  if (schedulerInterval) return;
  console.log('[odds-scheduler] Avviato — aggiornamento ogni 3s (con controllo liquidità)');
  
  // Sincronizza i livelli di esposizione mercato (Market Making Liability) ogni 5 secondi
  liabilityInterval = setInterval(async () => {
    try {
      const activeIds = getCachedLiveEvents().map(e => e.id);
      if (activeIds.length > 0) await refreshLiabilityCache(activeIds);
    } catch (err) {
      console.error('[liability] Errore cache refresh:', err);
    }
  }, 5000);

  // Prima esecuzione immediata
  tickLiveOdds();
  schedulerInterval = setInterval(tickLiveOdds, 3000);
}

export function stopLiveOddsScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  if (liabilityInterval) {
    clearInterval(liabilityInterval);
    liabilityInterval = null;
  }
}
