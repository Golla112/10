/**
 * xcodetecCache - Redis caching layer for xcodetec API
 * Provides persistent caching with TTL for xcodetec data
 */

import { getRedisClient, clampTTL } from './cacheService';

const CACHE_KEYS = {
  navbar: 'xcodetec:navbar',
  liveSnapshot: 'xcodetec:live:snapshot',
  prematch: (sportId: number, catId: number, tourId: number) => `xcodetec:prematch:${sportId}:${catId}:${tourId}`,
  event: (eventId: string) => `xcodetec:event:${eventId}`,
  lastUpdate: 'xcodetec:lastUpdate',
};

const TTL = {
  navbar: 10 * 60,        // 10 minutes
  liveSnapshot: 30,       // 30 seconds for live
  prematch: 5 * 60,       // 5 minutes for prematch
  event: 60,              // 1 minute per evento
  lastUpdate: 7 * 24 * 3600, // 7 days for stats
};

export async function getCachedNavbar(): Promise<any | null> {
  try {
    const client = getRedisClient();
    const data = await client.get(CACHE_KEYS.navbar);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('[xcodetecCache] getCachedNavbar error:', err);
    return null;
  }
}

export async function setCachedNavbar(data: any): Promise<void> {
  try {
    const client = getRedisClient();
    await client.set(CACHE_KEYS.navbar, JSON.stringify(data), 'EX', TTL.navbar);
  } catch (err) {
    console.error('[xcodetecCache] setCachedNavbar error:', err);
  }
}

export async function getCachedLiveSnapshot(): Promise<any | null> {
  try {
    const client = getRedisClient();
    const data = await client.get(CACHE_KEYS.liveSnapshot);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('[xcodetecCache] getCachedLiveSnapshot error:', err);
    return null;
  }
}

export async function setCachedLiveSnapshot(data: any): Promise<void> {
  try {
    const client = getRedisClient();
    await client.set(CACHE_KEYS.liveSnapshot, JSON.stringify(data), 'EX', TTL.liveSnapshot);
    await client.set(CACHE_KEYS.lastUpdate, Date.now().toString(), 'EX', TTL.lastUpdate);
  } catch (err) {
    console.error('[xcodetecCache] setCachedLiveSnapshot error:', err);
  }
}

export async function getCachedPrematch(sportId: number, catId: number, tourId: number): Promise<any | null> {
  try {
    const client = getRedisClient();
    const data = await client.get(CACHE_KEYS.prematch(sportId, catId, tourId));
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('[xcodetecCache] getCachedPrematch error:', err);
    return null;
  }
}

export async function setCachedPrematch(sportId: number, catId: number, tourId: number, data: any): Promise<void> {
  try {
    const client = getRedisClient();
    await client.set(CACHE_KEYS.prematch(sportId, catId, tourId), JSON.stringify(data), 'EX', TTL.prematch);
  } catch (err) {
    console.error('[xcodetecCache] setCachedPrematch error:', err);
  }
}

export async function getCachedEvent(eventId: string): Promise<any | null> {
  try {
    const client = getRedisClient();
    const data = await client.get(CACHE_KEYS.event(eventId));
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('[xcodetecCache] getCachedEvent error:', err);
    return null;
  }
}

export async function setCachedEvent(eventId: string, data: any): Promise<void> {
  try {
    const client = getRedisClient();
    await client.set(CACHE_KEYS.event(eventId), JSON.stringify(data), 'EX', TTL.event);
  } catch (err) {
    console.error('[xcodetecCache] setCachedEvent error:', err);
  }
}

export async function clearXcodetecCache(): Promise<void> {
  try {
    const client = getRedisClient();
    const keys = await client.keys('xcodetec:*');
    if (keys.length > 0) {
      await client.del(...keys);
      console.log(`[xcodetecCache] Cleared ${keys.length} cache keys`);
    }
  } catch (err) {
    console.error('[xcodetecCache] clearXcodetecCache error:', err);
  }
}

export async function getLastUpdate(): Promise<number | null> {
  try {
    const client = getRedisClient();
    const data = await client.get(CACHE_KEYS.lastUpdate);
    return data ? parseInt(data, 10) : null;
  } catch (err) {
    return null;
  }
}
