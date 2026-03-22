import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * SwapTransaction Entity - Audit log for all swaps
 * Used for:
 * - Points calculation and verification
 * - Fee discount tracking
 * - Volume analytics
 * - Fraud detection
 */
@Entity('swap_transactions')
@Index(['wallet', 'executedAt'])
@Index(['signature'], { unique: true })
@Index(['status', 'executedAt'])
@Index(['pointsAwardedAmount'])
@Index(['createdAt'])
export class SwapTransaction {
  /**
   * Solana transaction signature (unique identifier)
   * Primary key - guarantees only one record per tx
   */
  @PrimaryColumn('varchar', { length: 88 })
  signature: string;

  /**
   * User's wallet address
   * Denormalized for query performance
   */
  @Column('varchar', { length: 88 })
  wallet: string;

  /**
   * Input token mint address
   */
  @Column('varchar', { length: 44 })
  inputMint: string;

  /**
   * Output token mint address
   */
  @Column('varchar', { length: 44 })
  outputMint: string;

  /**
   * Input amount in smallest units
   * Stored as string for precision
   */
  @Column('varchar', { length: 80 })
  inputAmount: string;

  /**
   * Output amount in smallest units
   * Stored as string for precision
   */
  @Column('varchar', { length: 80 })
  outputAmount: string;

  /**
   * Input token decimals
   * Used to calculate human-readable amounts
   */
  @Column('integer')
  inputDecimals: number;

  /**
   * Output token decimals
   * Used to calculate human-readable amounts
   */
  @Column('integer')
  outputDecimals: number;

  /**
   * USD value of input at time of swap
   * Used for points calculation: 1 point = $1 USD
   */
  @Column('decimal', { precision: 20, scale: 2 })
  inputAmountUSD: string;

  /**
   * USD value of output at time of swap
   * For analytics only
   */
  @Column('decimal', { precision: 20, scale: 2 })
  outputAmountUSD: string;

  /**
   * KNS fee tier applied during swap (Section 8)
   * "No Tier" | "Tier 1" | "Tier 2" | "Tier 3" | "Tier 4"
   */
  @Column('varchar', { length: 20 })
  feeTier: string;

  /**
   * Discount percentage applied (0, 5, 10, 15, 20)
   * From fee tier lookup
   */
  @Column('integer')
  discountPercent: number;

  /**
   * Effective fee in basis points (bps)
   * 10.0, 9.5, 9.0, 8.5, 8.0
   */
  @Column('decimal', { precision: 5, scale: 1 })
  effectiveFeeBps: string;

  /**
   * Total fee collected from user (in output token value)
   */
  @Column('decimal', { precision: 20, scale: 2 })
  feeAmountUSD: string;

  /**
   * Charity portion of fee (0.05% of total swap fee)
   */
  @Column('decimal', { precision: 20, scale: 2 })
  charityAmountUSD: string;

  /**
   * KindSwap portion of fee
   */
  @Column('decimal', { precision: 20, scale: 2 })
  kindswapFeeUSD: string;

  /**
   * Rebate portion of fee (user rebates)
   * Amount from total fee allocated to user rebates
   */
  @Column('decimal', { precision: 20, scale: 6, default: 0.0, name: 'rebateAmountUSD' })
  rebateAmountUSD: string;

  /**
   * Staking rewards portion of fee
   * Amount from total fee allocated to staking pool
   */
  @Column('decimal', { precision: 20, scale: 6, default: 0.0, name: 'stakingAmountUSD' })
  stakingAmountUSD: string;

  /**
   * Jupiter routing information (JSON)
   * Stores the complete route breakdown for auditing
   */
  @Column('jsonb', { nullable: true })
  routeData: Record<string, unknown>;

  /**
   * Transaction status
   */
  @Column('varchar', { length: 20, default: 'pending' })
  status: 'pending' | 'confirmed' | 'failed' | 'cancelled';

  /**
   * Block height when confirmed
   * NULL if not yet confirmed
   */
  @Column('bigint', { nullable: true })
  blockHeight: string;

  /**
   * Points awarded for this swap
   * Formula: 1 point = $1 USD (min $5, daily cap 10k)
   * 0 if below minimum or daily cap exceeded
   */
  @Column('integer')
  pointsAwardedAmount: number;

  /**
   * Whether points were actually awarded
   * May be false if daily cap was hit
   */
  @Column('boolean', { default: true })
  pointsAwarded: boolean;

  /**
   * Slippage tolerance used (in basis points)
   * Default: 50 (0.5%)
   */
  @Column('integer')
  slippageBps: number;

  /**
   * Actual price impact experienced
   */
  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  actualPriceImpactPct: string;

  /**
   * KNS balance at time of swap
   * Used to verify fee tier was correctly applied
   */
  @Column('bigint')
  knsBalanceAtSwap: string;

  /**
   * User agent / client info
   */
  @Column('varchar', { length: 255, nullable: true })
  userAgent: string;

  /**
   * IP address of requester (if available)
   */
  @Column('varchar', { length: 45, nullable: true })
  ipAddress: string;

  /**
   * Any error message if status is 'failed'
   */
  @Column('text', { nullable: true })
  errorMessage: string;

  /**
   * Off-chain verification timestamp
   */
  @Column('timestamp', { nullable: true })
  verifiedAt: Date;

  /**
   * Notes for admin/debugging
   */
  @Column('text', { nullable: true })
  notes: string;

  /**
   * When the swap was executed on-chain
   */
  @CreateDateColumn()
  executedAt: Date;

  /**
   * Created when API received the request
   */
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
