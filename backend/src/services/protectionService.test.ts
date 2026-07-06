import * as fc from 'fast-check';
import { generateDelay, applyLiveMargin, oddsChangedBeyondTolerance, createPendingBet } from './protectionService';

fc.configureGlobal({ numRuns: 100 });

// ── Task 1.1 ──────────────────────────────────────────────────────────────────
// Feature: live-bet-protection, Proprietà 1: Delay sempre nell'intervallo [3000, 5000] ms
// Valida: Requisiti 1.1, 1.6

describe('Proprietà 1: generateDelay — intervallo [3000, 5000] ms', () => {
  it('deve sempre ritornare un valore tra 3000 e 5000 inclusi', () => {
    fc.assert(
      fc.property(fc.integer(), (_seed) => {
        const delay = generateDelay();
        return delay >= 3000 && delay <= 5000;
      })
    );
  });

  it('deve ritornare un intero', () => {
    fc.assert(
      fc.property(fc.integer(), (_seed) => {
        const delay = generateDelay();
        return Number.isInteger(delay);
      })
    );
  });
});

// ── Task 1.2 ──────────────────────────────────────────────────────────────────
// Feature: live-bet-protection, Proprietà 4: Correttezza formula Live Margin
// Valida: Requisiti 2.6, 6.1, 6.2, 6.5

describe('Proprietà 4: applyLiveMargin — correttezza formula e quota > 1.00', () => {
  it('deve essere sempre > 1.00 per qualsiasi quota > 1', () => {
    fc.assert(
      fc.property(fc.float({ min: Math.fround(1.01), max: Math.fround(100), noNaN: true }), (q) => {
        const result = applyLiveMargin(q);
        return result > 1.0;
      })
    );
  });

  it('deve essere uguale a parseFloat((1 / Math.min(0.97, (1/q) * 1.12)).toFixed(2))', () => {
    fc.assert(
      fc.property(fc.float({ min: Math.fround(1.01), max: Math.fround(100), noNaN: true }), (q) => {
        const expected = parseFloat((1 / Math.min(0.97, (1 / q) * 1.12)).toFixed(2));
        const result = applyLiveMargin(q);
        return result === expected;
      })
    );
  });
});

// ── Task 1.3 ──────────────────────────────────────────────────────────────────
// Feature: live-bet-protection, Proprietà 3: Soglia cambio quote
// Valida: Requisiti 2.2, 2.4

describe('Proprietà 3: oddsChangedBeyondTolerance — soglia 3%', () => {
  it('deve ritornare true se |current - accepted| / accepted > 0.03', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1.01), max: Math.fround(50), noNaN: true }),
        fc.float({ min: Math.fround(1.01), max: Math.fround(50), noNaN: true }),
        (accepted, current) => {
          const diff = Math.abs(current - accepted) / accepted;
          if (diff > 0.03) {
            return oddsChangedBeyondTolerance(accepted, current) === true;
          }
          return true; // skip this case
        }
      )
    );
  });

  it('deve ritornare false se |current - accepted| / accepted <= 0.03', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1.01), max: Math.fround(50), noNaN: true }),
        fc.float({ min: Math.fround(1.01), max: Math.fround(50), noNaN: true }),
        (accepted, current) => {
          const diff = Math.abs(current - accepted) / accepted;
          if (diff <= 0.03) {
            return oddsChangedBeyondTolerance(accepted, current) === false;
          }
          return true; // skip this case
        }
      )
    );
  });

  it('deve coprire entrambi i casi (true e false) in modo combinato', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1.01), max: Math.fround(50), noNaN: true }),
        fc.float({ min: Math.fround(1.01), max: Math.fround(50), noNaN: true }),
        (accepted, current) => {
          const diff = Math.abs(current - accepted) / accepted;
          const result = oddsChangedBeyondTolerance(accepted, current);
          if (diff > 0.03) return result === true;
          return result === false;
        }
      )
    );
  });
});

// ── Task 1.4 ──────────────────────────────────────────────────────────────────
// Feature: live-bet-protection, Proprietà 5: TTL Pending Bet ≤ 30 secondi
// Valida: Requisiti 3.7

// Mock Redis per verificare il TTL senza connessione reale
jest.mock('./cacheService', () => {
  const mockSet = jest.fn().mockResolvedValue('OK');
  const mockGet = jest.fn().mockResolvedValue(null);
  return {
    getRedisClient: () => ({
      set: mockSet,
      get: mockGet,
    }),
  };
});

