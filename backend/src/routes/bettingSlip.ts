import { Router, Request, Response } from 'express';
import bettingSlipService, { BettingSlipItem } from '../services/bettingSlipService';
import { requireAuth } from '../middleware/auth';
import { requireRoles } from '../middleware/roleAuth';

const router = Router();
const requireAdminOrSuperadmin = requireRoles('admin', 'superadmin');
const MAX_BETTING_SLIP_BODY_CHARS = 50000;
const MAX_TEXT_FIELD_LEN = 120;

router.use(requireAuth);

function rejectIfPayloadTooLarge(req: Request, res: Response): boolean {
  try {
    const size = JSON.stringify(req.body ?? {}).length;
    if (size > MAX_BETTING_SLIP_BODY_CHARS) {
      res.status(413).json({ success: false, error: `Payload troppo grande (max ${MAX_BETTING_SLIP_BODY_CHARS} caratteri).` });
      return true;
    }
    return false;
  } catch {
    res.status(400).json({ success: false, error: 'Payload non valido' });
    return true;
  }
}

function isNonEmptyShortString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_TEXT_FIELD_LEN;
}

function handleRouteError(res: Response, error: unknown, fallbackMessage: string): void {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const lower = message.toLowerCase();

  if (lower.includes('not found')) {
    res.status(404).json({ success: false, error: message });
    return;
  }
  if (lower.includes('must be') || lower.includes('invalid')) {
    res.status(400).json({ success: false, error: message });
    return;
  }
  if (lower.includes('placed before confirmation')) {
    res.status(409).json({ success: false, error: message });
    return;
  }

  res.status(500).json({ success: false, error: message || fallbackMessage });
}

function getAuthUserId(req: Request): string {
  const userId = req.authUserId;
  if (!userId) {
    throw new Error('User not authenticated');
  }
  return userId;
}

function ensureSlipOwner(req: Request, res: Response, slipId: string): string | null {
  const userId = getAuthUserId(req);
  const slip = bettingSlipService.getSlip(slipId);

  if (!slip) {
    res.status(404).json({ success: false, error: 'Betting slip not found' });
    return null;
  }

  if (!slip.userId || slip.userId !== userId) {
    res.status(403).json({ success: false, error: 'Accesso non autorizzato' });
    return null;
  }

  return userId;
}

// Static routes first to avoid :slipId shadowing
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const config = {
      maxSelections: 20,
      minOdds: 1.02,
      maxOdds: 1000,
      minStake: 1,
      maxStake: 10000,
      maxMultipleOdds: 5000,
      taxRate: 0.2,
      excludedMarkets: [],
      bonusRules: {
        multipleBonus: { minSelections: 5, bonusPercentage: 0.1 },
        accumulatorBonus: { minSelections: 10, bonusPercentage: 0.15 },
        highOddsBonus: { minOdds: 10, bonusPercentage: 0.05 },
      },
    };

    res.json({ success: true, data: config, timestamp: Date.now() });
  } catch (error: any) {
    console.error('GET /betting-slip/config error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch configuration' });
  }
});

router.get('/stats', requireAdminOrSuperadmin, async (_req: Request, res: Response) => {
  try {
    const stats = bettingSlipService.getStats();
    res.json({ success: true, data: stats, timestamp: Date.now() });
  } catch (error: any) {
    console.error('GET /betting-slip/stats error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch stats' });
  }
});

router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const authUserId = getAuthUserId(req);
    const { userId } = req.params;

    if (userId !== authUserId) {
      return res.status(403).json({ success: false, error: 'Accesso non autorizzato' });
    }

    const slips = bettingSlipService.getUserSlips(authUserId);
    res.json({ success: true, data: slips, count: slips.length, timestamp: Date.now() });
  } catch (error: any) {
    console.error('GET /betting-slip/user error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch user slips' });
  }
});

