import Redis from 'ioredis';

const EVENTS_KEY = 'events:all';
const EVENTS_TTL_MIN = 600;
const EVENTS_TTL_MAX = 7 * 24 * 3600;
const ODDS_TTL_MIN = 300;
const ODDS_TTL_MAX = 900;

let redisClient: Redis | null = null;
let redisAvailable = true;

// ── In-memory fallback quando Redis non è disponibile ─────────────────────────
const memCache = new Map<string, { value: string; expiresAt: number }>();

function memGet(key: string): string | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { memCache.delete(key); return null; }
  return entry.value;
}

function memSet(key: string, value: string, ttlSeconds: number): void {
  memCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function memDel(key: string): void {
  memCache.delete(key);
}

// ── Redis client ──────────────────────────────────────────────────────────────

export function getRedisClient(): Redis {
  if (!redisClient) {
    const url = process.env.UPSTASH_REDIS_URL;
    const token = process.env.UPSTASH_REDIS_TOKEN;

    if (url && token) {
      // Con Upstash la password è già nell'URL — non passarla di nuovo come opzione
      redisClient = new Redis(url, {
        tls: { rejectUnauthorized: false },
        maxRetriesPerRequest: 2,
        retryStrategy: (times) => (times > 3 ? null : Math.min(times * 300, 2000)),
        connectTimeout: 8000,
        lazyConnect: true,
      });
    } else {
      // Nessuna config Redis — usa solo in-memory
      redisAvailable = false;
      // Ritorna un client dummy che non si connette mai
      redisClient = new Redis({ lazyConnect: true, enableOfflineQueue: false });
    }

    redisClient.on('error', (err) => {
      if (redisAvailable) {
        console.error('[redis] Errore connessione:', err.message);
        redisAvailable = false;
      }
    });

    redisClient.on('connect', () => {
      if (!redisAvailable) {
        console.log('[redis] Connessione ripristinata');
        redisAvailable = true;
      }
    });
  }
  return redisClient;
}

export function clampTTL(ttl: number, min: number, max: number): number {
  return Math.min(Math.max(ttl, min), max);
}

// ── Cache helpers con fallback in-memory ──────────────────────────────────────

async function safeGet(key: string): Promise<string | null> {
  if (!redisAvailable) return memGet(key);
  try {
    const client = getRedisClient();
    const val = await client.get(key);
    // Sincronizza in-memory come backup
    if (val !== null) memSet(key, val, EVENTS_TTL_MAX);
    return val;
  } catch {
    redisAvailable = false;
    return memGet(key);
  }
}

async function safeSet(key: string, value: string, ttl: number): Promise<void> {
  // Scrivi sempre in-memory come backup
  memSet(key, value, ttl);
  if (!redisAvailable) return;
  try {
    const client = getRedisClient();
    await client.set(key, value, 'EX', ttl);
  } catch {
    redisAvailable = false;
  }
}

async function safeDel(key: string): Promise<void> {
  memDel(key);
  if (!redisAvailable) return;
  try {
    const client = getRedisClient();
    await client.del(key);
  } catch {
    redisAvailable = false;
  }
}

async function safeSetNX(key: string, ttl: number): Promise<boolean> {
  if (!redisAvailable) {
    if (memGet(key) !== null) return false;
    memSet(key, '1', ttl);
    return true;
  }
  try {
    const client = getRedisClient();
    const result = await client.set(key, '1', 'EX', ttl, 'NX');
    return result === 'OK';
  } catch {
    redisAvailable = false;
    if (memGet(key) !== null) return false;
    memSet(key, '1', ttl);
    return true;
  }
}

// ── API pubblica ──────────────────────────────────────────────────────────────

export async function getEvents(): Promise<unknown[] | null> {
  const data = await safeGet(EVENTS_KEY);
  if (!data) return null;
  try { return JSON.parse(data); } catch { return null; }
}

export async function setEvents(data: unknown[], ttlSeconds: number): Promise<void> {
  const ttl = clampTTL(ttlSeconds, EVENTS_TTL_MIN, EVENTS_TTL_MAX);
  await safeSet(EVENTS_KEY, JSON.stringify(data), ttl);
}

export async function getOdds(eventId: string): Promise<unknown | null> {
  const data = await safeGet(`odds:${eventId}`);
  if (!data) return null;
  try { return JSON.parse(data); } catch { return null; }
}

export async function setOdds(eventId: string, data: unknown, ttlSeconds: number): Promise<void> {
  const ttl = clampTTL(ttlSeconds, ODDS_TTL_MIN, ODDS_TTL_MAX);
  await safeSet(`odds:${eventId}`, JSON.stringify(data), ttl);
}

export async function acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
  return safeSetNX(key, ttlSeconds);
}

export async function releaseLock(key: string): Promise<void> {
  await safeDel(key);
}

export async function setDebounce(key: string, ttlSeconds: number): Promise<void> {
  await safeSet(key, '1', ttlSeconds);
}

export async function checkDebounce(key: string): Promise<boolean> {
  return (await safeGet(key)) !== null;
}

export async function getRedisValue(key: string): Promise<string | null> {
  return safeGet(key);
}

export async function setRedisValue(key: string, value: string, ttlSeconds: number): Promise<void> {
  await safeSet(key, value, ttlSeconds);
}
