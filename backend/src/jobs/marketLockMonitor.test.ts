import * as fc from 'fast-check';
import { detectCriticalEvent, activateMarketLock, isMarketLocked } from './marketLockMonitor';

fc.configureGlobal({ numRuns: 100 });

// ── Mock Redis ────────────────────────────────────────────────────────────────

const mockStore: Map<string, string> = new Map();

const mockRedis = {
  get: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  set: jest.fn(async (key: string, value: string, _mode?: string, _ttl?: number) => {
    mockStore.set(key, value);
    return 'OK';
  }),
};

jest.mock('../services/cacheService', () => ({
  getRedisClient: () => mockRedis,
}));

beforeEach(() => {
  mockStore.clear();
  mockRedis.get.mockClear();
  mockRedis.set.mockClear();
});

// ── Proprietà 8: Rilevamento Critical Event da cambio punteggio ───────────────

describe('detectCriticalEvent', () => {
  // Feature: live-bet-protection, Proprietà 8: Rilevamento Critical Event da cambio punteggio
  // Valida: Requisiti 4.1, 4.5
  it('Proprietà 8 — ritorna true se home o away score è cambiato', () => {
    fc.assert(
      fc.property(
        fc.record({ home: fc.nat(), away: fc.nat() }),
        fc.record({ home: fc.nat(), away: fc.nat() }),
        (prevScore, currScore) => {
          const result = detectCriticalEvent('event-1', prevScore, currScore);

          if (prevScore.home !== currScore.home || prevScore.away !== currScore.away) {
            // Score changed → must detect critical event
            expect(result).toBe(true);
          } else {
            // Score unchanged → no critical event
            expect(result).toBe(false);
          }
        }
      )
    );
  });

  it('Proprietà 8 — ritorna false se i punteggi sono identici', () => {
    fc.assert(
      fc.property(
        fc.record({ home: fc.nat(), away: fc.nat() }),
        (score) => {
          const result = detectCriticalEvent('event-1', score, { ...score });
          expect(result).toBe(false);
        }
      )
    );
  });
});

// ── Proprietà 9: Estensione lock — un solo lock attivo per evento ─────────────

describe('activateMarketLock — idempotenza', () => {
  // Feature: live-bet-protection, Proprietà 9: Estensione lock — un solo lock attivo per evento
  // Valida: Requisiti 4.6
  it('Proprietà 9 — chiamare activateMarketLock N volte sullo stesso eventId produce esattamente 1 chiave in Redis', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 1, max: 5 }),
        async (eventId, numCalls) => {
          // Reset store and mocks for each run
          mockStore.clear();
          mockRedis.set.mockClear();

          for (let i = 0; i < numCalls; i++) {
            await activateMarketLock(eventId);
          }

          // Count how many distinct live:lock:{eventId} keys exist
          const lockKey = `live:lock:${eventId}`;
          const keysInStore = Array.from(mockStore.keys()).filter(k => k === lockKey);

          // Must be exactly 1 key (no duplicates)
          expect(keysInStore.length).toBe(1);

          // SET must have been called numCalls times (always overwrites, never NX)
          expect(mockRedis.set).toHaveBeenCalledTimes(numCalls);

          // Each call must use PX (milliseconds TTL), not EX
          for (const call of mockRedis.set.mock.calls) {
            expect(call[2]).toBe('PX');
            const ttlMs = call[3] as number;
            expect(ttlMs).toBeGreaterThanOrEqual(5000);
            expect(ttlMs).toBeLessThanOrEqual(10000);
          }
        }
      )
    );
  });
});
