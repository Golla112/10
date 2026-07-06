import { v4 as uuidv4 } from 'uuid';
import { getRedisClient } from './cacheService';
import { generateCodiceSchedina } from './betService';
import { PendingLiveBet, ProtectionLogEntry, ProtectionStats } from '../types/liveProtection';
import { Selection } from './betService';

// Lazy imports to avoid circular deps and allow mocking in tests
function getLiveOddsService() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const liveOddsScheduler = require('./liveOddsScheduler');
  const liveService = require('./liveService');
  return {
    getLiveOdds: liveOddsScheduler.getLiveOdds,
    isEventLive: liveService.isEventLive,
  } as {
    getLiveOdds: (eventId: string) => import('./liveOddsEngine').LiveMarketOdds | null;
    isEventLive: (eventId: string) => boolean;
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DELAY_MIN_MS = 3000;
const DELAY_MAX_MS = 5000;
const ODDS_TOLERANCE = 0.03;   // 3%
const PENDING_TTL_S = 30;

// ── In-memory log (circular buffer, max 1000 entries) ─────────────────────────

const protectionLog: ProtectionLogEntry[] = [];
const MAX_LOG_SIZE = 1000;

function appendLog(entry: ProtectionLogEntry): void {
  if (protectionLog.length >= MAX_LOG_SIZE) {
    protectionLog.shift();
  }
  protectionLog.push(entry);
}

/**
 * Public wrapper around appendLog — exported for testing and external use.
 */
export function logProtectionEvent(entry: ProtectionLogEntry): void {
  appendLog(entry);
}

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Generates a random delay between 3000 and 5000 ms (inclusive).
 */
export function generateDelay(): number {
  return Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS + 1)) + DELAY_MIN_MS;
}

/**
 * Applies the live margin (12%) to a given odds value.
 * Formula: 1 / min(0.97, (1/quota) * 1.12), rounded to 2 decimal places.
 */
export function applyLiveMargin(quota: number): number {
  if (quota <= 1) return 0;
  const impliedProb = 1 / quota;
  const adjusted = Math.min(0.97, impliedProb * 1.12);
  return parseFloat((1 / adjusted).toFixed(2));
}

/**
 * Returns true if the odds change between accepted and current exceeds the 3% tolerance.
 */
export function oddsChangedBeyondTolerance(accepted: number, current: number): boolean {
  return Math.abs(current - accepted) / accepted > ODDS_TOLERANCE;
}

// ── Redis helpers ─────────────────────────────────────────────────────────────

function pendingKey(pendingId: string): string {
  return `live:pending:${pendingId}`;
}

/**
 * Creates a PendingLiveBet and stores it in Redis with TTL 30s.
 */
export async function createPendingBet(data: {
  user_id: string;
  event_id: string;
  selections: Selection[];
  stake: number;
  accepted_odds: Record<string, number>;
}): Promise<PendingLiveBet> {
  const pending_id = uuidv4();
  const delay_ms = generateDelay();

  const pending: PendingLiveBet = {
    pending_id,
    user_id: data.user_id,
    event_id: data.event_id,
    selections: data.selections,
    stake: data.stake,
    accepted_odds: data.accepted_odds,
    created_at: Date.now(),
    delay_ms,
    status: 'pending',
  };

  const redis = getRedisClient();
  await redis.set(pendingKey(pending_id), JSON.stringify(pending), 'EX', PENDING_TTL_S);

  return pending;
}

/**
 * Retrieves a PendingLiveBet from Redis by pendingId.
 */
export async function getPendingBet(pendingId: string): Promise<PendingLiveBet | null> {
  const redis = getRedisClient();
  const data = await redis.get(pendingKey(pendingId));
  if (!data) return null;
  return JSON.parse(data) as PendingLiveBet;
}

/**
 * Updates the PendingLiveBet in Redis (preserving remaining TTL is not critical here;
 * we reset to PENDING_TTL_S to ensure the final status is readable).
 */
async function updatePendingBet(pending: PendingLiveBet): Promise<void> {
  const redis = getRedisClient();
  await redis.set(pendingKey(pending.pending_id), JSON.stringify(pending), 'EX', PENDING_TTL_S);
}

// ── Process pending bet after delay ──────────────────────────────────────────

/**
 * Runs all protection checks and updates the pending bet status to accepted or rejected.
 * Should be called after the delay_ms has elapsed.
 */
