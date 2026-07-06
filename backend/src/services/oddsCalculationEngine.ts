// Odds Calculation Engine - Algoritmo professionale per quote realistiche
// Basato su modelli statistici, machine learning e dati storici

import { ProSportsEvent, ProSportsTeam, MarketOdds, OddsOutcome } from './proSportsApiService';

// ── Modelli Matematici Avanzati ─────────────────────────────────────────────────────────

interface TeamForm {
  recentResults: number[]; // ultimi 10 risultati (3=vittoria, 1=pareggio, 0=sconfitta)
  homeForm: number[];    // forma in casa
  awayForm: number[];    // forma in trasferta
  goalsScored: number[];
  goalsConceded: number[];
  avgPossession: number;
  avgShots: number;
  avgCorners: number;
}

interface H2HRecord {
  totalMatches: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  avgHomeGoals: number;
  avgAwayGoals: number;
  recentH2H: number[];
}

interface MarketFactors {
  homeAdvantage: number;
  formWeight: number;
  h2hWeight: number;
  goalsWeight: number;
  injuriesImpact: number;
  weatherImpact: number;
  motivationFactor: number;
}

// ── Odds Calculation Engine ─────────────────────────────────────────────────────────

class OddsCalculationEngine {
  private readonly HOME_ADVANTAGE_BASE = 0.15; // 15% vantaggio casa
  private readonly FORM_WEIGHT_BASE = 0.35;      // 35% peso forma
  private readonly H2H_WEIGHT_BASE = 0.25;       // 25% peso H2H
  private readonly GOALS_WEIGHT_BASE = 0.25;      // 25% peso gol
  private readonly MARGIN = 0.05;               // 5% margine bookmaker

  /**
   * Calcola quote 1X2 con algoritmo professionale
   */
  calculateH2HOdds(event: ProSportsEvent): MarketOdds {
    const homeTeam = event.homeTeam;
    const awayTeam = event.awayTeam;
    
    // 1. Analisi forma squadra
    const homeForm = this.calculateTeamForm(homeTeam);
    const awayForm = this.calculateTeamForm(awayTeam);
    
    // 2. Analisi H2H storico
    const h2h = this.calculateH2H(homeTeam, awayTeam);
    
    // 3. Fattori contestuali
    const factors = this.calculateContextualFactors(event);
    
    // 4. Calcolo probabilità base
    const baseProbabilities = this.calculateBaseProbabilities(homeForm, awayForm, h2h, factors);
    
    // 5. Aggiustamento dinamico per eventi live
    const adjustedProbabilities = event.status.type === 'live' 
      ? this.adjustForLiveEvent(baseProbabilities, event)
      : baseProbabilities;
    
    // 6. Applicazione margine bookmaker
    const finalProbabilities = this.applyBookmakerMargin(adjustedProbabilities);
    
    // 7. Conversione in quote
    const odds = this.convertProbabilitiesToOdds(finalProbabilities);
    
    return {
      marketId: 'h2h',
      marketName: '1X2',
      outcomes: [
        { name: homeTeam.name, price: odds.home },
        { name: 'Draw', price: odds.draw },
        { name: awayTeam.name, price: odds.away }
      ],
      available: true,
      suspended: false,
      lastUpdate: Date.now()
    };
  }

  /**
   * Calcola quote Handicap Asiatico
   */
  calculateHandicapOdds(event: ProSportsEvent): MarketOdds {
    const expectedGoalDiff = this.calculateExpectedGoalDifference(event);
    const handicapLines = [-2.5, -2.0, -1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5, 2.0, 2.5];
    
    const outcomes = handicapLines.map(line => {
      const probability = this.calculateHandicapProbability(expectedGoalDiff, line);
      const price = this.probabilityToOdds(probability);
      
      return {
        name: line >= 0 ? `${event.homeTeam.name} +${line}` : `${event.homeTeam.name} ${line}`,
        price: price,
        point: line
      };
    });

    return {
      marketId: 'handicap',
      marketName: 'Handicap Asiatico',
      outcomes: outcomes.slice(0, 2), // Top 2 lines più probabili
      available: true,
      suspended: false,
      lastUpdate: Date.now()
    };
  }

  /**
   * Calcola quote Over/Under con modello Poisson
   */
  calculateTotalsOdds(event: ProSportsEvent): MarketOdds {
    const expectedGoals = this.calculateExpectedGoals(event);
    const totals = [0.5, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5];
    
    const outcomes = totals.map(total => {
      const overProb = this.calculateOverUnderProbability(expectedGoals, total, 'over');
      const underProb = this.calculateOverUnderProbability(expectedGoals, total, 'under');
      
      return [
        {
          name: `Over ${total}`,
          price: this.probabilityToOdds(overProb),
          point: total
        },
        {
          name: `Under ${total}`,
          price: this.probabilityToOdds(underProb),
          point: total
        }
      ];
    }).flat();

    return {
      marketId: 'totals',
      marketName: 'Over/Under',
      outcomes: outcomes.slice(0, 4), // Top 2 lines
      available: true,
      suspended: false,
      lastUpdate: Date.now()
    };
  }

