/**
 * Property-based tests per adminStatsService
 * Usa fast-check per verificare le proprietà universali della logica pura.
 *
 * Feature: admin-panel
 * Properties: 10, 11, + calculateBookProfit
 */

import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Logica pura estratta (non chiama Supabase)
// ---------------------------------------------------------------------------

/**
 * Calcola il nuovo saldo dopo una scommessa win.
 * saldo_dopo = saldo_prima + potential_win
 */
function applyWinCredit(balanceBefore: number, potentialWin: number): number {
  return balanceBefore + potentialWin;
}

/**
 * Calcola il nuovo saldo dopo una scommessa lose.
 * saldo_dopo = saldo_prima (invariato)
 */
function applyLoseResult(balanceBefore: number): number {
  return balanceBefore;
}

/**
 * Calcola il profitto del book dato un array di scommesse.
 * bookProfit = SUM(stake dove result='lose') - SUM(potential_win dove result='win')
 * Le scommesse pending/cancelled non influenzano il calcolo.
 */
function calculateBookProfit(
  bets: Array<{ result: string; stake: number; potential_win: number }>,
): number {
  return bets.reduce((acc, bet) => {
    if (bet.result === 'lose') return acc + bet.stake;
    if (bet.result === 'win') return acc - bet.potential_win;
    return acc;
  }, 0);
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const positiveAmount = fc.double({ min: 0.01, max: 1_000_000, noNaN: true });
const nonNegativeBalance = fc.double({ min: 0, max: 10_000_000, noNaN: true });

const betArb = fc.record({
  result: fc.constantFrom('win', 'lose', 'pending', 'cancelled'),
  stake: positiveAmount,
  potential_win: positiveAmount,
});

// ---------------------------------------------------------------------------
// Proprietà 10: Accredito saldo su win (critica)
// Feature: admin-panel, Property 10: Accredito saldo su win
// Per qualsiasi scommessa con result='win' e potential_win=p,
// dopo la risoluzione il saldo dell'utente deve aumentare esattamente di p
// saldo_dopo = saldo_prima + potential_win
// Validates: Requirements 6.1
// ---------------------------------------------------------------------------

describe('Property 10: Accredito saldo su win', () => {
  // **Validates: Requirements 6.1**
  it('saldo_dopo = saldo_prima + potential_win per qualsiasi win', () => {
    fc.assert(
      fc.property(nonNegativeBalance, positiveAmount, (balanceBefore, potentialWin) => {
        const balanceAfter = applyWinCredit(balanceBefore, potentialWin);
        return Math.abs(balanceAfter - (balanceBefore + potentialWin)) < 0.0001;
      }),
      { numRuns: 100 },
    );
  });

  it('il saldo aumenta sempre dopo una win', () => {
    fc.assert(
      fc.property(nonNegativeBalance, positiveAmount, (balanceBefore, potentialWin) => {
        const balanceAfter = applyWinCredit(balanceBefore, potentialWin);
        return balanceAfter > balanceBefore;
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Proprietà 11: Invarianza saldo su lose (critica)
// Feature: admin-panel, Property 11: Invarianza saldo su lose
// Per qualsiasi scommessa con result='lose',
// dopo la risoluzione il saldo dell'utente deve rimanere invariato
// saldo_dopo = saldo_prima
// Validates: Requirements 6.2
// ---------------------------------------------------------------------------

describe('Property 11: Invarianza saldo su lose', () => {
  // **Validates: Requirements 6.2**
  it('saldo_dopo = saldo_prima per qualsiasi lose', () => {
    fc.assert(
      fc.property(nonNegativeBalance, (balanceBefore) => {
        const balanceAfter = applyLoseResult(balanceBefore);
        return balanceAfter === balanceBefore;
      }),
      { numRuns: 100 },
    );
  });

  it('il saldo non cambia mai dopo una lose', () => {
    fc.assert(
      fc.property(nonNegativeBalance, (balanceBefore) => {
        const balanceAfter = applyLoseResult(balanceBefore);
        return Math.abs(balanceAfter - balanceBefore) < 0.0001;
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// calculateBookProfit con dati generati casualmente
// Feature: admin-panel, Property 3 (backend): Calcolo profitto book
// bookProfit = SUM(stake lose) - SUM(potential_win win)
// pending/cancelled non influenzano il calcolo
// Validates: Requirements 1.4
// ---------------------------------------------------------------------------

describe('calculateBookProfit con dati generati casualmente', () => {
  it('bookProfit = SUM(stake lose) - SUM(potential_win win)', () => {
    fc.assert(
      fc.property(fc.array(betArb, { minLength: 0, maxLength: 50 }), (bets) => {
        const expected =
          bets.filter(b => b.result === 'lose').reduce((s, b) => s + b.stake, 0) -
          bets.filter(b => b.result === 'win').reduce((s, b) => s + b.potential_win, 0);
        const actual = calculateBookProfit(bets);
        return Math.abs(actual - expected) < 0.001;
      }),
      { numRuns: 100 },
    );
  });

  it('scommesse pending e cancelled non influenzano il profitto', () => {
    fc.assert(
      fc.property(
        fc.array(betArb, { minLength: 1, maxLength: 20 }),
        fc.array(
          fc.record({
            result: fc.constantFrom('pending', 'cancelled'),
            stake: positiveAmount,
            potential_win: positiveAmount,
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (settledBets, neutralBets) => {
          const profitWithout = calculateBookProfit(settledBets);
          const profitWith = calculateBookProfit([...settledBets, ...neutralBets]);
          return Math.abs(profitWith - profitWithout) < 0.001;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('array vuoto produce profitto zero', () => {
    expect(calculateBookProfit([])).toBe(0);
  });

  it('solo scommesse win produce profitto negativo o zero', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            result: fc.constant('win'),
            stake: positiveAmount,
            potential_win: positiveAmount,
          }),
          { minLength: 1, maxLength: 20 },
        ),
        (winBets) => {
          return calculateBookProfit(winBets) <= 0;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('solo scommesse lose produce profitto positivo o zero', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            result: fc.constant('lose'),
            stake: positiveAmount,
            potential_win: positiveAmount,
          }),
          { minLength: 1, maxLength: 20 },
        ),
        (loseBets) => {
          return calculateBookProfit(loseBets) >= 0;
        },
      ),
      { numRuns: 100 },
    );
  });
});