export async function processPendingBet(pendingId: string): Promise<void> {
  const pending = await getPendingBet(pendingId);
  if (!pending) return; // TTL expired or not found

  // 1. Check event is still live
  const { isEventLive } = getLiveOddsService();
  if (!isEventLive(pending.event_id)) {
    pending.status = 'rejected';
    pending.rejection_reason = 'event_not_live';
    await updatePendingBet(pending);
    appendLog({
      timestamp: new Date().toISOString(),
      pending_id: pending.pending_id,
      event_id: pending.event_id,
      stake: pending.stake,
      accepted_odds: pending.accepted_odds,
      outcome: 'rejected',
      rejection_reason: 'event_not_live',
    });
    return;
  }

  // 2. Check market lock
  const redis = getRedisClient();
  const lock = await redis.get(`live:lock:${pending.event_id}`);
  if (lock) {
    pending.status = 'rejected';
    pending.rejection_reason = 'market_locked';
    await updatePendingBet(pending);
    appendLog({
      timestamp: new Date().toISOString(),
      pending_id: pending.pending_id,
      event_id: pending.event_id,
      stake: pending.stake,
      accepted_odds: pending.accepted_odds,
      outcome: 'rejected',
      rejection_reason: 'market_locked',
    });
    return;
  }

  // 3. Check odds change (Real-time calculation from Live Engine)
  const { getLiveOdds } = getLiveOddsService();
  const currentMarkets = getLiveOdds(pending.event_id);
  
  if (currentMarkets) {
    for (const sel of pending.selections) {
      const accepted = pending.accepted_odds[sel.event_id];
      if (accepted == null) continue;

      // Resolve current odd for this selection from our professional engine
      let current: number | undefined | null;
      const m = sel.market?.toLowerCase() || 'h2h';
      const o = sel.outcome?.toLowerCase() || '';

      if (m === 'h2h' || m === '1x2' || m === 'testa a testa') {
        if (o === 'home' || o.includes('1')) current = currentMarkets.h2h.home;
        else if (o === 'away' || o.includes('2')) current = currentMarkets.h2h.away;
        else if (o === 'draw' || o.includes('x')) current = currentMarkets.h2h.draw;
      } else if (m === 'totals' || m === 'o/u' || m === 'under/over') {
        const line = sel.point != null ? sel.point : 2.5;
        const key = `over${String(line).replace('.', '')}` as keyof typeof currentMarkets.over_under;
        const ukey = `under${String(line).replace('.', '')}` as keyof typeof currentMarkets.over_under;
        if (o.includes('over')) current = currentMarkets.over_under[key];
        else if (o.includes('under')) current = currentMarkets.over_under[ukey];
      } else if (m === 'gg/ng' || m === 'btts') {
        if (o.includes('gg') || o.includes('yes')) current = currentMarkets.gg_ng.gg;
        else if (o.includes('ng') || o.includes('no')) current = currentMarkets.gg_ng.ng;
      }

      if (current == null || current <= 1) continue;

      if (oddsChangedBeyondTolerance(accepted, current)) {
        const diffPct = Math.abs(current - accepted) / accepted;
        pending.status = 'rejected';
        pending.rejection_reason = 'odds_changed';
        pending.new_odds = { home: (currentMarkets.h2h.home ?? 0), draw: (currentMarkets.h2h.draw ?? 0), away: (currentMarkets.h2h.away ?? 0) };
        await updatePendingBet(pending);
        appendLog({
          timestamp: new Date().toISOString(),
          pending_id: pending.pending_id,
          event_id: pending.event_id,
          stake: pending.stake,
          accepted_odds: pending.accepted_odds,
          outcome: 'rejected',
          rejection_reason: 'odds_changed',
          odds_diff_pct: parseFloat((diffPct * 100).toFixed(2)),
        });
        return;
      }
    }
  }

  // 4. Accept the bet
  const codice_schedina = generateCodiceSchedina();
  pending.status = 'accepted';
  pending.codice_schedina = codice_schedina;
  await updatePendingBet(pending);
  
  // Registra la Liability per influenzare dinamicamente le quote live
  try {
    const { recordLiability } = await import('./liabilityEngine');
    const stakePerSel = pending.stake / pending.selections.length;
    for (const sel of pending.selections) {
      if (sel.market && sel.outcome) {
        let m = sel.market.toLowerCase();
        let o = sel.outcome.toLowerCase();
        if (m === '1x2' || m === 'testa a testa' || m === 'h2h') m = 'h2h';
        if (m === 'o/u' || m === 'under/over' || m === 'totals') m = 'totals';
        if (m === 'h2h') {
          if (o.includes('1') || o.includes('casa')) o = 'home';
          if (o.includes('x') || o.includes('pareggio')) o = 'draw';
          if (o.includes('2') || o.includes('ospite')) o = 'away';
        }
        if (m === 'totals') {
          if (o.includes('over')) o = 'over';
          if (o.includes('under')) o = 'under';
        }
        await recordLiability(sel.event_id, m, o, stakePerSel).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[liability] Error recording live bet:', err);
  }

  appendLog({
    timestamp: new Date().toISOString(),
    pending_id: pending.pending_id,
    event_id: pending.event_id,
    stake: pending.stake,
    accepted_odds: pending.accepted_odds,
    outcome: 'accepted',
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function getProtectionStats(periodHours = 24): ProtectionStats {
  const cutoff = Date.now() - periodHours * 3600 * 1000;
  const recent = protectionLog.filter(e => new Date(e.timestamp).getTime() >= cutoff);

  const total_accepted = recent.filter(e => e.outcome === 'accepted').length;
  const total_rejected = recent.filter(e => e.outcome === 'rejected').length;

  const rejections_by_reason: Record<string, number> = {};
  for (const e of recent) {
    if (e.outcome === 'rejected' && e.rejection_reason) {
      rejections_by_reason[e.rejection_reason] = (rejections_by_reason[e.rejection_reason] ?? 0) + 1;
    }
  }

  return {
    period_hours: periodHours,
    total_pending: recent.length,
    total_accepted,
    total_rejected,
    rejections_by_reason,
  };
}

export { protectionLog };

// ── Locked Events ─────────────────────────────────────────────────────────────

/**
 * Scans Redis for all active market lock keys and returns the locked event IDs.
 */
export async function getLockedEvents(): Promise<string[]> {
  const redis = getRedisClient();
  let cursor = '0';
  const lockedEventIds: string[] = [];
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'live:lock:*', 'COUNT', 100);
    cursor = nextCursor;
    for (const key of keys) {
      lockedEventIds.push(key.replace('live:lock:', ''));
    }
  } while (cursor !== '0');
  return lockedEventIds;
}