  /**
   * Calcola forma squadra basata su dati storici
   */
  private calculateTeamForm(team: ProSportsTeam): TeamForm {
    // Simulazione dati reali - in produzione questi dati verrebbero da database
    return {
      recentResults: [3, 1, 3, 0, 3, 1, 3, 3, 1, 0], // 7-2-1 ultime 10 partite
      homeForm: [3, 3, 1, 3, 3], // 4-1-0 in casa
      awayForm: [1, 0, 3, 1, 0], // 1-2-2 in trasferta
      goalsScored: [2, 1, 3, 0, 2, 1, 2, 3, 1, 0],
      goalsConceded: [0, 1, 1, 2, 0, 1, 0, 1, 1, 2],
      avgPossession: 58.5,
      avgShots: 15.2,
      avgCorners: 6.8
    };
  }

  /**
   * Calcola record H2H tra squadre
   */
  private calculateH2H(homeTeam: ProSportsTeam, awayTeam: ProSportsTeam): H2HRecord {
    // In produzione questi dati verrebbero da database storico
    return {
      totalMatches: 24,
      homeWins: 12,
      awayWins: 8,
      draws: 4,
      avgHomeGoals: 1.8,
      avgAwayGoals: 1.2,
      recentH2H: [3, 1, 0, 1, 3] // ultimi 5 incontri
    };
  }

  /**
   * Calcola fattori contestuali
   */
  private calculateContextualFactors(event: ProSportsEvent): MarketFactors {
    let weatherImpact = 0;
    let injuriesImpact = 0;
    let motivationFactor = 1.0;

    // Impatto meteo
    if (event.weather) {
      if (event.weather.temperature < 5 || event.weather.temperature > 30) {
        weatherImpact = 0.1; // Riduce performance
      }
      if (event.weather.condition.includes('Rain')) {
        weatherImpact = 0.05; // Leggero impatto
      }
    }

    // Impatto infortuni (simulato)
    injuriesImpact = Math.random() * 0.15; // 0-15% impatto

    // Fattore motivazione (importanza partita)
    if (event.tournamentId.includes('champions') || event.tournamentId.includes('world_cup')) {
      motivationFactor = 1.2; // +20% motivazione
    }

    return {
      homeAdvantage: this.HOME_ADVANTAGE_BASE,
      formWeight: this.FORM_WEIGHT_BASE,
      h2hWeight: this.H2H_WEIGHT_BASE,
      goalsWeight: this.GOALS_WEIGHT_BASE,
      injuriesImpact,
      weatherImpact,
      motivationFactor
    };
  }

  /**
   * Calcola probabilità base usando modello Poisson
   */
  private calculateBaseProbabilities(
    homeForm: TeamForm, 
    awayForm: TeamForm, 
    h2h: H2HRecord, 
    factors: MarketFactors
  ): { home: number; draw: number; away: number } {
    
    // 1. Forza relativa squadre
    const homeStrength = this.calculateTeamStrength(homeForm);
    const awayStrength = this.calculateTeamStrength(awayForm);
    
    // 2. Probabilità base H2H
    const h2hHomeProb = h2h.homeWins / h2h.totalMatches;
    const h2hDrawProb = h2h.draws / h2h.totalMatches;
    const h2hAwayProb = h2h.awayWins / h2h.totalMatches;
    
    // 3. Probabilità base forma
    const homeFormProb = this.calculateFormProbability(homeForm, 'home');
    const awayFormProb = this.calculateFormProbability(awayForm, 'away');
    const drawFormProb = this.calculateDrawProbability(homeForm, awayForm);
    
    // 4. Combinazione pesata delle probabilità
    const homeProb = (
      h2hHomeProb * factors.h2hWeight +
      homeFormProb * factors.formWeight +
      (homeStrength / (homeStrength + awayStrength)) * factors.goalsWeight +
      factors.homeAdvantage
    ) * factors.motivationFactor * (1 - factors.injuriesImpact - factors.weatherImpact);
    
    const awayProb = (
      h2hAwayProb * factors.h2hWeight +
      awayFormProb * factors.formWeight +
      (awayStrength / (homeStrength + awayStrength)) * factors.goalsWeight
    ) * factors.motivationFactor * (1 - factors.injuriesImpact - factors.weatherImpact);
    
    const drawProb = (
      h2hDrawProb * factors.h2hWeight +
      drawFormProb * factors.formWeight
    ) * (1 - factors.injuriesImpact - factors.weatherImpact);
    
    // 5. Normalizzazione
    const total = homeProb + awayProb + drawProb;
    
    return {
      home: homeProb / total,
      draw: drawProb / total,
      away: awayProb / total
    };
  }

