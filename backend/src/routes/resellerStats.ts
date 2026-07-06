import { Router } from 'express';
import { supabase } from '../db/supabase';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /reseller/stats - Get reseller dashboard stats
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const resellerId = req.authUserId;
    
    // Get reseller info
    const { data: reseller } = await supabase
      .from('users')
      .select('balance, username')
      .eq('id', resellerId)
      .single();

    if (!reseller) {
      return res.status(404).json({ error: 'Reseller not found' });
    }

    // Get users under this reseller
    const { data: users } = await supabase
      .from('users')
      .select('id, username, balance, is_blocked, created_at')
      .eq('reseller_id', resellerId)
      .eq('role', 'user');

    const totalUsers = users?.length || 0;
    const activeUsers = users?.filter(u => !u.is_blocked).length || 0;
    const totalBalance = users?.reduce((a, u) => a + Number(u.balance || 0), 0) || 0;

    // Get monthly stats
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Get bets from users under this reseller
    const userIds = users?.map(u => u.id) || [];
    
    let monthlyStake = 0;
    let monthlyWin = 0;
    
    if (userIds.length > 0) {
      const { data: bets } = await supabase
        .from('bets')
        .select('stake, potential_win, result, created_at')
        .in('user_id', userIds)
        .gte('created_at', monthStart.toISOString());

      monthlyStake = bets?.reduce((a, b) => a + Number(b.stake || 0), 0) || 0;
      monthlyWin = bets?.filter(b => b.result === 'win')
        .reduce((a, b) => a + Number(b.potential_win || 0), 0) || 0;
    }

    // Get recent transfers (balance adjustments)
    const { data: transfers } = await supabase
      .from('balance_logs')
      .select('user_id, amount, created_at')
      .eq('reseller_id', resellerId)
      .order('created_at', { ascending: false })
      .limit(10);

    const recentTransfers = transfers?.map(t => {
      const user = users?.find(u => u.id === t.user_id);
      return {
        id: `${t.user_id}-${t.created_at}`,
        username: user?.username || 'Unknown',
        amount: Math.abs(Number(t.amount)),
        type: Number(t.amount) > 0 ? 'in' : 'out' as 'in' | 'out',
        date: t.created_at,
      };
    }) || [];

    res.json({
      totalUsers,
      activeUsers,
      totalBalance,
      monthlyStake,
      monthlyWin,
      recentTransfers,
      resellerBalance: reseller.balance,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /reseller/users - Get users managed by this reseller
router.get('/users', requireAuth, async (req, res) => {
  try {
    const resellerId = req.authUserId;
    
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, balance, is_blocked, created_at, last_login')
      .eq('reseller_id', resellerId)
      .eq('role', 'user')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get bet counts for each user
    const usersWithStats = await Promise.all(
      (users || []).map(async (user) => {
        const { count } = await supabase
          .from('bets')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        return {
          ...user,
          totalBets: count || 0,
        };
      })
    );

    res.json(usersWithStats);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /reseller/users - Create new user under this reseller
router.post('/users', requireAuth, async (req, res) => {
  try {
    const resellerId = req.authUserId;
    if (!resellerId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { username, password, initialBalance = 0 } = req.body;

    if (!username?.trim() || !password?.trim()) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Check if username exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username.trim())
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Create user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: `${username.trim().toLowerCase()}@reseller.${resellerId.slice(0, 8)}.bb365.app`,
      password,
      user_metadata: { username: username.trim(), role: 'user' },
      email_confirm: true,
    });

    if (authError || !authData?.user) {
      return res.status(500).json({ error: authError?.message || 'Failed to create user' });
    }

    // Insert user record with reseller_id
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        username: username.trim(),
        role: 'user',
        balance: initialBalance,
        is_blocked: false,
        reseller_id: resellerId,
      })
      .select()
      .single();

    if (insertError) {
      // Rollback auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw insertError;
    }

    // If initial balance > 0, deduct from reseller
    if (initialBalance > 0) {
      const { data: reseller } = await supabase
        .from('users')
        .select('balance')
        .eq('id', resellerId)
        .single();

      if (reseller && reseller.balance >= initialBalance) {
        await supabase.rpc('credit_balance', {
          p_user_id: resellerId,
          p_amount: -initialBalance,
        });
      }
    }

    res.status(201).json(newUser);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PATCH /reseller/users/:id/balance - Transfer balance to/from user
router.patch('/users/:id/balance', requireAuth, async (req, res) => {
  try {
    const resellerId = req.authUserId;
    const userId = req.params.id;
    const { amount } = req.body;

    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Verify user belongs to reseller
    const { data: user } = await supabase
      .from('users')
      .select('id, balance, username')
      .eq('id', userId)
      .eq('reseller_id', resellerId)
      .single();

    if (!user) {
      return res.status(403).json({ error: 'User not found or not authorized' });
    }

    const transferAmount = Number(amount);
    
    // If negative (withdraw from user), check user has enough
    if (transferAmount < 0 && user.balance < Math.abs(transferAmount)) {
      return res.status(402).json({ error: 'User has insufficient balance' });
    }

    // If positive (add to user), check reseller has enough
    if (transferAmount > 0) {
      const { data: reseller } = await supabase
        .from('users')
        .select('balance')
        .eq('id', resellerId)
        .single();

      if (!reseller || reseller.balance < transferAmount) {
        return res.status(402).json({ error: 'Insufficient reseller balance' });
      }
    }

    // Perform transfer
    const { data: newBalance } = await supabase.rpc('credit_balance', {
      p_user_id: userId,
      p_amount: transferAmount,
    });

    // Adjust reseller balance in opposite direction
    await supabase.rpc('credit_balance', {
      p_user_id: resellerId,
      p_amount: -transferAmount,
    });

    // Log transfer
    await supabase.from('balance_logs').insert({
      reseller_id: resellerId,
      user_id: userId,
      amount: transferAmount,
      user_balance_after: newBalance,
    });

    res.json({ 
      success: true, 
      newBalance,
      transferAmount,
      username: user.username,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
