/**
 * Coupon Utilities - Advanced betting calculations
 * Based on joverbet system implementation
 */

import { Selection } from './betSlipStore';

// Generate all combinations of k items from n items
export function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  
  return [...withFirst, ...withoutFirst];
}

// Calculate total odds from selections
export function calculateTotalOdds(selections: Selection[]): number {
  if (selections.length === 0) return 1;
  return selections.reduce((acc, s) => acc * s.quota, 1);
}

// Check if selection qualifies for bonus (odds >= 1.25)
export function qualifiesForBonus(selection: Selection): boolean {
  return selection.quota >= 1.25;
}

// Calculate bonus percentage based on number of qualifying events
export function calculateRankBonus(selections: Selection[]): number {
  const validEvents = selections.filter(qualifiesForBonus).length;
  
  if (validEvents < 5) return 0;
  if (validEvents === 5) return 0.05;
  if (validEvents <= 10) return 0.10;
  if (validEvents <= 15) return 0.20;
  return 0.30;
}

// System K/N calculation
export interface SystemResult {
  numCombinations: number;
  totalStake: number;
  minWin: number;
  maxWin: number;
  minBonus: number;
  maxBonus: number;
  combinations: {
    combo: Selection[];
    odds: number;
    win: number;
  }[];
}

export function calculateSystem(
  selections: Selection[],
  k: number,
  stakePerCombo: number,
  applyBonus: boolean = true
): SystemResult {
  const combos = combinations(selections, k);
  const numCombinations = combos.length;
  const totalStake = stakePerCombo * numCombinations;
  
  const comboResults = combos.map(combo => {
    const odds = combo.reduce((acc, s) => acc * s.quota, 1);
    const win = stakePerCombo * odds;
    return { combo, odds, win };
  });
  
  const wins = comboResults.map(r => r.win);
  const minWin = Math.min(...wins);
  const maxWin = Math.max(...wins);
  
  let minBonus = 0;
  let maxBonus = 0;
  
  if (applyBonus) {
    const bonusPct = calculateRankBonus(selections);
    minBonus = minWin * bonusPct;
    maxBonus = maxWin * bonusPct;
  }
  
  return {
    numCombinations,
    totalStake,
    minWin,
    maxWin,
    minBonus,
    maxBonus,
    combinations: comboResults,
  };
}

// Fixed odds (banker) calculations
export interface FixedOddsResult {
  fixedMultiplier: number;
  regularOdds: number;
  totalOdds: number;
  potentialWin: number;
}

export function calculateWithFixedOdds(
  fixedSelections: Selection[],
  regularSelections: Selection[],
  stake: number,
  applyBonus: boolean = true
): FixedOddsResult {
  const fixedMultiplier = fixedSelections.reduce((acc, s) => acc * s.quota, 1);
  const regularOdds = regularSelections.reduce((acc, s) => acc * s.quota, 1);
  const totalOdds = fixedMultiplier * regularOdds;
  
  let potentialWin = stake * totalOdds;
  
  if (applyBonus) {
    const allSelections = [...fixedSelections, ...regularSelections];
    const bonusPct = calculateRankBonus(allSelections);
    potentialWin = potentialWin * (1 + bonusPct);
  }
  
  return {
    fixedMultiplier,
    regularOdds,
    totalOdds,
    potentialWin,
  };
}

// Validate coupon before submission
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateCoupon(
  selections: Selection[],
  stake: number,
  minStake: number = 0.5,
  maxStake: number = 10000,
  maxEvents: number = 20,
  minOdds: number = 1.05
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check empty
  if (selections.length === 0) {
    errors.push('Nessuna selezione nel coupon');
  }
  
  // Check max events
  if (selections.length > maxEvents) {
    errors.push(`Massimo ${maxEvents} eventi consentiti`);
  }
  
  // Check min odds
  const lowOdds = selections.filter(s => s.quota < minOdds);
  if (lowOdds.length > 0) {
    errors.push(`Quote troppo basse: ${lowOdds.map(s => s.nome_evento).join(', ')}`);
  }
  
  // Check stake
  if (stake < minStake) {
    errors.push(`Puntata minima €${minStake}`);
  }
  if (stake > maxStake) {
    errors.push(`Puntata massima €${maxStake}`);
  }
  
  // Check locked events
  const locked = selections.filter(s => s.locked);
  if (locked.length > 0) {
    errors.push(`Eventi bloccati: ${locked.map(s => s.nome_evento).join(', ')}`);
  }
  
  // Check duplicate events
  const eventIds = selections.map(s => s.event_id);
  const duplicates = eventIds.filter((item, index) => eventIds.indexOf(item) !== index);
  if (duplicates.length > 0) {
    errors.push('Eventi duplicati nel coupon');
  }
  
  // Warnings
  if (selections.length === 1) {
    warnings.push('Singola - nessun bonus applicabile');
  }
  
  const validForBonus = selections.filter(qualifiesForBonus).length;
  if (validForBonus < 5 && selections.length >= 5) {
    warnings.push(`Solo ${validForBonus} eventi validi per il bonus (serve minimo 5 con quota ≥1.25)`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Time filter utilities (from joverbet)
export interface TimeFilter {
  label: number;
  value?: number; // Unix timestamp
  name: string;
}

export const TIME_FILTERS: TimeFilter[] = [
  { label: 10, name: 'Prossime 2h' },
  { label: 20, name: 'Prossime 4h' },
  { label: 30, name: 'Oggi' },
  { label: 40, name: '2 Giorni' },
  { label: 50, name: 'Tutti' },
];

export function calculateTimeFilterValue(label: number): number | undefined {
  const now = new Date().getTime();
  
  switch (label) {
    case 10: // +2 hours
      return Math.round((now + 2 * 60 * 60 * 1000) / 1000);
    case 20: // +4 hours
      return Math.round((now + 4 * 60 * 60 * 1000) / 1000);
    case 30: // Today (end of day)
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return Math.round(today.getTime() / 1000);
    case 40: // +2 days
      return Math.round((now + 2 * 24 * 60 * 60 * 1000) / 1000);
    case 50: // All
      return undefined;
    default:
      return undefined;
  }
}

export function filterEventsByTime(events: any[], timeValue: number | undefined): any[] {
  if (!timeValue) return events;
  return events.filter(e => e.begin && e.begin < timeValue);
}

// Odds change detection
export interface OddsChange {
  eventId: string;
  market: string;
  outcome: string;
  oldOdds: number;
  newOdds: number;
  direction: 'up' | 'down';
}

export function detectOddsChanges(
  oldSelections: Selection[],
  newSelections: Selection[]
): OddsChange[] {
  const changes: OddsChange[] = [];
  
  for (const newSel of newSelections) {
    const oldSel = oldSelections.find(
      s => s.event_id === newSel.event_id && 
           s.market === newSel.market && 
           s.outcome === newSel.outcome
    );
    
    if (oldSel && oldSel.quota !== newSel.quota) {
      changes.push({
        eventId: newSel.event_id,
        market: newSel.market,
        outcome: newSel.outcome,
        oldOdds: oldSel.quota,
        newOdds: newSel.quota,
        direction: newSel.quota > oldSel.quota ? 'up' : 'down',
      });
    }
  }
  
  return changes;
}
