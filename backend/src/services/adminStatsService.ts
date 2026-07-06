import { supabase } from '../db/supabase';

export interface AdminStats {
  totalUsers: number;
  totalBalance: number;
  pendingBets: number;
  bookProfit: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  // 1. Total users count
  // NOTE: conta tutti gli utenti indipendentemente dal ruolo.
  // In futuro, quando la colonna `role` sarà consolidata nel DB live,
  // si potrà filtrare con .eq('role', 'user') per escludere reseller e admin.
  const { count: totalUsers, error: usersError } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  if (usersError) throw new Error(`totalUsers query failed: ${usersError.message}`);

  // 2. Total balance (sum all user balances)
  const { data: balanceRows, error: balanceError } = await supabase
    .from('users')
    .select('balance');

  if (balanceError) throw new Error(`totalBalance query failed: ${balanceError.message}`);

  const totalBalance = (balanceRows ?? []).reduce(
    (sum, row) => sum + (Number(row.balance) || 0),
    0
  );

  // 3. Pending bets count
  const { count: pendingBets, error: pendingError } = await supabase
    .from('bets')
    .select('*', { count: 'exact', head: true })
    .eq('result', 'pending');

  if (pendingError) throw new Error(`pendingBets query failed: ${pendingError.message}`);

  // 4. Book profit: SUM(stake where result='lose') - SUM(potential_win where result='win')
  const { data: betRows, error: betsError } = await supabase
    .from('bets')
    .select('stake, potential_win, result')
    .in('result', ['win', 'lose']);

  if (betsError) throw new Error(`bookProfit query failed: ${betsError.message}`);

  const bookProfit = (betRows ?? []).reduce((acc, bet) => {
    if (bet.result === 'lose') return acc + (Number(bet.stake) || 0);
    if (bet.result === 'win') return acc - (Number(bet.potential_win) || 0);
    return acc;
  }, 0);

  return {
    totalUsers: totalUsers ?? 0,
    totalBalance,
    pendingBets: pendingBets ?? 0,
    bookProfit,
  };
}
