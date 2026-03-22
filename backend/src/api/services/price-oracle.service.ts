import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { captureApiError } from '../../common/sentry.utils';

/**
 * Token Price Information
 */
export interface TokenPrice {
  mint: string;
  priceUSD: number;
  timestamp: number;
  source: 'jupiter' | 'birdeye' | 'cache';
}

/**
 * Price Oracle Service
 *
 * Fetches real-time token prices from multiple sources:
 * - Jupiter Price API (primary)
 * - Birdeye API (fallback)
 * - In-memory cache (performance optimization)
 *
 * Used to validate USD amounts claimed by frontend
 */
@Injectable()
export class PriceOracleService {
  private readonly logger = new Logger(PriceOracleService.name);

  // Price cache (5-minute TTL)
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // API endpoints
  private readonly COINGECKO_PRICE_API = 'https://api.coingecko.com/api/v3/simple/token_price/solana';
  private readonly JUPITER_PRICE_API = 'https://api.jup.ag/price/v3';
  private readonly BIRDEYE_PRICE_API = 'https://public-api.birdeye.so/defi/price';

  // Common token addresses
  private readonly SOL_MINT = 'So11111111111111111111111111111111111111112';
  private readonly USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  private readonly USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

  constructor(private readonly configService: ConfigService) {
    this.logger.log('Price Oracle Service initialized');
  }

  /**
   * Get token price in USD
   *
   * Priority:
   * 1. Check cache (if < 5 minutes old)
   * 2. CoinGecko API (most reliable, free)
   * 3. Jupiter Price API
   * 4. Birdeye API (fallback)
   *
   * @param tokenMint - Token mint address
   * @returns Price in USD or null if not found
   */
  async getTokenPriceUSD(tokenMint: string): Promise<number | null> {
    try {
      // Check cache first
      const cached = this.priceCache.get(tokenMint);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        this.logger.debug(`Cache hit for ${tokenMint.slice(0, 8)}... = $${cached.price}`);
        return cached.price;
      }

      // Try CoinGecko first (most reliable and free)
      let price = await this.fetchPriceFromCoinGecko(tokenMint);

      // Fallback to Jupiter if CoinGecko fails
      if (price === null) {
        this.logger.debug(`CoinGecko failed for ${tokenMint}, trying Jupiter...`);
        price = await this.fetchPriceFromJupiter(tokenMint);
      }

      // Fallback to Birdeye if both fail
      if (price === null) {
        this.logger.debug(`Jupiter failed for ${tokenMint}, trying Birdeye...`);
        price = await this.fetchPriceFromBirdeye(tokenMint);
      }

      // Cache the result
      if (price !== null) {
        this.priceCache.set(tokenMint, {
          price,
          timestamp: Date.now(),
        });
        this.logger.debug(`Fetched price for ${tokenMint.slice(0, 8)}... = $${price}`);
      } else {
        this.logger.warn(`Failed to fetch price for ${tokenMint} from all sources`);
      }

      return price;
    } catch (error) {
      this.logger.error(`Error fetching price for ${tokenMint}: ${error.message}`);
      captureApiError(error, 'Price Oracle', 'getTokenPriceUSD', { tokenMint });
      return null;
    }
  }

  /**
   * Calculate USD value from token amount
   *
   * @param tokenMint - Token mint address
   * @param tokenAmount - Token amount in smallest unit (e.g., lamports)
   * @param decimals - Token decimals
   * @returns USD value or null if price not available
   */
  async calculateUSDValue(
    tokenMint: string,
    tokenAmount: string,
    decimals: number,
  ): Promise<number | null> {
    try {
      const price = await this.getTokenPriceUSD(tokenMint);
      if (price === null) {
        return null;
      }

      // Convert from smallest unit to human-readable amount
      const amount = Number(tokenAmount) / Math.pow(10, decimals);

      // Calculate USD value
      const usdValue = amount * price;

      this.logger.debug(
        `Calculated USD: ${amount.toFixed(6)} tokens * $${price} = $${usdValue.toFixed(2)}`
      );

      return usdValue;
    } catch (error) {
      this.logger.error(`Error calculating USD value: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch price from CoinGecko API
   *
   * @param tokenMint - Token mint address
   * @returns Price in USD or null
   */
  private async fetchPriceFromCoinGecko(tokenMint: string): Promise<number | null> {
    try {
      const url = `${this.COINGECKO_PRICE_API}?contract_addresses=${tokenMint}&vs_currencies=usd`;

      // Optional API key for higher rate limits (not required for free tier)
      const coingeckoApiKey = this.configService.get<string>('COINGECKO_API_KEY');
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };

      // Add API key if configured (for Demo/Pro plans)
      if (coingeckoApiKey) {
        headers['x-cg-demo-api-key'] = coingeckoApiKey; // or 'x-cg-pro-api-key' for Pro
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // CoinGecko returns: { [mint]: { usd: number } }
      // Try both original case and lowercase
      const tokenData = data[tokenMint] || data[tokenMint.toLowerCase()];

      if (!tokenData || !tokenData.usd) {
        return null;
      }

      return tokenData.usd;
    } catch (error) {
      this.logger.debug(`CoinGecko API error for ${tokenMint}: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch price from Jupiter Price API
   *
   * @param tokenMint - Token mint address
   * @returns Price in USD or null
   */
  private async fetchPriceFromJupiter(tokenMint: string): Promise<number | null> {
    try {
      const url = `${this.JUPITER_PRICE_API}?ids=${tokenMint}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Jupiter returns: { data: { [mint]: { id, mintSymbol, vsToken, vsTokenSymbol, price } } }
      const tokenData = data.data?.[tokenMint];

      if (!tokenData || !tokenData.price) {
        return null;
      }

      return tokenData.price;
    } catch (error) {
      this.logger.debug(`Jupiter API error for ${tokenMint}: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch price from Birdeye API
   *
   * @param tokenMint - Token mint address
   * @returns Price in USD or null
   */
  private async fetchPriceFromBirdeye(tokenMint: string): Promise<number | null> {
    try {
      const birdeyeApiKey = this.configService.get<string>('BIRDEYE_API_KEY');

      if (!birdeyeApiKey) {
        this.logger.debug('Birdeye API key not configured');
        return null;
      }

      const url = `${this.BIRDEYE_PRICE_API}?address=${tokenMint}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': birdeyeApiKey,
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Birdeye returns: { data: { value: number } }
      if (!data.data || !data.data.value) {
        return null;
      }

      return data.data.value;
    } catch (error) {
      this.logger.debug(`Birdeye API error for ${tokenMint}: ${error.message}`);
      return null;
    }
  }

  /**
   * Warm up cache with common token prices
   * Call this on service initialization
   */
  async warmUpCache(): Promise<void> {
    this.logger.log('Warming up price cache...');

    const commonTokens = [this.SOL_MINT, this.USDC_MINT, this.USDT_MINT];

    for (const mint of commonTokens) {
      await this.getTokenPriceUSD(mint);
    }

    this.logger.log(`Cache warmed up with ${this.priceCache.size} tokens`);
  }

  /**
   * Clear price cache
   * Useful for testing or manual refresh
   */
  clearCache(): void {
    this.priceCache.clear();
    this.logger.log('Price cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: Array<{ mint: string; price: number; age: number }> } {
    const entries = Array.from(this.priceCache.entries()).map(([mint, data]) => ({
      mint,
      price: data.price,
      age: Date.now() - data.timestamp,
    }));

    return {
      size: this.priceCache.size,
      entries,
    };
  }
}
