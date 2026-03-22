import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { captureApiError } from '../../common/sentry.utils';

/**
 * Response type for Solscan token transfer API
 */
export interface SolscanTokenTransfer {
  blockTime: number; // Unix timestamp
  slot: number;
  txHash: string;
  src: string; // Source wallet
  dst: string; // Destination wallet
  amount: string; // Raw amount (needs decimal adjustment)
  decimals: number;
  address: string; // Token mint address
  changeType: string; // 'inc' for incoming, 'dec' for outgoing
  fee: number;
  symbol?: string;
}

export interface SolscanTokenTransfersResponse {
  success: boolean;
  data: SolscanTokenTransfer[];
  total?: number;
}

/**
 * SolscanService
 * Fetches token transfer history from Solscan public API
 * Used to calculate time-weighted average balance for KNS holding points
 */
@Injectable()
export class SolscanService {
  private readonly logger = new Logger(SolscanService.name);
  private readonly apiKey: string;

  // Solscan API endpoints - uses pro-api with API key or public API without key
  private readonly BASE_URL: string;

  // Rate limiting: Solscan Pro API with key allows higher limits
  // We cache results and batch requests to stay well under limit
  private readonly REQUEST_DELAY_MS = 500; // 500ms between requests
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY_MS = 1000; // 1 second initial delay

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('SOLSCAN_API_KEY', '');

