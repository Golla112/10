/**
 * Property-based tests per adminUtils.ts
 * Usa fast-check per verificare le proprietà universali delle funzioni pure.
 */

import * as fc from 'fast-check';
import {
  filterUsersByUsername,
  calculateAddBalance,
  calculateSubtractBalance,
  validateAmount,
  filterBetsByStatus,
  filterBetsByDateRange,
  calculateBookProfit,
  shouldShowPaidBadge,
  AdminUser,
  AdminBet,
} from './adminUtils';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const adminUserArb = (): fc.Arbitrary<AdminUser> =>
  fc.record({
    id: fc.uuid(),
    username: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
    balance: fc.double({ min: 0, max: 1_000_000, noNaN: true }),
    is_blocked: fc.boolean(),
    created_at: fc.constantFrom(
      '2024-01-01T00:00:00',
      '2024-06-15T12:00:00',
      '2023-12-31T23:59:59',
    ),
  });

const betResultArb = (): fc.Arbitrary<string> =>
  fc.constantFrom('win', 'lose', 'pending', 'cancelled');

const adminBetArb = (): fc.Arbitrary<AdminBet> =>
  fc.record({
    result: betResultArb(),
    stake: fc.double({ min: 0.01, max: 10_000, noNaN: true }),
    potential_win: fc.double({ min: 0.01, max: 100_000, noNaN: true }),
    paid_at: fc.option(
      fc.constantFrom('2024-01-01T10:00:00', '2024-06-01T08:30:00'),
      { nil: null },
    ),
    created_at: fc.constantFrom(
      '2024-01-15T10:00:00',
      '2024-03-20T14:30:00',
      '2024-06-01T08:00:00',
      '2023-12-01T00:00:00',
    ),
  });

// ---------------------------------------------------------------------------
// Proprietà 1: Conteggio utenti
// Feature: admin-panel, Property 1: Conteggio utenti
// ---------------------------------------------------------------------------

