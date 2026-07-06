// Betting Slip Service - Sistema Scontrino Avanzato
// Gestisce scommesse multiple, calcoli, validazioni

import { EventEmitter } from 'events';

// ── Interfacce Scontrino ───────────────────────────────────────────────────────

export interface BettingSlipItem {
  id: string;
  matchId: string;
  matchInfo: {
    homeTeam: string;
    awayTeam: string;
    sport: string;
    league: string;
    startTime: number;
    isLive: boolean;
  };
  marketId: string;
  marketName: string;
  outcomeId: string;
  outcomeName: string;
  odds: number;
  probability: number;
  margin: number;
  lastUpdated: number;
  stake: number;
  potentialWin: number;
  status: 'pending' | 'confirmed' | 'settled' | 'cancelled';
  isLocked: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface BettingSlip {
  id: string;
  userId?: string;
  type: 'single' | 'multiple' | 'system';
  items: BettingSlipItem[];
  totalStake: number;
  totalOdds: number;
  potentialWin: number;
  margin: number;
  status: 'draft' | 'pending' | 'confirmed' | 'settled' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  settledAt?: number;
  systemCombination?: number;
  bonusApplied?: {
    type: string;
    amount: number;
    percentage: number;
  };
  restrictions: {
    minStake: number;
    maxStake: number;
    maxSelections: number;
    maxOdds: number;
    excludedMarkets: string[];
  };
}

export interface SlipCalculation {
  totalStake: number;
  totalOdds: number;
  potentialWin: number;
  margin: number;
  tax: number;
  netWin: number;
  combinations: number;
  minWin: number;
  maxWin: number;
}

// ── Configurazione ─────────────────────────────────────────────────

const SLIP_CONFIG = {
  maxSelections: 20,
  minOdds: 1.02,
  maxOdds: 1000,
  minStake: 1,
  maxStake: 10000,
  maxMultipleOdds: 5000,
  taxRate: 0.20, // 20% tasse Italia
  excludedMarkets: [] as string[], // Mercati esclusi
  bonusRules: {
    multipleBonus: { minSelections: 5, bonusPercentage: 0.10 },
    accumulatorBonus: { minSelections: 10, bonusPercentage: 0.15 },
    highOddsBonus: { minOdds: 10, bonusPercentage: 0.05 }
  }
};

// ── Service Class ─────────────────────────────────────────────────────

class BettingSlipService extends EventEmitter {
  private activeSlips: Map<string, BettingSlip> = new Map();
  private slipCounter: number = 0;

  constructor() {
    super();
  }

  /**
   * Crea un nuovo scontrino
   */
  createSlip(userId?: string, type: 'single' | 'multiple' | 'system' = 'multiple'): BettingSlip {
    const slipId = this.generateSlipId();
    
    const slip: BettingSlip = {
      id: slipId,
      userId,
      type,
      items: [],
      totalStake: 0,
      totalOdds: 1,
      potentialWin: 0,
      margin: 0,
      status: 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      restrictions: SLIP_CONFIG
    };

    this.activeSlips.set(slipId, slip);
    
    this.emit('slip_created', slip);
    console.log(`📝 New slip created: ${slipId}`);
    
    return slip;
  }

  /**
   * Aggiungi selezione al scontrino
   */
  addSelection(slipId: string, selection: Omit<BettingSlipItem, 'id' | 'stake' | 'potentialWin' | 'status'>): BettingSlipItem | null {
    const slip = this.activeSlips.get(slipId);
    if (!slip) {
      throw new Error('Slip not found');
    }

    // Validazioni
    if (!this.validateSelection(selection, slip)) {
      throw new Error('Invalid selection');
    }

    const slipItem: BettingSlipItem = {
      id: this.generateItemId(),
      ...selection,
      stake: 0,
      potentialWin: 0,
      status: 'pending',
      isLocked: false,
      riskLevel: 'low'
    };

    slip.items.push(slipItem);
    slip.updatedAt = Date.now();

    // Ricalcola totali
    this.recalculateSlip(slip);

    this.activeSlips.set(slipId, slip);
    
    this.emit('selection_added', { slipId, item: slipItem });
    console.log(`➕ Selection added to slip ${slipId}: ${selection.outcomeName}`);
    
    return slipItem;
  }

