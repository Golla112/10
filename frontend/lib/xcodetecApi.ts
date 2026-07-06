/**
 * xcodetecApi - Complete API client for xcodetec platform
 * Based on discovered endpoints from joverbet skin
 */

const API_BASE = typeof window !== 'undefined'
  ? '/api/xcodetec'
  : `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000'}/xcodetec/proxy`;
const ORIGIN = process.env.NEXT_PUBLIC_XCODETEC_ORIGIN ?? 'https://www.joverbet.com';

// Headers non necessari: il backend proxy aggiunge Origin/Referer/Skin-*
const getHeaders = (_authToken?: string) => ({
  Accept: 'application/json',
});

// Generic fetch helper
async function apiFetch<T>(endpoint: string, options?: RequestInit, authToken?: string): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(authToken),
      ...(options?.headers || {}),
    },
  });
  
  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`);
  }
  
  return res.json();
}

// ==================== AUTH ====================

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  password: string;
  email: string;
  phone?: string;
  currency?: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    balance: number;
    currency: string;
  };
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function logout(authToken: string): Promise<void> {
  return apiFetch('/auth/logout', { method: 'POST' }, authToken);
}

export async function changePassword(oldPassword: string, newPassword: string, authToken: string): Promise<void> {
  return apiFetch('/auth/changepassword', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  }, authToken);
}

export async function passwordReset(email: string): Promise<void> {
  return apiFetch('/auth/passwordreset', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function getUserDetails(authToken: string): Promise<any> {
  return apiFetch('/auth/detail', {}, authToken);
}

// ==================== SKIN & CONFIG ====================

export async function getBanners(): Promise<any[]> {
  return apiFetch('/skin/banners');
}

export async function getSkinSettings(): Promise<any> {
  return apiFetch('/skin/settings');
}

export async function getSportConfig(): Promise<any> {
  return apiFetch('/sport/config');
}

export async function getNavbar(): Promise<any[]> {
  return apiFetch('/sport/navbar');
}

// ==================== GAMES ====================

export async function getGameHighlights(): Promise<any[]> {
  return apiFetch('/games/highlights');
}

export async function getCasinoGames(): Promise<any[]> {
  return apiFetch('/games/list/casino');
}

export async function getLiveCasinoGames(): Promise<any[]> {
  return apiFetch('/games/list/casinolive');
}

// ==================== SPORT WIDGETS ====================

export async function getFeaturedWidget(): Promise<any> {
  return apiFetch('/sport/widget/featured');
}

export async function getTodayWidget(): Promise<any> {
  return apiFetch('/sport/widget/today');
}

export async function getSportWidget(): Promise<any> {
  return apiFetch('/sport/widget');
}

export async function getPrintOdds(params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/sport/printodd/?${qs}`);
}

// ==================== TOURNAMENTS & EVENTS ====================

export async function getTournamentEvents(
  tournamentId: number, 
  marketType: number = 4
): Promise<any> {
  return apiFetch(`/sport/tournament/${tournamentId}/${marketType}`);
}

export async function getEventDetails(eventId: number | string): Promise<any> {
  return apiFetch(`/sport/event/${eventId}`);
}

// ==================== LIVE ====================

export async function getLiveSnapshot(): Promise<any> {
  return apiFetch('/live/snapshot');
}

export async function getLiveEvent(eventId: number | string): Promise<any> {
  return apiFetch(`/live/event/${eventId}`);
}

export async function getLiveVideo(eventId: number | string): Promise<any> {
  return apiFetch(`/live/video/${eventId}`);
}

export async function getLiveCalendar(): Promise<any> {
  return apiFetch('/live/calendar');
}

// ==================== WALLET ====================

export async function getWalletSettings(authToken: string): Promise<any> {
  return apiFetch('/wallet/settings/', {}, authToken);
}

export async function getWallet(authToken: string): Promise<any> {
  return apiFetch('/wallet/get', {}, authToken);
}

export async function getWalletChildren(authToken: string): Promise<any[]> {
  return apiFetch('/wallet/children/', {}, authToken);
}

// ==================== COUPON / BETTING ====================

