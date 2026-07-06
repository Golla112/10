import { Router, Request, Response } from 'express';
import { sportBettingService } from '../services/sportBettingApiService';
import { getOdds, setOdds } from '../services/cacheService';

const router = Router();

// Cache TTL settings
const PREMATCH_CACHE_TTL = 600; // 10 minuti
const LIVE_CACHE_TTL = 30; // 30 secondi per quote live
const EVENTS_CACHE_TTL = 300; // 5 minuti per eventi

// ── Rotte Sport ────────────────────────────────────────────────────────────────

/**
 * GET /api/sport-betting/sports
 * Ottieni tutti gli sport disponibili
 */
router.get('/sports', async (_req: Request, res: Response) => {
  try {
    const sports = await sportBettingService.getSports();
    res.json({
      success: true,
      data: sports,
      count: sports.length
    });
  } catch (error) {
    console.error('GET /sport-betting/sports error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sports'
    });
  }
});

/**
 * GET /api/sport-betting/sports/:sportId/markets
 * Ottieni tutti i mercati disponibili per uno sport
 */
router.get('/sports/:sportId/markets', async (req: Request, res: Response) => {
  const { sportId } = req.params;

  try {
    const markets = await sportBettingService.getSportMarkets(sportId);
    res.json({
      success: true,
      data: markets,
      sport: sportId,
      count: markets.length
    });
  } catch (error) {
    console.error(`GET /sport-betting/sports/${sportId}/markets error:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch markets'
    });
  }
});

// ── Rotte Eventi ────────────────────────────────────────────────────────────────

/**
 * GET /api/sport-betting/events/prematch/:sportId
 * Ottieni eventi prematch per uno sport
 */
router.get('/events/prematch/:sportId', async (req: Request, res: Response) => {
  const { sportId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;

  try {
    const events = await sportBettingService.getPrematchEvents(sportId, limit);
    const convertedEvents = events.map(event => 
      sportBettingService.convertToBetStackEvent(event)
    );

    res.json({
      success: true,
      data: convertedEvents,
      sport: sportId,
      type: 'prematch',
      count: convertedEvents.length
    });
  } catch (error) {
    console.error(`GET /sport-betting/events/prematch/${sportId} error:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prematch events'
    });
  }
});

/**
 * GET /api/sport-betting/events/live/:sportId?
 * Ottieni eventi live (opzionalmente filtrati per sport)
 */
router.get('/events/live/:sportId?', async (req: Request, res: Response) => {
  const { sportId } = req.params;

  try {
    const events = await sportBettingService.getLiveEvents(sportId);
    const convertedEvents = events.map(event => 
      sportBettingService.convertToBetStackEvent(event)
    );

    res.json({
      success: true,
      data: convertedEvents,
      sport: sportId || 'all',
      type: 'live',
      count: convertedEvents.length
    });
  } catch (error) {
    console.error(`GET /sport-betting/events/live/${sportId || ''} error:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch live events'
    });
  }
});

// ── Rotte Quote ─────────────────────────────────────────────────────────────────

/**
 * GET /api/sport-betting/odds/prematch/:sportId
 * Ottieni quote prematch per uno sport
 */
router.get('/odds/prematch/:sportId', async (req: Request, res: Response) => {
  const { sportId } = req.params;
  const markets = req.query.markets ? (req.query.markets as string).split(',') : ['h2h'];

  try {
    // Check cache first
    const cacheKey = `sport-betting:prematch:${sportId}:${markets.join(',')}`;
    const cached = await getOdds(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
        sport: sportId,
        markets
      });
    }

    // Fetch from API
    const odds = await sportBettingService.getPrematchOdds(sportId, markets);
    const convertedOdds = odds.map(odd => 
      sportBettingService.convertToBetStackOdds(odd)
    );

    // Cache the results
    await setOdds(cacheKey, convertedOdds, PREMATCH_CACHE_TTL);

    res.json({
      success: true,
      data: convertedOdds,
      cached: false,
      sport: sportId,
      markets,
      count: convertedOdds.length
    });
  } catch (error) {
    console.error(`GET /sport-betting/odds/prematch/${sportId} error:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prematch odds'
    });
  }
});

/**
 * GET /api/sport-betting/odds/live/:sportId?
 * Ottieni quote live (opzionalmente filtrate per sport)
 */