  /**
   * Rimuovi selezione dal scontrino
   */
  removeSelection(slipId: string, itemId: string): boolean {
    const slip = this.activeSlips.get(slipId);
    if (!slip) return false;

    const itemIndex = slip.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return false;

    slip.items.splice(itemIndex, 1);
    slip.updatedAt = Date.now();

    // Ricalcola totali
    this.recalculateSlip(slip);

    this.activeSlips.set(slipId, slip);
    
    this.emit('selection_removed', { slipId, itemId });
    console.log(`➖ Selection removed from slip ${slipId}`);
    
    return true;
  }

  /**
   * Aggiorna stake per scommessa singola o sistema
   */
  updateStake(slipId: string, itemId: string, stake: number): boolean {
    const slip = this.activeSlips.get(slipId);
    if (!slip) return false;

    const item = slip.items.find(item => item.id === itemId);
    if (!item) return false;

    // Validazioni stake
    if (stake < SLIP_CONFIG.minStake || stake > SLIP_CONFIG.maxStake) {
      throw new Error(`Stake must be between ${SLIP_CONFIG.minStake} and ${SLIP_CONFIG.maxStake}`);
    }

    item.stake = stake;
    item.potentialWin = stake * item.odds;
    
    slip.updatedAt = Date.now();
    this.recalculateSlip(slip);

    this.activeSlips.set(slipId, slip);
    
    this.emit('stake_updated', { slipId, itemId, stake });
    
    return true;
  }

  /**
   * Aggiorna stake totale per scommessa multipla
   */
  updateTotalStake(slipId: string, totalStake: number): boolean {
    const slip = this.activeSlips.get(slipId);
    if (!slip) return false;

    // Validazioni
    if (totalStake < SLIP_CONFIG.minStake || totalStake > SLIP_CONFIG.maxStake) {
      throw new Error(`Total stake must be between ${SLIP_CONFIG.minStake} and ${SLIP_CONFIG.maxStake}`);
    }

    slip.totalStake = totalStake;
    slip.potentialWin = totalStake * slip.totalOdds;
    slip.updatedAt = Date.now();

    this.activeSlips.set(slipId, slip);
    
    this.emit('total_stake_updated', { slipId, totalStake });
    
    return true;
  }

  /**
   * Calcola e applica bonus
   */
  applyBonus(slipId: string): BettingSlip {
    const slip = this.activeSlips.get(slipId);
    if (!slip) throw new Error('Slip not found');

    const bonus = this.calculateBonus(slip);
    if (bonus) {
      slip.bonusApplied = bonus;
      slip.potentialWin = slip.potentialWin * (1 + bonus.percentage);
      slip.updatedAt = Date.now();
    }

    this.activeSlips.set(slipId, slip);
    
    this.emit('bonus_applied', { slipId, bonus });
    
    return slip;
  }

  /**
   * Conferma scontrino
   */
  confirmSlip(slipId: string): BettingSlip {
    const slip = this.activeSlips.get(slipId);
    if (!slip) throw new Error('Slip not found');

    // Validazioni finali
    if (!this.validateSlip(slip)) {
      throw new Error('Invalid slip - cannot confirm');
    }

    slip.status = 'confirmed';
    slip.updatedAt = Date.now();

    this.activeSlips.set(slipId, slip);
    
    this.emit('slip_confirmed', slip);
    console.log(`✅ Slip confirmed: ${slipId} - Stake: €${slip.totalStake} - Potential: €${slip.potentialWin}`);
    
    return slip;
  }

