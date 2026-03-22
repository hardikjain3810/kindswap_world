import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeeConfiguration } from '../entities/fee-configuration.entity';
import { FeeConfigurationAudit } from '../entities/fee-configuration-audit.entity';

@Injectable()
export class FeeConfigurationRepository {
  constructor(
    @InjectRepository(FeeConfiguration)
    private readonly feeConfigRepo: Repository<FeeConfiguration>,
    @InjectRepository(FeeConfigurationAudit)
    private readonly auditRepo: Repository<FeeConfigurationAudit>,
  ) {}

  /**
   * Get the active fee configuration
   * Returns the single active configuration record
   */
  async getActiveConfiguration(): Promise<FeeConfiguration> {
    const config = await this.feeConfigRepo.findOne({
      where: { isActive: true },
      order: { updatedAt: 'DESC' },
    });

    if (!config) {
      throw new Error('No active fee configuration found');
    }

    return config;
  }

  /**
   * Update the fee configuration
   * Creates audit record of the change
   */
  async updateConfiguration(
    baseFeeBps?: number,
    charityPortion?: number,
    kindswapPortion?: number,
    rebatePortion?: number,
    stakingPortion?: number,
    platformWallet?: string,
    charityWallet?: string,
    rebateWallet?: string,
    stakingWallet?: string,
    changedBy?: string,
    changeReason?: string,
  ): Promise<FeeConfiguration> {
    const config = await this.getActiveConfiguration();

    // Store old values for audit
    const oldValues = {
      baseFeeBps: config.baseFeeBps,
      charityPortion: config.charityPortion,
      kindswapPortion: config.kindswapPortion,
      rebatePortion: config.rebatePortion,
      stakingPortion: config.stakingPortion,
      platformWallet: config.platformWallet,
      charityWallet: config.charityWallet,
      rebateWallet: config.rebateWallet,
      stakingWallet: config.stakingWallet,
    };

    // Update fields
    if (baseFeeBps !== undefined) config.baseFeeBps = baseFeeBps;
    if (charityPortion !== undefined) config.charityPortion = charityPortion;
    if (kindswapPortion !== undefined) config.kindswapPortion = kindswapPortion;
    if (rebatePortion !== undefined) config.rebatePortion = rebatePortion;
    if (stakingPortion !== undefined) config.stakingPortion = stakingPortion;
    if (platformWallet !== undefined) config.platformWallet = platformWallet;
    if (charityWallet !== undefined) config.charityWallet = charityWallet;
    if (rebateWallet !== undefined) config.rebateWallet = rebateWallet;
    if (stakingWallet !== undefined) config.stakingWallet = stakingWallet;

    config.version += 1;
    const updated = await this.feeConfigRepo.save(config);

    // Create audit record
    if (
      baseFeeBps !== oldValues.baseFeeBps ||
      charityPortion !== oldValues.charityPortion ||
      kindswapPortion !== oldValues.kindswapPortion ||
      rebatePortion !== oldValues.rebatePortion ||
      stakingPortion !== oldValues.stakingPortion ||
      platformWallet !== oldValues.platformWallet ||
      charityWallet !== oldValues.charityWallet ||
      rebateWallet !== oldValues.rebateWallet ||
      stakingWallet !== oldValues.stakingWallet
    ) {
      const auditRecord = this.auditRepo.create({
        configId: config.id,
        baseFeeBps: updated.baseFeeBps,
        charityPortion: updated.charityPortion,
        kindswapPortion: updated.kindswapPortion,
        rebatePortion: updated.rebatePortion,
        stakingPortion: updated.stakingPortion,
        rebateWallet: updated.rebateWallet,
        stakingWallet: updated.stakingWallet,
        changedBy,
        changeReason,
      });
      await this.auditRepo.save(auditRecord);
    }

    return updated;
  }

  /**
   * Get configuration audit history
   */
  async getConfigurationHistory(limit: number = 50): Promise<FeeConfigurationAudit[]> {
    return this.auditRepo.find({
      order: { changedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get audit history for specific config ID
   */
  async getConfigurationHistoryById(
    configId: string,
    limit: number = 50,
  ): Promise<FeeConfigurationAudit[]> {
    return this.auditRepo.find({
      where: { configId },
      order: { changedAt: 'DESC' },
      take: limit,
    });
  }
}
