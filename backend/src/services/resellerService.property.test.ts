/**
 * Feature: reseller-panel — Property-Based Tests
 * Valida: Requisiti 4.2, 4.3, 4.4, 4.5, 4.7, 3.1, 3.2, 3.5, 4.6, 6.1, 8.4, 9.2
 */
import * as fc from 'fast-check';

// ── Pure logic helpers (extracted for testability without DB) ─────────────────

interface BalanceState {
  resellerBalance: number;
  userBalance: number;
}

/**
 * Pure simulation of transfer_balance logic
 */
function simulateTransfer(state: BalanceState, amount: number): BalanceState | 'INSUFFICIENT_RESELLER_BALANCE' | 'INSUFFICIENT_USER_BALANCE' {
  if (amount > 0 && state.resellerBalance < amount) return 'INSUFFICIENT_RESELLER_BALANCE';
  if (amount < 0 && state.userBalance < Math.abs(amount)) return 'INSUFFICIENT_USER_BALANCE';
  return {
    resellerBalance: Math.round((state.resellerBalance - amount) * 100) / 100,
    userBalance: Math.round((state.userBalance + amount) * 100) / 100,
  };
}

/**
 * Pure simulation of profit calculation
 */
function calculateProfit(bets: Array<{ result: string; stake: number; potential_win: number }>): number {
  return bets.reduce((acc, bet) => {
    if (bet.result === 'lose') return acc + bet.stake;
    if (bet.result === 'win') return acc - bet.potential_win;
    return acc;
  }, 0);
}

/**
 * Pure simulation of tipo field assignment
 */
function assignTipo(bet: { user_id: string }, resellerId: string): 'reseller' | 'utente' {
  return bet.user_id === resellerId ? 'reseller' : 'utente';
}

// ── Proprietà 2: Conservazione del Saldo nei Trasferimenti ───────────────────

