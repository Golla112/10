/**
 * Client HTTP centralizzato per api.xcodetec.com (skin joverbet).
 * Usato da proxy backend, servizi prematch/live e scraper.
 */

export const XCODE_BASE = process.env.XCODETEC_API_BASE ?? 'https://api.xcodetec.com/api';
export const XCODE_ORIGIN = process.env.XCODETEC_ORIGIN ?? 'https://www.joverbet.com';

export function getXcodetecHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = process.env.XCODETEC_BEARER_TOKEN?.trim();
  return {
    Accept: 'application/json',
    Origin: XCODE_ORIGIN,
    Referer: `${XCODE_ORIGIN}/`,
    'Skin-Language': process.env.XCODETEC_LANGUAGE ?? 'it-IT',
    'Skin-TZ': process.env.XCODETEC_TIMEZONE ?? 'Europe/Rome',
    Authorization: token ? `Bearer ${token}` : 'Bearer null',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    ...extra,
  };
}

interface XcWrapped<T> {
  success?: boolean;
  data?: T;
}

export async function xcodetecFetchRaw(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 12_000, ...fetchOptions } = options;
  const url = path.startsWith('http') ? path : `${XCODE_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  return fetch(url, {
    ...fetchOptions,
    headers: {
      ...getXcodetecHeaders(),
      ...(fetchOptions.headers as Record<string, string> | undefined),
    },
    signal: fetchOptions.signal ?? AbortSignal.timeout(timeoutMs),
  });
}

export async function xcodetecFetchJson<T = unknown>(
  path: string,
  options: RequestInit & { timeoutMs?: number; unwrap?: boolean } = {}
): Promise<T | null> {
  const { unwrap = true, ...fetchOptions } = options;
  try {
    const res = await xcodetecFetchRaw(path, fetchOptions);
    if (!res.ok) return null;
    const json = (await res.json()) as XcWrapped<T> | T;
    if (!unwrap) return json as T;
    const wrapped = json as XcWrapped<T>;
    return (wrapped.data ?? json) as T;
  } catch {
    return null;
  }
}

export function xcodetecCacheControl(path: string): string {
  if (path.startsWith('/live/snapshot') || path.startsWith('/live/event/')) {
    return 'no-store';
  }
  if (path.startsWith('/sport/config') || path.startsWith('/sport/navbar')) {
    return 'public, max-age=300, stale-while-revalidate=600';
  }
  return 'public, max-age=60, stale-while-revalidate=120';
}