export async function getPayedCoupons(authToken: string): Promise<any[]> {
  return apiFetch('/coupon/payed', {}, authToken);
}

export async function cancelCoupon(couponId: string, authToken: string): Promise<void> {
  return apiFetch(`/coupon/cancel/${couponId}`, { method: 'POST' }, authToken);
}

export async function checkCoupon(couponId: string, authToken: string): Promise<any> {
  return apiFetch(`/coupon/check/${couponId}`, {}, authToken);
}

export async function refuseCoupon(couponId: string, authToken: string): Promise<void> {
  return apiFetch(`/coupon/refuse/${couponId}`, { method: 'POST' }, authToken);
}

export async function confirmCoupon(couponId: string, authToken: string): Promise<void> {
  return apiFetch(`/coupon/confirm/${couponId}`, { method: 'POST' }, authToken);
}

export async function verifyCashout(couponId: string, authToken: string): Promise<any> {
  return apiFetch(`/coupon/cashout/verify/${couponId}`, {}, authToken);
}

export async function confirmCashout(couponId: string, authToken: string): Promise<void> {
  return apiFetch(`/coupon/cashout/confirm/${couponId}`, { method: 'POST' }, authToken);
}

// ==================== PAYMENTS ====================

export async function getPaymentMethods(authToken: string): Promise<any[]> {
  return apiFetch('/payment/list', {}, authToken);
}

export async function executePayment(
  paymentMethodId: string, 
  amount: number, 
  authToken: string
): Promise<any> {
  return apiFetch('/payment/exec', {
    method: 'POST',
    body: JSON.stringify({ paymentMethodId, amount }),
  }, authToken);
}

// ==================== BROADCASTING / WEBSOCKET ====================

export async function getBroadcastingAuth(socketId: string, channelName: string, authToken: string): Promise<any> {
  return apiFetch('/broadcasting/auth', {
    method: 'POST',
    body: JSON.stringify({ socket_id: socketId, channel_name: channelName }),
  }, authToken);
}

// ==================== HOOKS & REAL-TIME ====================

export function useXcodetecWebSocket(channel: string, onMessage: (data: any) => void) {
  // WebSocket connection to ws.xcodetec.com
  const wsUrl = 'wss://ws.xcodetec.com/app/f7505296-aaf5-4557-bdcb-0ec1f5da5a2a';
  
  if (typeof window === 'undefined') return null;
  
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('[WebSocket] Connected');
    // Subscribe to channel
    ws.send(JSON.stringify({
      event: 'pusher:subscribe',
      data: { channel }
    }));
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };
  
  ws.onerror = (error) => {
    console.error('[WebSocket] Error:', error);
  };
  
  return ws;
}

// ==================== CACHE HELPERS ====================

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export async function cachedApiFetch<T>(
  key: string, 
  fetchFn: () => Promise<T>, 
  ttl: number = CACHE_TTL
): Promise<T> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  
  const data = await fetchFn();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}

export function clearCache(): void {
  cache.clear();
}

// Export all as default object
const xcodetecApi = {
  // Auth
  login,
  register,
  logout,
  changePassword,
  passwordReset,
  getUserDetails,
  // Skin
  getBanners,
  getSkinSettings,
  getSportConfig,
  getNavbar,
  // Games
  getGameHighlights,
  getCasinoGames,
  getLiveCasinoGames,
  // Sport
  getFeaturedWidget,
  getTodayWidget,
  getSportWidget,
  getPrintOdds,
  getTournamentEvents,
  getEventDetails,
  // Live
  getLiveSnapshot,
  getLiveEvent,
  getLiveVideo,
  getLiveCalendar,
  // Wallet
  getWalletSettings,
  getWallet,
  getWalletChildren,
  // Coupon
  getPayedCoupons,
  cancelCoupon,
  checkCoupon,
  refuseCoupon,
  confirmCoupon,
  verifyCashout,
  confirmCashout,
  // Payment
  getPaymentMethods,
  executePayment,
  // Utils
  cachedApiFetch,
  clearCache,
};

export default xcodetecApi;