describe('Proprietà 5: createPendingBet — TTL ≤ 30 secondi', () => {
  it('deve chiamare Redis set con TTL ≤ 30 secondi', async () => {
    const { getRedisClient } = require('./cacheService');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          event_id: fc.uuid(),
          stake: fc.float({ min: Math.fround(1), max: Math.fround(20), noNaN: true }),
          accepted_odds: fc.record({ home: fc.float({ min: Math.fround(1.01), max: Math.fround(10), noNaN: true }) }),
        }),
        async (data) => {
          const mockRedis = getRedisClient();
          mockRedis.set.mockClear();

          await createPendingBet({
            user_id: data.event_id,
            event_id: data.event_id,
            selections: [],
            stake: data.stake,
            accepted_odds: data.accepted_odds,
          });

          // Verifica che set sia stato chiamato
          expect(mockRedis.set).toHaveBeenCalledTimes(1);

          // Estrai il TTL dall'argomento della chiamata: set(key, value, 'EX', ttl)
          const callArgs = mockRedis.set.mock.calls[0];
          const ttl = callArgs[3]; // quarto argomento è il valore TTL

          return typeof ttl === 'number' && ttl <= 30;
        }
      )
    );
  });
});

// ── Task 5.1 ──────────────────────────────────────────────────────────────────
// Feature: live-bet-protection, Proprietà 11: Log contiene tutti i campi richiesti per ogni Pending_Bet processata
// Valida: Requisiti 7.1, 7.2, 7.3

import { logProtectionEvent, protectionLog } from './protectionService';
import { ProtectionLogEntry } from '../types/liveProtection';

describe('Proprietà 11: logProtectionEvent — completezza dei campi nel log', () => {

  // Proprietà 11a: entry con outcome 'accepted' contiene tutti i campi obbligatori
  it('deve contenere timestamp, pending_id, event_id, stake, accepted_odds, outcome per outcome=accepted', () => {
    fc.assert(
      fc.property(
        fc.record({
          timestamp: fc.date().map(d => d.toISOString()),
          pending_id: fc.uuid(),
          event_id: fc.uuid(),
          stake: fc.float({ min: Math.fround(0.01), max: Math.fround(20), noNaN: true }),
          accepted_odds: fc.record({
            home: fc.float({ min: Math.fround(1.01), max: Math.fround(10), noNaN: true }),
          }),
        }),
        (data) => {
          const entry: ProtectionLogEntry = {
            timestamp: data.timestamp,
            pending_id: data.pending_id,
            event_id: data.event_id,
            stake: data.stake,
            accepted_odds: data.accepted_odds,
            outcome: 'accepted',
          };

          logProtectionEvent(entry);

          const logged = protectionLog[protectionLog.length - 1];

          return (
            typeof logged.timestamp === 'string' &&
            logged.timestamp.length > 0 &&
            typeof logged.pending_id === 'string' &&
            logged.pending_id.length > 0 &&
            typeof logged.event_id === 'string' &&
            logged.event_id.length > 0 &&
            typeof logged.stake === 'number' &&
            typeof logged.accepted_odds === 'object' &&
            logged.accepted_odds !== null &&
            logged.outcome === 'accepted'
          );
        }
      )
    );
  });

  // Proprietà 11b: entry con outcome 'rejected' e rejection_reason 'odds_changed' contiene anche odds_diff_pct
  it('deve contenere odds_diff_pct per outcome=rejected con rejection_reason=odds_changed', () => {
    fc.assert(
      fc.property(
        fc.record({
          timestamp: fc.date().map(d => d.toISOString()),
          pending_id: fc.uuid(),
          event_id: fc.uuid(),
          stake: fc.float({ min: Math.fround(0.01), max: Math.fround(20), noNaN: true }),
          accepted_odds: fc.record({
            home: fc.float({ min: Math.fround(1.01), max: Math.fround(10), noNaN: true }),
          }),
          odds_diff_pct: fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
        }),
        (data) => {
          const entry: ProtectionLogEntry = {
            timestamp: data.timestamp,
            pending_id: data.pending_id,
            event_id: data.event_id,
            stake: data.stake,
            accepted_odds: data.accepted_odds,
            outcome: 'rejected',
            rejection_reason: 'odds_changed',
            odds_diff_pct: data.odds_diff_pct,
          };

          logProtectionEvent(entry);

          const logged = protectionLog[protectionLog.length - 1];

          return (
            logged.outcome === 'rejected' &&
            logged.rejection_reason === 'odds_changed' &&
            typeof logged.odds_diff_pct === 'number' &&
            logged.odds_diff_pct > 0
          );
        }
      )
    );
  });

  // Proprietà 11c: il buffer circolare non supera mai 1000 entry
  it('il buffer circolare non deve mai superare 1000 entry', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1001, max: 2000 }),
        (n) => {
          // Svuota il log prima del test
          protectionLog.length = 0;

          for (let i = 0; i < n; i++) {
            logProtectionEvent({
              timestamp: new Date().toISOString(),
              pending_id: `pending-${i}`,
              event_id: `event-${i}`,
              stake: 10,
              accepted_odds: { home: 2.0 },
              outcome: i % 2 === 0 ? 'accepted' : 'rejected',
            });
          }

          return protectionLog.length <= 1000;
        }
      )
    );
  });
});
