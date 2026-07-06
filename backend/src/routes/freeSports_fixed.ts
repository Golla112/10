import { Router, Request, Response } from 'express';
import { getOdds, setOdds } from '../services/cacheService';

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
    // Dati mock senza dipendenze esterne
    const mockEvents: any[] = [
      {
        id: '1',
        sport: 'soccer',
        league: 'Serie A',
        homeTeam: 'Milan',
        awayTeam: 'Inter',
        startTime: Date.now(),
        status: 'prematch',
        score: null,
        odds: {
          h2h: { home: 2.10, draw: 3.40, away: 3.60 },
          overUnder: { over25: 1.85, under25: 1.95 }
        }
      },
      {
        id: '2',
        sport: 'soccer',
        league: 'Premier League',
        homeTeam: 'Manchester City',
        awayTeam: 'Liverpool',
        startTime: Date.now() + 3600000,
        status: 'live',
        score: { home: 2, away: 1 },
        minute: 67,
        odds: {
          h2h: { home: 1.85, draw: 3.60, away: 4.20 },
          overUnder: { over25: 1.85, under25: 1.95 }
        }
      }
    ];

    res.json({
      success: true,
      data: mockEvents,
      count: mockEvents.length,
      source: 'free-apis-mock'
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
    const mockLiveEvents = [
      {
        id: '3',
        sport: 'soccer',
        league: 'Champions League',
        homeTeam: 'Real Madrid',
        awayTeam: 'Bayern Munich',
        startTime: Date.now() - 7200000,
        status: 'live',
        score: { home: 1, away: 0 },
        minute: 45,
        odds: {
          h2h: { home: 1.95, draw: 3.50, away: 4.10 },
          overUnder: { over25: 1.80, under25: 2.00 }
        }
      }
    ];

    res.json({
      success: true,
      data: mockLiveEvents,
      count: mockLiveEvents.length,
      type: 'live',
      source: 'free-apis-mock'
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
    const mockPrematchEvents = [
      {
        id: '4',
        sport: 'soccer',
        league: 'La Liga',
        homeTeam: 'Barcelona',
        awayTeam: 'Real Madrid',
        startTime: Date.now() + 86400000,
        status: 'prematch',
        odds: {
          h2h: { home: 2.05, draw: 3.30, away: 3.80 },
          overUnder: { over25: 1.90, under25: 1.85 }
        }
      },
      {
        id: '5',
        sport: 'basketball',
        league: 'EuroLeague',
        homeTeam: 'Olimpia Milano',
        awayTeam: 'Virtus Bologna',
        startTime: Date.now() + 7200000,
        status: 'prematch',
        odds: {
          h2h: { home: 1.75, draw: 3.40, away: 4.80 },
          overUnder: { over25: 2.10, under25: 1.70 }
        }
      }
    ];

    res.json({
      success: true,
      data: mockPrematchEvents,
      count: mockPrematchEvents.length,
      type: 'prematch',
      source: 'free-apis-mock'
    });
  } catch (error) {
    console.error('GET /free-sports/events/prematch error:', error);
    res.status(500).json({
      success: false,
      error: 'failed to fetch prematch events'
    });
  }
});

/**
 * GET /api/free-sports/odds/:eventId
 * Ottieni quote per evento specifico
 */
router.get('/odds/:eventId', async (req: Request, res: Response) => {
  const { eventId } = req.params;

  try {
    // Mock odds deterministiche
    const mockOdds = {
      h2h: { home: 2.15, draw: 3.40, away: 3.60 },
      overUnder: { over25: 1.85, under25: 1.95 }
    };

    res.json({
      success: true,
      data: mockOdds,
      eventId,
      source: 'free-apis-mock-deterministic'
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
 * GET /api/free-sports/stats
 * Statistiche del servizio
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = {
      totalEvents: 5,
      liveEvents: 2,
      connectedClients: 0,
      websocketPort: 4002,
      uptime: Math.floor(process.uptime()),
      lastUpdate: Date.now()
    };

    res.json({
      success: true,
      data: stats,
      source: 'free-apis-mock'
    });
  } catch (error) {
    console.error('GET /free-sports/stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stats'
    });
  }
});

/**
 * GET /api/free-sports/health
 * Health check del servizio
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      status: 'healthy',
      message: 'Free Sports API working with mock data',
      timestamp: Date.now()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: message
    });
  }
});

export default router;
