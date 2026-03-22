import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  Index,
} from 'typeorm';
import { User } from './user.entity';

/**
 * UserPoints Entity - Tracks all types of points earned
 * Implements the full Points System from spec (Section 6)
 *
 * Total Points Formula:
 * Total = Swap Points + Community Points + KNS Holding Points
 * (Fully additive, no multipliers in Phase-1)
 */
@Entity('user_points')
@Index(['totalPoints', 'wallet'])
@Index(['swapPoints'])
@Index(['communityPoints'])
@Index(['knsPoints'])
@Index(['wallet', 'updatedAt'])
export class UserPoints {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Denormalized wallet for quick queries
   * Synced from related User entity
   */
  @Column('varchar', { length: 88 })
  wallet: string;

  /**
   * Swap Usage Points (Section 3)
   * Base: 1 point = $1 USD swapped
   * Min: $5 minimum swap to earn points (3.2)
   * Cap: 10,000 per wallet per UTC day (3.3)
   * Updated after each successful swap execution
   */
  @Column('integer', { default: 0 })
  swapPoints: number;

  /**
   * Community Contribution Points (Section 4)
   * Range: 50-300+ points per contribution
   * - Twitter post: 50-150
   * - Educational thread: 100-300
   * - YouTube video (2+ min): 300-800
   * - Blog/guide: 200-500
   * - Translation/docs: 150-400
   * Cap: Max 2,000 per wallet per week (4.3)
   * Constraint: ≤ 30% of total wallet points (4.3)
   * Manually reviewed and approved in Phase-1
   */
  @Column('integer', { default: 0 })
  communityPoints: number;

  /**
   * KNS Holding Points (Section 5)
   * Daily accrual based on average balance
   * Brackets (5.1):
   * - < 10,000 KNS    → 0 points/day
   * - 10,000-49,999   → 50 points/day
   * - 50,000-99,999   → 150 points/day
   * - 100,000-249,999 → 300 points/day
   * - ≥ 250,000       → 500 points/day (MAX)
   * Updated daily by scheduler
   */
  @Column('integer', { default: 0 })
  knsPoints: number;

  /**
   * Total Effective Points (Section 6)
   * Formula: swapPoints + communityPoints + knsPoints
   * Used for ranking on leaderboard
   * Denormalized for query performance
   */
  @Column('integer', { default: 0 })
  totalPoints: number;

  /**
   * Swap points earned in current UTC day
   * Used to enforce daily cap of 10,000
   * Reset daily at UTC midnight
   */
  @Column('integer', { default: 0 })
  swapPointsToday: number;

  /**
   * Date when swapPointsToday was last reset
   * Used to detect when to reset daily cap
   */
  @Column('date', { nullable: true })
  lastSwapDayReset: Date;

  /**
   * Swap points earned in current UTC week (Mon-Sun)
   * Used for community points validation
   */
  @Column('integer', { default: 0 })
  communityPointsThisWeek: number;

  /**
   * Date when communityPointsThisWeek was last reset
   * Used to detect when to reset weekly cap
   */
  @Column('date', { nullable: true })
  lastWeekReset: Date;

  /**
   * Current leaderboard rank
   * NULL if outside top 100
   * Updated hourly or after each significant transaction
   */
  @Column('integer', { nullable: true })
  currentRank: number;

  /**
   * Leaderboard rank from previous period
   * Used to show rank changes in UI
   */
  @Column('integer', { nullable: true })
  previousRank: number;

  /**
   * Cumulative USD volume swapped on KindSwap
   * Used for analytics and tier progression
   */
  @Column('decimal', { precision: 20, scale: 2, default: '0' })
  totalSwapVolumeUSD: string;

  /**
   * Number of successful swaps executed
   * Used for analytics
   */
  @Column('integer', { default: 0 })
  totalSwapsCount: number;

  /**
   * Average swap size in USD
   * Denormalized: totalSwapVolumeUSD / totalSwapsCount
   */
  @Column('decimal', { precision: 18, scale: 2, default: '0' })
  averageSwapSize: string;

  /**
   * Last time points were updated
   * Used to track update frequency and debugging
   */
  @Column('timestamp')
  @UpdateDateColumn()
  lastPointsUpdate: Date;

  /**
   * Last time this wallet was on the leaderboard top 100
   * Used to trigger notifications
   */
  @Column('timestamp', { nullable: true })
  lastTopRankTime: Date;

  /**
   * Version for optimistic locking
   * Prevents race conditions on concurrent point awards
   */
  @Column('integer', { default: 0 })
  version: number;

  /**
   * One-to-one relationship with User
   */
  @OneToOne(() => User, (user) => user.points, {
    onDelete: 'CASCADE',
  })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
