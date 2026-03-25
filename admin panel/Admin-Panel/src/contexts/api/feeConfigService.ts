/**
 * FeeConfigService - Fetches fee configuration and tiers from backend API
 *
 * Fee Model:
 * - Base fee: 0.10% (10 bps) - constant
 * - Tiers provide discounts on the total fee
 * - Charity gets 25% of the total fee
 * - KindSwap gets 75% of the total fee
 */

import { API_BASE_URL, API_ENDPOINTS } from "../../config/api";
import * as Sentry from '@sentry/react';
import { fetchWithRetry, isTransientNetworkError } from '../../lib/utils/retry';

// Types matching the backend API schema
export interface FeeConfiguration {
  id: string;
  baseFeeBps: number;
  charityPortion: number;
  kindswapPortion: number;
  isActive: boolean;
  version: number;
  notes?: string;
  platformWallet: string;
  charityWallet: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeeTier {
  id: string;
  name: string;
  knsMin: string;
  discountPercent: number;
  effectiveFeeBps: number;
  tierOrder: number;
  isActive: boolean;
  version: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalculatedFee {
  knsBalance: string;
  applicableTier: {
    id: string;
    name: string;
    knsMin: string;
    discountPercent: number;
    effectiveFeeBps: number;
    tierOrder: number;
  };
  effectiveFeeBps: number;
  discountPercent: number;
  charityPortion: number;
  kindswapPortion: number;
}

/**
 * FeeConfigService - Singleton service for fee configuration
 */
export class FeeConfigService {
  private static instance: FeeConfigService;
  private baseUrl: string = API_BASE_URL;
  private cachedConfig: FeeConfiguration | null = null;
  private cachedTiers: FeeTier[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 30 * 1000; // 30 seconds cache for quicker admin updates

  private constructor() {
    // baseUrl is initialized from central config
  }

  static getInstance(): FeeConfigService {
    if (!FeeConfigService.instance) {
      FeeConfigService.instance = new FeeConfigService();
    }
    return FeeConfigService.instance;
  }

  /**
   * Check if API is configured
   */
  isEnabled(): boolean {
    return Boolean(this.baseUrl);
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.cacheTimestamp < this.CACHE_TTL_MS;
  }

  /**
   * Fetch fee configuration from API
   */
  async getFeeConfig(forceRefresh = false): Promise<FeeConfiguration | null> {
    if (!forceRefresh && this.cachedConfig && this.isCacheValid()) {
      return this.cachedConfig;
    }

    if (!this.isEnabled()) {
      console.debug('[FeeConfig] API not configured, using defaults');
      return null;
    }

    try {
      const response = await fetchWithRetry(
        `${this.baseUrl}${API_ENDPOINTS.FEE_CONFIG}`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        },
        {
          maxRetries: 2,
          initialDelay: 1000,
          onRetry: (attempt, error, delay) => {
            console.warn(`[FeeConfig] Retry attempt ${attempt} after ${delay}ms:`, error.message);
          },
        }
      );

      const data: FeeConfiguration = await response.json();
      this.cachedConfig = data;
      this.cacheTimestamp = Date.now();
      console.log('[FeeConfig] Loaded fee config:', data);
      return data;
    } catch (error) {
      console.warn('[FeeConfig] Failed to fetch config:', error);

      // Only log non-transient errors to Sentry
      if (error instanceof Error && !isTransientNetworkError(error)) {
        Sentry.captureException(error, {
          tags: { feature: 'fee-config', action: 'fetch-config' },
          level: 'error',
        });
      }
      return null;
    }
  }

  /**
   * Fetch all fee tiers from API
   */
  async getFeeTiers(forceRefresh = false): Promise<FeeTier[]> {
    if (!forceRefresh && this.cachedTiers && this.isCacheValid()) {
      return this.cachedTiers;
    }

    if (!this.isEnabled()) {
      console.debug('[FeeConfig] API not configured, using defaults');
      return [];
    }

    try {
      const response = await fetchWithRetry(
        `${this.baseUrl}${API_ENDPOINTS.FEE_TIERS}`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        },
        {
          maxRetries: 2,
          initialDelay: 1000,
          onRetry: (attempt, error, delay) => {
            console.warn(`[FeeConfig] Retry attempt ${attempt} after ${delay}ms:`, error.message);
          },
        }
      );

      const data: FeeTier[] = await response.json();
      this.cachedTiers = data;
      this.cacheTimestamp = Date.now();
      console.log('[FeeConfig] Loaded fee tiers:', data);
      return data;
    } catch (error) {
      console.warn('[FeeConfig] Failed to fetch tiers:', error);

      // Only log non-transient errors to Sentry
      if (error instanceof Error && !isTransientNetworkError(error)) {
        Sentry.captureException(error, {
          tags: { feature: 'fee-config', action: 'fetch-tiers' },
          level: 'error',
        });
      }
      return [];
    }
  }

  /**
   * Calculate fee for a specific KNS balance
   */
  async calculateFee(knsBalance: number): Promise<CalculatedFee | null> {
    if (!this.isEnabled()) {
      console.debug('[FeeConfig] API not configured');
      return null;
    }

    try {
      const response = await fetchWithRetry(
        `${this.baseUrl}${API_ENDPOINTS.CALCULATE_FEE}?knsBalance=${Math.floor(knsBalance)}`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        },
        {
          maxRetries: 2,
          initialDelay: 1000,
        }
      );

      const data: CalculatedFee = await response.json();
      return data;
    } catch (error) {
      console.warn('[FeeConfig] Failed to calculate fee:', error);

      // Only log non-transient errors to Sentry
      if (error instanceof Error && !isTransientNetworkError(error)) {
        Sentry.captureException(error, {
          tags: { feature: 'fee-config', action: 'calculate-fee' },
          level: 'error',
          extra: { knsBalance },
        });
      }
      return null;
    }
  }

