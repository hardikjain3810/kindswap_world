import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * FeeTierAudit Entity
 *
 * Audit log for all changes to fee tiers
 * Created automatically when fee_tiers is updated
 *
 * Tracks:
 * - What tier changed
 * - What properties changed (boundaries, discounts, effective fees)
 * - Who made the change (admin wallet)
 * - Why it changed (change reason)
 * - When it changed (timestamp)
 *
 * Enables complete rollback to any previous tier configuration
 */
@Entity('fee_tier_audit')
export class FeeTierAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Reference to the fee_tiers record that was updated
   */
  @Column('uuid')
  tierId: string;

  /**
   * Tier name at time of change
   */
  @Column('varchar', { length: 20 })
  name: string;

  /**
   * Minimum KNS balance at time of change
   */
  @Column('bigint')
  knsMin: string;

  /**
   * Discount percent at time of change
   */
  @Column('integer')
  discountPercent: number;

  /**
   * Effective fee BPS at time of change
   */
  @Column('decimal', { precision: 5, scale: 1 })
  effectiveFeeBps: number;

  /**
   * Tier order at time of change
   */
  @Column('integer')
  tierOrder: number;

  /**
   * Admin wallet address who made this change
   * Format: Solana base58 address (44 characters)
   */
  @Column('varchar', { length: 88, nullable: true })
  changedBy: string;

  /**
   * Reason for the change
   * Example: "Tier 3 KNS minimum increased from 100k to 150k"
   */
  @Column('text', { nullable: true })
  changeReason: string;

  @CreateDateColumn()
  changedAt: Date;
}