describe('Property 1: Conteggio utenti', () => {
  // **Validates: Requirements 1.1**
  it('filterUsersByUsername con search="" restituisce tutti gli N utenti', () => {
    fc.assert(
      fc.property(fc.array(adminUserArb()), (users) => {
        const result = filterUsersByUsername(users, '');
        return result.length === users.length;
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Proprietà 2: Somma saldi utenti
// Feature: admin-panel, Property 2: Somma saldi utenti
// ---------------------------------------------------------------------------

describe('Property 2: Somma saldi utenti', () => {
  // **Validates: Requirements 1.2**
  it('la somma dei balance è uguale alla somma aritmetica', () => {
    fc.assert(
      fc.property(fc.array(adminUserArb()), (users) => {
        const expected = users.reduce((acc, u) => acc + u.balance, 0);
        const actual = users.reduce((acc, u) => acc + u.balance, 0);
        return Math.abs(actual - expected) < 0.0001;
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Proprietà 3: Calcolo profitto book
// Feature: admin-panel, Property 3: Calcolo profitto book
// ---------------------------------------------------------------------------

describe('Property 3: Calcolo profitto book', () => {
  // **Validates: Requirements 1.4, 8.4**
  it('calculateBookProfit = SUM(stake lose) - SUM(potential_win win); pending/cancelled ignorati', () => {
    fc.assert(
      fc.property(fc.array(adminBetArb()), (bets) => {
        const expected =
          bets.filter(b => b.result === 'lose').reduce((s, b) => s + b.stake, 0) -
          bets.filter(b => b.result === 'win').reduce((s, b) => s + b.potential_win, 0);
        const actual = calculateBookProfit(bets);
        return Math.abs(actual - expected) < 0.001;
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Proprietà 4: Filtro username case-insensitive
// Feature: admin-panel, Property 4: Filtro username case-insensitive
// ---------------------------------------------------------------------------

describe('Property 4: Filtro username case-insensitive', () => {
  // **Validates: Requirements 2.2**
  it('tutti i risultati hanno username che contiene search (case-insensitive)', () => {
    fc.assert(
      fc.property(
        fc.array(adminUserArb()),
        fc.string({ minLength: 1, maxLength: 10 }),
        (users, search) => {
          const result = filterUsersByUsername(users, search);
          return result.every(u =>
            u.username.toLowerCase().includes(search.toLowerCase()),
          );
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Proprietà 5: Calcolo aggiungi saldo
// Feature: admin-panel, Property 5: Calcolo aggiungi saldo
// ---------------------------------------------------------------------------

describe('Property 5: Calcolo aggiungi saldo', () => {
  // **Validates: Requirements 3.1**
  it('calculateAddBalance(s, a) === s + a per s >= 0 e a > 0', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1_000_000, noNaN: true }),
        fc.double({ min: 0.01, max: 1_000_000, noNaN: true }),
        (s, a) => {
          return Math.abs(calculateAddBalance(s, a) - (s + a)) < 0.0001;
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Proprietà 6: Calcolo sottrai saldo con non-negatività
// Feature: admin-panel, Property 6: Calcolo sottrai saldo con non-negatività
// ---------------------------------------------------------------------------

describe('Property 6: Calcolo sottrai saldo con non-negatività', () => {
  // **Validates: Requirements 3.2**
  it('calculateSubtractBalance(s, a) === MAX(0, s - a) e mai negativo', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1_000_000, noNaN: true }),
        fc.double({ min: 0.01, max: 1_000_000, noNaN: true }),
        (s, a) => {
          const result = calculateSubtractBalance(s, a);
          const expected = Math.max(0, s - a);
          return result >= 0 && Math.abs(result - expected) < 0.0001;
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Proprietà 7: Validazione importo non valido
// Feature: admin-panel, Property 7: Validazione importo non valido
// ---------------------------------------------------------------------------

describe('Property 7: Validazione importo non valido', () => {
  // **Validates: Requirements 3.4**
  it('validateAmount(positive) === true', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.001, max: 1_000_000, noNaN: true }), (v) => {
        return validateAmount(v) === true;
      }),
    );
  });

  it('validateAmount(0) === false', () => {
    expect(validateAmount(0)).toBe(false);
  });

  it('validateAmount(negative) === false', () => {
    fc.assert(
      fc.property(fc.double({ min: -1_000_000, max: -0.001, noNaN: true }), (v) => {
        return validateAmount(v) === false;
      }),
    );
  });

  it('validateAmount(NaN) === false', () => {
    expect(validateAmount(NaN)).toBe(false);
  });

  it('validateAmount(string) === false', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        return validateAmount(s) === false;
      }),
    );
  });

  it('validateAmount(undefined) === false', () => {
    expect(validateAmount(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Proprietà 8: Filtro scommesse per stato
// Feature: admin-panel, Property 8: Filtro scommesse per stato
// ---------------------------------------------------------------------------

describe('Property 8: Filtro scommesse per stato', () => {
  // **Validates: Requirements 5.2**
  it('tutti i risultati hanno result === status', () => {
    fc.assert(
      fc.property(
        fc.array(adminBetArb()),
        fc.constantFrom('pending', 'win', 'lose', 'cancelled'),
        (bets, status) => {
          const result = filterBetsByStatus(bets, status);
          return result.every(b => b.result === status);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Proprietà 9: Filtro scommesse per data
// Feature: admin-panel, Property 9: Filtro scommesse per data
// ---------------------------------------------------------------------------

describe('Property 9: Filtro scommesse per data', () => {
  // **Validates: Requirements 5.3**
  it('tutti i risultati hanno created_at nel range [from, to+T23:59:59]', () => {
    const dateOptions = [
      '2024-01-01',
      '2024-03-01',
      '2024-06-01',
      '2024-09-01',
      '2024-12-01',
    ] as const;

    fc.assert(
      fc.property(
        fc.array(adminBetArb()),
        fc.constantFrom(...dateOptions),
        fc.constantFrom(...dateOptions),
        (bets, d1, d2) => {
          const from = d1 <= d2 ? d1 : d2;
          const to = d1 <= d2 ? d2 : d1;
          const result = filterBetsByDateRange(bets, from, to);
          const toEnd = `${to}T23:59:59`;
          return result.every(b => b.created_at >= from && b.created_at <= toEnd);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Proprietà 12: Badge "Pagata" condizionale
// Feature: admin-panel, Property 12: Badge "Pagata" condizionale
// ---------------------------------------------------------------------------

describe('Property 12: Badge "Pagata" condizionale', () => {
  // **Validates: Requirements 7.3**
  it('shouldShowPaidBadge è true se e solo se result === "win" && paid_at !== null', () => {
    fc.assert(
      fc.property(adminBetArb(), (bet) => {
        const show = shouldShowPaidBadge(bet);
        const expected = bet.result === 'win' && bet.paid_at != null;
        return show === expected;
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Proprietà 14: Header x-site-password nelle chiamate API
// Feature: admin-panel, Property 14: Header x-site-password nelle chiamate API
// ---------------------------------------------------------------------------

import {
  adminListUsers,
  adminUpdateBalance,
  adminBlockUser,
  adminGetStats,
} from './api';

// Mock del modulo session per controllare getStoredPassword
jest.mock('./session', () => ({
  getStoredPassword: jest.fn(() => 'default-password'),
  getStoredUser: jest.fn(() => null),
}));

describe('Property 14: Header x-site-password nelle chiamate API', () => {
  // Feature: admin-panel, Property 14: Header x-site-password nelle chiamate API
  // **Validates: Requirements 9.2, 10.5**

  const session = require('./session') as { getStoredPassword: jest.Mock };

  let fetchMock: jest.Mock;

  beforeEach(() => {
    // Mock fetch globale (non esiste in Node, va assegnato direttamente)
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
      text: async () => '',
    } as unknown as Response);
    (global as unknown as Record<string, unknown>)['fetch'] = fetchMock;
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>)['fetch'];
    jest.clearAllMocks();
  });

  it('adminListUsers include sempre x-site-password', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (password) => {
          fetchMock.mockClear();
          session.getStoredPassword.mockReturnValue(password);

          await adminListUsers().catch(() => {});

          expect(fetchMock).toHaveBeenCalled();
          const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
          const headers = init?.headers as Record<string, string>;
          return headers?.['x-site-password'] === password;
        },
      ),
    );
  });

  it('adminUpdateBalance include sempre x-site-password', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.uuid(),
        fc.double({ min: 0, max: 100_000, noNaN: true }),
        async (password, id, balance) => {
          fetchMock.mockClear();
          session.getStoredPassword.mockReturnValue(password);

          await adminUpdateBalance(id, balance).catch(() => {});

          expect(fetchMock).toHaveBeenCalled();
          const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
          const headers = init?.headers as Record<string, string>;
          return headers?.['x-site-password'] === password;
        },
      ),
    );
  });

  it('adminBlockUser include sempre x-site-password', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.uuid(),
        fc.boolean(),
        async (password, id, blocked) => {
          fetchMock.mockClear();
          session.getStoredPassword.mockReturnValue(password);

          await adminBlockUser(id, blocked).catch(() => {});

          expect(fetchMock).toHaveBeenCalled();
          const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
          const headers = init?.headers as Record<string, string>;
          return headers?.['x-site-password'] === password;
        },
      ),
    );
  });

  it('adminGetStats include sempre x-site-password', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (password) => {
          fetchMock.mockClear();
          session.getStoredPassword.mockReturnValue(password);
          fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ totalUsers: 0, totalBalance: 0, pendingBets: 0, bookProfit: 0 }),
          } as unknown as Response);

          await adminGetStats().catch(() => {});

          expect(fetchMock).toHaveBeenCalled();
          const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
          const headers = init?.headers as Record<string, string>;
          return headers?.['x-site-password'] === password;
        },
      ),
    );
  });
});