router.get('/odds/live/:sportId?', async (req: Request, res: Response) => {
  const { sportId } = req.params;

  try {
    // Check cache first (con TTL molto breve per quote live)
    const cacheKey = `sport-betting:live:${sportId || 'all'}`;
    const cached = await getOdds(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
        sport: sportId || 'all',
        type: 'live'
      });
    }

    // Fetch from API
    const odds = await sportBettingService.getLiveOdds(sportId);
    const convertedOdds = odds.map(odd => 
      sportBettingService.convertToBetStackOdds(odd)
    );

    // Cache con TTL breve
    await setOdds(cacheKey, convertedOdds, LIVE_CACHE_TTL);

    res.json({
      success: true,
      data: convertedOdds,
      cached: false,
      sport: sportId || 'all',
      type: 'live',
      count: convertedOdds.length
    });
  } catch (error) {
    console.error(`GET /sport-betting/odds/live/${sportId || ''} error:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch live odds'
    });
  }
});

/**
 * GET /api/sport-betting/odds/event/:eventId
 * Ottieni quote per un evento specifico
 */
router.get('/odds/event/:eventId', async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const markets = req.query.markets ? (req.query.markets as string).split(',') : undefined;

  try {
    // Check cache first
    const cacheKey = `sport-betting:event:${eventId}:${markets?.join(',') || 'all'}`;
    const cached = await getOdds(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
        eventId
      });
    }

    let odds;
    if (markets) {
      odds = await sportBettingService.getMarketsOdds(eventId, markets);
    } else {
      odds = await sportBettingService.getEventOdds(eventId);
    }

    if (!odds) {
      return res.json({
        success: false,
        error: 'No odds found for this event',
        eventId
      });
    }

    const convertedOdds = sportBettingService.convertToBetStackOdds(odds);

    // Cache con TTL appropriato basato sul tipo di evento
    const isLive = await sportBettingService.getLiveEvents();
    const eventIsLive = isLive.some(e => e.id === eventId);
    const ttl = eventIsLive ? LIVE_CACHE_TTL : PREMATCH_CACHE_TTL;

    await setOdds(cacheKey, convertedOdds, ttl);

    res.json({
      success: true,
      data: convertedOdds,
      cached: false,
      eventId,
      live: eventIsLive
    });
  } catch (error) {
    console.error(`GET /sport-betting/odds/event/${eventId} error:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch event odds'
    });
  }
});

// ── Rotte Mercati Specializzati ───────────────────────────────────────────────────

/**
 * GET /api/sport-betting/odds/h2h/:sportId
 * Quote Head-to-Head (1X2)
 */
router.get('/odds/h2h/:sportId', async (req: Request, res: Response) => {
  const { sportId } = req.params;

  try {
    const cacheKey = `sport-betting:h2h:${sportId}`;
    const cached = await getOdds(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
        market: 'h2h',
        sport: sportId
      });
    }

    const odds = await sportBettingService.getPrematchOdds(sportId, ['h2h']);
    const convertedOdds = odds.map(odd => 
      sportBettingService.convertToBetStackOdds(odd)
    );

    await setOdds(cacheKey, convertedOdds, PREMATCH_CACHE_TTL);

    res.json({
      success: true,
      data: convertedOdds,
      cached: false,
      market: 'h2h',
      sport: sportId,
      count: convertedOdds.length
    });
  } catch (error) {
    console.error(`GET /sport-betting/odds/h2h/${sportId} error:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch H2H odds'
    });
  }
});

/**
 * GET /api/sport-betting/odds/spreads/:sportId
 * Quote Handicap/Spreads
 */
router.get('/odds/spreads/:sportId', async (req: Request, res: Response) => {
  const { sportId } = req.params;

  try {
    const odds = await sportBettingService.getPrematchOdds(sportId, ['spreads']);
    const convertedOdds = odds.map(odd => 
      sportBettingService.convertToBetStackOdds(odd)
    );

    res.json({
      success: true,
      data: convertedOdds,
      market: 'spreads',
      sport: sportId,
      count: convertedOdds.length
    });
  } catch (error) {
    console.error(`GET /sport-betting/odds/spreads/${sportId} error:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch spreads odds'
    });
  }
});

/**
 * GET /api/sport-betting/odds/totals/:sportId
 * Quote Over/Under
 */
router.get('/odds/totals/:sportId', async (req: Request, res: Response) => {
  const { sportId } = req.params;

  try {
    const odds = await sportBettingService.getPrematchOdds(sportId, ['totals']);
    const convertedOdds = odds.map(odd => 
      sportBettingService.convertToBetStackOdds(odd)
    );

    res.json({
      success: true,
      data: convertedOdds,
      market: 'totals',
      sport: sportId,
      count: convertedOdds.length
    });
  } catch (error) {
    console.error(`GET /sport-betting/odds/totals/${sportId} error:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch totals odds'
    });
  }
});

// ── Rotte Utilità ───────────────────────────────────────────────────────────────

/**
 * GET /api/sport-betting/health
 * Health check per Sport-Betting-API
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const sports = await sportBettingService.getSports();
    const isHealthy = sports.length > 0;

    res.json({
      success: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      sportsCount: sports.length,
      timestamp: Date.now()
    });
  } catch (error) {
    res.json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    });
  }
});

/**
 * GET /api/sport-betting/markets/:eventId/check
 * Verifica se un mercato è disponibile per un evento
 */
router.get('/markets/:eventId/check/:marketKey', async (req: Request, res: Response) => {
  const { eventId, marketKey } = req.params;

  try {
    const isAvailable = await sportBettingService.isMarketAvailable(eventId, marketKey);
    
    res.json({
      success: true,
      data: {
        eventId,
        marketKey,
        available: isAvailable
      }
    });
  } catch (error) {
    console.error(`GET /sport-betting/markets/${eventId}/check/${marketKey} error:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to check market availability'
    });
  }
});

export default router;