    // Use Pro API if key is available, otherwise fall back to public API
    if (this.apiKey) {
      this.BASE_URL = 'https://pro-api.solscan.io';
      this.logger.log('Using Solscan Pro API with authentication');
    } else {
      this.BASE_URL = 'https://api.solscan.io';
      this.logger.warn(
        'SOLSCAN_API_KEY not configured - using public API (may be rate limited or blocked)',
      );
    }
  }

  /**
   * Get token transfers for a wallet
   * @param wallet - Wallet address
   * @param tokenMint - Token mint address (KNS token)
   * @param limit - Max transfers to fetch (default 50, max 50 per request)
   * @param offset - Pagination offset
   */
  async getTokenTransfers(
    wallet: string,
    tokenMint: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<SolscanTokenTransfer[]> {
    return this.retryWithBackoff(async () => {
      try {
        // Solscan API endpoint for SPL token transfers
        // Pro API uses /v1.0/ prefix, public API uses root
        const endpoint = this.apiKey ? 'v1.0/account/token/txs' : 'account/token/txs';
        const url = new URL(`${this.BASE_URL}/${endpoint}`);
        url.searchParams.set('address', wallet);
        url.searchParams.set('token', tokenMint);
        url.searchParams.set('offset', offset.toString());
        url.searchParams.set('limit', Math.min(limit, 50).toString());

        this.logger.debug(`Fetching token transfers for ${wallet}, token ${tokenMint}`);

        const headers: Record<string, string> = {
          Accept: 'application/json',
          'User-Agent': 'KindSoul-Backend/1.0',
        };

        // Add API key to headers if available
        if (this.apiKey) {
          headers['token'] = this.apiKey;
        }

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          if (response.status === 429) {
            this.logger.warn('Solscan rate limit hit, backing off');
            throw new Error('RATE_LIMITED');
          }
          if (response.status === 403) {
            this.logger.warn(
              `Solscan API access forbidden (403) - ${this.apiKey ? 'API key may be invalid' : 'API key not configured'}`,
            );
            throw new Error('ACCESS_FORBIDDEN');
          }
          // 404 means no transfer history found - this is expected for wallets that never held the token
          if (response.status === 404) {
            this.logger.debug(
              `No token transfer history found for wallet ${wallet} (404 - expected for new wallets)`,
            );
            return [];
          }
          throw new Error(`Solscan API error: ${response.status} ${response.statusText}`);
        }

        const data: SolscanTokenTransfersResponse = await response.json();

        if (!data.success || !Array.isArray(data.data)) {
          this.logger.warn(`Unexpected Solscan response format for wallet ${wallet}`);
          return [];
        }

        return data.data;
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message === 'RATE_LIMITED' || error.message === 'ACCESS_FORBIDDEN')
        ) {
          throw error;
        }
        this.logger.error(`Failed to fetch token transfers for ${wallet}: ${error}`);
        captureApiError(error, 'Solscan', '/account/token/txs', {
          wallet,
          tokenMint,
          limit,
          offset,
        });
        return [];
      }
    });
  }

  /**
   * Get all token transfers for the last N days
   * Handles pagination to fetch complete history
   * @param wallet - Wallet address
   * @param tokenMint - Token mint address
   * @param daysBack - Number of days of history to fetch (default 1)
   */
  async getTokenTransfersSinceDays(
    wallet: string,
    tokenMint: string,
    daysBack: number = 1,
  ): Promise<SolscanTokenTransfer[]> {
    const cutoffTime = Math.floor(Date.now() / 1000) - daysBack * 24 * 60 * 60;
    const allTransfers: SolscanTokenTransfer[] = [];
    let offset = 0;
    const pageSize = 50;
    let hasMore = true;

    while (hasMore) {
      const transfers = await this.getTokenTransfers(wallet, tokenMint, pageSize, offset);

      if (transfers.length === 0) {
        hasMore = false;
        break;
      }

      // Filter transfers within our time window
      for (const tx of transfers) {
        if (tx.blockTime >= cutoffTime) {
          allTransfers.push(tx);
        } else {
          // Transfers are sorted by time descending, so we can stop
          hasMore = false;
          break;
        }
      }

      // If we got a full page and haven't hit the cutoff, fetch more
      if (hasMore && transfers.length === pageSize) {
        offset += pageSize;
        // Rate limit protection
        await this.delay(this.REQUEST_DELAY_MS);
      } else {
        hasMore = false;
      }
    }

    return allTransfers;
  }

  /**
   * Get current token balance from Solscan
   * @param wallet - Wallet address
   * @param tokenMint - Token mint address
   */
  async getTokenBalance(wallet: string, tokenMint: string): Promise<string | null> {
    return this.retryWithBackoff(async () => {
      try {
        // Pro API uses /v1.0/ prefix, public API uses root
        const endpoint = this.apiKey ? 'v1.0/account/tokens' : 'account/tokens';
        const url = new URL(`${this.BASE_URL}/${endpoint}`);
        url.searchParams.set('address', wallet);

        const headers: Record<string, string> = {
          Accept: 'application/json',
          'User-Agent': 'KindSoul-Backend/1.0',
        };

        // Add API key to headers if available
        if (this.apiKey) {
          headers['token'] = this.apiKey;
        }

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          if (response.status === 429) {
            this.logger.warn('Solscan rate limit hit on balance check');
            throw new Error('RATE_LIMITED');
          }
          if (response.status === 403) {
            this.logger.warn(
              `Solscan API access forbidden (403) on balance check - ${this.apiKey ? 'API key may be invalid' : 'API key not configured'}`,
            );
            throw new Error('ACCESS_FORBIDDEN');
          }
          // 404 means wallet not found or has no token accounts - return null (treated as 0 balance)
          if (response.status === 404) {
            this.logger.debug(
              `No token accounts found for wallet ${wallet} (404 - expected for new wallets)`,
            );
            return null;
          }
          throw new Error(`Solscan API error: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          return null;
        }

        // Find the token in the response
        const token = data.find(
          (t: { tokenAddress: string; amount: string }) => t.tokenAddress === tokenMint,
        );

        return token?.amount || '0';
      } catch (error) {
        this.logger.error(`Failed to fetch token balance for ${wallet}: ${error}`);
        captureApiError(error, 'Solscan', '/account/tokens', { wallet, tokenMint });
        return null;
      }
    });
  }

  /**
   * Retry logic with exponential backoff for rate limits and access errors
   * @param fn - Function to retry
   * @param retries - Number of retries remaining (default: MAX_RETRIES)
   * @param delayMs - Current delay in milliseconds
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number = this.MAX_RETRIES,
    delayMs: number = this.INITIAL_RETRY_DELAY_MS,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'RATE_LIMITED' || error.message === 'ACCESS_FORBIDDEN') &&
        retries > 0
      ) {
        this.logger.warn(
          `${error.message} - Retrying in ${delayMs}ms (${retries} retries left)`,
        );
        await this.delay(delayMs);
        // Exponential backoff: double the delay for next retry
        return this.retryWithBackoff(fn, retries - 1, delayMs * 2);
      }
      throw error;
    }
  }

  /**
   * Utility: Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