  /**
   * Calcola totali scontrino
   */
  private recalculateSlip(slip: BettingSlip): void {
    if (slip.items.length === 0) {
      slip.totalOdds = 1;
      slip.potentialWin = 0;
      slip.margin = 0;
      return;
    }

    // Calcola quote totali basato su tipo
    switch (slip.type) {
      case 'single':
        if (slip.items.length === 1) {
          slip.totalOdds = slip.items[0].odds;
          slip.potentialWin = slip.items[0].stake * slip.items[0].odds;
        }
        break;

      case 'multiple':
        slip.totalOdds = slip.items.reduce((product, item) => product * item.odds, 1);
        slip.potentialWin = slip.totalStake * slip.totalOdds;
        break;

      case 'system':
        // Calcola combinazioni sistema (es. 2 su 3, 3 su 4)
        slip.totalOdds = this.calculateSystemOdds(slip);
        slip.potentialWin = slip.totalStake * slip.totalOdds;
        break;
    }

    // Calcola margine medio
    slip.margin = slip.items.reduce((sum, item) => sum + item.margin, 0) / slip.items.length;
  }

  /**
   * Calcola quote per scommessa sistema
   */
  private calculateSystemOdds(slip: BettingSlip): number {
    const { systemCombination = 2 } = slip; // Esempio: 2 su 3
    const n = slip.items.length;
    const k = systemCombination;
    
    // Calcolo combinazioni binomiali
    const combinations = this.binomialCoefficient(n, k);
    
    // Calcola quote media per combinazione
    let totalCombinationOdds = 0;
    
    for (let i = 0; i < combinations; i++) {
      let combinationOdds = 1;
      // Per ogni combinazione, moltiplica le quote
      for (let j = 0; j < k; j++) {
        // Logica complessa per selezionare k elementi da n
        combinationOdds *= slip.items[(i * k + j) % n].odds;
      }
      totalCombinationOdds += combinationOdds;
    }
    
    return totalCombinationOdds / combinations;
  }

  /**
   * Coefficiente binomiale
   */
  private binomialCoefficient(n: number, k: number): number {
    if (k > n) return 0;
    if (k === 0 || k === n) return 1;
    
    let result = 1;
    for (let i = 1; i <= k; i++) {
      result = result * (n - k + i) / i;
    }
    
    return result;
  }

  /**
   * Calcola bonus applicabili
   */
  private calculateBonus(slip: BettingSlip): any | null {
    const { multipleBonus, accumulatorBonus, highOddsBonus } = SLIP_CONFIG.bonusRules;

    // Higher threshold must be checked first.
    if (slip.items.length >= accumulatorBonus.minSelections) {
      return {
        type: 'accumulator',
        amount: slip.potentialWin * accumulatorBonus.bonusPercentage,
        percentage: accumulatorBonus.bonusPercentage
      };
    }

    // Bonus multiple
    if (slip.items.length >= multipleBonus.minSelections) {
      return {
        type: 'multiple',
        amount: slip.potentialWin * multipleBonus.bonusPercentage,
        percentage: multipleBonus.bonusPercentage
      };
    }

    // Bonus quote alte
    if (slip.totalOdds >= highOddsBonus.minOdds) {
      return {
        type: 'high_odds',
        amount: slip.potentialWin * highOddsBonus.bonusPercentage,
        percentage: highOddsBonus.bonusPercentage
      };
    }

    return null;
  }

  /**
   * Validazione selezione
   */
  private validateSelection(selection: any, slip: BettingSlip): boolean {
    // Controlla quote minime
    if (selection.odds < SLIP_CONFIG.minOdds || selection.odds > SLIP_CONFIG.maxOdds) {
      return false;
    }

    // Controlla mercati esclusi
    if (slip.restrictions.excludedMarkets.includes(selection.marketId)) {
      return false;
    }

    // Controlla duplicati nello stesso match
    const duplicateInSameMatch = slip.items.some(item => 
      item.matchId === selection.matchId && item.marketId === selection.marketId
    );
    if (duplicateInSameMatch) {
      return false;
    }

    return true;
  }

  /**
   * Validazione completa scontrino
   */
  private validateSlip(slip: BettingSlip): boolean {
    // Controlla numero selezioni
    if (slip.items.length === 0 || slip.items.length > slip.restrictions.maxSelections) {
      return false;
    }

    // Controlla quote totali per multiple
    if (slip.type === 'multiple' && slip.totalOdds > SLIP_CONFIG.maxMultipleOdds) {
      return false;
    }

    // Controlla stake minimo
    if (slip.totalStake < slip.restrictions.minStake) {
      return false;
    }

    // Controlla quote minime per ogni selezione
    const invalidOdds = slip.items.some(item => 
      item.odds < SLIP_CONFIG.minOdds || item.odds > SLIP_CONFIG.maxOdds
    );
    if (invalidOdds) {
      return false;
    }

    return true;
  }

