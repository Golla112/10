import { Router, Request, Response } from 'express';
import { getEvents, setEvents, getRedisClient } from '../services/cacheService';
import { getCachedLiveEvents } from '../services/liveService';
import { getLiveOdds, isMarketLocked, getSportMarkets } from '../services/liveOddsScheduler';
import { computeAllLiveMarkets, BaseOdds } from '../services/liveOddsEngine';
import { calculatePrematchOdds } from '../services/prematchOddsEngine';
import { fetchEvents } from '../services/betStackService';
import { BetStackEvent } from '../services/betStackService';
import { requireRoles } from '../middleware/roleAuth';
import { refreshEvents } from '../jobs/eventRefresh';
import {
  fetchSuperbetChampionships,
  fetchLeagueEventsFull,
} from '../services/superbetLeagueService';
import { getSportEvents, getEventsStats } from '../services/eventsIndexService';

const router = Router();
const CACHE_TTL = 600;
const requireAdminOrSuperadmin = requireRoles('admin', 'superadmin');

async function waitForCache(maxWaitMs = 15000): Promise<unknown[] | null> {
  const interval = 1000;
  let waited = 0;
  while (waited < maxWaitMs) {
    const cached = await getEvents();
    if (cached !== null && (cached as unknown[]).length > 0) return cached;
    await new Promise(r => setTimeout(r, interval));
    waited += interval;
  }
  return await getEvents();
}

router.get('/championships', async (_req: Request, res: Response) => {
  try {
    const items = await fetchSuperbetChampionships();
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    return res.json(items);
  } catch (err) {
    console.error('GET /events/championships error:', err);
    return res.json([]);
  }
});

router.get('/league/:championshipId', async (req: Request, res: Response) => {
  const championshipId = Number(req.params.championshipId);
  const discipline = Number(req.query.discipline ?? '1');
  if (!Number.isFinite(championshipId) || championshipId <= 0) {
    return res.status(400).json({ error: 'ID campionato non valido' });
  }
  try {
    const events = await fetchLeagueEventsFull(championshipId, discipline);
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    return res.json(events);
  } catch (err) {
    console.error('GET /events/league error:', err);
    return res.status(502).json({ error: 'Errore caricamento lega' });
  }
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    const cached = await getEvents();
    if (cached !== null && (cached as unknown[]).length > 0) {
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.json(cached);
    }
    refreshEvents().catch(() => {});
    const populated = await waitForCache(30000);
    return res.json(populated ?? []);
  } catch (err) {
    console.error('GET /events error:', err);
    return res.json([]);
  }
});

router.post('/refresh', requireAdminOrSuperadmin, async (_req: Request, res: Response) => {
  try {
    const client = getRedisClient();
    await client.del('events:all');
    const events = await fetchEvents();
    if (events !== null) {
      await setEvents(events, CACHE_TTL);
      return res.json({ ok: true, count: events.length });
    }
    return res.status(502).json({ ok: false, error: 'API unavailable' });
  } catch (err) {
    console.error('POST /events/refresh error:', err);
    return res.status(500).json({ ok: false });
  }
});

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getEventsStats();
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    return res.json(stats);
  } catch (err) {
    console.error('GET /events/stats error:', err);
    return res.json({});
  }
});

router.get('/sport/:sport', async (req: Request, res: Response) => {
  const sport = String(req.params.sport ?? '').toLowerCase();
  if (!sport) return res.status(400).json({ error: 'Sport non valido' });
  try {
    const { events, meta } = await getSportEvents(sport);
    res.setHeader('Cache-Control', 'public, max-age=45, stale-while-revalidate=120');
    return res.json({ events, meta });
  } catch (err) {
    console.error('GET /events/sport error:', err);
    return res.status(502).json({ error: 'Errore caricamento sport' });
  }
});

router.get('/live', async (_req: Request, res: Response) => {
  try {
    const liveEvents = getCachedLiveEvents();
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    return res.json(liveEvents);
  } catch (err) {
    console.error('GET /events/live error:', err);
    return res.json([]);
  }
});