router.post('/create', async (req: Request, res: Response) => {
  try {
    if (rejectIfPayloadTooLarge(req, res)) return;
    const authUserId = getAuthUserId(req);
    const { type = 'multiple' } = req.body as { type?: 'single' | 'multiple' | 'system' };
    if (!['single', 'multiple', 'system'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Tipo scontrino non valido' });
    }
    const slip = bettingSlipService.createSlip(authUserId, type);

    res.json({ success: true, data: slip, message: 'Betting slip created successfully', timestamp: Date.now() });
  } catch (error: any) {
    console.error('POST /betting-slip/create error:', error);
    handleRouteError(res, error, 'Failed to create betting slip');
  }
});

router.post('/:slipId/add-selection', async (req: Request, res: Response) => {
  try {
    if (rejectIfPayloadTooLarge(req, res)) return;
    const { slipId } = req.params;
    if (!ensureSlipOwner(req, res, slipId)) return;

    const selection = req.body as Record<string, unknown>;
    const matchInfo = selection.matchInfo as Record<string, unknown> | undefined;
    if (
      !isNonEmptyShortString(selection.matchId) ||
      !matchInfo ||
      !isNonEmptyShortString(matchInfo.homeTeam) ||
      !isNonEmptyShortString(matchInfo.awayTeam) ||
      !isNonEmptyShortString(matchInfo.sport) ||
      !isNonEmptyShortString(matchInfo.league) ||
      typeof matchInfo.startTime !== 'number' ||
      !Number.isFinite(matchInfo.startTime) ||
      typeof matchInfo.isLive !== 'boolean' ||
      !isNonEmptyShortString(selection.marketId) ||
      !isNonEmptyShortString(selection.marketName) ||
      !isNonEmptyShortString(selection.outcomeId) ||
      !isNonEmptyShortString(selection.outcomeName) ||
      typeof selection.odds !== 'number' ||
      !Number.isFinite(selection.odds) ||
      selection.odds < 1.01 ||
      selection.odds > 1000 ||
      typeof selection.probability !== 'number' ||
      !Number.isFinite(selection.probability) ||
      typeof selection.margin !== 'number' ||
      !Number.isFinite(selection.margin) ||
      typeof selection.lastUpdated !== 'number' ||
      !Number.isFinite(selection.lastUpdated)
    ) {
      return res.status(400).json({ success: false, error: 'Selezione non valida' });
    }
    const riskLevelRaw = selection.riskLevel;
    const riskLevel: BettingSlipItem['riskLevel'] =
      riskLevelRaw === 'medium' || riskLevelRaw === 'high' || riskLevelRaw === 'critical' ? riskLevelRaw : 'low';

    const normalizedSelection: Omit<BettingSlipItem, 'id' | 'stake' | 'potentialWin' | 'status'> = {
      matchId: selection.matchId as string,
      matchInfo: {
        homeTeam: matchInfo.homeTeam as string,
        awayTeam: matchInfo.awayTeam as string,
        sport: matchInfo.sport as string,
        league: matchInfo.league as string,
        startTime: matchInfo.startTime as number,
        isLive: matchInfo.isLive as boolean,
      },
      marketId: selection.marketId as string,
      marketName: selection.marketName as string,
      outcomeId: selection.outcomeId as string,
      outcomeName: selection.outcomeName as string,
      odds: selection.odds as number,
      probability: selection.probability as number,
      margin: selection.margin as number,
      lastUpdated: selection.lastUpdated as number,
      isLocked: Boolean(selection.isLocked ?? false),
      riskLevel,
    };

    const slipItem = bettingSlipService.addSelection(slipId, normalizedSelection);

    res.json({ success: true, data: slipItem, message: 'Selection added to slip', timestamp: Date.now() });
  } catch (error: any) {
    console.error('POST /betting-slip/add-selection error:', error);
    handleRouteError(res, error, 'Failed to add selection');
  }
});

router.delete('/:slipId/selection/:itemId', async (req: Request, res: Response) => {
  try {
    const { slipId, itemId } = req.params;
    if (!ensureSlipOwner(req, res, slipId)) return;

    const removed = bettingSlipService.removeSelection(slipId, itemId);
    if (!removed) {
      return res.status(404).json({ success: false, error: 'Selection not found' });
    }

    res.json({ success: true, message: 'Selection removed from slip', timestamp: Date.now() });
  } catch (error: any) {
    console.error('DELETE /betting-slip/selection error:', error);
    handleRouteError(res, error, 'Failed to remove selection');
  }
});

router.put('/:slipId/update-stake', async (req: Request, res: Response) => {
  try {
    if (rejectIfPayloadTooLarge(req, res)) return;
    const { slipId } = req.params;
    if (!ensureSlipOwner(req, res, slipId)) return;

    const { totalStake } = req.body as { totalStake: number };
    if (typeof totalStake !== 'number' || !Number.isFinite(totalStake) || totalStake <= 0) {
      return res.status(400).json({ success: false, error: 'totalStake non valido' });
    }
    const updated = bettingSlipService.updateTotalStake(slipId, totalStake);

    if (!updated) {
      return res.status(400).json({ success: false, error: 'Failed to update stake' });
    }

    res.json({ success: true, message: 'Stake updated successfully', timestamp: Date.now() });
  } catch (error: any) {
    console.error('PUT /betting-slip/update-stake error:', error);
    handleRouteError(res, error, 'Failed to update stake');
  }
});

router.put('/:slipId/item-stake', async (req: Request, res: Response) => {
  try {
    if (rejectIfPayloadTooLarge(req, res)) return;
    const { slipId } = req.params;
    if (!ensureSlipOwner(req, res, slipId)) return;

    const { itemId, stake } = req.body as { itemId: string; stake: number };
    if (!isNonEmptyShortString(itemId)) {
      return res.status(400).json({ success: false, error: 'itemId non valido' });
    }
    if (typeof stake !== 'number' || !Number.isFinite(stake) || stake <= 0) {
      return res.status(400).json({ success: false, error: 'stake non valido' });
    }
    const updated = bettingSlipService.updateStake(slipId, itemId, stake);

    if (!updated) {
      return res.status(400).json({ success: false, error: 'Failed to update item stake' });
    }

    res.json({ success: true, message: 'Item stake updated successfully', timestamp: Date.now() });
  } catch (error: any) {
    console.error('PUT /betting-slip/item-stake error:', error);
    handleRouteError(res, error, 'Failed to update item stake');
  }
});

router.post('/:slipId/apply-bonus', async (req: Request, res: Response) => {
  try {
    const { slipId } = req.params;
    if (!ensureSlipOwner(req, res, slipId)) return;

    const slip = bettingSlipService.applyBonus(slipId);
    res.json({ success: true, data: slip, message: 'Bonus applied successfully', timestamp: Date.now() });
  } catch (error: any) {
    console.error('POST /betting-slip/apply-bonus error:', error);
    handleRouteError(res, error, 'Failed to apply bonus');
  }
});

router.post('/:slipId/place-bet', async (req: Request, res: Response) => {
  try {
    const { slipId } = req.params;
    if (!ensureSlipOwner(req, res, slipId)) return;

    const slip = bettingSlipService.placeBet(slipId);
    res.json({ success: true, data: slip, message: 'Bet placed successfully - waiting for confirmation', timestamp: Date.now() });
  } catch (error: any) {
    console.error('POST /betting-slip/place-bet error:', error);
    handleRouteError(res, error, 'Failed to place bet');
  }
});

// Keep legacy path name, but enforce placed->confirmed workflow
router.post('/:slipId/confirm', async (req: Request, res: Response) => {
  try {
    const { slipId } = req.params;
    if (!ensureSlipOwner(req, res, slipId)) return;

    const slip = bettingSlipService.confirmBet(slipId);
    res.json({ success: true, data: slip, message: 'Bet confirmed successfully', timestamp: Date.now() });
  } catch (error: any) {
    console.error('POST /betting-slip/confirm error:', error);
    handleRouteError(res, error, 'Failed to confirm bet');
  }
});

router.get('/:slipId/calculate', async (req: Request, res: Response) => {
  try {
    const { slipId } = req.params;
    if (!ensureSlipOwner(req, res, slipId)) return;

    const calculation = bettingSlipService.calculateSlipDetails(slipId);
    if (!calculation) {
      return res.status(404).json({ success: false, error: 'Betting slip not found' });
    }

    res.json({ success: true, data: calculation, timestamp: Date.now() });
  } catch (error: any) {
    console.error('GET /betting-slip/calculate error:', error);
    handleRouteError(res, error, 'Failed to calculate slip');
  }
});

router.get('/:slipId', async (req: Request, res: Response) => {
  try {
    const { slipId } = req.params;
    if (!ensureSlipOwner(req, res, slipId)) return;

    const slip = bettingSlipService.getSlip(slipId);
    if (!slip) {
      return res.status(404).json({ success: false, error: 'Betting slip not found' });
    }

    res.json({ success: true, data: slip, timestamp: Date.now() });
  } catch (error: any) {
    console.error('GET /betting-slip error:', error);
    handleRouteError(res, error, 'Failed to fetch betting slip');
  }
});

export default router;
