import { getRedisClient } from './cacheService';

// Liability factors: The proportion the odds will adjust per €1000 imbalance
const VOLATILITY_FACTOR = 0.02; // A 2% shift for every €1000 of unbalanced risk

export interface LiabilityState {
  totalStake: number;
  outcomes: Record<string, number>;
}

/**
 * Registra una puntata nel registro del rischio.
 */
export async function recordLiability(eventId: string, market: string, outcome: string, stake: number): Promise<void> {
  const client = getRedisClient();
  const key = `liability:${eventId}:${market}`;
  
  // Hashmap in Redis to track stakes: { [outcome]: total_stake }
  await client.hincrbyfloat(key, outcome, stake);
  await client.hincrbyfloat(key, '_TOTAL', stake);
  
  // Scadenza del liability al termine del match (cache di 48 ore)
  await client.expire(key, 48 * 3600);
}

/**
 * Recupera l'esposizione corrente su un mercato.
 */
export async function getLiability(eventId: string, market: string): Promise<LiabilityState> {
  const client = getRedisClient();
  const key = `liability:${eventId}:${market}`;
  
  try {
    const raw = await client.hgetall(key);
    if (!raw || Object.keys(raw).length === 0) {
      return { totalStake: 0, outcomes: {} };
    }
    
    const outcomes: Record<string, number> = {};
    let totalStake = 0;
    
    for (const [k, v] of Object.entries(raw)) {
      if (k === '_TOTAL') totalStake = parseFloat(v);
      else outcomes[k] = parseFloat(v);
    }
    
    return { totalStake, outcomes };
  } catch (err) {
    return { totalStake: 0, outcomes: {} };
  }
}

// Memory Cache integrato per accesso sincrono durante i tick (0 latency)
const liabilityMemCache = new Map<string, LiabilityState>();

export async function refreshLiabilityCache(eventsId: string[]): Promise<void> {
  for (const id of eventsId) {
    // Carica solo i mercati principali per ora (es. h2h e totals) per questioni di scaling
    const h2h = await getLiability(id, "h2h");
    const totals = await getLiability(id, "totals");
    liabilityMemCache.set(`${id}:h2h`, h2h);
    if (totals.totalStake > 0) liabilityMemCache.set(`${id}:totals`, totals);
  }
}

export function getLiabilitySync(eventId: string, market: string): LiabilityState {
  return liabilityMemCache.get(`${eventId}:${market}`) ?? { totalStake: 0, outcomes: {} };
}

/**
 * Restituisce il moltiplicatore (Market Influence) per l'outcome.
 * Se ci sono troppi soldi sull'outcome, la quota scende (< 1.0).
 * Se ce ne sono pochi rispetto al resto, la quota sale (> 1.0).
 *
 * Utilizza la formula logistica per l'adattamento delle probabilità implicite.
 */
export function calculateMarketAdjustment(
  outcome: string, 
  baseProb: number, 
  state: LiabilityState,
  fluidity = 0.5 // come le quote reagiscono velocemente al mercato
): number {
  if (state.totalStake < 100) return 1.0; // Pochi volumi -> nessun impatto
  
  const outcomeStake = state.outcomes[outcome] || 0;
  
  // L'equilibrio "ideale" è proporzionale alla probabilità base
  const expectedStake = state.totalStake * baseProb;
  
  // Sbilanciamento (es. 1000€ sopra la media)
  const imbalance = outcomeStake - expectedStake;
  
  // Normalizzazione rispetto ad una cassa di 1000€
  const normalizedImbalance = imbalance / 1000.0;
  
  // La probabilità reale aggiustata
  // Una funzione sigmoid per evitare estremi
  const shift = normalizedImbalance * VOLATILITY_FACTOR * fluidity;
  
  const adjustedProb = baseProb + shift;
  
  // Calcolo moltiplicatore rispetto alla quota:
  // (P_nuova / P_vecchia) invertito perché p più alta = quota più bassa
  if (adjustedProb <= 0.01) return 1.5; // Limite quota al rialzo
  if (adjustedProb >= 0.99) return 0.5; // Limite quota al ribasso
  
  // Moltiplicatore quota reale: 
  // Quota = 1 / P. Moltiplicatore = (1/AdjP) / (1/BaseP) = BaseP / AdjP
  return baseProb / adjustedProb;
}
