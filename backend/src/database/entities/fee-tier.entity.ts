import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * FeeTier Entity
 *
 * Defines fee tiers based on KNS balance holdings
 * There are exactly 5 tiers:
 * - No Tier (0 KNS): 0% discount, 10.0 bps effective fee
 * - Tier 1 (5k KNS): 5% discount, 9.5 bps effective fee
 * - Tier 2 (25k KNS): 10% discount, 9.0 bps effective fee
 * - Tier 3 (100k KNS): 15% discount, 8.5 bps effective fee
 * - Tier 4 (500k+ KNS): 20% discount, 8.0 bps effective fee
 *
 * @example
 * GET /api/config/fee-tiers returns:
 * [
 *   {
 *     id: "550e8400-e29b-41d4-a716-446655440000",
 *     name: "No Tier",
 *     knsMin: "0",
 *     discountPercent: 0,
 *     effectiveFeeBps: 10.0,
 *     tierOrder: 0
 *   },
 *   ...
 * ]
 */
@Entity('fee_tiers')
@Index(['tierOrder'])
@Index(['knsMin'])
export class FeeTier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Tier name for display
   * Values: "No Tier", "Tier 1", "Tier 2", "Tier 3", "Tier 4"
   */
  @Column('varchar', { length: 20 })
  name: string;

  /**
   * Minimum KNS balance required for this tier
   * Stored as string to maintain precision
   * Values: 0, 5000, 25000, 100000, 500000
   */
  @Column('bigint')
  knsMin: string;

  /**
   * Discount percentage applied to base fee
   * Values: 0, 5, 10, 15, 20
   * Formula: effective_fee = base_fee * (1 - discount_percent / 100)
   */
  @Column('integer')
  discountPercent: number;

  /**
   * Effective fee in basis points after discount
   * Values: 10.0, 9.5, 9.0, 8.5, 8.0
   * Example: 9.5 = 0.095%
   */
  @Column('decimal', { precision: 5, scale: 1 })
  effectiveFeeBps: number;

  /**
   * Order of tiers for sorting and display
   * Values: 0, 1, 2, 3, 4 (lowest to highest)
   */
  @Column('integer')
  tierOrder: number;

  /**
   * Whether this tier is currently active
   * Set to false to soft-delete without losing history
   */
  @Column('boolean', { default: true })
  isActive: boolean;

  /**
   * Version for optimistic locking
   * Prevents concurrent update conflicts
   */
  @Column('integer', { default: 0 })
  version: number;

  /**
   * Admin notes about this tier
   */
  @Column('text', { nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
