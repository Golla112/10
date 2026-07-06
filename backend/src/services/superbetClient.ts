/**
 * Client HTTP per superbet24.org (prematch)
 * Bootstrap automatico CSRF + cookie dalla pagina sport.
 */

const SUPERBET_BASE = process.env.SUPERBET_BASE_URL ?? 'https://superbet24.org';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

interface SessionCache {
  cookie: string;
  csrf: string;
  ts: number;
}

let sessionCache: SessionCache | null = null;
const SESSION_TTL = 25 * 60 * 1000;

function parseSetCookies(setCookies: string[]): string {
  const parts = setCookies.map((c) => c.split(';')[0]).filter(Boolean);
  if (process.env.SUPERBET_COOKIE?.trim()) {
    parts.unshift(process.env.SUPERBET_COOKIE.trim());
  }
  return [...new Set(parts)].join('; ');
}

export async function getSuperbetSession(): Promise<SessionCache> {
  const now = Date.now();
  if (sessionCache && now - sessionCache.ts < SESSION_TTL) {
    return sessionCache;
  }

  if (process.env.SUPERBET_CSRF_TOKEN?.trim() && process.env.SUPERBET_COOKIE?.trim()) {
    sessionCache = {
      csrf: process.env.SUPERBET_CSRF_TOKEN.trim(),
      cookie: process.env.SUPERBET_COOKIE.trim(),
      ts: now,
    };
    return sessionCache;
  }

  const res = await fetch(`${SUPERBET_BASE}/index.php?action=sport`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    throw new Error(`superbet bootstrap HTTP ${res.status}`);
  }

  const html = await res.text();
  const csrf =
    html.match(/meta name="csrf-token" content="([^"]+)"/i)?.[1] ??
    process.env.SUPERBET_CSRF_TOKEN?.trim() ??
    '';

  if (!csrf) {
    throw new Error('superbet: CSRF token non trovato');
  }

  const cookie = parseSetCookies(res.headers.getSetCookie?.() ?? []);
  sessionCache = { csrf, cookie, ts: now };
  return sessionCache;
}

export function invalidateSuperbetSession(): void {
  sessionCache = null;
}

export interface SuperbetAjaxResponse<T = unknown> {
  errorCode?: string;
  result?: T;
}

export async function superbetAjax<T = unknown>(
  params: Record<string, string>
): Promise<SuperbetAjaxResponse<T> | null> {
  const session = await getSuperbetSession();
  const body = new URLSearchParams({
    sesstkn: process.env.SUPERBET_SESSTKN ?? '',
    ...params,
  });

  const res = await fetch(`${SUPERBET_BASE}/ajax.php`, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Origin: SUPERBET_BASE,
      Referer: `${SUPERBET_BASE}/index.php?action=sport`,
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-Token': session.csrf,
      Cookie: session.cookie,
      'User-Agent': USER_AGENT,
    },
    body: body.toString(),
    signal: AbortSignal.timeout(20_000),
  });

  const text = await res.text();
  if (!text.startsWith('{')) {
    if (text.includes('CSRF')) invalidateSuperbetSession();
    console.warn('[superbet] risposta non JSON:', text.slice(0, 120));
    return null;
  }

  try {
    return JSON.parse(text) as SuperbetAjaxResponse<T>;
  } catch {
    return null;
  }
}

export { SUPERBET_BASE };