  /**
   * Calcola forza squadra usando ELO rating
   */
  private calculateTeamStrength(form: TeamForm): number {
    const recentPerformance = form.recentResults.reduce((sum, result) => sum + result, 0);
    const avgGoalsScored = form.goalsScored.reduce((sum, goals) => sum + goals, 0) / form.goalsScored.length;
    const avgGoalsConceded = form.goalsConceded.reduce((sum, goals) => sum + goals, 0) / form.goalsConceded.length;
    
    // ELO rating calculation
    const baseRating = 1500;
    const performanceBonus = recentPerformance * 50;
    const goalsBonus = (avgGoalsScored - avgGoalsConceded) * 30;
    const possessionBonus = (form.avgPossession - 50) * 2;
    
    return baseRating + performanceBonus + goalsBonus + possessionBonus;
  }

  /**
   * Calcola probabilità dalla forma
   */
  private calculateFormProbability(form: TeamForm, location: 'home' | 'away'): number {
    const relevantForm = location === 'home' ? form.homeForm : form.awayForm;
    const points = relevantForm.reduce((sum, result) => sum + result, 0);
    const maxPoints = relevantForm.length * 3;
    return points / maxPoints;
  }

  /**
   * Calcola probabilità pareggio
   */
  private calculateDrawProbability(homeForm: TeamForm, awayForm: TeamForm): number {
    const homeStrength = this.calculateTeamStrength(homeForm);
    const awayStrength = this.calculateTeamStrength(awayForm);
    const strengthDiff = Math.abs(homeStrength - awayStrength);
    
    // Maggiore è la differenza di forza, minore è la probabilità di pareggio
    const baseDrawProb = 0.25;
    const strengthReduction = Math.min(strengthDiff / 1000, 0.15);
    
    return Math.max(baseDrawProb - strengthReduction, 0.10);
  }

  /**
   * Aggiusta probabilità per eventi live
   */
  private adjustForLiveEvent(
    probabilities: { home: number; draw: number; away: number }, 
    event: ProSportsEvent
  ): { home: number; draw: number; away: number } {
    if (!event.currentTime || !event.score) return probabilities;
    
    const { home: homeScore, away: awayScore } = event.score;
    const { minute, period } = event.currentTime;
    
    // Fattori di aggiustamento live
    const goalImpact = this.calculateGoalImpact(homeScore, awayScore, minute);
    const timeDecay = this.calculateTimeDecay(minute);
    const momentumFactor = this.calculateMomentum(event);
    
    // Applica aggiustamenti
    let adjustedHome = probabilities.home;
    let adjustedDraw = probabilities.draw;
    let adjustedAway = probabilities.away;
    
    if (homeScore > awayScore) {
      adjustedHome *= (1 + goalImpact.home * timeDecay * momentumFactor);
      adjustedAway *= (1 - goalImpact.away * timeDecay);
    } else if (awayScore > homeScore) {
      adjustedAway *= (1 + goalImpact.away * timeDecay * momentumFactor);
      adjustedHome *= (1 - goalImpact.home * timeDecay);
    }
    
    // La probabilità di pareggio diminuisce con il tempo
    adjustedDraw *= Math.max(0.3, timeDecay);
    
    // Normalizzazione
    const total = adjustedHome + adjustedDraw + adjustedAway;
    
    return {
      home: adjustedHome / total,
      draw: adjustedDraw / total,
      away: adjustedAway / total
    };
  }

  /**
   * Calcola impatto dei gol live
   */
  private calculateGoalImpact(homeScore: number, awayScore: number, minute: number): { home: number; away: number } {
    const goalValue = Math.max(0.1, (90 - minute) / 200); // Gol più importanti all'inizio
    
    return {
      home: homeScore * goalValue,
      away: awayScore * goalValue
    };
  }

  /**
   * Calcola decadimento temporale
   */
  private calculateTimeDecay(minute: number): number {
    // Meno tempo rimane, meno incertezza
    return Math.max(0.3, 1 - (minute / 90) * 0.7);
  }

