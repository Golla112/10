/**
 * adminUtils.ts — Funzioni pure e utility per il pannello admin BigBet365
 */

export interface AdminUser {
  id: string;
  username: string;
  balance: number;
  is_blocked: boolean;
  created_at: string;
}

export interface AdminBet {
  result: string;
  stake: number;
  potential_win: number;
  paid_at?: string | null;
  created_at: string;
}

/**
 * Filtra gli utenti per username (case-insensitive, ricerca parziale).
 * Se search è vuota restituisce tutti gli utenti.
 */
export function filterUsersByUsername(users: AdminUser[], search: string): AdminUser[] {
  if (!search) return users;
  const lower = search.toLowerCase();
  return users.filter(u => u.username.toLowerCase().includes(lower));
}

/**
 * Calcola il nuovo saldo dopo un'operazione di aggiunta.
 * Restituisce current + amount.
 */
export function calculateAddBalance(current: number, amount: number): number {
  return current + amount;
}

/**
 * Calcola il nuovo saldo dopo un'operazione di sottrazione.
 * Restituisce MAX(0, current - amount) — il saldo non può diventare negativo.
 */
export function calculateSubtractBalance(current: number, amount: number): number {
  return Math.max(0, current - amount);
}

/**
 * Valida un importo: restituisce true solo per numeri strettamente positivi (> 0).
 * Restituisce false per 0, negativi, NaN, stringhe, undefined, null.
 */
export function validateAmount(value: unknown): boolean {
  return typeof value === 'number' && !isNaN(value) && value > 0;
}

/**
 * Filtra le scommesse per stato (result).
 */
export function filterBetsByStatus(bets: AdminBet[], status: string): AdminBet[] {
  return bets.filter(b => b.result === status);
}

/**
 * Filtra le scommesse per range di date.
 * Inclusivo: created_at >= from e created_at <= to + 'T23:59:59'.
 */
export function filterBetsByDateRange(bets: AdminBet[], from: string, to: string): AdminBet[] {
  const toEnd = `${to}T23:59:59`;
  return bets.filter(b => b.created_at >= from && b.created_at <= toEnd);
}

/**
 * Calcola il profitto del book.
 * SUM(stake dove result='lose') - SUM(potential_win dove result='win').
 * Le scommesse pending e cancelled non influenzano il calcolo.
 */
export function calculateBookProfit(bets: AdminBet[]): number {
  let profit = 0;
  for (const bet of bets) {
    if (bet.result === 'lose') profit += bet.stake;
    else if (bet.result === 'win') profit -= bet.potential_win;
  }
  return profit;
}

/**
 * Determina se mostrare il badge "Pagata" per una scommessa.
 * true se result === 'win' && paid_at !== null && paid_at !== undefined.
 */
export function shouldShowPaidBadge(bet: AdminBet): boolean {
  return bet.result === 'win' && bet.paid_at != null;
}
