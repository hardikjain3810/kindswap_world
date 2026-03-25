/**
 * CoinGecko API Service with API Key Rotation
 *
 * Features:
 * - Multiple API key support with automatic rotation on rate limits
 * - Exponential backoff retry mechanism
 * - 429 (Too Many Requests) error handling
 * - Request caching to reduce API calls
 */

import * as Sentry from '@sentry/react';
import { isTransientNetworkError } from '@/lib/utils/retry';

interface CoinGeckoConfig {
  apiKeys: string[];
  maxRetries?: number;
  initialRetryDelayMs?: number;
  maxRetryDelayMs?: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class CoinGeckoService {
  private apiKeys: string[];
  private currentKeyIndex: number = 0;
  private maxRetries: number;
  private initialRetryDelayMs: number;
  private maxRetryDelayMs: number;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private keyFailureCount: Map<number, number> = new Map();
  private keyLastFailureTime: Map<number, number> = new Map();
  private readonly KEY_COOLDOWN_MS = 60000; // 1 minute cooldown for failed keys

  constructor(config: CoinGeckoConfig) {
    if (!config.apiKeys || config.apiKeys.length === 0) {
      throw new Error('CoinGeckoService requires at least one API key');
    }

    this.apiKeys = config.apiKeys;
    this.maxRetries = config.maxRetries ?? 3;
    this.initialRetryDelayMs = config.initialRetryDelayMs ?? 1000;
    this.maxRetryDelayMs = config.maxRetryDelayMs ?? 10000;

    // Initialize failure tracking for each key
    this.apiKeys.forEach((_, index) => {
      this.keyFailureCount.set(index, 0);
      this.keyLastFailureTime.set(index, 0);
    });
  }

  /**
   * Gets the current API key to use
   */
  private getCurrentApiKey(): string {
    return this.apiKeys[this.currentKeyIndex];
  }

  /**
   * Rotates to the next API key
   */
  private rotateApiKey(): boolean {
    const startIndex = this.currentKeyIndex;
    const now = Date.now();

    // Try to find a key that's not in cooldown
    do {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;

      const lastFailure = this.keyLastFailureTime.get(this.currentKeyIndex) || 0;
      const isInCooldown = now - lastFailure < this.KEY_COOLDOWN_MS;

      if (!isInCooldown) {
        console.log(`[CoinGecko] Rotated to API key #${this.currentKeyIndex + 1}`);
        return true;
      }
    } while (this.currentKeyIndex !== startIndex);

    // All keys are in cooldown
    console.warn('[CoinGecko] All API keys are in cooldown, using current key anyway');
    return false;
  }

  /**
   * Marks the current API key as failed
   */
  private markKeyAsFailed(): void {
    const count = (this.keyFailureCount.get(this.currentKeyIndex) || 0) + 1;
    this.keyFailureCount.set(this.currentKeyIndex, count);
    this.keyLastFailureTime.set(this.currentKeyIndex, Date.now());

    console.warn(`[CoinGecko] API key #${this.currentKeyIndex + 1} failed (total failures: ${count})`);

    Sentry.captureMessage(`CoinGecko API key #${this.currentKeyIndex + 1} rate limited`, {
      level: 'warning',
      tags: {
        feature: 'coingecko-api',
        keyIndex: this.currentKeyIndex.toString(),
      },
    });
  }

  /**
   * Resets failure count for the current key (on successful request)
   */
  private resetKeyFailureCount(): void {
    this.keyFailureCount.set(this.currentKeyIndex, 0);
  }

  /**
   * Calculates retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = Math.min(
      this.initialRetryDelayMs * Math.pow(2, attempt),
      this.maxRetryDelayMs
    );
    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    return Math.floor(delay + jitter);
  }

  /**
   * Sleeps for the specified duration
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets cached data if available and not expired
   */
  private getCachedData<T>(cacheKey: string, maxAgeMs: number): T | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > maxAgeMs) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Caches data
   */
  private setCachedData<T>(cacheKey: string, data: T): void {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Makes a fetch request with retry logic and API key rotation
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retryOn429: boolean = true
  ): Promise<Response> {
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      const apiKey = this.getCurrentApiKey();
      const headers = {
        'Accept': 'application/json',
        'x-cg-pro-api-key': apiKey,
        ...options.headers,
      };

      try {
        const response = await fetch(url, { ...options, headers });

        // Check for rate limit error
        if (response.status === 429) {
          console.warn(`[CoinGecko] Rate limit (429) hit on attempt ${attempt + 1}`);

          this.markKeyAsFailed();

          // Try rotating to another key if available
          if (this.apiKeys.length > 1 && retryOn429) {
            this.rotateApiKey();

            // Don't count this as a retry attempt if we have another key to try
            if (attempt === 0) {
              continue;
            }
          }

          if (attempt < this.maxRetries) {
            const delay = this.calculateRetryDelay(attempt);
            console.log(`[CoinGecko] Retrying in ${delay}ms...`);
            await this.sleep(delay);
            attempt++;
            continue;
          }

          throw new Error(`Rate limit exceeded (429) after ${this.maxRetries} retries`);
        }

        // Success - reset failure count
        if (response.ok) {
          this.resetKeyFailureCount();
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[CoinGecko] Request failed on attempt ${attempt + 1}:`, lastError);

        if (attempt < this.maxRetries) {
          const delay = this.calculateRetryDelay(attempt);
          console.log(`[CoinGecko] Retrying in ${delay}ms...`);
          await this.sleep(delay);
          attempt++;
        } else {
          break;
        }
      }
    }

    // All retries exhausted
    // Only log non-transient errors to Sentry (handled by retry logic)
    if (lastError && !isTransientNetworkError(lastError)) {
      Sentry.captureException(lastError, {
        tags: {
          feature: 'coingecko-api',
          action: 'fetch-with-retry',
          url,
        },
        level: 'error',
      });
    }

    throw lastError || new Error('Request failed after all retries');
  }

  /**
   * Fetches simple price data for tokens
   */
  async getSimplePrice(
    ids: string | string[],
    vsCurrencies: string | string[] = 'usd',
    include24hrChange: boolean = false,
    cacheMs: number = 60000
  ): Promise<any> {
    const idsStr = Array.isArray(ids) ? ids.join(',') : ids;
    const vsStr = Array.isArray(vsCurrencies) ? vsCurrencies.join(',') : vsCurrencies;
    const changeParam = include24hrChange ? '&include_24hr_change=true' : '';

    const url = `https://pro-api.coingecko.com/api/v3/simple/price?ids=${idsStr}&vs_currencies=${vsStr}${changeParam}`;
    const cacheKey = `simple_price_${idsStr}_${vsStr}_${include24hrChange}`;

    // Check cache first
    const cached = this.getCachedData(cacheKey, cacheMs);
    if (cached) {
      console.log('[CoinGecko] Returning cached price data');
      return cached;
    }

    try {
      const response = await this.fetchWithRetry(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      console.error('[CoinGecko] getSimplePrice failed:', error);
      throw error;
    }
  }

  /**
   * Fetches token price by contract address
   */
  async getTokenPrice(
    platform: string,
    contractAddresses: string | string[],
    vsCurrencies: string | string[] = 'usd',
    include24hrChange: boolean = false,
    cacheMs: number = 60000
  ): Promise<any> {
    const addressesStr = Array.isArray(contractAddresses)
      ? contractAddresses.join(',')
      : contractAddresses;
    const vsStr = Array.isArray(vsCurrencies) ? vsCurrencies.join(',') : vsCurrencies;
    const changeParam = include24hrChange ? '&include_24hr_change=true' : '';

    const url = `https://pro-api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${addressesStr}&vs_currencies=${vsStr}${changeParam}`;
    const cacheKey = `token_price_${platform}_${addressesStr}_${vsStr}_${include24hrChange}`;

    // Check cache first
    const cached = this.getCachedData(cacheKey, cacheMs);
    if (cached) {
      console.log('[CoinGecko] Returning cached token price data');
      return cached;
    }

    try {
      const response = await this.fetchWithRetry(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      console.error('[CoinGecko] getTokenPrice failed:', error);
      throw error;
    }
  }

  /**
   * Gets statistics about API key usage
   */
  getKeyStats(): Array<{ keyIndex: number; failures: number; lastFailure: number }> {
    return this.apiKeys.map((_, index) => ({
      keyIndex: index,
      failures: this.keyFailureCount.get(index) || 0,
      lastFailure: this.keyLastFailureTime.get(index) || 0,
    }));
  }

  /**
   * Clears the cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[CoinGecko] Cache cleared');
  }
}

// Singleton instance
let coinGeckoServiceInstance: CoinGeckoService | null = null;

/**
 * Initializes the CoinGecko service with API keys
 */
export function initCoinGeckoService(apiKeys: string[]): CoinGeckoService {
  coinGeckoServiceInstance = new CoinGeckoService({
    apiKeys,
    maxRetries: 3,
    initialRetryDelayMs: 1000,
    maxRetryDelayMs: 10000,
  });
  return coinGeckoServiceInstance;
}

/**
 * Gets the CoinGecko service instance
 */
export function getCoinGeckoService(): CoinGeckoService {
  if (!coinGeckoServiceInstance) {
    throw new Error('CoinGeckoService not initialized. Call initCoinGeckoService first.');
  }
  return coinGeckoServiceInstance;
}

export default CoinGeckoService;
