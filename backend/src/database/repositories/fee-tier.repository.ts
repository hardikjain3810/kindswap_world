import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeeTier } from '../entities/fee-tier.entity';
import { FeeTierAudit } from '../entities/fee-tier-audit.entity';

@Injectable()
export class FeeTierRepository {
  constructor(
    @InjectRepository(FeeTier)
    private readonly tierRepo: Repository<FeeTier>,
    @InjectRepository(FeeTierAudit)
    private readonly auditRepo: Repository<FeeTierAudit>,
  ) {}

  /**
   * Get all active tiers ordered by tier order
   */
  async getAllActiveTiers(): Promise<FeeTier[]> {
    return this.tierRepo.find({
      where: { isActive: true },
      order: { tierOrder: 'ASC' },
    });
  }

  /**
   * Get tier by ID
   */
  async getTierById(id: string): Promise<FeeTier | null> {
    return this.tierRepo.findOne({
      where: { id },
    });
  }

  /**
   * Find applicable tier for given KNS balance
   * Returns the highest tier where balance >= knsMin
   */
  async getTierByKnsBalance(knsBalance: number): Promise<FeeTier> {
    const tiers = await this.getAllActiveTiers();

    // Iterate from highest tier to lowest
    for (let i = tiers.length - 1; i >= 0; i--) {
      const tierKnsMin = parseInt(tiers[i].knsMin);
      if (knsBalance >= tierKnsMin) {
        return tiers[i];
      }
    }

    // Return lowest tier (No Tier) if no match
    return tiers[0];
  }

  /**
   * Update a fee tier
   * Creates audit record of the change
   */
  async updateTier(
    id: string,
    name?: string,
    knsMin?: string,
    discountPercent?: number,
    effectiveFeeBps?: number,
    changedBy?: string,
    changeReason?: string,
  ): Promise<FeeTier> {
    const tier = await this.getTierById(id);

    if (!tier) {
      throw new Error(`Tier ${id} not found`);
    }

    // Store old values for audit
    const oldValues = {
      name: tier.name,
      knsMin: tier.knsMin,
      discountPercent: tier.discountPercent,
      effectiveFeeBps: tier.effectiveFeeBps,
      tierOrder: tier.tierOrder,
    };

    // Update fields
    if (name !== undefined) tier.name = name;
    if (knsMin !== undefined) tier.knsMin = knsMin;
    if (discountPercent !== undefined) tier.discountPercent = discountPercent;
    if (effectiveFeeBps !== undefined) tier.effectiveFeeBps = effectiveFeeBps;

    tier.version += 1;
    const updated = await this.tierRepo.save(tier);

    // Create audit record if something changed
    const changed =
      name !== oldValues.name ||
      knsMin !== oldValues.knsMin ||
      discountPercent !== oldValues.discountPercent ||
      effectiveFeeBps !== oldValues.effectiveFeeBps;

    if (changed) {
      const auditRecord = this.auditRepo.create({
        tierId: tier.id,
        name: updated.name,
        knsMin: updated.knsMin,
        discountPercent: updated.discountPercent,
        effectiveFeeBps: updated.effectiveFeeBps,
        tierOrder: updated.tierOrder,
        changedBy,
        changeReason,
      });
      await this.auditRepo.save(auditRecord);
    }

    return updated;
  }

  /**
   * Get tier audit history
   */
  async getTierHistory(tierId: string, limit: number = 50): Promise<FeeTierAudit[]> {
    return this.auditRepo.find({
      where: { tierId },
      order: { changedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get all tier audit records
   */
  async getAllAuditHistory(limit: number = 100): Promise<FeeTierAudit[]> {
    return this.auditRepo.find({
      order: { changedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Soft delete tier (mark as inactive)
   */
  async deactivateTier(id: string): Promise<FeeTier> {
    const tier = await this.getTierById(id);

    if (!tier) {
      throw new Error(`Tier ${id} not found`);
    }

    tier.isActive = false;
    tier.version += 1;
    return this.tierRepo.save(tier);
  }

  /**
   * Reactivate tier
   */
  async activateTier(id: string): Promise<FeeTier> {
    const tier = await this.getTierById(id);

    if (!tier) {
      throw new Error(`Tier ${id} not found`);
    }

    tier.isActive = true;
    tier.version += 1;
    return this.tierRepo.save(tier);
  }
}
