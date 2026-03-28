import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * FeeConfigurationAudit Entity
 *
 * Audit log for all changes to fee configuration
 * Created automatically when fee_configuration is updated
 *
 * Tracks:
 * - What changed (baseFeeBps, charityPortion, kindswapPortion)
 * - Who changed it (admin wallet)
 * - Why it changed (change reason)
 * - When it changed (timestamp)
 */
@Entity('fee_configuration_audit')
export class FeeConfigurationAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Reference to the fee_configuration record that was updated
   */
  @Column('uuid', { name: 'config_id' })
  configId: string;

  /**
   * Base fee in basis points at time of change
   */
  @Column('decimal', { precision: 5, scale: 1, name: 'base_fee_bps' })
  baseFeeBps: number;

  /**
   * Charity portion at time of change
   */
  @Column('decimal', { precision: 5, scale: 4, name: 'charity_portion' })
  charityPortion: number;

  /**
   * KindSwap portion at time of change
   */
  @Column('decimal', { precision: 5, scale: 4, name: 'kindswap_portion' })
  kindswapPortion: number;

  /**
   * Rebate portion at time of change
   * 0.0 if rebate feature was not enabled
   */
  @Column('decimal', { precision: 5, scale: 4, default: 0.0, name: 'rebate_portion' })
  rebatePortion: number;

  /**
   * Staking portion at time of change
   * 0.0 if staking feature was not enabled
   */
  @Column('decimal', { precision: 5, scale: 4, default: 0.0, name: 'staking_portion' })
  stakingPortion: number;

  /**
   * Rebate wallet address at time of change
   * NULL if rebate feature was not enabled
   */
  @Column('varchar', { length: 88, nullable: true, name: 'rebate_wallet' })
  rebateWallet: string;

  /**
   * Staking wallet address at time of change
   * NULL if staking feature was not enabled
   */
  @Column('varchar', { length: 88, nullable: true, name: 'staking_wallet' })
  stakingWallet: string;

  /**
   * Admin wallet address who made this change
   * Format: Solana base58 address (44 characters)
   */
  @Column('varchar', { length: 88, nullable: true, name: 'changed_by' })
  changedBy: string;

  /**
   * Reason for the change
   * Example: "Adjusted charity split from 50/50 to 40/60"
   */
  @Column('text', { nullable: true, name: 'change_reason' })
  changeReason: string;

  @CreateDateColumn({ name: 'changed_at' })
  changedAt: Date;
}
