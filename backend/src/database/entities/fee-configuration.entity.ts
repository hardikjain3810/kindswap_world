import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * FeeConfiguration Entity
 *
 * Stores global platform fee configuration
 * This is a singleton table - should only have 1 active row
 *
 * FEE SPLIT MODEL (4-WAY DISTRIBUTION):
 * - baseFeeBps: Base fee in basis points (10.0 = 0.10%) - max total fee
 * - charityPortion: Portion of total fee going to charity (0.25 = 25%)
 * - kindswapPortion: Portion of total fee going to KindSwap platform (0.50 = 50%)
 * - rebatePortion: Portion of total fee going to rebates (0.15 = 15%)
 * - stakingPortion: Portion of total fee going to staking rewards (0.10 = 10%)
 * - All 4 portions MUST sum to 1.0 (100%)
 *
 * Fee Calculation:
 * - feeAmountUSD = inputAmountUSD × effectiveFeeBps / 10000 (total fee)
 * - charityAmountUSD = feeAmountUSD × charityPortion (25% of total)
 * - kindswapFeeUSD = feeAmountUSD × kindswapPortion (50% of total)
 * - rebateAmountUSD = feeAmountUSD × rebatePortion (15% of total)
 * - stakingAmountUSD = feeAmountUSD × stakingPortion (10% of total)
 *
 * Example ($100 swap at No Tier, 10 bps):
 * - Total fee: $0.10 (charged to user)
 * - Charity: $0.025 (25% of $0.10)
 * - Platform: $0.050 (50% of $0.10)
 * - Rebate: $0.015 (15% of $0.10)
 * - Staking: $0.010 (10% of $0.10)
 *
 * @example
 * GET /api/config/fee-config returns:
 * {
 *   baseFeeBps: 10.0,
 *   charityPortion: 0.25,
 *   kindswapPortion: 0.50,
 *   rebatePortion: 0.15,
 *   stakingPortion: 0.10,
 *   platformWallet: "ksw...",
 *   charityWallet: "kNS...",
 *   rebateWallet: "reb...",
 *   stakingWallet: "stk...",
 *   updatedAt: "2026-01-21T14:22:30Z"
 * }
 */
@Entity('fee_configuration')
export class FeeConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Base fee in basis points
   * 10.0 = 0.10%
   * This is the starting point before discounts
   */
  @Column('decimal', {
    precision: 5,
    scale: 1,
    default: 10.0,
    name: 'base_fee_bps',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  baseFeeBps: number;

  /**
   * Portion of total fee going to charity
   * 0.25 = 25% of fee goes to charity
   * Must sum with kindswapPortion to 1.0
   */
  @Column('decimal', {
    precision: 5,
    scale: 4,
    default: 0.25,
    name: 'charity_portion',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  charityPortion: number;

  /**
   * Portion of total fee going to KindSwap platform
   * 0.75 = 75% of fee goes to platform
   * Must sum with charityPortion to 1.0
   */
  @Column('decimal', {
    precision: 5,
    scale: 4,
    default: 0.75,
    name: 'kindswap_portion',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  kindswapPortion: number;

  /**
   * Whether this configuration is currently active
   * Set to false to soft-delete without losing history
   */
  @Column('boolean', { default: true, name: 'is_active' })
  isActive: boolean;

  /**
   * Version for optimistic locking
   * Prevents concurrent update conflicts
   */
  @Column('integer', { default: 0, name: 'version' })
  version: number;

  /**
   * Admin notes about this configuration
   */
  @Column('text', { nullable: true, name: 'notes' })
  notes: string;

  /**
   * Platform fee wallet address (Solana address)
   * All platform fees will be sent to this wallet
   * Default: ksw2N41N4a2UXGCxj3hhZczdaC5P5wPBNCC35kutD28
   */
  @Column('varchar', {
    length: 44,
    default: 'ksw2N41N4a2UXGCxj3hhZczdaC5P5wPBNCC35kutD28',
    name: 'platform_wallet'
  })
  platformWallet: string;

  /**
   * Charity fee wallet address (Solana address)
   * All charity fees will be sent to this wallet
   * Default: kNSBmzPU33zmNAbJeKp986iqDii8aa4mnJnAZkZ1TED
   */
  @Column('varchar', {
    length: 44,
    default: 'kNSBmzPU33zmNAbJeKp986iqDii8aa4mnJnAZkZ1TED',
    name: 'charity_wallet'
  })
  charityWallet: string;

  /**
   * Portion of total fee going to rebates
   * 0.15 = 15% of fee goes to user rebates
   * Must sum with other portions to 1.0
   */
  @Column('decimal', {
    precision: 5,
    scale: 4,
    default: 0.0,
    name: 'rebate_portion',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  rebatePortion: number;

  /**
   * Portion of total fee going to staking rewards
   * 0.10 = 10% of fee goes to staking pool
   * Must sum with other portions to 1.0
   */
  @Column('decimal', {
    precision: 5,
    scale: 4,
    default: 0.0,
    name: 'staking_portion',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  stakingPortion: number;

  /**
   * Rebate wallet address (Solana address)
   * All rebate fees will be sent to this wallet
   * NULL if rebate feature is not enabled
   */
  @Column('varchar', { length: 88, nullable: true, name: 'rebate_wallet' })
  rebateWallet: string;

  /**
   * Staking rewards wallet address (Solana address)
   * All staking fees will be sent to this wallet
   * NULL if staking feature is not enabled
   */
  @Column('varchar', { length: 88, nullable: true, name: 'staking_wallet' })
  stakingWallet: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
