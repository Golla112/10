import { Router, Request, Response } from 'express';
import { supabase } from '../db/supabase';
import { requireRoles } from '../middleware/roleAuth';

const router = Router();
const requireAdminOrSuperadmin = requireRoles('admin', 'superadmin');

interface BetRow {
  result: 'pending' | 'win' | 'lose';
  stake: number;
  potential_win: number;
  created_at: string;
}

function computePL(bets: BetRow[]): number {
  return bets.reduce((acc, bet) => {
    if (bet.result === 'win') {
      return acc + (bet.potential_win - bet.stake);
    } else if (bet.result === 'lose') {
      return acc - bet.stake;
    }
    return acc;
  }, 0);
}

function startOf(unit: 'day' | 'week' | 'month' | 'year'): Date {
  const now = new Date();
  switch (unit) {
    case 'day': {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'week': {
      const d = new Date(now);
      const day = d.getDay(); // 0 = Sunday
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'month': {
      return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }
    case 'year': {
      return new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    }
  }
}

router.get('/', requireAdminOrSuperadmin, async (_req: Request, res: Response) => {
  try {
    // Fetch all settled bets (win or lose) for the current year (widest window needed)
    const yearStart = startOf('year');

    const { data, error } = await supabase
      .from('bets')
      .select('result, stake, potential_win, created_at')
      .in('result', ['win', 'lose'])
      .gte('created_at', yearStart.toISOString());

    if (error) {
      console.error('GET /profit-loss DB error:', error);
      return res.status(500).json({ error: 'Failed to retrieve profit/loss data.' });
    }

    const bets: BetRow[] = (data ?? []) as BetRow[];

    const dayStart = startOf('day');
    const weekStart = startOf('week');
    const monthStart = startOf('month');

    const daily = computePL(bets.filter((b) => new Date(b.created_at) >= dayStart));
    const weekly = computePL(bets.filter((b) => new Date(b.created_at) >= weekStart));
    const monthly = computePL(bets.filter((b) => new Date(b.created_at) >= monthStart));
    const yearly = computePL(bets);

    return res.json({
      daily: Math.round(daily * 100) / 100,
      weekly: Math.round(weekly * 100) / 100,
      monthly: Math.round(monthly * 100) / 100,
      yearly: Math.round(yearly * 100) / 100,
    });
  } catch (err) {
    console.error('GET /profit-loss error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
