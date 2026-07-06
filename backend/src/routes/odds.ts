import { Router, Request, Response } from 'express';
import { getOdds, setOdds } from '../services/cacheService';
import { fetchOdds } from '../services/betStackService';

const router = Router();
const CACHE_TTL = 600; // 10 minutes (within 5–15 min bounds)

router.get('/:eventId', async (req: Request, res: Response) => {
  const { eventId } = req.params;

  try {
    // Try cache first
    const cached = await getOdds(eventId);
    if (cached !== null) {
      return res.json(cached);
    }

    // Cache miss — fetch from BetStack
    const odds = await fetchOdds(eventId);
    if (odds !== null) {
      await setOdds(eventId, odds, CACHE_TTL);
      return res.json(odds);
    }

    // BetStack failed — try stale cache
    const stale = await getOdds(eventId);
    if (stale !== null) {
      return res.json(stale);
    }

    // No data available — return empty object per Req 3.4
    return res.json({});
  } catch (err) {
    console.error(`GET /odds/${eventId} error:`, err);
    return res.json({});
  }
});

export default router;
