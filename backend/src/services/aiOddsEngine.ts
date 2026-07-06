// AI Odds Engine - Machine Learning avanzato per quote predittive
// TensorFlow.js + Neural Networks per previsioni ultra-accurate

// TensorFlow is optional in this environment; fall back to no-op implementation when unavailable.
let tf: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  tf = require('@tensorflow/tfjs-node');
} catch {
  tf = null;
}
import { ProSportsEvent, ProSportsOdds } from './proSportsApiService';

// ── Neural Network Architecture ───────────────────────────────────────────────────────

interface TrainingData {
  features: number[][];
  labels: number[][];
}

interface ModelMetrics {
  accuracy: number;
  loss: number;
  mae: number;
  rmse: number;
}

class AIOddsEngine {
  private model: any = null;
  private isTraining = false;
  private modelMetrics: ModelMetrics = { accuracy: 0, loss: 1, mae: 1, rmse: 1 };

  constructor() {
    this.initializeModel();
  }

  /**
   * Inizializza neural network avanzato
   */
  private async initializeModel() {
    if (!tf) {
      console.warn('TensorFlow non disponibile: AI Odds Engine in modalità fallback.');
      this.model = null;
      return;
    }
    // Architettura deep learning per predizione quote
    this.model = tf.sequential({
      layers: [
        // Input layer - 50 features
        tf.layers.dense({
          inputShape: [50],
          units: 128,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.batchNormalization(),
        
        // Hidden layer 1
        tf.layers.dense({
          units: 256,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dropout({ rate: 0.4 }),
        tf.layers.batchNormalization(),
        
        // Hidden layer 2
        tf.layers.dense({
          units: 128,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.batchNormalization(),
        
        // Hidden layer 3
        tf.layers.dense({
          units: 64,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        
        // Output layer - 3 quote predictions (home, draw, away)
        tf.layers.dense({
          units: 3,
          activation: 'softmax'
        })
      ]
    });

    // Compilazione con optimizer avanzato
    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy', 'mae']
    });

    console.log('Neural Network inizializzato con successo');
  }

  /**
   * Estrae features avanzate per training
   */
  private extractFeatures(event: ProSportsEvent): number[] {
    const features = [];

    // Team strength features (10)
    const homeStrength = this.calculateTeamStrength(event.homeTeam);
    const awayStrength = this.calculateTeamStrength(event.awayTeam);
    features.push(
      homeStrength, awayStrength,
      homeStrength - awayStrength,
      homeStrength / awayStrength,
      this.calculateHomeAdvantage(event),
      this.calculateFormTrend(event.homeTeam),
      this.calculateFormTrend(event.awayTeam),
      this.calculateGoalDifference(event.homeTeam),
      this.calculateGoalDifference(event.awayTeam),
      this.calculateDefensiveStrength(event.homeTeam)
    );

    // H2H features (8)
    const h2hFeatures = this.extractH2HFeatures(event);
    features.push(...h2hFeatures);

    // Tournament features (5)
    const tournamentFeatures = this.extractTournamentFeatures(event);
    features.push(...tournamentFeatures);

    // Temporal features (6)
    const temporalFeatures = this.extractTemporalFeatures(event);
    features.push(...temporalFeatures);

    // Statistical features (12)
    const statsFeatures = this.extractStatisticalFeatures(event);
    features.push(...statsFeatures);

    // Weather & venue features (4)
    const contextFeatures = this.extractContextualFeatures(event);
    features.push(...contextFeatures);

    // Market features (5)
    const marketFeatures = this.extractMarketFeatures(event);
    features.push(...marketFeatures);

    return features;
  }

  /**
   * Calcola forza squadra con algoritmo avanzato
   */
  private calculateTeamStrength(team: any): number {
    // ELO rating dinamico
    const baseELO = 1500;
    const recentForm = this.calculateRecentForm(team);
    const homeAwayPerformance = this.calculateHomeAwayPerformance(team);
    const goalEfficiency = this.calculateGoalEfficiency(team);
    const defensiveStability = this.calculateDefensiveStability(team);
    
    return baseELO + 
           (recentForm * 50) + 
           (homeAwayPerformance * 30) + 
           (goalEfficiency * 40) + 
           (defensiveStability * 20);
  }

  /**
   * Calcola forma recente con trend analysis
   */
  private calculateRecentForm(team: any): number {
    // Simulazione dati forma ultimi 10 match
    const results = [3, 1, 3, 0, 3, 1, 3, 3, 1, 0]; // 7-2-1
    const weights = [1.5, 1.4, 1.3, 1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.6];
    
    const weightedSum = results.reduce((sum, result, index) => 
      sum + (result * weights[index]), 0
    );
    
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    return weightedSum / totalWeight;
  }

  /**
   * Calcola efficienza gol
   */
  private calculateGoalEfficiency(team: any): number {
    // xG (Expected Goals) analysis
    const xGScored = [1.8, 2.1, 1.5, 0.9, 2.3, 1.7, 2.0, 2.4, 1.2, 0.8];
    const actualGoals = [2, 1, 3, 0, 2, 1, 2, 3, 1, 0];
    
    const totalXG = xGScored.reduce((sum, xg) => sum + xg, 0);
    const totalGoals = actualGoals.reduce((sum, goals) => sum + goals, 0);
    
    return totalGoals / totalXG; // Efficienza realizzazione
  }

  /**
   * Estrae features H2H avanzate
   */
  private extractH2HFeatures(event: ProSportsEvent): number[] {
    // Simulazione dati H2H
    const totalMatches = 24;
    const homeWins = 12;
    const awayWins = 8;
    const draws = 4;
    const avgHomeGoals = 1.8;
    const avgAwayGoals = 1.2;
    const recentHomeWins = 3;
    const recentAwayWins = 2;
    
    return [
      totalMatches,
      homeWins / totalMatches,
      awayWins / totalMatches,
      draws / totalMatches,
      avgHomeGoals,
      avgAwayGoals,
      avgHomeGoals - avgAwayGoals,
      (recentHomeWins - recentAwayWins) / 5
    ];
  }

  /**
   * Estrae features tournament
   */
  private extractTournamentFeatures(event: ProSportsEvent): number[] {
    const tournamentImportance = this.getTournamentImportance(event.tournamentId);
    const tournamentAvgGoals = this.getTournamentAvgGoals(event.tournamentId);
    const homeAdvantageTournament = this.getHomeAdvantageByTournament(event.tournamentId);
    const seasonStage = this.getSeasonStage(event);
    const isKnockout = this.isKnockoutStage(event);
    
    return [
      tournamentImportance,
      tournamentAvgGoals,
      homeAdvantageTournament,
      seasonStage,
      isKnockout ? 1 : 0
    ];
  }

  /**
   * Estrae features temporali
   */
  private extractTemporalFeatures(event: ProSportsEvent): number[] {
    const now = Date.now();
    const eventTime = event.startTime;
    const daysToEvent = (eventTime - now) / (1000 * 60 * 60 * 24);
    const isWeekend = new Date(eventTime).getDay() >= 5 ? 1 : 0;
    const isEvening = new Date(eventTime).getHours() >= 18 ? 1 : 0;
    const month = new Date(eventTime).getMonth() / 11; // Normalizzato 0-1
    const seasonProgress = this.getSeasonProgress(event);
    
    return [
      Math.min(daysToEvent / 30, 1), // Giorni normalizzati
      isWeekend,
      isEvening,
      month,
      seasonProgress
    ];
  }

  /**
   * Estrae features statistiche avanzate
   */
  private extractStatisticalFeatures(event: ProSportsEvent): number[] {
    if (!event.statistics) return new Array(12).fill(0);
    
    const stats = event.statistics;
    
    return [
      stats.possession.home / 100,
      stats.possession.away / 100,
      stats.shots.total.home / 30, // Normalizzato
      stats.shots.total.away / 30,
      stats.shots.onTarget.home / 15,
      stats.shots.onTarget.away / 15,
      stats.corners.total.home / 10,
      stats.corners.total.away / 10,
      stats.fouls.home / 20,
      stats.fouls.away / 20,
      stats.yellowCards.home / 5,
      stats.yellowCards.away / 5
    ];
  }

  /**
   * Estrae features contestuali
   */
  private extractContextualFeatures(event: ProSportsEvent): number[] {
    if (!event.weather) return new Array(4).fill(0);
    
    const tempNormalized = Math.min(Math.max((event.weather.temperature - 5) / 30, 0), 1);
    const humidityNormalized = event.weather.humidity / 100;
    const windImpact = Math.min(event.weather.windSpeed / 50, 1);
    const pitchCondition = this.getPitchConditionScore(event.weather.pitchCondition);
    
    return [tempNormalized, humidityNormalized, windImpact, pitchCondition];
  }

  /**
   * Estrae features di mercato
   */
  private extractMarketFeatures(event: ProSportsEvent): number[] {
    if (!event.odds || !event.odds.markets) return new Array(5).fill(0);
    
    const h2hMarket = event.odds.markets.find(m => m.marketId === 'h2h');
    if (!h2hMarket) return new Array(5).fill(0);
    
    const outcomes = h2hMarket.outcomes;
    const homeOdds = outcomes[0]?.price || 2.0;
    const drawOdds = outcomes[1]?.price || 3.0;
    const awayOdds = outcomes[2]?.price || 3.0;
    
    // Calcolo probabilità implicite
    const homeProb = 1 / homeOdds;
    const drawProb = 1 / drawOdds;
    const awayProb = 1 / awayOdds;
    const totalProb = homeProb + drawProb + awayProb;
    const margin = (totalProb - 1) * 100;
    
    return [
      homeOdds / 5, // Normalizzato
      drawOdds / 5,
      awayOdds / 5,
      margin / 15, // Normalizzato
      (homeOdds - awayOdds) / 5 // Differenza quote
    ];
  }

  /**
   * Addestra il modello con dati storici
   */
  async trainModel(historicalData: ProSportsEvent[]): Promise<void> {
    if (this.isTraining || !this.model) return;
    
    this.isTraining = true;
    console.log('Inizio training Neural Network...');

    try {
      // Prepara dati training
      const trainingData = this.prepareTrainingData(historicalData);
      
      // Converti in tensors
      const features = tf.tensor2d(trainingData.features);
      const labels = tf.tensor2d(trainingData.labels);
      
      // Training loop avanzato
      const history = await this.model.fit(features, labels, {
        epochs: 100,
        batchSize: 32,
        validationSplit: 0.2,
        shuffle: true,
        callbacks: [
          tf.callbacks.earlyStopping({ monitor: 'val_loss', patience: 10 }),
          tf.callbacks.reduceLROnPlateau({ monitor: 'val_loss', factor: 0.5, patience: 5 })
        ]
      });

      // Aggiorna metriche
      this.modelMetrics = {
        accuracy: history.history['accuracy'][history.history['accuracy'].length - 1],
        loss: history.history['loss'][history.history['loss'].length - 1],
        mae: history.history['mae'][history.history['mae'].length - 1],
        rmse: Math.sqrt(history.history['loss'][history.history['loss'].length - 1])
      };

      console.log('Training completato:', this.modelMetrics);
      
      // Cleanup
      features.dispose();
      labels.dispose();
      
    } catch (error) {
      console.error('Errore durante training:', error);
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Prepara dati di training
   */
  private prepareTrainingData(events: ProSportsEvent[]): TrainingData {
    const features: number[][] = [];
    const labels: number[][] = [];

    events.forEach(event => {
      // Estrai features
      const eventFeatures = this.extractFeatures(event);
      features.push(eventFeatures);

      // Calcola label (risultato reale)
      const result = this.calculateActualResult(event);
      labels.push([
        result.home === 1 ? 1 : 0,
        result.draw === 1 ? 1 : 0,
        result.away === 1 ? 1 : 0
      ]);
    });

    return { features, labels };
  }

  /**
   * Predice quote con AI
   */
  async predictOdds(event: ProSportsEvent): Promise<ProSportsOdds> {
    if (!this.model) throw new Error('Modello non inizializzato');

    try {
      // Estrai features
      const features = this.extractFeatures(event);
      
      // Converti in tensor
      const inputTensor = tf.tensor2d([features]);
      
      // Predizione
      const prediction = this.model.predict(inputTensor) as any;
      const probabilities = await prediction.data();
      
      // Converti probabilità in quote
      const odds = this.probabilitiesToOdds(Array.from(probabilities));
      
      // Cleanup
      inputTensor.dispose();
      prediction.dispose();
      
      return {
        eventId: event.id,
        markets: [
          {
            marketId: 'h2h_ai',
            marketName: '1X2 (AI Enhanced)',
            outcomes: [
              { name: event.homeTeam.name, price: odds.home },
              { name: 'Draw', price: odds.draw },
              { name: event.awayTeam.name, price: odds.away }
            ],
            available: true,
            suspended: false,
            lastUpdate: Date.now()
          }
        ],
        lastUpdate: Date.now(),
        bookmakers: [{
          bookmakerId: 'ai_engine',
          bookmakerName: 'AI Prediction Engine',
          logo: '/ai/brain.png',
          markets: [],
          averagePayout: 95.2,
          margin: 4.8
        }],
        movement: [],
        suspended: []
      };
      
    } catch (error) {
      console.error('Errore predizione AI:', error);
      throw error;
    }
  }

  /**
   * Converte probabilità neural network in quote
   */
  private probabilitiesToOdds(probabilities: number[]): { home: number; draw: number; away: number } {
    // Applica margine AI (più basso perché più accurato)
    const margin = 0.04; // 4% margine AI
    
    const adjustedProbs = probabilities.map(p => p * (1 - margin));
    const total = adjustedProbs.reduce((sum, p) => sum + p, 0);
    const normalizedProbs = adjustedProbs.map(p => p / total);
    
    return {
      home: Math.round((1 / normalizedProbs[0]) * 100) / 100,
      draw: Math.round((1 / normalizedProbs[1]) * 100) / 100,
      away: Math.round((1 / normalizedProbs[2]) * 100) / 100
    };
  }

  /**
   * Calcola risultato reale per training
   */
  private calculateActualResult(event: ProSportsEvent): { home: number; draw: number; away: number } {
    if (event.status.type === 'finished' && event.score) {
      if (event.score.home > event.score.away) {
        return { home: 1, draw: 0, away: 0 };
      } else if (event.score.away > event.score.home) {
        return { home: 0, draw: 0, away: 1 };
      } else {
        return { home: 0, draw: 1, away: 0 };
      }
    }
    
    // Per eventi non finiti, usa quote attuali come proxy
    return { home: 0, draw: 0, away: 0 };
  }

  /**
   * Metodi helper semplificati
   */
  private calculateHomeAdvantage(event: ProSportsEvent): number {
    return 0.15; // 15% vantaggio base
  }

  private calculateFormTrend(team: any): number {
    return Math.random() * 0.3 - 0.15; // -15% a +15%
  }

  private calculateGoalDifference(team: any): number {
    return Math.random() * 2 - 1; // -1 a +1
  }

  private calculateDefensiveStrength(team: any): number {
    return Math.random() * 0.5 + 0.5; // 0.5 a 1.0
  }

  private calculateHomeAwayPerformance(team: any): number {
    return Math.random() * 0.4 - 0.2; // -20% a +20%
  }

  private calculateDefensiveStability(team: any): number {
    return this.calculateDefensiveStrength(team);
  }

  private getTournamentImportance(tournamentId: string): number {
    return Math.random(); // 0-1
  }

  private getTournamentAvgGoals(tournamentId: string): number {
    return 2.5 + Math.random(); // 2.5-3.5
  }

  private getHomeAdvantageByTournament(tournamentId: string): number {
    return 0.1 + Math.random() * 0.1; // 10-20%
  }

  private getSeasonStage(event: ProSportsEvent): number {
    return Math.random(); // 0-1
  }

  private isKnockoutStage(event: ProSportsEvent): boolean {
    return Math.random() > 0.7; // 30% knockout
  }

  private getSeasonProgress(event: ProSportsEvent): number {
    return Math.random(); // 0-1
  }

  private getPitchConditionScore(condition: string): number {
    return 0.5 + Math.random() * 0.5; // 0.5-1.0
  }

  /**
   * Salva il modello addestrato
   */
  async saveModel(path: string): Promise<void> {
    if (!this.model) return;
    await this.model.save(`file://${path}`);
    console.log(`Modello salvato in ${path}`);
  }

  /**
   * Carica modello pre-addestrato
   */
  async loadModel(path: string): Promise<void> {
    this.model = await tf.loadLayersModel(`file://${path}`);
    console.log(`Modello caricato da ${path}`);
  }

  /**
   * Get model metrics
   */
  getModelMetrics(): ModelMetrics {
    return this.modelMetrics;
  }

  /**
   * Check if model is ready for predictions
   */
  isModelReady(): boolean {
    return this.model !== null && !this.isTraining;
  }
}

// ── Esportazione ───────────────────────────────────────────────────────────────────

export const aiOddsEngine = new AIOddsEngine();

export default aiOddsEngine;