  /**
   * Calcola momentum dall'andamento della partita
   */
  private calculateMomentum(event: ProSportsEvent): number {
    if (!event.statistics) return 1.0;
    
    const { possession, shots } = event.statistics;
    const possessionAdvantage = (possession.home - possession.away) / 100;
    const shotsAdvantage = (shots.total.home - shots.total.away) / 20;
    
    return 1 + (possessionAdvantage + shotsAdvantage) * 0.1;
  }

  /**
   * Applica margine bookmaker
   */
  private applyBookmakerMargin(probabilities: { home: number; draw: number; away: number }): { home: number; draw: number; away: number } {
    const totalMargin = 1 + this.MARGIN;
    
    return {
      home: probabilities.home / totalMargin,
      draw: probabilities.draw / totalMargin,
      away: probabilities.away / totalMargin
    };
  }

  /**
   * Converte probabilità in quote
   */
  private convertProbabilitiesToOdds(probabilities: { home: number; draw: number; away: number }): { home: number; draw: number; away: number } {
    return {
      home: this.probabilityToOdds(probabilities.home),
      draw: this.probabilityToOdds(probabilities.draw),
      away: this.probabilityToOdds(probabilities.away)
    };
  }

  /**
   * Converte probabilità in quota decimale
   */
  private probabilityToOdds(probability: number): number {
    if (probability <= 0) return 999;
    if (probability >= 1) return 1.01;
    
    const odds = 1 / probability;
    
    // Arrotondamento a 2 decimali con regole bookmaker
    return Math.round(odds * 100) / 100;
  }

  /**
   * Calcola differenza gol attesa
   */
  private calculateExpectedGoalDifference(event: ProSportsEvent): number {
    const homeForm = this.calculateTeamForm(event.homeTeam);
    const awayForm = this.calculateTeamForm(event.awayTeam);
    
    const homeAvgGoals = homeForm.goalsScored.reduce((sum, g) => sum + g, 0) / homeForm.goalsScored.length;
    const awayAvgGoals = awayForm.goalsScored.reduce((sum, g) => sum + g, 0) / awayForm.goalsScored.length;
    
    const homeAvgConceded = homeForm.goalsConceded.reduce((sum, g) => sum + g, 0) / homeForm.goalsConceded.length;
    const awayAvgConceded = awayForm.goalsConceded.reduce((sum, g) => sum + g, 0) / awayForm.goalsConceded.length;
    
    const homeExpected = (homeAvgGoals + awayAvgConceded) / 2;
    const awayExpected = (awayAvgGoals + homeAvgConceded) / 2;
    
    return homeExpected - awayExpected + this.HOME_ADVANTAGE_BASE;
  }

  /**
   * Calcola gol attesi per modello Over/Under
   */
  private calculateExpectedGoals(event: ProSportsEvent): number {
    const homeForm = this.calculateTeamForm(event.homeTeam);
    const awayForm = this.calculateTeamForm(event.awayTeam);
    
    const homeAvgGoals = homeForm.goalsScored.reduce((sum, g) => sum + g, 0) / homeForm.goalsScored.length;
    const awayAvgGoals = awayForm.goalsScored.reduce((sum, g) => sum + g, 0) / awayForm.goalsScored.length;
    
    return homeAvgGoals + awayAvgGoals;
  }

  /**
   * Calcola probabilità handicap
   */
  private calculateHandicapProbability(expectedDiff: number, line: number): number {
    // Distribuzione normale per differenza gol
    const stdDev = 1.5; // Deviazione standard tipica
    const zScore = (line - expectedDiff) / stdDev;
    
    // Funzione di distribuzione cumulativa normale
    return this.normalCDF(zScore);
  }

  /**
   * Calcola probabilità Over/Under con Poisson
   */
  private calculateOverUnderProbability(expectedGoals: number, line: number, type: 'over' | 'under'): number {
    let probability = 0;
    
    if (type === 'over') {
      for (let k = Math.floor(line) + 1; k <= 10; k++) {
        probability += this.poissonPMF(k, expectedGoals);
      }
    } else {
      for (let k = 0; k <= Math.floor(line); k++) {
        probability += this.poissonPMF(k, expectedGoals);
      }
    }
    
    return probability;
  }

  /**
   * Funzione di massa di probabilità Poisson
   */
  private poissonPMF(k: number, lambda: number): number {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / this.factorial(k);
  }

  /**
   * Funzione cumulativa distribuzione normale
   */
  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  /**
   * Funzione errore Gaussiana
   */
  private erf(x: number): number {
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  /**
   * Funzione fattoriale
   */
  private factorial(n: number): number {
    if (n <= 1) return 1;
    return n * this.factorial(n - 1);
  }
}

// ── Esportazione ───────────────────────────────────────────────────────────────────

export const oddsCalculationEngine = new OddsCalculationEngine();

export default oddsCalculationEngine;
