/**
 * Exponential backoff utilities for API calls with jitter
 * Prevents thundering herd and handles rate limiting gracefully
 */

export interface BackoffOptions {
  maxRetries?: number;      // Default: 3
  baseDelay?: number;       // Default: 1000ms
  maxDelay?: number;        // Default: 30000ms (30s)
  jitter?: boolean;         // Default: true - adds randomness
  factor?: number;          // Default: 2 - exponential factor
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  options: BackoffOptions = {}
): number {
  const { baseDelay = 1000, maxDelay = 30000, jitter = true, factor = 2 } = options;
  
  // Calculate exponential delay: baseDelay * factor^attempt
  let delay = baseDelay * Math.pow(factor, attempt);
  
  // Cap at maxDelay
  delay = Math.min(delay, maxDelay);
  
  // Add jitter (±25%) to prevent thundering herd
  if (jitter) {
    const jitterAmount = delay * 0.25;
    delay = delay + (Math.random() * jitterAmount * 2 - jitterAmount);
  }
  
  return Math.floor(delay);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: BackoffOptions = {}
): Promise<T> {
  const { maxRetries = 3 } = options;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      // Don't retry on last attempt
      if (attempt >= maxRetries) {
        throw lastError;
      }
      
      // Check if it's a rate limit error (429)
      const isRateLimit = 
        lastError.message.includes('429') ||
        lastError.message.includes('rate limit') ||
        lastError.message.includes('Rate limit');
      
      // Calculate and apply backoff
      const delay = calculateBackoffDelay(attempt, {
        ...options,
        // Longer delays for rate limits
        baseDelay: isRateLimit ? 5000 : options.baseDelay,
      });
      
      console.log(`[backoff] Retry ${attempt + 1}/${maxRetries} after ${delay}ms (error: ${lastError.message.substring(0, 50)})`);
      await sleep(delay);
    }
  }
  
  throw lastError || new Error('Retry failed');
}

/**
 * Circuit breaker pattern - stops calling failing service temporarily
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private failureThreshold = 5,
    private resetTimeout = 60000, // 1 minute
    private halfOpenMaxCalls = 3
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
        this.failures = 0;
        console.log('[circuitBreaker] Transition to half-open');
      } else {
        throw new Error('Circuit breaker is OPEN - service temporarily unavailable');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }
  
  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.failures--;
      if (this.failures <= 0) {
        this.state = 'closed';
        console.log('[circuitBreaker] Transition to closed');
      }
    } else {
      this.failures = Math.max(0, this.failures - 1);
    }
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      console.log(`[circuitBreaker] Transition to OPEN after ${this.failures} failures`);
    }
  }
  
  getState(): string {
    return this.state;
  }
}

// Singleton circuit breakers for different services
const circuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker());
  }
  return circuitBreakers.get(name)!;
}