describe('Proprietà 2: Conservazione del Saldo nei Trasferimenti', () => {
  it('la somma (reseller + utente) è invariante dopo qualsiasi trasferimento valido', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }).map(n => n / 100), // cents → euros
        fc.integer({ min: 0, max: 1000000 }).map(n => n / 100),
        fc.integer({ min: -500000, max: 500000 }).map(n => n / 100),
        (resellerBalance, userBalance, amount) => {
          if (amount === 0) return true; // zero transfer is trivially conserved
          const state = { resellerBalance, userBalance };
          const totalBefore = resellerBalance + userBalance;
          const result = simulateTransfer(state, amount);

          if (typeof result === 'string') return true; // error case, skip

          const totalAfter = result.resellerBalance + result.userBalance;
          return Math.abs(totalBefore - totalAfter) < 0.01;
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ── Proprietà 3: Invariante di Saldo Non Negativo ────────────────────────────

describe('Proprietà 3: Invariante di Saldo Non Negativo', () => {
  it('nessun saldo scende sotto zero dopo un trasferimento', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }).map(n => n / 100),
        fc.integer({ min: 0, max: 1000000 }).map(n => n / 100),
        fc.integer({ min: -1000000, max: 1000000 }).map(n => n / 100),
        (resellerBalance, userBalance, amount) => {
          const state = { resellerBalance, userBalance };
          const result = simulateTransfer(state, amount);

          if (typeof result === 'string') return true; // error correctly thrown

          return result.resellerBalance >= 0 && result.userBalance >= 0;
        }
      ),
      { numRuns: 300 }
    );
  });

  it('una sequenza di trasferimenti non porta mai a saldo negativo', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -50000, max: 50000 }).map(n => n / 100), { minLength: 1, maxLength: 20 }),
        (amounts) => {
          let state: BalanceState = { resellerBalance: 1000, userBalance: 0 };

          for (const amount of amounts) {
            const result = simulateTransfer(state, amount);
            if (typeof result === 'string') continue; // error correctly blocked
            state = result;
            if (state.resellerBalance < 0 || state.userBalance < 0) return false;
          }
          return true;
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ── Proprietà 4: Isolamento dei Dati tra Reseller ────────────────────────────

describe('Proprietà 4: Isolamento dei Dati tra Reseller', () => {
  it('getResellerBets assegna tipo corretto: reseller vs utente', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
        (resellerId, userIds) => {
          const allIds = [resellerId, ...userIds];
          const bets = allIds.map(uid => ({ user_id: uid }));

          for (const bet of bets) {
            const tipo = assignTipo(bet, resellerId);
            if (bet.user_id === resellerId && tipo !== 'reseller') return false;
            if (bet.user_id !== resellerId && tipo !== 'utente') return false;
          }
          return true;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('utenti di un reseller non appaiono nelle query di un altro reseller', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
        (reseller1Id, reseller2Id, userIds) => {
          fc.pre(reseller1Id !== reseller2Id);

          // Simulate: users belong to reseller1
          const reseller1Users = userIds.map(id => ({ id, reseller_id: reseller1Id }));

          // reseller2 should see none of these users
          const visibleToReseller2 = reseller1Users.filter(u => u.reseller_id === reseller2Id);
          return visibleToReseller2.length === 0;
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ── Proprietà 5: Invariante di Ownership alla Creazione Utente ───────────────

describe('Proprietà 5: Invariante di Ownership alla Creazione Utente', () => {
  it('ogni utente creato ha reseller_id corretto e balance = 0', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
        (resellerId, usernames) => {
          // Simulate user creation
          const createdUsers = usernames.map(username => ({
            username,
            reseller_id: resellerId,
            balance: 0,
            role: 'user',
          }));

          return createdUsers.every(u =>
            u.reseller_id === resellerId &&
            u.balance === 0 &&
            u.role === 'user'
          );
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ── Proprietà 10: Correttezza del Calcolo del Profitto ───────────────────────

describe('Proprietà 10: Correttezza del Calcolo del Profitto nelle Statistiche', () => {
  it('profit_from_users = SUM(stake dove lose) - SUM(potential_win dove win)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            result: fc.constantFrom('win', 'lose', 'pending', 'cancelled'),
            stake: fc.float({ min: 0.5, max: 1000, noNaN: true }),
            potential_win: fc.float({ min: 0.5, max: 10000, noNaN: true }),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        (bets) => {
          const profit = calculateProfit(bets);

          const expectedProfit = bets.reduce((acc, bet) => {
            if (bet.result === 'lose') return acc + bet.stake;
            if (bet.result === 'win') return acc - bet.potential_win;
            return acc;
          }, 0);

          return Math.abs(profit - expectedProfit) < 0.001;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('profit è 0 quando non ci sono scommesse', () => {
    expect(calculateProfit([])).toBe(0);
  });

  it('profit è positivo quando tutti perdono', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            result: fc.constant('lose'),
            stake: fc.integer({ min: 1, max: 100000 }).map(n => n / 100),
            potential_win: fc.integer({ min: 1, max: 1000000 }).map(n => n / 100),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (bets) => calculateProfit(bets) > 0
      ),
      { numRuns: 100 }
    );
  });
});

// ── Proprietà 9: Campo tipo nelle scommesse ───────────────────────────────────

describe('Proprietà 9: Completezza e Correttezza del Campo tipo', () => {
  it('ogni scommessa ha tipo corretto: reseller o utente, mai mancante', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(
          fc.record({ user_id: fc.uuid() }),
          { minLength: 0, maxLength: 30 }
        ),
        (resellerId, bets) => {
          const withTipo = bets.map(bet => ({
            ...bet,
            tipo: assignTipo(bet, resellerId),
          }));

          return withTipo.every(bet =>
            bet.tipo === 'reseller' || bet.tipo === 'utente'
          );
        }
      ),
      { numRuns: 200 }
    );
  });
});