// GET /events/:id — cerca un singolo evento per ID (prematch o live)
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // 1. Cerca nella cache prematch
    const prematch = await getEvents() as Array<{ id: string }> | null;
    if (prematch) {
      const found = prematch.find(e => e.id === id) as BetStackEvent | undefined;
      if (found) {
        // Se l'evento non ha quote reali, calcola on-demand
        const hasOdds = (found.bookmakers ?? []).some(bk =>
          bk.markets?.some(m => m.key === 'h2h' && (m.outcomes ?? []).some(o => o.price > 1))
        );
        if (!hasOdds) {
          try {
            const enriched = await calculatePrematchOdds(found);
            return res.json(enriched);
          } catch {
            return res.json(found);
          }
        }
        return res.json(found);
      }
    }
    // 2. Cerca nella cache live in-memory
    const liveEvents = getCachedLiveEvents() as Array<{ id: string }>;
    console.log(`[events/:id] id=${id} prematch=${prematch?.length ?? 0} live=${liveEvents.length}`);
    const liveFound = liveEvents.find(e => e.id === id);
    if (liveFound) {
      const liveFoundAny = liveFound as unknown as { id: string; home: { name: string }; away: { name: string }; score?: { home: number; away: number }; minute?: number };
      let schedulerOdds = getLiveOdds(id);
      const locked = isMarketLocked(id);

      // Se lo scheduler non ha ancora calcolato, calcola on-demand
      if (!schedulerOdds) {
        try {
          const score = liveFoundAny.score ?? { home: 0, away: 0 };
          const sportCat = (liveFound as unknown as { sport_category?: string }).sport_category ?? 'soccer';
          const minute = liveFoundAny.minute ?? (sportCat === 'hockey' ? 30 : 45);
          // Stima quote base dal nome squadra
          function hashStr(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return Math.abs(h); }
          const hv = hashStr(liveFoundAny.home.name + liveFoundAny.away.name);
          const pH = 0.30 + (hv % 1000) / 4000;
          const pD = 0.22 + ((hv >> 4) % 500) / 5000;
          const pA = Math.max(0.05, 1 - pH - pD);
          const tot = pH + pD + pA;
          const m = 0.08;
          const base: BaseOdds = {
            home: parseFloat(((1 + m) / (pH / tot)).toFixed(2)),
            draw: parseFloat(((1 + m) / (pD / tot)).toFixed(2)),
            away: parseFloat(((1 + m) / (pA / tot)).toFixed(2)),
          };
          schedulerOdds = computeAllLiveMarkets({ base, homeScore: score.home ?? 0, awayScore: score.away ?? 0, minute, sport: sportCat, isExtraTime: sportCat === 'hockey' ? minute > 60 : minute > 90 });
        } catch { /* usa null */ }
      }

      if (schedulerOdds) {
        const enriched = {
          ...liveFound,
          locked,
          bookmakers: [{
            key: 'live_engine',
            title: 'Live Engine',
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: liveFoundAny.home.name, price: schedulerOdds.h2h.home ?? 0 },
                  { name: 'Draw', price: schedulerOdds.h2h.draw ?? 0 },
                  { name: liveFoundAny.away.name, price: schedulerOdds.h2h.away ?? 0 },
                ].filter(o => o.price > 1),
              },
              ...(schedulerOdds.over_under ? [{
                key: 'totals',
                outcomes: [
                  { name: 'Over', point: 2.5, price: schedulerOdds.over_under.over25 ?? 0 },
                  { name: 'Under', point: 2.5, price: schedulerOdds.over_under.under25 ?? 0 },
                ].filter(o => o.price > 1),
              }] : []),
            ],
          }],
          _liveMarkets: schedulerOdds,
          _sportMarkets: getSportMarkets(id),
        };
        return res.json(enriched);
      }
      return res.json(liveFound);
    }

    return res.status(404).json({ error: 'Evento non trovato.' });
  } catch (err) {
    console.error(`GET /events/${id} error:`, err);
    return res.status(500).json({ error: 'Errore interno.' });
  }
});

export default router;
