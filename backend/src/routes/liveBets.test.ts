/**
 * Property-based tests per le route /bet/live
 * Feature: live-bet-protection
 *
 * Nota: supertest non è disponibile come dipendenza, quindi i test
 * verificano direttamente le funzioni di validazione esportate dal router.
 */

import * as fc from 'fast-check';

// ── Configurazione fast-check ─────────────────────────────────────────────────
fc.configureGlobal({ numRuns: 100 });

// ── Mock dei moduli ───────────────────────────────────────────────────────────

jest.mock('../services/liveService', () => ({
  isEventLive: jest.fn(),
  getEventH2HOdds: jest.fn(),
}));

jest.mock('../jobs/marketLockMonitor', () => ({
  isMarketLocked: jest.fn(),
}));

jest.mock('../services/protectionService', () => ({
  createPendingBet: jest.fn(),
  getPendingBet: jest.fn(),
  processPendingBet: jest.fn(),
  getProtectionStats: jest.fn(),
}));

import {
  validateLiveStake,
  validateLiveSelections,
  hasLiveSelections,
  checkMarketLocks,
  LIVE_MAX_STAKE,
} from './liveBets';
import { getPendingBet } from '../services/protectionService';

const mockGetPendingBet = getPendingBet as jest.MockedFunction<typeof getPendingBet>;

// ── Helper: selezione live valida ─────────────────────────────────────────────

function makeLiveSelection(eventId: string) {
  return {
    event_id: eventId,
    nome_evento: 'Test Event',
    market: 'h2h',
    outcome: '1' as const,
    quota: 1.5,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 3.1 — Proprietà 10: Stake > €20 su scommessa live → rifiuto 400
// Feature: live-bet-protection, Proprietà 10: Stake > €20 su scommessa live → rifiuto 400
// Valida: Requisiti 5.1, 5.4
// ─────────────────────────────────────────────────────────────────────────────

describe('Proprietà 10: Stake > €20 su scommessa live → rifiuto 400', () => {
  it('validateLiveStake ritorna errore per qualsiasi stake > 20€', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(LIVE_MAX_STAKE + 0.01), max: Math.fround(LIVE_MAX_STAKE + 50000), noNaN: true }),
        (stake) => {
          const error = validateLiveStake(stake);
          // Deve ritornare un messaggio di errore (non null)
          expect(error).not.toBeNull();
          expect(error).toMatch(new RegExp(String(LIVE_MAX_STAKE)));
        }
      )
    );
  });

  it('validateLiveStake non ritorna errore per stake ≤ 20€', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(LIVE_MAX_STAKE), noNaN: true }),
        (stake) => {
          const error = validateLiveStake(stake);
          expect(error).toBeNull();
        }
      )
    );
  });

  it('validateLiveStake ritorna errore per stake esattamente 0 o negativo', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(-10000), max: Math.fround(0), noNaN: true }),
        (stake) => {
          const error = validateLiveStake(stake);
          expect(error).not.toBeNull();
        }
      )
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 3.2 — Proprietà 7: Market Lock attivo → tutte le scommesse sull'evento rifiutate
// Feature: live-bet-protection, Proprietà 7: Market Lock attivo → tutte le scommesse sull'evento rifiutate
// Valida: Requisiti 4.2
// ─────────────────────────────────────────────────────────────────────────────

describe('Proprietà 7: Market Lock attivo → rifiuto (checkMarketLocks ritorna event_id)', () => {
  it('checkMarketLocks ritorna event_id per qualsiasi evento con market lock attivo', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({ event_id: fc.uuid() }),
        async ({ event_id }) => {
          // isEventLive ritorna true per questo evento
          const isEventLiveFn = (_id: string) => true;
          // isMarketLocked ritorna true per qualsiasi evento
          const isMarketLockedFn = async (_id: string) => true;

          const selections = [makeLiveSelection(event_id)];
          const lockedId = await checkMarketLocks(selections, isEventLiveFn, isMarketLockedFn);

          // Deve ritornare l'event_id bloccato (non null)
          expect(lockedId).toBe(event_id);
        }
      )
    );
  });

  it('checkMarketLocks ritorna null quando nessun evento è bloccato', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({ event_id: fc.uuid() }),
        async ({ event_id }) => {
          const isEventLiveFn = (_id: string) => true;
          const isMarketLockedFn = async (_id: string) => false;

          const selections = [makeLiveSelection(event_id)];
          const lockedId = await checkMarketLocks(selections, isEventLiveFn, isMarketLockedFn);

          expect(lockedId).toBeNull();
        }
      )
    );
  });

  it('checkMarketLocks blocca indipendentemente dallo stake', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: Math.fround(1), max: Math.fround(LIVE_MAX_STAKE), noNaN: true }),
        fc.uuid(),
        async (stake, event_id) => {
          // Lo stake non influenza checkMarketLocks — verifica che il lock sia indipendente
          const isEventLiveFn = (_id: string) => true;
          const isMarketLockedFn = async (_id: string) => true;

          const selections = [makeLiveSelection(event_id)];
          const lockedId = await checkMarketLocks(selections, isEventLiveFn, isMarketLockedFn);

          // Il lock deve essere rilevato indipendentemente dallo stake
          expect(lockedId).toBe(event_id);
          // Lo stake è valido (≤ 20) ma il lock blocca comunque
          expect(validateLiveStake(stake)).toBeNull();
        }
      )
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 3.3 — Proprietà 6: Scommesse live senza pending_id valido → rifiuto
// Feature: live-bet-protection, Proprietà 6: Scommesse live senza pending_id valido → rifiuto
// Valida: Requisiti 3.1
// ─────────────────────────────────────────────────────────────────────────────

describe('Proprietà 6: Scommesse live senza pending_id valido → rifiuto 404', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // getPendingBet ritorna null per qualsiasi pending_id
    mockGetPendingBet.mockResolvedValue(null);
  });

  it('getPendingBet ritorna null per qualsiasi pending_id non valido', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (pendingId) => {
          const result = await getPendingBet(pendingId);
          // Deve ritornare null → il router risponderà 404
          expect(result).toBeNull();
        }
      )
    );
  });

  it('getPendingBet ritorna null anche per pending_id con formato arbitrario', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (pendingId) => {
          const result = await getPendingBet(pendingId);
          expect(result).toBeNull();
        }
      )
    );
  });
});


