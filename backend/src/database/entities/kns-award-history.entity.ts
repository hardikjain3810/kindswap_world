import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * KNS Award History Entity
 * Tracks daily KNS holding points awards
 * Prevents double awards and provides audit trail
 */
@Entity('kns_award_history')
@Index(['wallet', 'awardDate'], { unique: true }) // One award per wallet per day
@Index(['awardDate'])
@Index(['wallet'])
@Index(['tierName'])
export class KnsAwardHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Wallet address that received the award
   */
  @Column('varchar', { length: 88 })
  wallet: string;

  /**
   * Date of the award (UTC)
   * Only one award per wallet per day is allowed
   */
  @Column('date')
  awardDate: Date;

  /**
   * Current KNS balance at time of calculation
   */
  @Column('decimal', { precision: 20, scale: 6 })
  currentBalance: string;

  /**
   * Time-weighted average balance over 24h period
   * Used to determine tier and prevent flash balance gaming
   */
  @Column('decimal', { precision: 20, scale: 6 })
  timeWeightedAverageBalance: string;

  /**
   * The tier name based on TWAB
   * e.g., '< 10k', '10k-49k', '50k-99k', '100k-249k', '250k+'
   */
  @Column('varchar', { length: 50 })
  tierName: string;

  /**
   * Points awarded for this day
   * Based on tier: 0, 50, 150, 300, or 500
   */
  @Column('integer')
  pointsAwarded: number;

  /**
   * Number of token transfers in the calculation period
   * Useful for debugging and analytics
   */
  @Column('integer', { default: 0 })
  transferCount: number;

  /**
   * Period start timestamp (Unix) for TWAB calculation
   */
  @Column('bigint')
  periodStart: string;

  /**
   * Period end timestamp (Unix) for TWAB calculation
   */
  @Column('bigint')
  periodEnd: string;

  /**
   * Processing status
   * - 'success': Points awarded successfully
   * - 'skipped': Balance too low for any points
   * - 'error': Failed to process
   */
  @Column('varchar', { length: 20, default: 'success' })
  status: string;

  /**
   * Error message if status is 'error'
   */
  @Column('text', { nullable: true })
  errorMessage: string | null;

  /**
   * Timestamp when this record was created
   */
  @CreateDateColumn()
  createdAt: Date;
}
