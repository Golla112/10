import { getRedisClient } from '../services/cacheService';

const LOCK_MIN_MS = 5000;
const LOCK_MAX_MS = 10000;
const MONITOR_INTERVAL_MS = 5000;

/**
 * Returns true if home or away score has changed between prevScore and currScore.
 */
export function detectCriticalEvent(
  _eventId: string,
  prevScore: { home: number; away: number },
  currScore: { home: number; away: number }
): boolean {
  return prevScore.home !== currScore.home || prevScore.away !== currScore.away;
}

/**
 * Saves (or overwrites) the market lock key in Redis with a random TTL between 5000–10000 ms.
 * Always uses SET without NX so it extends an existing lock.
 */
export async function activateMarketLock(eventId: string): Promise<void> {
  const redis = getRedisClient();
  const ttlMs = Math.floor(Math.random() * (LOCK_MAX_MS - LOCK_MIN_MS + 1)) + LOCK_MIN_MS;
  const key = `live:lock:${eventId}`;
  await redis.set(key, '1', 'PX', ttlMs);
}

/**
 * Returns true if the market lock key exists in Redis for the given eventId.
 */
export async function isMarketLocked(eventId: string): Promise<boolean> {
  const redis = getRedisClient();
  const val = await redis.get(`live:lock:${eventId}`);
  return val !== null;
}

/**
 * Starts a monitoring loop that runs every 5 seconds.
 * Compares current scores with previous scores stored in Redis (live:score:{eventId}).
 * If a score change is detected, activates a market lock for that event.
 */
export function startMonitoring(): NodeJS.Timeout {
  return setInterval(async () => {
    const redis = getRedisClient();

    // Scan for all live:score:* keys
    let cursor = '0';
    const scoreKeys: string[] = [];

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'live:score:*', 'COUNT', 100);
      cursor = nextCursor;
      scoreKeys.push(...keys);
    } while (cursor !== '0');

    for (const key of scoreKeys) {
      const eventId = key.replace('live:score:', '');
      const raw = await redis.get(key);
      if (!raw) continue;

      let currScore: { home: number; away: number };
      try {
        currScore = JSON.parse(raw);
      } catch {
        continue;
      }

      // Read previous score from live:prev_score:{eventId}
      const prevKey = `live:prev_score:${eventId}`;
      const prevRaw = await redis.get(prevKey);

      if (prevRaw) {
        let prevScore: { home: number; away: number };
        try {
          prevScore = JSON.parse(prevRaw);
        } catch {
          // Store current as previous and continue
          await redis.set(prevKey, raw, 'EX', 60);
          continue;
        }

        if (detectCriticalEvent(eventId, prevScore, currScore)) {
          await activateMarketLock(eventId);
        }
      }

      // Update previous score to current
      await redis.set(prevKey, raw, 'EX', 60);
    }
  }, MONITOR_INTERVAL_MS);
}
