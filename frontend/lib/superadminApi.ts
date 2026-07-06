import { getAccessToken, getStoredUser } from './session';

const API = () => process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
const PWD = () => process.env.NEXT_PUBLIC_SITE_PASSWORD ?? '';

async function headers(): Promise<Record<string, string>> {
  const user = getStoredUser();
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    'x-site-password': PWD(),
    'x-user-id': user?.supabaseId ?? '',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const baseHeaders = await headers();
  const res = await fetch(`${API()}/superadmin${path}`, { ...opts, headers: { ...baseHeaders, ...(opts?.headers ?? {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export interface SAStats {
  totalUsers: number; totalResellers: number; totalAdmins: number;
  totalBalance: number; activeBets: number; totalStake: number;
  totalPaidOut: number; profit: number;
}

export interface SAUser {
  id: string; username: string; balance: number;
  is_blocked: boolean; role: string; reseller_id?: string; created_at: string;
}

export interface SABet {
  id: string; codice_schedina: string; nome_proprietario: string;
  stake: number; total_odds: number; potential_win: number;
  result: string; created_at: string; selections: unknown[];
  user_id?: string;
}

export interface SAProfits {
  globalProfit: number; totalStake: number; totalPaidOut: number;
  todayProfit: number; todayStake: number; todayPaidOut: number;
  resellers: { id: string; username: string; balance: number }[];
}

export const saApi = {
  getStats: () => req<SAStats>('/stats'),
  getAdmins: () => req<SAUser[]>('/admins'),
  createAdmin: (username: string, password: string) =>
    req<SAUser>('/admins', { method: 'POST', body: JSON.stringify({ username, password }) }),
  deleteAdmin: (id: string) => req<{ ok: boolean }>(`/admins/${id}`, { method: 'DELETE' }),
  blockAdmin: (id: string, blocked: boolean) =>
    req<{ ok: boolean }>(`/admins/${id}/block`, { method: 'PATCH', body: JSON.stringify({ blocked }) }),
  getUsers: () => req<SAUser[]>('/users'),
  blockUser: (id: string, blocked: boolean) =>
    req<{ ok: boolean }>(`/users/${id}/block`, { method: 'PATCH', body: JSON.stringify({ blocked }) }),
  changePassword: (id: string, password: string) =>
    req<{ ok: boolean }>(`/users/${id}/password`, { method: 'PATCH', body: JSON.stringify({ password }) }),
  adjustBalance: (id: string, amount: number) =>
    req<{ ok: boolean; new_balance: number }>(`/users/${id}/balance`, { method: 'PATCH', body: JSON.stringify({ amount }) }),
  getBets: (params?: { from?: string; to?: string; user_id?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return req<SABet[]>(`/bets${qs ? '?' + qs : ''}`);
  },
  getProfits: () => req<SAProfits>('/profits'),
};
