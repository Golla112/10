import crypto from 'crypto';

export interface Selection {
  event_id: string;
  nome_evento: string;
  quota: number;
  market?: string;
  outcome?: string;
  point?: number;
}

/**
 * Genera tutte le combinazioni di k elementi da un array.
 * Es. combinations([A,B,C], 2) → [[A,B],[A,C],[B,C]]
 */
export function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

/**
 * Calcola la vincita potenziale di una scommessa sistema K/N.
 * - Genera C(N,K) combinazioni
 * - Ogni combinazione ha stake/C(N,K) come puntata (oppure stake fisso per combinazione)
 * - Restituisce la vincita massima (tutte le combinazioni vincenti)
 */
export function computeSystemPotentialWin(
  stakePerCombo: number,
  selections: Array<{ quota: number }>,
  k: number
): { potentialWin: number; numCombinations: number; stakePerCombo: number } {
  const combos = combinations(selections, k);
  const numCombinations = combos.length;
  const potentialWin = combos.reduce((total, combo) => {
    const comboOdds = combo.reduce((acc, s) => acc * s.quota, 1);
    return total + stakePerCombo * comboOdds;
  }, 0);
  return {
    potentialWin: Math.round(potentialWin * 100) / 100,
    numCombinations,
    stakePerCombo: Math.round(stakePerCombo * 100) / 100,
  };
}

/**
 * Risolve il risultato di una scommessa sistema.
 * Ogni selezione ha un result: 'win' | 'lose' | 'void'
 * Una combinazione vince se tutte le sue selezioni vincono (void = quota 1).
 * La schedina vince se almeno una combinazione vince.
 */
export function settleSystemBet(
  stake: number,
  selections: Array<{ quota: number; result: 'win' | 'lose' | 'void' }>,
  k: number
): { result: 'win' | 'lose'; actualWin: number } {
  const combos = combinations(selections, k);
  const numCombinations = combos.length;
  const stakePerCombo = stake / numCombinations;

  let totalWin = 0;
  for (const combo of combos) {
    const hasLose = combo.some(s => s.result === 'lose');
    if (hasLose) continue;
    const comboOdds = combo.reduce((acc, s) => acc * (s.result === 'void' ? 1 : s.quota), 1);
    totalWin += stakePerCombo * comboOdds;
  }

  return {
    result: totalWin > 0 ? 'win' : 'lose',
    actualWin: Math.round(totalWin * 100) / 100,
  };
}

/**
 * Generates a unique codice schedina: "BB" + timestamp_base36 + 4 random hex chars (uppercase)
 */
export function generateCodiceSchedina(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `BB${ts}${rand}`;
}

/**
 * Computes total odds as the product of all selection quotas.
 * For a single selection, returns that selection's quota.
 */
export function computeTotalOdds(selections: Array<{ quota: number }>): number {
  return selections.reduce((acc, s) => acc * s.quota, 1);
}

/**
 * Calcola la percentuale di bonus per una multipla.
 * Regola: Almeno 5 eventi, ognuno con quota >= 1.25.
 */
export function calculateMultipleBonus(selections: Array<{ quota: number }>): number {
  const validEvents = selections.filter(s => s.quota >= 1.25).length;
  if (validEvents < 5) return 0;
  if (validEvents === 5) return 5;
  if (validEvents <= 10) return 10;
  if (validEvents <= 15) return 20;
  return 30; // Max 30% per 16+ eventi
}

/**
 * Computes potential win as stake × totalOdds × (1 + bonusPct/100), rounded to 2 decimal places.
 */
export function computePotentialWin(stake: number, totalOdds: number, selections: Array<{ quota: number }>): number {
  const bonusPct = calculateMultipleBonus(selections);
  const base = stake * totalOdds;
  const bonus = base * (bonusPct / 100);
  return Math.round((base + bonus) * 100) / 100;
}

/**
 * Computes the debounce hash key for a bet submission.
 * Hash is SHA-256 of sorted event_ids joined with ":".
 */
export function computeDebounceKey(nomeProprietario: string, selections: Selection[]): string {
  const sortedIds = selections.map((s) => s.event_id).sort().join(':');
  const hash = crypto.createHash('sha256').update(sortedIds).digest('hex');
  return `debounce:${nomeProprietario}:${hash}`;
}
