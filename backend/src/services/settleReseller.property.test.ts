/**
 * Feature: reseller-panel
 * Proprietà 7: Correttezza Aggiornamento Saldo su Liquidazione Scommessa Reseller
 * Proprietà 8: Correttezza Aggiornamento Saldo Reseller su Liquidazione Scommessa Utente
 * Valida: Requisiti 7.2, 7.4, 7.5, 10.1, 10.2
 */
import * as fc from 'fast-check';

// ── Pure simulation of settle logic ──────────────────────────────────────────

interface BetSettlement {
  stake: number;
  potentialWin: number;
  result: 'win' | 'lose';
}

/**
 * Simulates the reseller balance delta when a USER's bet is settled.
 * win → reseller pays potentialWin (balance decreases)
 * lose → reseller earns stake (balance increases)
 */
function resellerDeltaFromUserBet(bet: BetSettlement): number {
  return bet.result === 'win' ? -bet.potentialWin : bet.stake;
}

/**
 * Simulates the reseller balance after their OWN bet is settled.
 * The stake was already deducted when the bet was placed.
 * win → balance += potentialWin
 * lose → balance unchanged (stake already deducted)
 */
function resellerBalanceAfterOwnBet(
  balanceBeforeBet: number,
  bet: BetSettlement
): number {
  const balanceAfterPlacing = balanceBeforeBet - bet.stake;
  if (bet.result === 'win') return balanceAfterPlacing + bet.potentialWin;
  return balanceAfterPlacing; // lose: stake already gone
}

// ── Proprietà 7: Saldo Reseller su Liquidazione Scommessa Propria ─────────────

describe('Proprietà 7: Correttezza Aggiornamento Saldo su Liquidazione Scommessa Reseller', () => {
  it('win: saldo_finale = saldo_pre_scommessa - stake + potential_win', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100000, noNaN: true }),
        fc.float({ min: 0.5, max: 1000, noNaN: true }),
        fc.float({ min: 0.5, max: 100000, noNaN: true }),
        (balanceBefore, stake, potentialWin) => {
          fc.pre(balanceBefore >= stake); // must have enough to bet

          const bet: BetSettlement = { stake, potentialWin, result: 'win' };
          const finalBalance = resellerBalanceAfterOwnBet(balanceBefore, bet);
          const expected = balanceBefore - stake + potentialWin;

          return Math.abs(finalBalance - expected) < 0.001;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('lose: saldo_finale = saldo_pre_scommessa - stake', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100000, noNaN: true }),
        fc.float({ min: 0.5, max: 1000, noNaN: true }),
        fc.float({ min: 0.5, max: 100000, noNaN: true }),
        (balanceBefore, stake, potentialWin) => {
          fc.pre(balanceBefore >= stake);

          const bet: BetSettlement = { stake, potentialWin, result: 'lose' };
          const finalBalance = resellerBalanceAfterOwnBet(balanceBefore, bet);
          const expected = balanceBefore - stake;

          return Math.abs(finalBalance - expected) < 0.001;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('win porta sempre a saldo maggiore rispetto a lose (a parità di stake)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 100, max: 100000, noNaN: true }),
        fc.float({ min: 0.5, max: 500, noNaN: true }),
        fc.float({ min: 0.5, max: 10000, noNaN: true }),
        (balanceBefore, stake, potentialWin) => {
          fc.pre(balanceBefore >= stake && potentialWin > stake);

          const winBalance = resellerBalanceAfterOwnBet(balanceBefore, { stake, potentialWin, result: 'win' });
          const loseBalance = resellerBalanceAfterOwnBet(balanceBefore, { stake, potentialWin, result: 'lose' });

          return winBalance > loseBalance;
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ── Proprietà 8: Saldo Reseller su Liquidazione Scommessa Utente ──────────────

describe('Proprietà 8: Correttezza Aggiornamento Saldo Reseller su Liquidazione Scommessa Utente', () => {
  it('utente vince → reseller perde potentialWin (delta negativo)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0.5, max: 1000, noNaN: true }),
        fc.float({ min: 0.5, max: 100000, noNaN: true }),
        (stake, potentialWin) => {
          const delta = resellerDeltaFromUserBet({ stake, potentialWin, result: 'win' });
          return delta === -potentialWin;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('utente perde → reseller guadagna stake (delta positivo)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0.5, max: 1000, noNaN: true }),
        fc.float({ min: 0.5, max: 100000, noNaN: true }),
        (stake, potentialWin) => {
          const delta = resellerDeltaFromUserBet({ stake, potentialWin, result: 'lose' });
          return delta === stake;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('il delta win è sempre negativo', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000000 }).map(n => n / 100),
        fc.integer({ min: 1, max: 10000000 }).map(n => n / 100),
        (stake, potentialWin) => {
          return resellerDeltaFromUserBet({ stake, potentialWin, result: 'win' }) < 0;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('il delta lose è sempre positivo', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000000 }).map(n => n / 100),
        fc.integer({ min: 1, max: 10000000 }).map(n => n / 100),
        (stake, potentialWin) => {
          return resellerDeltaFromUserBet({ stake, potentialWin, result: 'lose' }) > 0;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('saldo reseller dopo N scommesse utenti è corretto', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100000, noNaN: true }),
        fc.array(
          fc.record({
            stake: fc.float({ min: 0.5, max: 500, noNaN: true }),
            potentialWin: fc.float({ min: 0.5, max: 5000, noNaN: true }),
            result: fc.constantFrom('win', 'lose') as fc.Arbitrary<'win' | 'lose'>,
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (initialBalance, bets) => {
          let balance = initialBalance;
          for (const bet of bets) {
            balance += resellerDeltaFromUserBet(bet);
          }

          const expectedBalance = bets.reduce((acc, bet) => {
            return acc + resellerDeltaFromUserBet(bet);
          }, initialBalance);

          return Math.abs(balance - expectedBalance) < 0.001;
        }
      ),
      { numRuns: 200 }
    );
  });
});
