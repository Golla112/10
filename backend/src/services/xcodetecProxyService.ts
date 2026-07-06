/**
 * xcodetecProxyService — Proxy completo per API xcodetec
 *
 * Espone gli endpoint xcodetec nella loro forma originale:
 * - /api/live/snapshot  → config_palimpsest + config_markets + events_labels + events_markets
 * - /api/live/event/:id → mercati dettagliati evento live
 * - /api/sport/config   → marketgroups + markets (con spread, group_id, odds config)
 * - /api/sport/navbar   → albero sport/categorie/tornei
 * - /api/live/calendar  → calendario eventi prematch
 */

import { xcodetecFetchJson, xcodetecFetchRaw } from './xcodetecClient';

// ── Cache in-memory ───────────────────────────────────────────────────────────

interface SnapshotCache {
  data: XcLiveSnapshot | null;
  ts: number;
}

interface SportConfigCache {
  data: XcSportConfig | null;
  ts: number;
}

interface NavbarCache {
  data: unknown | null;
  ts: number;
}

interface CalendarCache {
  data: unknown | null;
  ts: number;
}

const snapshotCache: SnapshotCache = { data: null, ts: 0 };
const sportConfigCache: SportConfigCache = { data: null, ts: 0 };
const navbarCache: NavbarCache = { data: null, ts: 0 };
const calendarCache: CalendarCache = { data: null, ts: 0 };
const eventMarketsCache = new Map<string, { data: unknown; ts: number }>();

const SNAPSHOT_TTL = 5_000;
const CONFIG_TTL = 5 * 60_000;
const NAVBAR_TTL = 10 * 60_000;
const CALENDAR_TTL = 2 * 60_000;
const EVENT_TTL = 3_000;

// ── Tipi ─────────────────────────────────────────────────────────────────────

export interface XcPalimpsestItem {
  id: number;
  label: string;
  icon: string;
  order: number;
  type: string;
  sport_id?: number;
  category_id?: number;
  widget?: boolean;
  timed?: boolean;
}

export interface XcMarketOddConfig {
  id: number;
  label: string;
  order: number;
}

export interface XcMarketConfig {
  id: number;
  label: string;
  sport_id: number;
  group_id: number;
  main: boolean;
  order: number;
  spread: boolean;
  spread_type?: string;
  spread_default?: string;
  player?: boolean;
  odds: XcMarketOddConfig[];
}

export interface XcGroupConfig {
  id: number;
  label: string;
  hint?: string;
  main: boolean;
  sport_id: number;
}

export interface XcSportConfig {
  marketgroups: XcGroupConfig[];
  markets: XcMarketConfig[];
}

export interface XcLiveEvent {
  id: number;
  home: string;
  away: string;
  label?: string;
  short?: number;
  phase?: string;
  result?: string;
  score?: string;
  time?: string;
  timer?: string;
  begin: number;
  sport_id: number;
  category_id: number;
  tournament_id: number;
  gamescore?: string | null;
  started?: boolean;
  stream_id?: number;
}

export interface XcLiveOdd {
  id: number;
  locked: boolean;
  code: string;
  unique: string;
  value?: number;
  extra?: string;
}

export interface XcLiveMarket {
  id: number;
  odds: Record<string, XcLiveOdd>;
  extra?: string;
}

export interface XcLiveSnapshot {
  config_palimpsest: {
    sports: Record<string, XcPalimpsestItem>;
    categories: Record<string, XcPalimpsestItem>;
    tournaments: Record<string, XcPalimpsestItem>;
  };
  config_markets: {
    markets: Record<string, XcMarketConfig>;
  };
  events_labels: Record<string, XcLiveEvent>;
  events_markets: Record<string, Record<string, XcLiveMarket>>;
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function xcFetch<T>(
  path: string,
  ttlMs: number,
  cache: { data: T | null; ts: number }
): Promise<T | null> {
  const now = Date.now();
  if (cache.data && now - cache.ts < ttlMs) return cache.data;

  const data = await xcodetecFetchJson<T>(path);
  if (data == null) return cache.data;

  cache.data = data;
  cache.ts = now;
  return data;
}

// ── API pubblica ──────────────────────────────────────────────────────────────

export async function getLiveSnapshot(): Promise<XcLiveSnapshot | null> {
  return xcFetch<XcLiveSnapshot>('/live/snapshot', SNAPSHOT_TTL, snapshotCache);
}

export async function getSportConfig(): Promise<XcSportConfig | null> {
  return xcFetch<XcSportConfig>('/sport/config', CONFIG_TTL, sportConfigCache);
}

export async function getNavbar(): Promise<unknown | null> {
  return xcFetch<unknown>('/sport/navbar', NAVBAR_TTL, navbarCache);
}

export async function getLiveCalendar(): Promise<unknown | null> {
  return xcFetch<unknown>('/live/calendar', CALENDAR_TTL, calendarCache);
}

export async function getLiveEventMarkets(
  eventId: string
): Promise<Record<string, XcLiveMarket> | null> {
  const now = Date.now();
  const cached = eventMarketsCache.get(eventId);
  if (cached && now - cached.ts < EVENT_TTL) {
    return cached.data as Record<string, XcLiveMarket>;
  }

  try {
    const res = await xcodetecFetchRaw(`/live/event/${eventId}`, { timeoutMs: 8_000 });
    if (!res.ok) return (cached?.data as Record<string, XcLiveMarket>) ?? null;

    const json = (await res.json()) as
      | { data?: Record<string, XcLiveMarket> }
      | Record<string, XcLiveMarket>;
    const data =
      (json as { data?: Record<string, XcLiveMarket> }).data ??
      (json as Record<string, XcLiveMarket>);

    eventMarketsCache.set(eventId, { data, ts: now });
    if (eventMarketsCache.size > 200) {
      for (const [k, v] of eventMarketsCache) {
        if (now - v.ts > 30_000) eventMarketsCache.delete(k);
      }
    }
    return data;
  } catch {
    return (cached?.data as Record<string, XcLiveMarket>) ?? null;
  }
}

export function invalidateSnapshotCache(): void {
  snapshotCache.ts = 0;
}
