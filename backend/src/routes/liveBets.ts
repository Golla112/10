import { Router, Request, Response } from 'express';
import { isEventLive } from '../services/liveService';
import { isMarketLocked } from '../jobs/marketLockMonitor';
import {
  createPendingBet,
  getPendingBet,
  processPendingBet,
  getProtectionStats,
  getLockedEvents,
} from '../services/protectionService';
import { Selection } from '../services/betService';
import { LIVE_MAX_STAKE as SHARED_LIVE_MAX_STAKE } from '../constants/betting';
import { requireRoles } from '../middleware/roleAuth';
import { requireAuth } from '../middleware/auth';

const router = Router();
const requireAdminOrSuperadmin = requireRoles('admin', 'superadmin');

export const LIVE_MAX_STAKE = SHARED_LIVE_MAX_STAKE;

// ── Funzioni di validazione esportate per i test ──────────────────────────────

export function validateLiveStake(stake: number): string | null {
  if (typeof stake !== 'number' || stake <= 0) return 'stake must be a positive number.';
  if (stake > LIVE_MAX_STAKE) return `Puntata massima per scommesse live: €${LIVE_MAX_STAKE.toFixed(2)}`;
  return null;
}

export function validateLiveSelections(selections: Selection[]): string | null {
  if (!Array.isArray(selections) || selections.length === 0) return 'selections must be a non-empty array.';
  return null;
}

export function hasLiveSelections(
  selections: Selection[],
  isEventLiveFn: (id: string) => boolean
): boolean {
  return selections.some(s => isEventLiveFn(s.event_id));
}

export async function checkMarketLocks(
  selections: Selection[],
  isEventLiveFn: (id: string) => boolean,
  isMarketLockedFn: (id: string) => Promise<boolean>
): Promise<string | null> {
  const liveSelections = selections.filter(s => isEventLiveFn(s.event_id));
  for (const sel of liveSelections) {
    const locked = await isMarketLockedFn(sel.event_id);
    if (locked) return sel.event_id;
  }
  return null;
}

// POST /bet/live — invia scommessa live (risponde 202 con pending_id)
router.post('/bet/live', requireAuth, async (req: Request, res: Response) => {
  const userId = req.authUserId;
  if (!userId) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  const { stake, selections, accepted_odds, event_id } = req.body as {
    stake: number;
    selections: Selection[];
    accepted_odds?: Record<string, number>;
    event_id?: string;
  };

  // Validazione stake
  if (typeof stake !== 'number' || stake <= 0) {
    return res.status(400).json({ error: 'stake must be a positive number.' });
  }
  if (stake > LIVE_MAX_STAKE) {
    return res.status(400).json({
      error: `Puntata massima per scommesse live: €${LIVE_MAX_STAKE.toFixed(2)}`,
    });
  }

  if (!Array.isArray(selections) || selections.length === 0) {
    return res.status(400).json({ error: 'selections must be a non-empty array.' });
  }

  // Verifica che almeno una selezione sia live
  const liveSelections = selections.filter(s => isEventLive(s.event_id));
  if (liveSelections.length === 0) {
    return res.status(400).json({ error: 'Nessuna selezione live trovata.' });
  }

  // Determina event_id principale (primo evento live)
  const primaryEventId = event_id ?? liveSelections[0].event_id;

  // Verifica Market Lock su tutti gli eventi live 
  for (const sel of liveSelections) {
    const locked = await isMarketLocked(sel.event_id);
    if (locked) {
      return res.status(423).json({
        error: 'Mercato temporaneamente sospeso. Riprova tra qualche secondo.',
        event_id: sel.event_id,
      });
    }
  }

  // Crea la pending bet
  const pending = await createPendingBet({
    user_id: userId,
    event_id: primaryEventId,
    selections,
    stake,
    accepted_odds: accepted_odds ?? {},
  });

  // Schedula processPendingBet dopo il delay
  setTimeout(() => {
    processPendingBet(pending.pending_id).catch(err =>
      console.error('[liveBets] processPendingBet error:', err)
    );
  }, pending.delay_ms);

  return res.status(202).json({
    pending_id: pending.pending_id,
    delay_ms: pending.delay_ms,
  });
});

// GET /bet/live/status/:pendingId — polling stato della pending bet
router.get('/bet/live/status/:pendingId', requireAuth, async (req: Request, res: Response) => {
  const userId = req.authUserId;
  if (!userId) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  const { pendingId } = req.params;

  const pending = await getPendingBet(pendingId);
  if (!pending) {
    return res.status(404).json({ error: 'Pending bet non trovata o scaduta.' });
  }
  if (pending.user_id !== userId) {
    return res.status(403).json({ error: 'Accesso non autorizzato' });
  }

  const remaining_ms = Math.max(0, pending.created_at + pending.delay_ms - Date.now());

  const response: Record<string, unknown> = {
    status: pending.status,
    remaining_ms,
  };

  if (pending.codice_schedina) {
    response.codice_schedina = pending.codice_schedina;
  }
  if (pending.rejection_reason) {
    response.rejection_reason = pending.rejection_reason;
  }
  if (pending.new_odds) {
    response.new_odds = pending.new_odds;
  }

  return res.json(response);
});

// GET /live-protection/stats — statistiche aggregate ultime 24h
router.get('/live-protection/stats', requireAdminOrSuperadmin, async (_req: Request, res: Response) => {
  const stats = getProtectionStats(24);
  return res.json(stats);
});

// GET /live-protection/locks — event_id con market lock attivi
router.get('/live-protection/locks', requireAdminOrSuperadmin, async (_req: Request, res: Response) => {
  const locked_events = await getLockedEvents();
  return res.json({ locked_events });
});

export default router;

