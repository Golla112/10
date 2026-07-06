import { getStoredPassword, getStoredUser } from './session';



const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';



export interface Selection {

  event_id: string;

  nome_evento: string;

  quota: number;

  market: string;

  outcome: string;

  betcode?: string;

  result?: 'win' | 'lose' | 'pending';

  live?: boolean;

}



export interface Bet {

  id: string;

  codice_schedina: string;

  nome_proprietario: string;

  stake: number;

  selections: Selection[];

  total_odds: number;

  potential_win: number;

  bonus_pct?: number;

  result: 'pending' | 'win' | 'lose' | 'cancelled';

  created_at: string;

  settled_at: string | null;

  paid_at: string | null;

}



export interface BetSubmitPayload {

  nome_proprietario?: string;

  stake: number;

  selections: Selection[];

  accepted_odds?: Record<string, number>;

  is_live?: boolean;

  bonus_pct?: number;

}



export interface OddsChangedError {

  error: string;

  changed_odds: Record<string, { accepted: number; current: number }>;

}



export interface BetSubmitResponse {

  codice_schedina: string;

  created_at: string;

}



export interface BalanceResponse {

  balance: number;

  is_blocked: boolean;

  username?: string;

}



export interface ProfitLossResponse {

  daily: number;

  weekly: number;

  monthly: number;

  yearly: number;

}



export interface BetsParams {

  date?: string;

  from?: string;

  to?: string;

  userId?: string;

}



function authHeaders(): HeadersInit {

  const user = getStoredUser();

  const headers: Record<string, string> = {

    'Content-Type': 'application/json',

    'x-site-password': getStoredPassword(),

  };

  // Pass Supabase user ID so backend can check/deduct balance

  if (user?.supabaseId) headers['x-user-id'] = user.supabaseId;

  return headers;

}



export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {

  const res = await fetch(`${API_BASE}${path}`, {

    ...init,

    headers: {

      ...authHeaders(),

      ...(init?.headers ?? {}),

    },

  });



  if (!res.ok) {

    const text = await res.text().catch(() => res.statusText);

    throw new Error(`API ${path} failed (${res.status}): ${text}`);

  }



  return res.json() as Promise<T>;

}

async function fallbackFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Fallback ${path} failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}



export async function fetchChampionships(): Promise<
  Array<{
    id: number;
    discipline: number;
    sport: string;
    nation: string;
    name: string;
    label: string;
  }>
> {
  try {
    const data = await apiFetch<Array<{
      id: number;
      discipline: number;
      sport: string;
      nation: string;
      name: string;
      label: string;
    }>>('/events/championships');

    if (Array.isArray(data) && data.length > 0) return data;
  } catch {
    // fallback sotto
  }

  return fallbackFetch('/api/fallback/championships');
}

export async function fetchLeagueEvents(
  championshipId: number,
  discipline: number
): Promise<unknown[]> {
  try {
    const data = await apiFetch<unknown[]>(
      `/events/league/${championshipId}?discipline=${discipline}`
    );
    if (Array.isArray(data) && data.length > 0) return data;
  } catch {
    // fallback sotto
  }

  return fallbackFetch<unknown[]>(`/api/fallback/league/${championshipId}`);
}

export async function fetchEvents(): Promise<unknown[]> {
  try {
    const data = await apiFetch<unknown[]>('/events');
    if (Array.isArray(data) && data.length > 0) return data;
  } catch {
    // fallback sotto
  }

  return fallbackFetch<unknown[]>('/api/fallback/events');
}

export type SportEventsResponse = {
  events: Array<{
    id: string;
    home: { name: string };
    away: { name: string };
    time?: number;
    sport_category?: string;
    league?: { name?: string };
    bookmakers?: Array<{
      markets?: Array<{
        key?: string;
        name?: string;
        outcomes?: Array<{ name: string; price: number; betcode?: string }>;
      }>;
    }>;
  }>;
  meta: { events: number; leagues: number };
};

const sportEventsCache = new Map<string, { ts: number; data: SportEventsResponse }>();
const SPORT_CACHE_TTL = 45_000;

