import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { FeeConfigurationRepository } from '../../database/repositories/fee-configuration.repository';
import { FeeTierRepository } from '../../database/repositories/fee-tier.repository';
import { FeeConfiguration } from '../../database/entities/fee-configuration.entity';
import { FeeTier } from '../../database/entities/fee-tier.entity';

/**
 * Validate Solana wallet address
 * Checks length and base58 alphabet
 */
function isValidSolanaAddress(address: string): boolean {
  const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  // Check length (Solana addresses are 32-44 characters)
  if (address.length < 32 || address.length > 44) {
    return false;
  }

  // Check if all characters are valid base58
  for (const char of address) {
    if (!base58Alphabet.includes(char)) {
      return false;
    }
  }

  return true;
}

/**
 * ConfigService
 * Manages fee configuration and tier data
 * Implements two-layer caching: Redis + memory
 *
 * Caching Strategy:
 * - Redis TTL: 3600 seconds (1 hour)
 * - Cache keys: 'fee_configuration', 'fee_tiers'
 * - Invalidated on admin updates
 * - Gracefully falls back to DB on cache miss
 */
@Injectable()
export class ConfigService {
  // Cache keys
  private readonly FEE_CONFIG_CACHE_KEY = 'fee_configuration';
  private readonly FEE_TIERS_CACHE_KEY = 'fee_tiers';
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly feeConfigRepo: FeeConfigurationRepository,
    private readonly feeTierRepo: FeeTierRepository,
  ) {
    // Validate and sync tiers on startup
    this.validateAndSyncTiers();
  }

  /**
   * Validate that all tier fees are in sync with base fee
   * Auto-corrects any inconsistencies on startup
   */
  private async validateAndSyncTiers(): Promise<void> {
    try {
      const config = await this.feeConfigRepo.getActiveConfiguration();
      if (!config) return;

      const tiers = await this.feeTierRepo.getAllActiveTiers();
      if (!tiers.length) return;

      const baseFeeBps = Number(config.baseFeeBps);
      let inconsistenciesFound = false;

      for (const tier of tiers) {
        const expectedEffectiveFee = baseFeeBps * (1 - tier.discountPercent / 100);
        const currentEffectiveFee = Number(tier.effectiveFeeBps);
        const difference = Math.abs(expectedEffectiveFee - currentEffectiveFee);

        // Allow 0.01 bps tolerance for rounding
        if (difference > 0.01) {
          inconsistenciesFound = true;
          console.warn(
            `[ConfigService] Tier ${tier.name} out of sync: ` +
            `expected ${expectedEffectiveFee.toFixed(2)} bps, got ${currentEffectiveFee} bps`
          );
        }
      }

      if (inconsistenciesFound) {
        console.log('[ConfigService] Syncing tier fees with base fee...');
        await this.recalculateTierFees(baseFeeBps, 'system');
        console.log('[ConfigService] ✅ Tier fees synced successfully');
      } else {
        console.log('[ConfigService] ✅ All tier fees are in sync with base fee');
      }
    } catch (error) {
      console.error('[ConfigService] Failed to validate tier sync:', error);
      // Don't throw - allow service to start even if validation fails
    }
  }

  /**
   * Default fee configuration used when no config exists in DB
   * This ensures the API always returns valid data for frontend
   *
   * 4-WAY FEE DISTRIBUTION:
   * - Charity: 25% (community impact)
   * - Platform: 50% (operations)
   * - Rebate: 15% (user rewards)
   * - Staking: 10% (staking pool)
   */
  private readonly DEFAULT_FEE_CONFIG: Partial<FeeConfiguration> = {
    baseFeeBps: 10, // 0.10% base fee
    charityPortion: 0.25, // 25% goes to charity
    kindswapPortion: 0.50, // 50% goes to KindSwap platform
    rebatePortion: 0.15, // 15% goes to user rebates
    stakingPortion: 0.10, // 10% goes to staking rewards
    platformWallet: 'ksw2N41N4a2UXGCxj3hhZczdaC5P5wPBNCC35kutD28',
    charityWallet: 'kNSBmzPU33zmNAbJeKp986iqDii8aa4mnJnAZkZ1TED',
    rebateWallet: null,
    stakingWallet: null,
    isActive: true,
    version: 1,
  };

  /**
   * PUBLIC: Get current fee configuration
   * Returns cached version if available, otherwise fetches from DB
   * Falls back to default configuration if none exists
   */
  async getFeeConfiguration(): Promise<FeeConfiguration> {
    const cached = await this.cacheManager.get<FeeConfiguration>(this.FEE_CONFIG_CACHE_KEY);

    if (cached) {
      return cached;
    }

    try {
      const config = await this.feeConfigRepo.getActiveConfiguration();
      await this.cacheManager.set(this.FEE_CONFIG_CACHE_KEY, config, this.CACHE_TTL);
      return config;
    } catch (error) {
      // If no configuration exists, return default values
      // This allows the frontend to function while admin sets up config
      console.warn('[ConfigService] No fee configuration found in DB, using defaults');
      const defaultConfig = {
        ...this.DEFAULT_FEE_CONFIG,
        id: 'default',
        updatedAt: new Date(),
        createdAt: new Date(),
      } as FeeConfiguration;

      // Cache the default so we don't log repeatedly
      await this.cacheManager.set(this.FEE_CONFIG_CACHE_KEY, defaultConfig, this.CACHE_TTL);
      return defaultConfig;
    }
  }

  /**
   * Default fee tiers used when no tiers exist in DB
   */
  private readonly DEFAULT_FEE_TIERS: Partial<FeeTier>[] = [
    { name: 'No Tier', knsMin: '0', discountPercent: 0, effectiveFeeBps: 10, tierOrder: 0 },
    { name: 'Bronze', knsMin: '10000', discountPercent: 5, effectiveFeeBps: 9.5, tierOrder: 1 },
    { name: 'Silver', knsMin: '50000', discountPercent: 10, effectiveFeeBps: 9, tierOrder: 2 },
    { name: 'Gold', knsMin: '100000', discountPercent: 15, effectiveFeeBps: 8.5, tierOrder: 3 },
    { name: 'Diamond', knsMin: '250000', discountPercent: 20, effectiveFeeBps: 8, tierOrder: 4 },
  ];

  /**
   * PUBLIC: Get all active fee tiers
   * Returns cached version if available, otherwise fetches from DB
   * Falls back to default tiers if none exist
   */
  async getFeeTiers(): Promise<FeeTier[]> {
    const cached = await this.cacheManager.get<FeeTier[]>(this.FEE_TIERS_CACHE_KEY);

    if (cached) {
      return cached;
    }

    try {
      const tiers = await this.feeTierRepo.getAllActiveTiers();

      // If no tiers in DB, return defaults
      if (!tiers || tiers.length === 0) {
        console.warn('[ConfigService] No fee tiers found in DB, using defaults');
        const defaultTiers = this.DEFAULT_FEE_TIERS.map((tier, index) => ({
          ...tier,
          id: `default-tier-${index}`,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })) as FeeTier[];

        await this.cacheManager.set(this.FEE_TIERS_CACHE_KEY, defaultTiers, this.CACHE_TTL);
        return defaultTiers;
      }

      await this.cacheManager.set(this.FEE_TIERS_CACHE_KEY, tiers, this.CACHE_TTL);
      return tiers;
    } catch (error) {
      console.warn('[ConfigService] Error fetching fee tiers, using defaults:', error);
      const defaultTiers = this.DEFAULT_FEE_TIERS.map((tier, index) => ({
        ...tier,
        id: `default-tier-${index}`,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })) as FeeTier[];

      await this.cacheManager.set(this.FEE_TIERS_CACHE_KEY, defaultTiers, this.CACHE_TTL);
      return defaultTiers;
    }
  }

  /**
   * PUBLIC: Calculate fee tier for given KNS balance
   * Returns the applicable tier and its discount/fee information
   */
  async calculateFeeForBalance(
    knsBalance: number,
  ): Promise<{
    tier: FeeTier;
    effectiveFeeBps: number;
    discountPercent: number;
    charityPortion: number;
  }> {
    const tiers = await this.getFeeTiers();
    const config = await this.getFeeConfiguration();

    // Find applicable tier
    let applicableTier = tiers[0]; // Default to No Tier
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (knsBalance >= parseInt(tiers[i].knsMin)) {
        applicableTier = tiers[i];
        break;
      }
    }

    return {
      tier: applicableTier,
      effectiveFeeBps: applicableTier.effectiveFeeBps as unknown as number,
      discountPercent: applicableTier.discountPercent,
      charityPortion: config.charityPortion as unknown as number,
    };
  }

  /**
   * PUBLIC: Get tier by ID
   */
  async getTierById(tierId: string): Promise<FeeTier> {
    const tier = await this.feeTierRepo.getTierById(tierId);

    if (!tier) {
      throw new BadRequestException(`Tier ${tierId} not found`);
    }

    return tier;
  }

  /**
   * ADMIN: Update fee configuration
   * Requires admin wallet
   * Automatically invalidates cache
   *
   * 4-WAY FEE DISTRIBUTION VALIDATION:
   * - charityPortion + kindswapPortion + rebatePortion + stakingPortion = 1.0
   * - Each portion must be 0.0 to 1.0
   * - Sum tolerance: 0.0001 (accounting for float precision)
   */
  async updateFeeConfiguration(
    baseFeeBps?: number,
    charityPortion?: number,
    kindswapPortion?: number,
    rebatePortion?: number,
    stakingPortion?: number,
    platformWallet?: string,
    charityWallet?: string,
    rebateWallet?: string,
    stakingWallet?: string,
    adminWallet?: string,
    changeReason?: string,
  ): Promise<FeeConfiguration> {
    // Validate inputs
    if (baseFeeBps !== undefined && baseFeeBps <= 0) {
      throw new BadRequestException('baseFeeBps must be positive');
    }

    if (charityPortion !== undefined && (charityPortion < 0 || charityPortion > 1)) {
      throw new BadRequestException('charityPortion must be between 0 and 1');
    }

    if (kindswapPortion !== undefined && (kindswapPortion < 0 || kindswapPortion > 1)) {
      throw new BadRequestException('kindswapPortion must be between 0 and 1');
    }

    if (rebatePortion !== undefined && (rebatePortion < 0 || rebatePortion > 1)) {
      throw new BadRequestException('rebatePortion must be between 0 and 1');
    }

    if (stakingPortion !== undefined && (stakingPortion < 0 || stakingPortion > 1)) {
      throw new BadRequestException('stakingPortion must be between 0 and 1');
    }

    // Validate wallet addresses
    if (platformWallet !== undefined && !isValidSolanaAddress(platformWallet)) {
      throw new BadRequestException('Invalid platform wallet address. Must be 32-44 characters and valid base58.');
    }

    if (charityWallet !== undefined && !isValidSolanaAddress(charityWallet)) {
      throw new BadRequestException('Invalid charity wallet address. Must be 32-44 characters and valid base58.');
    }

    if (rebateWallet !== undefined && rebateWallet !== null && !isValidSolanaAddress(rebateWallet)) {
      throw new BadRequestException('Invalid rebate wallet address. Must be 32-44 characters and valid base58.');
    }

    if (stakingWallet !== undefined && stakingWallet !== null && !isValidSolanaAddress(stakingWallet)) {
      throw new BadRequestException('Invalid staking wallet address. Must be 32-44 characters and valid base58.');
    }

    // 4-WAY FEE SPLIT VALIDATION
    // Get current config to merge with updates
    const currentConfig = await this.feeConfigRepo.getActiveConfiguration();

    // Convert decimal values to numbers (PostgreSQL returns decimals as strings)
    const finalCharityPortion = charityPortion ?? Number(currentConfig.charityPortion);
    const finalKindswapPortion = kindswapPortion ?? Number(currentConfig.kindswapPortion);
    const finalRebatePortion = rebatePortion ?? Number(currentConfig.rebatePortion ?? 0);
    const finalStakingPortion = stakingPortion ?? Number(currentConfig.stakingPortion ?? 0);

    // Validate 4-way sum
    if (!this.validatePortionSum([
      finalCharityPortion,
      finalKindswapPortion,
      finalRebatePortion,
      finalStakingPortion,
    ])) {
      const sum = finalCharityPortion + finalKindswapPortion + finalRebatePortion + finalStakingPortion;
      throw new BadRequestException(
        `Fee portions must sum to 1.0 (100%). ` +
        `Current sum: ${sum.toFixed(4)} ` +
        `(charity: ${finalCharityPortion}, platform: ${finalKindswapPortion}, ` +
        `rebate: ${finalRebatePortion}, staking: ${finalStakingPortion})`
      );
    }

    const updated = await this.feeConfigRepo.updateConfiguration(
      baseFeeBps,
      charityPortion,
      kindswapPortion,
      rebatePortion,
      stakingPortion,
      platformWallet,
      charityWallet,
      rebateWallet,
      stakingWallet,
      adminWallet,
      changeReason,
    );

    // If base fee changed, recalculate all tier effective fees
    if (baseFeeBps !== undefined) {
      await this.recalculateTierFees(baseFeeBps, adminWallet);
    }

    // Invalidate cache
    await this.invalidateCache();

    return updated;
  }

  /**
   * Helper method to validate that fee portions sum to 1.0
   * Allows tolerance of 0.0001 for floating point precision
   *
   * @param portions Array of portion values to validate
   * @returns true if sum is within tolerance of 1.0
   */
  private validatePortionSum(portions: number[]): boolean {
    const sum = portions.reduce((acc, val) => acc + val, 0);
    const tolerance = 0.0001;
    return Math.abs(sum - 1.0) < tolerance;
  }

  /**
   * Recalculate all tier effective fees based on new base fee
   * Called automatically when base fee is updated
   */
  private async recalculateTierFees(
    newBaseFeeBps: number,
    adminWallet?: string,
  ): Promise<void> {
    const tiers = await this.feeTierRepo.getAllActiveTiers();

    for (const tier of tiers) {
      // Calculate new effective fee: baseFeeBps * (1 - discount%)
      const newEffectiveFeeBps = newBaseFeeBps * (1 - tier.discountPercent / 100);

      await this.feeTierRepo.updateTier(
        tier.id,
        undefined, // name unchanged
        undefined, // knsMin unchanged
        undefined, // discountPercent unchanged
        newEffectiveFeeBps,
        adminWallet || 'system',
        `Auto-recalculated from base fee change to ${newBaseFeeBps} bps`,
      );
    }

    console.log(`[ConfigService] Recalculated ${tiers.length} tier fees based on new base fee: ${newBaseFeeBps} bps`);
  }

  /**
   * ADMIN: Update a fee tier
   * Requires admin wallet
   * Automatically invalidates cache
   */
  async updateFeeTier(
    tierId: string,
    name?: string,
    knsMin?: string,
    discountPercent?: number,
    effectiveFeeBps?: number,
    adminWallet?: string,
    changeReason?: string,
  ): Promise<FeeTier> {
    // Validate inputs
    if (discountPercent !== undefined && (discountPercent < 0 || discountPercent > 20)) {
      throw new BadRequestException('discountPercent must be between 0 and 20');
    }

    if (effectiveFeeBps !== undefined && effectiveFeeBps <= 0) {
      throw new BadRequestException('effectiveFeeBps must be positive');
    }

    if (knsMin !== undefined && parseInt(knsMin) < 0) {
      throw new BadRequestException('knsMin must be non-negative');
    }

    const updated = await this.feeTierRepo.updateTier(
      tierId,
      name,
      knsMin,
      discountPercent,
      effectiveFeeBps,
      adminWallet,
      changeReason,
    );

    // Invalidate cache
    await this.invalidateCache();

    return updated;
  }

  /**
   * ADMIN: Get fee configuration audit history
   */
  async getFeeConfigurationAuditHistory(limit: number = 50) {
    return this.feeConfigRepo.getConfigurationHistory(limit);
  }

  /**
   * ADMIN: Get tier audit history
   */
  async getFeeTierAuditHistory(tierId?: string, limit: number = 50) {
    if (tierId) {
      return this.feeTierRepo.getTierHistory(tierId, limit);
    }
    return this.feeTierRepo.getAllAuditHistory(limit);
  }

  /**
   * ADMIN: Deactivate a tier
   */
  async deactivateTier(tierId: string, adminWallet?: string, reason?: string): Promise<FeeTier> {
    const tier = await this.feeTierRepo.deactivateTier(tierId);

    // Create audit record for deactivation
    await this.feeTierRepo.updateTier(
      tierId,
      undefined,
      undefined,
      undefined,
      undefined,
      adminWallet,
      reason || 'Tier deactivated',
    );

    await this.invalidateCache();
    return tier;
  }

  /**
   * ADMIN: Activate a tier
   */
  async activateTier(tierId: string, adminWallet?: string, reason?: string): Promise<FeeTier> {
    const tier = await this.feeTierRepo.activateTier(tierId);

    // Create audit record for activation
    await this.feeTierRepo.updateTier(
      tierId,
      undefined,
      undefined,
      undefined,
      undefined,
      adminWallet,
      reason || 'Tier reactivated',
    );

    await this.invalidateCache();
    return tier;
  }

  /**
   * PRIVATE: Invalidate all caches
   * Called after any admin update
   */
  private async invalidateCache(): Promise<void> {
    await this.cacheManager.del(this.FEE_CONFIG_CACHE_KEY);
    await this.cacheManager.del(this.FEE_TIERS_CACHE_KEY);
  }

  /**
   * PRIVATE: Get cache status (for debugging)
   */
  async getCacheStatus(): Promise<{
    feeConfigCached: boolean;
    feeTiersCached: boolean;
  }> {
    const feeConfigCached = (await this.cacheManager.get(this.FEE_CONFIG_CACHE_KEY)) !== null;
    const feeTiersCached = (await this.cacheManager.get(this.FEE_TIERS_CACHE_KEY)) !== null;

    return {
      feeConfigCached,
      feeTiersCached,
    };
  }
}
