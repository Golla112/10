import { create } from 'zustand';

export interface Selection {
  event_id: string;
  nome_evento: string;
  quota: number;
  market: string;
  outcome: string;
  betcode?: string;
  live?: boolean;
  locked?: boolean;
  isFixed?: boolean; // Banker selection
  prevQuota?: number; // For odds change tracking
}

export type BetType = 'singola' | 'multipla' | 'sistema';

interface BetSlipState {
  selections: Selection[];
  stake: number;
  totalOdds: number;
  potentialWin: number;
  ownerName: string;
  betType: BetType;
  sistemaK: number; // es. 2 per sistema 2/N
  isOpen: boolean; // For mobile coupon visibility
  addSelection: (s: Selection) => void;
  removeSelection: (eventId: string, outcome?: string) => void;
  setStake: (amount: number) => void;
  setSelections: (selections: Selection[]) => void;
  setOwnerName: (name: string) => void;
  setBetType: (type: BetType) => void;
  setSistemaK: (k: number) => void;
  setIsOpen: (open: boolean) => void;
  updateSelectionOdds: (eventId: string, market: string, outcome: string, newOdds: number) => void;
  setSelectionLocked: (eventId: string, locked: boolean) => void;
  toggleFixedSelection: (eventId: string, outcome: string) => void;
  clear: () => void;
}

function computeTotalOdds(selections: Selection[]): number {
  if (selections.length === 0) return 1;
  return selections.reduce((acc, s) => acc * s.quota, 1);
}

/** Genera tutte le combinazioni di k elementi */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const [first, ...rest] = arr;
  return [
    ...combinations(rest, k - 1).map(c => [first, ...c]),
    ...combinations(rest, k),
  ];
}

/** Calcola vincita potenziale massima per sistema K/N — stile Goldbet/Bet365
 *  stake = puntata PER COMBINAZIONE (non totale)
 *  totalStake = stake × numCombinations
 */
export function computeSystemPotentialWin(
  stakePerCombo: number,
  selections: Selection[],
  k: number
): { potentialWin: number; numCombinations: number; totalStake: number } {
  const combos = combinations(selections, k);
  const numCombinations = combos.length;
  if (numCombinations === 0) return { potentialWin: 0, numCombinations: 0, totalStake: 0 };
  const totalStake = stakePerCombo * numCombinations;
  const potentialWin = combos.reduce((total, combo) => {
    const comboOdds = combo.reduce((acc, s) => acc * s.quota, 1);
    return total + stakePerCombo * comboOdds;
  }, 0);
  return { potentialWin: Math.round(potentialWin * 100) / 100, numCombinations, totalStake: Math.round(totalStake * 100) / 100 };
}

export function calculateMultipleBonus(selections: Selection[]): number {
  const validEvents = selections.filter(s => s.quota >= 1.25).length;
  if (validEvents < 5) return 0;
  if (validEvents === 5) return 0.05;
  if (validEvents <= 10) return 0.10;
  if (validEvents <= 15) return 0.20;
  return 0.30;
}

function computePotentialWin(state: Pick<BetSlipState, 'selections' | 'stake' | 'betType' | 'sistemaK'>): number {
  const { selections, stake, betType, sistemaK } = state;
  if (betType === 'sistema' && sistemaK >= 2 && sistemaK < selections.length) {
    return computeSystemPotentialWin(stake, selections, sistemaK).potentialWin;
  }
  const baseWin = stake * computeTotalOdds(selections);
  const bonusPct = calculateMultipleBonus(selections);
  return Math.round((baseWin * (1 + bonusPct)) * 100) / 100;
}

export const useBetSlipStore = create<BetSlipState>((set) => ({
  selections: [],
  stake: 0,
  totalOdds: 1,
  potentialWin: 0,
  ownerName: '',
  betType: 'multipla',
  sistemaK: 2,
  isOpen: false,

  addSelection: (s: Selection) =>
    set((state) => {
      const filtered = state.selections.filter((sel) => sel.event_id !== s.event_id);
      if (filtered.length >= 20) return state;
      const selections = [...filtered, s];
      const totalOdds = computeTotalOdds(selections);
      const newState = { ...state, selections, totalOdds };
      return { ...newState, potentialWin: computePotentialWin(newState) };
    }),

  removeSelection: (eventId: string, outcome?: string) =>
    set((state) => {
      const selections = state.selections.filter((s) =>
        outcome ? !(s.event_id === eventId && s.outcome === outcome) : s.event_id !== eventId
      );
      const totalOdds = computeTotalOdds(selections);
      const newState = { ...state, selections, totalOdds };
      return { ...newState, potentialWin: computePotentialWin(newState) };
    }),

  setStake: (amount: number) =>
    set((state) => {
      const newState = { ...state, stake: amount };
      return { ...newState, potentialWin: computePotentialWin(newState) };
    }),

  setSelections: (selections: Selection[]) =>
    set((state) => {
      const totalOdds = computeTotalOdds(selections);
      const newState = { ...state, selections, totalOdds };
      return { ...newState, potentialWin: computePotentialWin(newState) };
    }),

  setOwnerName: (name: string) => set({ ownerName: name }),

  setBetType: (betType: BetType) =>
    set((state) => {
      const newState = { ...state, betType };
      return { ...newState, potentialWin: computePotentialWin(newState) };
    }),

  setSistemaK: (sistemaK: number) =>
    set((state) => {
      const newState = { ...state, sistemaK };
      return { ...newState, potentialWin: computePotentialWin(newState) };
    }),

  setIsOpen: (open: boolean) => set({ isOpen: open }),

  updateSelectionOdds: (eventId: string, market: string, outcome: string, newOdds: number) =>
    set((state) => {
      const selections = state.selections.map((s) => {
        if (s.event_id === eventId && s.market === market && s.outcome === outcome) {
          return { 
            ...s, 
            prevQuota: s.quota,
            quota: newOdds 
          };
        }
        return s;
      });
      const totalOdds = computeTotalOdds(selections);
      const newState = { ...state, selections, totalOdds };
      return { ...newState, potentialWin: computePotentialWin(newState) };
    }),

  setSelectionLocked: (eventId: string, locked: boolean) =>
    set((state) => {
      const selections = state.selections.map((s) =>
        s.event_id === eventId ? { ...s, locked } : s
      );
      return { ...state, selections };
    }),

  toggleFixedSelection: (eventId: string, outcome: string) =>
    set((state) => {
      const selections = state.selections.map((s) =>
        s.event_id === eventId && s.outcome === outcome
          ? { ...s, isFixed: !s.isFixed }
          : s
      );
      const totalOdds = computeTotalOdds(selections);
      const newState = { ...state, selections, totalOdds };
      return { ...newState, potentialWin: computePotentialWin(newState) };
    }),

  clear: () =>
    set({
      selections: [],
      stake: 0,
      totalOdds: 1,
      potentialWin: 0,
      ownerName: '',
      betType: 'multipla',
      sistemaK: 2,
      isOpen: false,
    }),
}));