export async function fetchSportEvents(sport: string): Promise<SportEventsResponse> {
  const key = sport.toLowerCase();
  const cached = sportEventsCache.get(key);
  if (cached && Date.now() - cached.ts < SPORT_CACHE_TTL) {
    return cached.data;
  }

  try {
    const data = await apiFetch<SportEventsResponse>(`/events/sport/${key}`);
    if (data?.events?.length) {
      sportEventsCache.set(key, { ts: Date.now(), data });
      return data;
    }
  } catch {
    // fallback sotto
  }

  const all = (await fetchEvents()) as SportEventsResponse['events'];
  const events = all.filter((e) => (e.sport_category ?? 'soccer') === key);
  const leagues = new Set(events.map((e) => e.league?.name ?? 'Prematch'));
  const fallback: SportEventsResponse = {
    events,
    meta: { events: events.length, leagues: leagues.size },
  };
  sportEventsCache.set(key, { ts: Date.now(), data: fallback });
  return fallback;
}

export async function fetchEventsStats(): Promise<
  Record<string, { events: number; leagues: number }>
> {
  try {
    return await apiFetch<Record<string, { events: number; leagues: number }>>('/events/stats');
  } catch {
    return {};
  }
}



export async function fetchBalance(supabaseId: string): Promise<BalanceResponse> {
  const { getAccessToken } = await import('./session');
  const token = await getAccessToken();

  const res = await fetch(`${API_BASE}/users/me/balance`, {
    headers: {
      'x-site-password': getStoredPassword(),
      'x-user-id': supabaseId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) return { balance: 0, is_blocked: false };

  return res.json() as Promise<BalanceResponse>;

}

export async function fetchLiveEvents(): Promise<unknown[]> {

  return apiFetch<unknown[]>('/events/live');

}



export async function fetchEventById(eventId: string): Promise<unknown | null> {

  // Prima prova la route diretta /events/:id (funziona per prematch e live)

  try {

    return await apiFetch<unknown>(`/events/${eventId}`);

  } catch {

    // Fallback: cerca nella lista prematch

    try {

      const events = await apiFetch<unknown[]>('/events');

      return (events as Array<{ id: string }>).find(e => e.id === eventId) ?? null;

    } catch {

      return null;

    }

  }

}



export async function fetchOdds(eventId: string): Promise<unknown> {

  return apiFetch<unknown>(`/odds/${encodeURIComponent(eventId)}`);

}



export async function submitBet(betData: BetSubmitPayload): Promise<BetSubmitResponse> {

  const res = await fetch(`${API_BASE}/bets`, {

    method: 'POST',

    headers: authHeaders() as Record<string, string>,

    body: JSON.stringify(betData),

  });



  if (res.status === 409) {

    const body = await res.json() as OddsChangedError;

    const err = new Error(body.error) as Error & { oddsChanged?: OddsChangedError['changed_odds'] };

    err.oddsChanged = body.changed_odds;

    throw err;

  }



  if (!res.ok) {

    const text = await res.text().catch(() => res.statusText);

    throw new Error(`API /bets failed (${res.status}): ${text}`);

  }



  return res.json() as Promise<BetSubmitResponse>;

}



export async function bookBet(payload: BetSubmitPayload): Promise<{ booking_code: string }> {

  return apiFetch<{ booking_code: string }>('/bets/book', {

    method: 'POST',

    body: JSON.stringify(payload),

  });

}



export async function fetchBookedBet(code: string): Promise<any> {

  return apiFetch<any>(`/bets/book/${code}`);

}



export async function fetchBetByCodice(codice: string): Promise<Bet> {

  // Public endpoint — no password required

  const res = await fetch(`${API_BASE}/bets/${encodeURIComponent(codice.toUpperCase())}`);

  if (!res.ok) {

    const text = await res.text().catch(() => res.statusText);

    throw new Error(`API /bets/${codice} failed (${res.status}): ${text}`);

  }

  return res.json() as Promise<Bet>;

}



export async function fetchBets(params?: BetsParams): Promise<Bet[]> {

  const query = new URLSearchParams();

  if (params?.date) query.set('date', params.date);

  if (params?.from) query.set('from', params.from);

  if (params?.to) query.set('to', params.to);

  const qs = query.toString() ? `?${query.toString()}` : '';

  return apiFetch<Bet[]>(`/bets${qs}`);

}



export async function fetchProfitLoss(): Promise<ProfitLossResponse> {

  return apiFetch<ProfitLossResponse>('/profit-loss');

}



// Admin API helpers

const ADMIN_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';



function adminHeaders(): HeadersInit {

  return { 'Content-Type': 'application/json', 'x-site-password': getStoredPassword() };

}



export async function adminSetResult(codice: string, result: 'win' | 'lose' | 'pending'): Promise<void> {

  const res = await fetch(`${ADMIN_BASE}/admin/result/${codice}`, {

    method: 'POST', headers: adminHeaders(),

    body: JSON.stringify({ result }),

  });

  if (!res.ok) throw new Error(`Set result failed (${res.status})`);

}



export async function adminSetPaid(codice: string, paid: boolean): Promise<void> {

  const res = await fetch(`${ADMIN_BASE}/admin/paid/${codice}`, {

    method: 'POST', headers: adminHeaders(),

    body: JSON.stringify({ paid }),

  });

  if (!res.ok) throw new Error(`Set paid failed (${res.status})`);

}



export async function adminSettleBet(codice: string): Promise<void> {

  const res = await fetch(`${ADMIN_BASE}/admin/settle/${codice}`, {

    method: 'POST', headers: adminHeaders(),

  });

  if (!res.ok) throw new Error(`Settle failed (${res.status})`);

}



export async function adminSettleAll(): Promise<{ settled: number; skipped: number }> {

  const res = await fetch(`${ADMIN_BASE}/admin/settle`, {

    method: 'POST', headers: adminHeaders(),

  });

  if (!res.ok) throw new Error(`Settle all failed (${res.status})`);

  return res.json();

}



export async function adminCancelBet(codice: string): Promise<void> {

  const res = await fetch(`${ADMIN_BASE}/admin/cancel/${codice}`, {

    method: 'POST', headers: adminHeaders(),

  });

  if (!res.ok) throw new Error(`Cancel failed (${res.status})`);

}



export async function fetchAllBets(params?: BetsParams): Promise<Bet[]> {

  const query = new URLSearchParams();

  if (params?.date) query.set('date', params.date);

  if (params?.from) query.set('from', params.from);

  if (params?.to) query.set('to', params.to);

  const qs = query.toString() ? `?${query.toString()}` : '';

  return apiFetch<Bet[]>(`/bets${qs}`);

}



// ── WebSocket live hook ───────────────────────────────────────────────────────

// Returns a cleanup function. Calls onData whenever new live events arrive.

// Falls back to REST polling if WS is unavailable.



export function connectLiveWS(

  onData: (events: unknown[]) => void,

  onStatus?: (status: 'connecting' | 'open' | 'closed' | 'error') => void,

  onOddsUpdate?: (eventId: string, odds: unknown, locked: boolean, countdown: number) => void

): () => void {

  const wsBase = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000')

    .replace(/^http/, 'ws');

  const url = `${wsBase}/ws/live`;



  let ws: WebSocket | null = null;

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  let destroyed = false;

  let wsWorking = false;



  function startPollFallback() {

    if (pollTimer || destroyed) return;

    async function poll() {

      if (destroyed) return;

      try {

        const data = await fetchLiveEvents();

        onData(data);

      } catch { /* silent */ }

      if (!destroyed && !wsWorking) pollTimer = setTimeout(poll, 30_000);

    }

    poll();

  }



  function connect() {

    if (destroyed) return;

    onStatus?.('connecting');

    try {

      ws = new WebSocket(url);

    } catch {

      onStatus?.('error');

      startPollFallback();

      return;

    }



    const openTimeout = setTimeout(() => {

      if (ws && ws.readyState !== WebSocket.OPEN) {

        ws.close();

        startPollFallback();

      }

    }, 5000);



    ws.onopen = () => {

      clearTimeout(openTimeout);

      wsWorking = true;

      onStatus?.('open');

      // Stop poll fallback if running

      if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }

    };



    ws.onmessage = (evt) => {

      try {

        const msg = JSON.parse(evt.data as string) as { type: string; data?: unknown[]; eventId?: string; odds?: unknown; locked?: boolean; countdown?: number };

        if (msg.type === 'live' && msg.data) onData(msg.data);

        else if (msg.type === 'odds_update' && msg.eventId && onOddsUpdate) {

          onOddsUpdate(msg.eventId, msg.odds, msg.locked ?? false, msg.countdown ?? 0);

        }

      } catch { /* ignore malformed */ }

    };



    ws.onerror = () => {

      clearTimeout(openTimeout);

      onStatus?.('error');

    };



    ws.onclose = () => {

      clearTimeout(openTimeout);

      wsWorking = false;

      onStatus?.('closed');

      if (!destroyed) {

        // Reconnect after 5s, fallback to poll in the meantime

        startPollFallback();

        reconnectTimer = setTimeout(connect, 5000);

      }

    };

  }



  connect();



  return () => {

    destroyed = true;

    if (reconnectTimer) clearTimeout(reconnectTimer);

    if (pollTimer) clearTimeout(pollTimer);

    if (ws) { ws.onclose = null; ws.close(); }

  };

}



// ── Live Bet Protection ───────────────────────────────────────────────────────



export interface LiveBetSubmitPayload {

  stake: number;

  selections: Selection[];

  accepted_odds: Record<string, number>;

}



export interface LiveBetSubmitResponse {

  pending_id: string;

  delay_ms: number;

}



export interface LiveBetStatusResponse {

  status: 'pending' | 'accepted' | 'rejected';

  remaining_ms?: number;

  codice_schedina?: string;

  rejection_reason?: string;

  new_odds?: Record<string, number>;

}



export async function submitLiveBet(payload: LiveBetSubmitPayload): Promise<LiveBetSubmitResponse> {

  const res = await fetch(`${API_BASE}/bet/live`, {

    method: 'POST',

    headers: authHeaders() as Record<string, string>,

    body: JSON.stringify(payload),

  });

  if (res.status === 423) {

    const body = await res.json().catch(() => ({})) as { error?: string };

    throw new Error(body.error ?? 'Mercato temporaneamente sospeso.');

  }

  if (!res.ok) {

    const text = await res.text().catch(() => res.statusText);

    throw new Error(`Live bet failed (${res.status}): ${text}`);

  }

  return res.json() as Promise<LiveBetSubmitResponse>;

}



export async function pollLiveBetStatus(pendingId: string): Promise<LiveBetStatusResponse> {

  const res = await fetch(`${API_BASE}/bet/live/status/${encodeURIComponent(pendingId)}`, {

    headers: authHeaders(),

  });

  if (res.status === 404) {

    return { status: 'rejected', rejection_reason: 'timeout' };

  }

  if (!res.ok) {

    const text = await res.text().catch(() => res.statusText);

    throw new Error(`Poll status failed (${res.status}): ${text}`);

  }

  return res.json() as Promise<LiveBetStatusResponse>;

}



export async function fetchLockedEvents(): Promise<string[]> {

  try {

    const res = await fetch(`${API_BASE}/live-protection/locks`, {

      headers: authHeaders(),

    });

    if (!res.ok) return [];

    const data = await res.json() as { locked_events: string[] };

    return data.locked_events ?? [];

  } catch {

    return [];

  }

}



// ── Admin User Management ─────────────────────────────────────────────────────



export interface AdminUser {

  id: string;

  username: string;

  balance: number;

  is_blocked: boolean;

  created_at: string;

  role?: string;

}



export interface AdminStats {

  totalUsers: number;

  totalBalance: number;

  pendingBets: number;

  bookProfit: number;

}



export async function adminListUsers(): Promise<AdminUser[]> {

  const res = await fetch(`${ADMIN_BASE}/users`, { headers: adminHeaders() });

  if (!res.ok) throw new Error(`List users failed (${res.status})`);

  return res.json() as Promise<AdminUser[]>;

}



export async function adminUpdateBalance(id: string, balance: number): Promise<void> {

  const res = await fetch(`${ADMIN_BASE}/users/${encodeURIComponent(id)}/balance`, {

    method: 'PATCH',

    headers: adminHeaders(),

    body: JSON.stringify({ balance }),

  });

  if (!res.ok) throw new Error(`Update balance failed (${res.status})`);

}



export async function adminBlockUser(id: string, blocked: boolean): Promise<void> {

  const res = await fetch(`${ADMIN_BASE}/users/${encodeURIComponent(id)}/block`, {

    method: 'PATCH',

    headers: adminHeaders(),

    body: JSON.stringify({ blocked }),

  });

  if (!res.ok) throw new Error(`Block user failed (${res.status})`);

}



export async function adminGetStats(): Promise<AdminStats> {

  const res = await fetch(`${ADMIN_BASE}/admin/stats`, { headers: adminHeaders() });

  if (!res.ok) throw new Error(`Get stats failed (${res.status})`);

  return res.json() as Promise<AdminStats>;

}



export async function adminCreateReseller(username: string, password: string): Promise<AdminUser> {

  const res = await fetch(`${ADMIN_BASE}/admin/resellers`, {

    method: 'POST',

    headers: adminHeaders(),

    body: JSON.stringify({ username, password }),

  });

  if (!res.ok) {

    const body = await res.json().catch(() => ({})) as { error?: string };

    throw new Error(body.error ?? `Create reseller failed (${res.status})`);

  }

  return res.json() as Promise<AdminUser>;

}

