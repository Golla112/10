import { Router, Request, Response } from 'express';
import advancedBettingEngine from '../services/advancedBettingEngine';

const router = Router();

// ── Rotte Advanced Betting ────────────────────────────────────────────────────────

/**
 * GET /api/advanced-betting/live-matches
 * Ottieni tutti i match live con mercati e quote
 */
router.get('/live-matches', async (_req: Request, res: Response) => {
  try {
    const liveMatches = advancedBettingEngine.getLiveMatches();
    
    res.json({
      success: true,
      data: liveMatches,
      count: liveMatches.length,
      timestamp: Date.now(),
      source: 'advanced-betting-engine'
    });
  } catch (error) {
    console.error('GET /advanced-betting/live-matches error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch live matches'
    });
  }
});

/**
 * GET /api/advanced-betting/match/:matchId
 * Ottieni dettagli match specifico
 */
router.get('/match/:matchId', async (req: Request, res: Response) => {
  const { matchId } = req.params;

  try {
    const markets = advancedBettingEngine.getMatchMarkets(matchId);
    
    if (!markets) {
      return res.status(404).json({
        success: false,
        error: 'Match not found'
      });
    }

    res.json({
      success: true,
      data: {
        matchId,
        markets: Array.from(markets.values()),
        totalMarkets: markets.size
      },
      timestamp: Date.now(),
      source: 'advanced-betting-engine'
    });
  } catch (error) {
    console.error(`GET /advanced-betting/match/${matchId} error:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch match details'
    });
  }
});

/**
 * GET /api/advanced-betting/match/:matchId/market/:marketId
 * Ottieni quote per mercato specifico
 */
router.get('/match/:matchId/market/:marketId', async (req: Request, res: Response) => {
  const { matchId, marketId } = req.params;

  try {
    const market = advancedBettingEngine.getMarketOdds(matchId, marketId);
    
    if (!market) {
      return res.status(404).json({
        success: false,
        error: 'Market not found'
      });
    }

    res.json({
      success: true,
      data: market,
      timestamp: Date.now(),
      source: 'advanced-betting-engine'
    });
  } catch (error) {
    console.error(`GET /advanced-betting/match/${matchId}/market/${marketId} error:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market odds'
    });
  }
});

/**
 * GET /api/advanced-betting/markets
 * Ottieni lista di tutti i mercati disponibili
 */
router.get('/markets', async (_req: Request, res: Response) => {
  try {
    // Importiamo i mercati dal motore
    const { BETTING_MARKETS } = await import('../services/advancedBettingEngine');
    
    const allMarkets: Array<{
      sport: string;
      category: string;
      marketId: string;
      marketName: string;
      marketType: string;
      description: string;
    }> = [];
    
    // Conta tutti i mercati per ogni sport
    Object.entries(BETTING_MARKETS as any).forEach(([sport, categories]) => {
      Object.entries(categories as any).forEach(([category, markets]) => {
        (markets as any[]).forEach((market: any) => {
          allMarkets.push({
            sport,
            category,
            marketId: market.id,
            marketName: market.name,
            marketType: market.type,
            description: `${sport.toUpperCase()} - ${category} - ${market.name}`
          });
        });
      });
    });

    res.json({
      success: true,
      data: allMarkets,
      count: allMarkets.length,
      source: 'advanced-betting-engine'
    });
  } catch (error: any) {
    console.error('GET /advanced-betting/markets error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch markets'
    });
  }
});

/**
 * GET /api/advanced-betting/health
 * Health check del sistema
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const stats = advancedBettingEngine.getStats();
    
    res.json({
      success: true,
      status: 'healthy',
      data: stats,
      message: 'Advanced Betting Engine running - GoldBet level system',
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error('GET /advanced-betting/health error:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * GET /api/advanced-betting/stats
 * Statistiche dettagliate del sistema
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = advancedBettingEngine.getStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: Date.now(),
      source: 'advanced-betting-engine'
    });
  } catch (error) {
    console.error('GET /advanced-betting/stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stats'
    });
  }
});

export default router;