  /**
   * 🎯 BOTTONE "SCOMMETTI" - Crea scommessa effettiva
   */
  placeBet(slipId: string): BettingSlip {
    const slip = this.activeSlips.get(slipId);
    if (!slip) throw new Error('Slip not found');

    // Validazioni finali prima di piazzare
    if (!this.validateSlip(slip)) {
      throw new Error('Invalid slip - cannot place bet');
    }

    // Aggiorna stato
    slip.status = 'pending';
    slip.updatedAt = Date.now();

    this.emit('betPlaced', slip);
    return slip;
  }

  /**
   * ✅ Conferma scommessa (dopo bottone "Scommetti")
   */
  confirmBet(slipId: string): BettingSlip {
    const slip = this.activeSlips.get(slipId);
    if (!slip) throw new Error('Slip not found');

    if (slip.status !== 'pending') {
      throw new Error('Slip must be placed before confirmation');
    }

    slip.status = 'confirmed';
    slip.updatedAt = Date.now();

    this.emit('betConfirmed', slip);
    return slip;
  }

  /**
   * Calcolo dettagliato scontrino
   */
  calculateSlipDetails(slipId: string): SlipCalculation | null {
    const slip = this.activeSlips.get(slipId);
    if (!slip) return null;

    const tax = slip.potentialWin * SLIP_CONFIG.taxRate;
    const netWin = slip.potentialWin - tax;

    const itemOdds = slip.items.map(item => item.odds);
    const minOdd = itemOdds.length > 0 ? Math.min(...itemOdds) : 0;
    const maxOdd = itemOdds.length > 0 ? Math.max(...itemOdds) : 0;

    return {
      totalStake: slip.totalStake,
      totalOdds: slip.totalOdds,
      potentialWin: slip.potentialWin,
      margin: slip.margin,
      tax,
      netWin,
      combinations: slip.type === 'system' ? this.binomialCoefficient(slip.items.length, slip.systemCombination || 2) : 1,
      minWin: slip.totalStake * minOdd,
      maxWin: slip.totalStake * maxOdd
    };
  }

  /**
   * Ottieni scontrino
   */
  getSlip(slipId: string): BettingSlip | null {
    return this.activeSlips.get(slipId) || null;
  }

  /**
   * Ottieni tutti gli scontrini utente
   */
  getUserSlips(userId: string): BettingSlip[] {
    return Array.from(this.activeSlips.values())
      .filter(slip => slip.userId === userId);
  }

  /**
   * Ottieni statistiche scontrini
   */
  getStats() {
    const slips = Array.from(this.activeSlips.values());
    
    return {
      totalSlips: slips.length,
      activeSlips: slips.filter(s => s.status === 'draft' || s.status === 'pending').length,
      confirmedSlips: slips.filter(s => s.status === 'confirmed').length,
      settledSlips: slips.filter(s => s.status === 'settled').length,
      totalStaked: slips.reduce((sum, s) => sum + s.totalStake, 0),
      totalPotentialWin: slips.reduce((sum, s) => sum + s.potentialWin, 0),
      averageOdds: slips.length > 0 ? slips.reduce((sum, s) => sum + s.totalOdds, 0) / slips.length : 0,
      averageMargin: slips.length > 0 ? slips.reduce((sum, s) => sum + s.margin, 0) / slips.length : 0
    };
  }

  /**
   * Genera ID scontrino
   */
  private generateSlipId(): string {
    return `slip_${++this.slipCounter}_${Date.now()}`;
  }

  /**
   * Genera ID item
   */
  private generateItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ── Esportazione ───────────────────────────────────────────────────────────────

const bettingSlipService = new BettingSlipService();

export default bettingSlipService;
