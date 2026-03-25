import { feeConfigService } from './feeConfigService';
import * as Sentry from '@sentry/react';
import { isTransientNetworkError } from '../../lib/utils/retry';

const DEFAULT_PLATFORM_WALLET = 'ksw2N41N4a2UXGCxj3hhZczdaC5P5wPBNCC35kutD28';
const DEFAULT_CHARITY_WALLET = 'kNSBmzPU33zmNAbJeKp986iqDii8aa4mnJnAZkZ1TED';

/**
 * FeeWalletService - Singleton service for fetching fee wallet addresses
 *
 * Provides dynamic platform and charity wallet addresses from backend API
 * with fallback to default values if API fails.
 */
export class FeeWalletService {
  private static instance: FeeWalletService;
  private cachedPlatformWallet: string | null = null;
  private cachedCharityWallet: string | null = null;

  private constructor() {}

  static getInstance(): FeeWalletService {
    if (!FeeWalletService.instance) {
      FeeWalletService.instance = new FeeWalletService();
    }
    return FeeWalletService.instance;
  }

  /**
   * Get platform wallet address
   * Returns cached value if available, otherwise fetches from API
   */
  async getPlatformWallet(): Promise<string> {
    if (this.cachedPlatformWallet) {
      return this.cachedPlatformWallet;
    }

    try {
      const config = await feeConfigService.getFeeConfig();
      const wallet = config?.platformWallet || DEFAULT_PLATFORM_WALLET;
      this.cachedPlatformWallet = wallet;
      return wallet;
    } catch (error) {
      console.error('Failed to load platform wallet:', error);

      if (error instanceof Error && !isTransientNetworkError(error)) {
        Sentry.captureException(error, {
          tags: { feature: 'fee-wallets', action: 'get-platform-wallet' },
          level: 'error',
        });
      }

      return DEFAULT_PLATFORM_WALLET;
    }
  }

  /**
   * Get charity wallet address
   * Returns cached value if available, otherwise fetches from API
   */
  async getCharityWallet(): Promise<string> {
    if (this.cachedCharityWallet) {
      return this.cachedCharityWallet;
    }

    try {
      const config = await feeConfigService.getFeeConfig();
      const wallet = config?.charityWallet || DEFAULT_CHARITY_WALLET;
      this.cachedCharityWallet = wallet;
      return wallet;
    } catch (error) {
      console.error('Failed to load charity wallet:', error);

      if (error instanceof Error && !isTransientNetworkError(error)) {
        Sentry.captureException(error, {
          tags: { feature: 'fee-wallets', action: 'get-charity-wallet' },
          level: 'error',
        });
      }

      return DEFAULT_CHARITY_WALLET;
    }
  }

  /**
   * Clear cache (useful after admin updates wallet addresses)
   */
  clearCache(): void {
    this.cachedPlatformWallet = null;
    this.cachedCharityWallet = null;
    // Also clear the fee config cache to force refetch
    feeConfigService.clearCache();
  }
}

// Export singleton instance
export const feeWalletService = FeeWalletService.getInstance();
