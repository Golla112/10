import { Router, Request, Response } from 'express';
import { getOdds, setOdds } from '../services/cacheService';
import freeSportsService, { FreeSportsEvent } from '../services/freeSportsApiService_simple';

const router = Router();

// Cache TTL settings
const FREE_CACHE_TTL = 300; // 5 minuti per API gratuite

// ── Rotte Eventi ────────────────────────────────────────────────────────

/**
 * GET /api/free-sports/events
 * Ottieni tutti gli eventi
 */
router.get('/events', async (_req: Request, res: Response) => {
  try {
    const events = await freeSportsService.getAllEvents();
    res.json({
      success: true,
      data: events,
      count: events.length,
      source: 'free-apis'
    });
  } catch (error) {
    console.error('GET /free-sports/events error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch events'
    });
  }
});

/**
 * GET /api/free-sports/events/live
 * Ottieni eventi live
 */
router.get('/events/live', async (_req: Request, res: Response) => {
  try {
    const events = await freeSportsService.getLiveEvents();
    res.json({
      success: true,
      data: events,
      count: events.length,
      type: 'live',
      source: 'free-apis'
    });
  } catch (error) {
    console.error('GET /free-sports/events/live error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch live events'
    });
  }
});

/**
 * GET /api/free-sports/events/prematch
 * Ottieni eventi prematch
 */
router.get('/events/prematch', async (_req: Request, res: Response) => {
  try {
    const events = await freeSportsService.getPrematchEvents();
    res.json({
      success: true,
      data: events,
      count: events.length,
      type: 'prematch',
      source: 'free-apis'
    });
  } catch (error) {
    console.error('GET /free-sports/events/prematch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prematch events'
    });
  }
});

/**
 * GET /api/free-sports/events/:sport
 * Ottieni eventi per sport specifico
 */
router.get('/events/:sport', async (req: Request, res: Response) => {
  const { sport } = req.params;

  try {
    const events = await freeSportsService.getEventsBySport(sport);
    res.json({
      success: true,
      data: events,
      sport,
      count: events.length,
      source: 'free-apis'
    });
  } catch (error) {
    console.error(`GET /free-sports/events/${sport} error:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch events by sport'
    });
  }
});

// ── Rotte Quote ──────────────────────────────────────────────────────────

/**
 * GET /api/free-sports/odds/:eventId
 * Ottieni quote per evento specifico
 */
router.get('/odds/:eventId', async (req: Request, res: Response) => {
  const { eventId } = req.params;

  try {
    // Check cache first
    const cacheKey = `free-sports:odds:${eventId}`;
    const cached = await getOdds(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
        eventId,
        source: 'free-apis-simulated'
      });
    }

    // Fetch from service
    const odds = await freeSportsService.getEventOdds(eventId);
    
    if (!odds) {
      return res.json({
        success: false,
        error: 'No odds found for this event',
        eventId
      });
    }

    // Cache the results
    await setOdds(cacheKey, odds, FREE_CACHE_TTL);

    res.json({
      success: true,
      data: odds,
      cached: false,
      eventId,
      source: 'free-apis-simulated',
      note: 'Quote simulate basate su algoritmo euristico'
    });
  } catch (error) {
    console.error(`GET /free-sports/odds/${eventId} error:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch event odds'
    });
  }
});

/**
 * GET /api/free-sports/odds/live/:sport?
 * Ottieni quote live per sport
 */
router.get('/odds/live/:sport?', async (req: Request, res: Response) => {
  const { sport } = req.params;

  try {
    const events = await freeSportsService.getEventsBySport(sport || 'soccer');
    const liveEvents = events.filter((event: FreeSportsEvent) => event.status === 'live');
    
    const oddsData = liveEvents.map((event: FreeSportsEvent) => ({
      eventId: event.id,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
      odds: event.odds
    }));

    res.json({
      success: true,
      data: oddsData,
      sport: sport || 'soccer',
      type: 'live',
      count: oddsData.length,
      source: 'free-apis-simulated'
    });
  } catch (error) {
    console.error(`GET /free-sports/odds/live/${sport || 'all'} error:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch live odds'
    });
  }
});

/**
 * GET /api/free-sports/odds/prematch/:sport
 * Ottieni quote prematch per sport
 */
router.get('/odds/prematch/:sport', async (req: Request, res: Response) => {
  const { sport } = req.params;

  try {
    const events = await freeSportsService.getEventsBySport(sport || 'soccer');
    const prematchEvents = events.filter((event: FreeSportsEvent) => event.status === 'prematch');
    
    const oddsData = prematchEvents.map((event: FreeSportsEvent) => ({
      eventId: event.id,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
      odds: event.odds
    }));

    res.json({
      success: true,
      data: oddsData,
      sport: sport || 'soccer',
      type: 'prematch',
      count: oddsData.length,
      source: 'free-apis-simulated'
    });
  } catch (error) {
    console.error(`GET /free-sports/odds/prematch/${sport || 'all'} error:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prematch odds'
    });
  }
});

// ── Rotte Statistiche ───────────────────────────────────────────────────────

/**
 * GET /api/free-sports/stats
 * Statistiche del servizio
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = freeSportsService.getStats();
    
    res.json({
      success: true,
      data: stats,
      sources: [
        {
          name: 'API-Football',
          type: 'football',
          cost: 'Free (100 requests/day)',
          features: ['Live scores', 'Fixtures', 'Standings']
        },
        {
          name: 'TheSportsDB',
          type: 'multi-sport',
          cost: 'Free',
          features: ['Events', 'Teams', 'Leagues']
        }
      ],
      limitations: [
        'Quote simulate (non reali)',
        'Rate limits delle API gratuite',
        'Copertura limitata rispetto a servizi a pagamento'
      ],
      advantages: [
        'Completamente gratuito',
        'WebSocket per aggiornamenti real-time',
        'Nessuna API key richiesta',
        'Multi-sport support'
      ]
    });
  } catch (error) {
    console.error('GET /free-sports/stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stats'
    });
  }
});

// ── Rotte Health Check ───────────────────────────────────────────────────────────

/**
 * GET /api/free-sports/health
 * Health check per API gratuite
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const events = await freeSportsService.getAllEvents();
    const stats = freeSportsService.getStats();
    const isHealthy = events.length > 0 && stats.connectedClients >= 0;
    
    res.json({
      success: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      sources: ['API-Football', 'TheSportsDB'],
      eventsCount: events.length,
      websocket: {
        running: true,
        clients: stats.connectedClients
      },
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

export default router;
