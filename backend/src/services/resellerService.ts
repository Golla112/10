import { supabase, supabaseAdmin } from '../db/supabase';

export interface ResellerInfo {
  id: string;
  username: string;
  balance: number;
  created_at: string;
  affiliate_code?: string;
}

export interface ResellerUser {
  id: string;
  username: string;
  balance: number;
  is_blocked: boolean;
  created_at: string;
}

export interface TransferResult {
  reseller_balance: number;
  user_balance: number;
}

export interface ResellerBet {
  codice_schedina: string;
  user_id: string;
  nome_proprietario: string;
  stake: number;
  total_odds: number;
  potential_win: number;
  result: 'pending' | 'win' | 'lose' | 'cancelled';
  created_at: string;
  tipo: 'reseller' | 'utente';
  selections?: unknown[];
}

export interface ResellerStats {
  total_users: number;
  active_users: number;
  reseller_balance: number;
  profit_from_users: number;
  pending_bets_count: number;
}

export async function getResellerInfo(resellerId: string): Promise<ResellerInfo> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, username, balance, created_at, affiliate_code')
    .eq('id', resellerId)
    .single();

  if (error || !data) {
    console.error('[getResellerInfo] error:', error);
    throw new Error('Reseller non trovato');
  }
  console.log('[getResellerInfo] data:', JSON.stringify(data));
  return data as ResellerInfo;
}

export async function getResellerUsers(resellerId: string): Promise<ResellerUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, balance, is_blocked, created_at')
    .eq('reseller_id', resellerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error('Errore nel recupero utenti');
  return (data ?? []) as ResellerUser[];
}

export async function createResellerUser(
  resellerId: string,
  username: string,
  password: string
): Promise<ResellerUser> {
  // Check username uniqueness
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (existing) throw Object.assign(new Error('Username già in uso'), { code: 'DUPLICATE_USERNAME' });

  // Create Supabase auth user
  const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@bb365.app`;
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: { username, role: 'user' },
    email_confirm: true,
  });

  if (authError || !authData.user) {
    if (authError?.message?.includes('already registered')) {
      throw Object.assign(new Error('Username già in uso'), { code: 'DUPLICATE_USERNAME' });
    }
    throw new Error(authError?.message ?? 'Errore nella creazione utente');
  }

  // Upsert users row directly — don't rely on trigger
  const { error: upsertError } = await supabaseAdmin
    .from('users')
    .upsert({
      id: authData.user.id,
      username,
      balance: 0,
      role: 'user',
      reseller_id: resellerId,
      is_blocked: false,
    }, { onConflict: 'id' });

  if (upsertError) {
    console.error('[createResellerUser] upsert error:', upsertError);
    throw new Error('Errore nell\'inserimento utente nel database');
  }

  const { data: newUser, error: fetchError } = await supabase
    .from('users')
    .select('id, username, balance, is_blocked, created_at')
    .eq('id', authData.user.id)
    .single();

  if (fetchError || !newUser) throw new Error('Errore nel recupero utente creato');
  return newUser as ResellerUser;
}

export async function transferBalance(
  resellerId: string,
  userId: string,
  amount: number
): Promise<TransferResult> {
  // Verify user belongs to reseller
  const { data: user } = await supabase
    .from('users')
    .select('reseller_id')
    .eq('id', userId)
    .single();

  if (!user || user.reseller_id !== resellerId) {
    throw Object.assign(new Error('Accesso non autorizzato'), { code: 'FORBIDDEN' });
  }

  const { data, error } = await supabase.rpc('transfer_balance', {
    p_reseller_id: resellerId,
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) {
    if (error.message?.includes('INSUFFICIENT_RESELLER_BALANCE')) {
      throw Object.assign(new Error('Saldo reseller insufficiente'), { code: 'INSUFFICIENT_RESELLER_BALANCE' });
    }
    if (error.message?.includes('INSUFFICIENT_USER_BALANCE')) {
      throw Object.assign(new Error('Saldo utente insufficiente'), { code: 'INSUFFICIENT_USER_BALANCE' });
    }
    throw new Error('Errore nel trasferimento');
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    reseller_balance: Number(row.reseller_balance),
    user_balance: Number(row.user_balance),
  };
}

export async function setUserBlocked(
  resellerId: string,
  userId: string,
  blocked: boolean
): Promise<void> {
  const { data: user } = await supabase
    .from('users')
    .select('reseller_id')
    .eq('id', userId)
    .single();

  if (!user || user.reseller_id !== resellerId) {
    throw Object.assign(new Error('Accesso non autorizzato'), { code: 'FORBIDDEN' });
  }

  const { error } = await supabase
    .from('users')
    .update({ is_blocked: blocked, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error('Errore nel blocco utente');
}

export async function getResellerBets(
  resellerId: string,
  status?: string
): Promise<ResellerBet[]> {
  // Get all user IDs belonging to this reseller
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('reseller_id', resellerId);

  const userIds = (users ?? []).map((u: { id: string }) => u.id);
  const allIds = [resellerId, ...userIds];

  let query = supabase
    .from('bets')
    .select('codice_schedina, user_id, nome_proprietario, stake, total_odds, potential_win, result, created_at, selections')
    .in('user_id', allIds)
    .order('created_at', { ascending: false });

  if (status && ['pending', 'win', 'lose', 'cancelled'].includes(status)) {
    query = query.eq('result', status);
  }

  const { data, error } = await query;
  if (error) throw new Error('Errore nel recupero scommesse');

  return (data ?? []).map((bet: {
    codice_schedina: string;
    user_id: string;
    nome_proprietario: string;
    stake: number;
    total_odds: number;
    potential_win: number;
    result: 'pending' | 'win' | 'lose' | 'cancelled';
    created_at: string;
    selections?: unknown[];
  }) => ({
    ...bet,
    tipo: bet.user_id === resellerId ? 'reseller' : 'utente',
  })) as ResellerBet[];
}

export async function getResellerStats(resellerId: string): Promise<ResellerStats> {
  // Reseller balance
  const { data: resellerData } = await supabase
    .from('users')
    .select('balance')
    .eq('id', resellerId)
    .single();

  // Users
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('reseller_id', resellerId);

  const userIds = (users ?? []).map((u: { id: string }) => u.id);
  const totalUsers = userIds.length;

  // Active users (at least one bet)
  let activeUsers = 0;
  let profitFromUsers = 0;
  let pendingBetsCount = 0;

  if (userIds.length > 0) {
    const { data: bets } = await supabase
      .from('bets')
      .select('user_id, stake, potential_win, result')
      .in('user_id', userIds);

    const betsByUser = new Set((bets ?? []).map((b: { user_id: string }) => b.user_id));
    activeUsers = betsByUser.size;

    for (const bet of bets ?? []) {
      if (bet.result === 'lose') profitFromUsers += Number(bet.stake);
      if (bet.result === 'win') profitFromUsers -= Number(bet.potential_win);
      if (bet.result === 'pending') pendingBetsCount++;
    }
  }

  // Also count reseller's own pending bets
  const { data: resellerBets } = await supabase
    .from('bets')
    .select('result')
    .eq('user_id', resellerId)
    .eq('result', 'pending');

  pendingBetsCount += (resellerBets ?? []).length;

  return {
    total_users: totalUsers,
    active_users: activeUsers,
    reseller_balance: Number(resellerData?.balance ?? 0),
    profit_from_users: profitFromUsers,
    pending_bets_count: pendingBetsCount,
  };
}
