// Sport-Betting-API Cache Service - Sistema di cache ottimizzato per BigBet365
// Gestisce cache multi-livello con Redis fallback

import { getRedisClient } from './cacheService';

// ── Configurazione Cache ─────────────────────────────────────────────────────────

const CACHE_PREFIX = 'sport-betting';
const DEFAULT_TTL = 60; // 1 minuto default
const LIVE_TTL = 30; // 30 secondi per dati live
const PREMATCH_TTL = 120; // 2 minuti per prematch (faster odds updates)
const EVENTS_TTL = 120; // 2 minuti per eventi

// ── Interfacce Cache ───────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  source: 'sport-betting-api' | 'fallback';
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  errors: number;
}

// ── Cache Service Class ─────────────────────────────────────────────────────────

class SportBettingCacheService {
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    errors: 0
  };

  private memoryCache: Map<string, CacheEntry<any>> = new Map();

  /**
   * Genera chiave cache con prefisso
   */
  private getKey(key: string): string {
    return `${CACHE_PREFIX}:${key}`;
  }

  /**
   * Determina TTL appropriato basato sul tipo di dati
   */
  private getTTL(type: 'live' | 'prematch' | 'events' | 'default' = 'default'): number {
    switch (type) {
      case 'live': return LIVE_TTL;
      case 'prematch': return PREMATCH_TTL;
      case 'events': return EVENTS_TTL;
      default: return DEFAULT_TTL;
    }
  }

  /**
   * Pulisce cache entries scaduti dalla memoria
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Ottiene dati dalla cache (Redis -> Memory -> null)
   */
  async get<T>(key: string, type: 'live' | 'prematch' | 'events' | 'default' = 'default'): Promise<T | null> {
    const fullKey = this.getKey(key);
    
    try {
      // Try Redis first
      const redis = getRedisClient();
      const cached = await redis.get(fullKey);
      
      if (cached) {
        this.stats.hits++;
        const parsed = JSON.parse(cached) as CacheEntry<T>;
        
        // Check if still valid
        const now = Date.now();
        if (now - parsed.timestamp < parsed.ttl * 1000) {
          return parsed.data;
        }
        
        // Remove expired entry
        await redis.del(fullKey);
      }

      // Fallback to memory cache
      const memoryEntry = this.memoryCache.get(fullKey);
      if (memoryEntry) {
        const now = Date.now();
        if (now - memoryEntry.timestamp < memoryEntry.ttl * 1000) {
          this.stats.hits++;
          return memoryEntry.data;
        }
        this.memoryCache.delete(fullKey);
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.errors++;
      
      // Try memory cache as fallback
      const memoryEntry = this.memoryCache.get(fullKey);
      if (memoryEntry) {
        const now = Date.now();
        if (now - memoryEntry.timestamp < memoryEntry.ttl * 1000) {
          return memoryEntry.data;
        }
        this.memoryCache.delete(fullKey);
      }
      
      return null;
    }
  }

  /**
   * Salva dati nella cache (Redis + Memory)
   */
  async set<T>(
    key: string, 
    data: T, 
    type: 'live' | 'prematch' | 'events' | 'default' = 'default',
    source: 'sport-betting-api' | 'fallback' = 'sport-betting-api'
  ): Promise<void> {
    const fullKey = this.getKey(key);
    const ttl = this.getTTL(type);
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      source
    };

    try {
      // Save to Redis
      const redis = getRedisClient();
      await redis.setex(fullKey, ttl, JSON.stringify(entry));
      
      // Save to memory as backup
      this.memoryCache.set(fullKey, entry);
      
      this.stats.sets++;
      
      // Cleanup expired entries
      this.cleanupMemoryCache();
    } catch (error) {
      console.error('Cache set error:', error);
      this.stats.errors++;
      
      // At least save to memory
      this.memoryCache.set(fullKey, entry);
      this.stats.sets++;
    }
  }

  /**
   * Elimina una chiave dalla cache
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.getKey(key);
    
    try {
      const redis = getRedisClient();
      await redis.del(fullKey);
      this.memoryCache.delete(fullKey);
    } catch (error) {
      console.error('Cache delete error:', error);
      this.stats.errors++;
      this.memoryCache.delete(fullKey);
    }
  }

  /**
   * Pulisce tutta la cache Sport-Betting
   */
  async clear(): Promise<void> {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys(`${CACHE_PREFIX}:*`);
      
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      
      this.memoryCache.clear();
    } catch (error) {
      console.error('Cache clear error:', error);
      this.stats.errors++;
      this.memoryCache.clear();
    }
  }

  /**
   * Ottiene statistiche della cache
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Resetta statistiche
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      errors: 0
    };
  }

  /**
   * Verifica se una chiave esiste in cache
   */
  async exists(key: string): Promise<boolean> {
    const fullKey = this.getKey(key);
    
    try {
      const redis = getRedisClient();
      const exists = await redis.exists(fullKey);
      
      if (exists) return true;
      
      // Check memory cache
      const memoryEntry = this.memoryCache.get(fullKey);
      if (memoryEntry) {
        const now = Date.now();
        return now - memoryEntry.timestamp < memoryEntry.ttl * 1000;
      }
      
      return false;
    } catch (error) {
      console.error('Cache exists error:', error);
      this.stats.errors++;
      
      // Check memory cache as fallback
      const memoryEntry = this.memoryCache.get(fullKey);
      if (memoryEntry) {
        const now = Date.now();
        return now - memoryEntry.timestamp < memoryEntry.ttl * 1000;
      }
      
      return false;
    }
  }

  /**
   * Ottiene tutte le chiavi della cache Sport-Betting
   */
  async getKeys(): Promise<string[]> {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys(`${CACHE_PREFIX}:*`);
      return keys.map(key => key.replace(`${CACHE_PREFIX}:`, ''));
    } catch (error) {
      console.error('Cache getKeys error:', error);
      this.stats.errors++;
      return Array.from(this.memoryCache.keys()).map(key => key.replace(`${CACHE_PREFIX}:`, ''));
    }
  }

  /**
   * Cache con fallback intelligente per quote
   */
  async getWithFallback<T>(
    key: string,
    fetcher: () => Promise<T | null>,
    type: 'live' | 'prematch' | 'events' | 'default' = 'default'
  ): Promise<T | null> {
    // Try cache first
    const cached = await this.get<T>(key, type);
    if (cached !== null) {
      return cached;
    }

    try {
      // Fetch fresh data
      const data = await fetcher();
      if (data !== null) {
        await this.set(key, data, type, 'sport-betting-api');
        return data;
      }
    } catch (error) {
      console.error('Fetcher error:', error);
    }

    return null;
  }

  /**
   * Pre-carica dati comuni in cache
   */
  async preloadCommonData(): Promise<void> {
    try {
      // Preload popular sports
      const popularSports = ['soccer', 'basketball', 'tennis'];
      
      for (const sport of popularSports) {
        // Preload events
        const eventsKey = `events:prematch:${sport}`;
        const eventsCached = await this.exists(eventsKey);
        if (!eventsCached) {
          // This will be populated by the API routes when called
        }
        
        // Preload odds
        const oddsKey = `odds:prematch:${sport}:h2h`;
        const oddsCached = await this.exists(oddsKey);
        if (!oddsCached) {
          // This will be populated by the API routes when called
        }
      }
    } catch (error) {
      console.error('Preload error:', error);
    }
  }
}

// ── Esportazione ───────────────────────────────────────────────────────────────

export const sportBettingCache = new SportBettingCacheService();

// Funzioni helper per uso rapido
export const getCachedSportBettingData = async <T>(
  key: string, 
  type: 'live' | 'prematch' | 'events' | 'default' = 'default'
): Promise<T | null> => {
  return await sportBettingCache.get<T>(key, type);
};

export const setCachedSportBettingData = async <T>(
  key: string, 
  data: T, 
  type: 'live' | 'prematch' | 'events' | 'default' = 'default'
): Promise<void> => {
  await sportBettingCache.set(key, data, type);
};

export const getSportBettingWithFallback = async <T>(
  key: string,
  fetcher: () => Promise<T | null>,
  type: 'live' | 'prematch' | 'events' | 'default' = 'default'
): Promise<T | null> => {
  return await sportBettingCache.getWithFallback(key, fetcher, type);
};

export default sportBettingCache;
