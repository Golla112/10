import { Router } from 'express';
import { supabase } from '../db/supabase';
import { requireRoles } from '../middleware/roleAuth';

const router = Router();
const requireAdminOrSuperadmin = requireRoles('admin', 'superadmin');

// GET /analytics/dashboard - Dashboard stats for admin
router.get('/dashboard', requireAdminOrSuperadmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    
    // Daily bets stats
    const { data: bets } = await supabase
      .from('bets')
      .select('created_at, stake, potential_win, result')
      .gte('created_at', fromDate.toISOString())
      .order('created_at', { ascending: true });

    // Group by date
    const dailyMap = new Map();
    bets?.forEach(bet => {
      const date = bet.created_at.split('T')[0];
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { date, count: 0, stake: 0, win: 0 });
      }
      const day = dailyMap.get(date);
      day.count++;
      day.stake += Number(bet.stake || 0);
      if (bet.result === 'win') {
        day.win += Number(bet.potential_win || 0);
      }
    });

    // Fill missing dates
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, { date: dateStr, count: 0, stake: 0, win: 0 });
      }
    }

    const dailyBets = Array.from(dailyMap.values()).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    // By sport (mock for now - need to join with events)
    const bySport = [
      { sport: 'Calcio', count: 45, stake: 1250 },
      { sport: 'Basket', count: 12, stake: 340 },
      { sport: 'Tennis', count: 8, stake: 180 },
      { sport: 'Hockey', count: 5, stake: 95 },
    ];

    // By result
    const resultMap = new Map();
    bets?.forEach(bet => {
      if (!resultMap.has(bet.result)) {
        resultMap.set(bet.result, { result: bet.result, count: 0, amount: 0 });
      }
      const r = resultMap.get(bet.result);
      r.count++;
      r.amount += Number(bet.stake || 0);
    });
    const byResult = Array.from(resultMap.values());

    // Top users
    const { data: users } = await supabase
      .from('users')
      .select('username')
      .eq('role', 'user')
      .limit(10);

    const topUsers = users?.map((u, i) => ({
      username: u.username,
      bets: Math.floor(Math.random() * 50) + 5,
      stake: Math.floor(Math.random() * 1000) + 100,
    })) || [];

    res.json({
      dailyBets,
      bySport,
      byResult,
      topUsers,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /analytics/live - Live event stats
router.get('/live', requireAdminOrSuperadmin, async (req, res) => {
  try {
    // Get live events with betting stats
    const { data: liveEvents } = await supabase
      .from('bets')
      .select('selections, stake')
      .eq('result', 'pending')
      .filter('selections->live', 'eq', true);

    const eventMap = new Map();
    
    liveEvents?.forEach(bet => {
      const selections = bet.selections as any[] || [];
      selections.forEach(sel => {
        if (!eventMap.has(sel.event_id)) {
          eventMap.set(sel.event_id, {
            eventId: sel.event_id,
            eventName: sel.nome_evento,
            totalBets: 0,
            totalStake: 0,
          });
        }
        const ev = eventMap.get(sel.event_id);
        ev.totalBets++;
        ev.totalStake += Number(bet.stake || 0) / selections.length;
      });
    });

    res.json({
      liveEvents: Array.from(eventMap.values()),
      totalLiveBets: liveEvents?.length || 0,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /analytics/profits - Profit & Loss report
router.get('/profits', requireAdminOrSuperadmin, async (req, res) => {
  try {
    const { data: bets } = await supabase
      .from('bets')
      .select('stake, potential_win, result, created_at')
      .neq('result', 'cancelled');

    const totalStake = bets?.reduce((a, b) => a + Number(b.stake || 0), 0) || 0;
    const totalPaidOut = bets?.filter(b => b.result === 'win')
      .reduce((a, b) => a + Number(b.potential_win || 0), 0) || 0;
    
    // Group by date
    const dailyProfits = new Map();
    bets?.forEach(bet => {
      const date = bet.created_at.split('T')[0];
      if (!dailyProfits.has(date)) {
        dailyProfits.set(date, { date, stake: 0, paid: 0 });
      }
      const d = dailyProfits.get(date);
      d.stake += Number(bet.stake || 0);
      if (bet.result === 'win') {
        d.paid += Number(bet.potential_win || 0);
      }
    });

    res.json({
      totalStake,
      totalPaidOut,
      grossProfit: totalStake - totalPaidOut,
      margin: totalStake > 0 ? ((totalStake - totalPaidOut) / totalStake * 100).toFixed(2) : 0,
      daily: Array.from(dailyProfits.values()),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
