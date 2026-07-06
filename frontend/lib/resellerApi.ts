import { getAccessToken, getStoredUser, getStoredPassword } from './session';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

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

async function getHeaders(): Promise<Record<string, string>> {
  const user = getStoredUser();
  const password = getStoredPassword();
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-site-password': password,
  };
  if (user?.supabaseId) {
    headers['x-user-id'] = user.supabaseId;
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Errore HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getMe(): Promise<ResellerInfo> {
  const headers = await getHeaders();
  const res = await fetch(`${API_BASE}/reseller/me`, { headers });
  return handleResponse<ResellerInfo>(res);
}

export async function getUsers(): Promise<ResellerUser[]> {
  const headers = await getHeaders();
  const res = await fetch(`${API_BASE}/reseller/users`, { headers });
  return handleResponse<ResellerUser[]>(res);
}

export async function createUser(username: string, password: string): Promise<ResellerUser> {
  const headers = await getHeaders();
  const res = await fetch(`${API_BASE}/reseller/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ username, password }),
  });
  return handleResponse<ResellerUser>(res);
}

export async function updateUserBalance(userId: string, amount: number): Promise<TransferResult> {
  const headers = await getHeaders();
  const res = await fetch(`${API_BASE}/reseller/users/${userId}/balance`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ amount }),
  });
  return handleResponse<TransferResult>(res);
}

export async function setUserBlocked(userId: string, blocked: boolean): Promise<void> {
  const headers = await getHeaders();
  const res = await fetch(`${API_BASE}/reseller/users/${userId}/block`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ blocked }),
  });
  await handleResponse<{ ok: boolean }>(res);
}

export async function getBets(status?: string): Promise<ResellerBet[]> {
  const url = status
    ? `${API_BASE}/reseller/bets?status=${encodeURIComponent(status)}`
    : `${API_BASE}/reseller/bets`;
  const headers = await getHeaders();
  const res = await fetch(url, { headers });
  return handleResponse<ResellerBet[]>(res);
}

export async function getStats(): Promise<ResellerStats> {
  const headers = await getHeaders();
  const res = await fetch(`${API_BASE}/reseller/stats`, { headers });
  return handleResponse<ResellerStats>(res);
}