  /**
   * Get both config and tiers in parallel
   */
  async getAll(forceRefresh = false): Promise<{
    config: FeeConfiguration | null;
    tiers: FeeTier[];
  }> {
    const [config, tiers] = await Promise.all([
      this.getFeeConfig(forceRefresh),
      this.getFeeTiers(forceRefresh),
    ]);
    return { config, tiers };
  }

  /**
   * Clear cache (useful for testing or after config updates)
   */
  clearCache(): void {
    this.cachedConfig = null;
    this.cachedTiers = null;
    this.cacheTimestamp = 0;
  }
}

// Export singleton instance
export const feeConfigService = FeeConfigService.getInstance();

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get current tier based on KNS balance from a list of tiers
 */
export function getCurrentTierFromList(knsBalance: number, tiers: FeeTier[]): FeeTier | null {
  if (!tiers.length) return null;

  // Sort by tierOrder descending to find highest qualifying tier
  const sortedTiers = [...tiers].sort((a, b) => b.tierOrder - a.tierOrder);

  for (const tier of sortedTiers) {
    if (knsBalance >= parseInt(tier.knsMin)) {
      return tier;
    }
  }

  // Return lowest tier (No Tier) if no match
  return tiers.find(t => t.tierOrder === 0) || tiers[0];
}

/**
 * Get next tier after current tier
 */
export function getNextTierFromList(currentTier: FeeTier, tiers: FeeTier[]): FeeTier | null {
  const nextTierOrder = currentTier.tierOrder + 1;
  return tiers.find(t => t.tierOrder === nextTierOrder) || null;
}

/**
 * Calculate tier progress percentage
 */
export function calculateTierProgressFromList(
  knsBalance: number,
  currentTier: FeeTier,
  nextTier: FeeTier | null
): number {
  if (!nextTier) return 100; // Already at max tier

  const currentMin = parseInt(currentTier.knsMin);
  const nextMin = parseInt(nextTier.knsMin);
  const range = nextMin - currentMin;
  const progress = knsBalance - currentMin;

  return Math.min(100, Math.max(0, (progress / range) * 100));
}

/**
 * Format KNS balance for display
 */
export function formatKnsBalance(knsMin: string | number): string {
  const num = typeof knsMin === 'string' ? parseInt(knsMin) : knsMin;
  if (num === 0) return '< 5,000';
  if (num >= 1000000) return `≥ ${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `≥ ${(num / 1000).toFixed(0)}K`;
  return `≥ ${num.toLocaleString()}`;
}

/**
 * Calculate fee amounts for a swap
 */
export function calculateFeeAmounts(
  inputAmountUSD: number,
  effectiveFeeBps: number,
  charityPortion: number,
  kindswapPortion: number
): {
  totalFeeUSD: number;
  charityUSD: number;
  kindswapUSD: number;
  effectiveFeePercent: number;
} {
  const effectiveFeePercent = effectiveFeeBps / 100; // Convert bps to percent
  const totalFeeUSD = inputAmountUSD * (effectiveFeePercent / 100);
  const charityUSD = totalFeeUSD * charityPortion;
  const kindswapUSD = totalFeeUSD * kindswapPortion;

  return {
    totalFeeUSD,
    charityUSD,
    kindswapUSD,
    effectiveFeePercent,
  };
}

// Default values if API is not available
export const DEFAULT_FEE_CONFIG = {
  baseFeeBps: 10,
  charityPortion: 0.25,
  kindswapPortion: 0.75,
};

export const DEFAULT_TIERS = [
  { name: 'No Tier', knsMin: '0', discountPercent: 0, effectiveFeeBps: 10, tierOrder: 0 },
  { name: 'Tier 1', knsMin: '5000', discountPercent: 5, effectiveFeeBps: 9.5, tierOrder: 1 },
  { name: 'Tier 2', knsMin: '25000', discountPercent: 10, effectiveFeeBps: 9.0, tierOrder: 2 },
  { name: 'Tier 3', knsMin: '100000', discountPercent: 15, effectiveFeeBps: 8.5, tierOrder: 3 },
  { name: 'Tier 4', knsMin: '500000', discountPercent: 20, effectiveFeeBps: 8.0, tierOrder: 4 },
];
