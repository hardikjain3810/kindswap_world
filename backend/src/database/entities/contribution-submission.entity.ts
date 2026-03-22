import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Contribution category types
 */
export enum ContributionCategory {
  TWITTER_POST = 'twitter_post',
  TWITTER_THREAD = 'twitter_thread',
  VIDEO = 'video',  // YouTube / TikTok
  BLOG = 'blog',
  TRANSLATION = 'translation',
}

/**
 * Submission review status
 */
export enum SubmissionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * ContributionSubmission Entity - Tracks community contribution submissions
 *
 * Users submit content links for review by admins.
 * Upon approval, community points are awarded to the user.
 *
 * Points ranges by category (from spec):
 * - Twitter Post: 10-50 pts
 * - Twitter Thread: 50-200 pts
 * - YouTube Video: 100-500 pts
 * - TikTok: 50-200 pts
 * - Blog Article: 50-300 pts
 * - Translation: 100-400 pts
 *
 * Constraints:
 * - Weekly cap: 2,000 community points per wallet per week
 * - Max 30% of total wallet points from community contributions
 */
@Entity('contribution_submissions')
@Index(['wallet'])
@Index(['status'])
@Index(['createdAt'])
@Index(['wallet', 'category', 'createdAt']) // For weekly limit queries
@Index(['reviewedBy'])
export class ContributionSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Wallet address of the submitter
   * Foreign key to users table
   */
  @Column('varchar', { length: 88 })
  wallet: string;

  /**
   * URL link to the contributed content
   * e.g., Twitter post URL, YouTube video URL, blog article URL
   */
  @Column('varchar', { length: 500 })
  contentLink: string;

  /**
   * Category of the contribution
   */
  @Column({
    type: 'enum',
    enum: ContributionCategory,
  })
  category: ContributionCategory;

  /**
   * Optional description of the contribution
   * User can explain what the content is about
   */
  @Column('varchar', { length: 500, nullable: true })
  description: string;

  /**
   * Review status of the submission
   * Default: pending
   */
  @Column({
    type: 'enum',
    enum: SubmissionStatus,
    default: SubmissionStatus.PENDING,
  })
  status: SubmissionStatus;

  /**
   * Points awarded for this contribution
   * Only set when status = approved
   * NULL for pending/rejected submissions
   */
  @Column('integer', { nullable: true })
  pointsAwarded: number;

  /**
   * Reason for rejection (if rejected)
   * Helps users understand why their submission was not approved
   */
  @Column('text', { nullable: true })
  rejectionReason: string;

  /**
   * Wallet address of the admin who reviewed this submission
   * NULL if not yet reviewed
   */
  @Column('varchar', { length: 88, nullable: true })
  reviewedBy: string;

  /**
   * Timestamp when the submission was reviewed
   * NULL if not yet reviewed
   */
  @Column('timestamp', { nullable: true })
  reviewedAt: Date;

  /**
   * Relationship to User entity
   * Many submissions can belong to one user
   */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wallet', referencedColumnName: 'wallet' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/**
 * Points ranges for each category (for reference/validation)
 * X (Twitter) Post: 10-50
 * X Educational Thread: 50-200
 * YouTube / TikTok Video: 100-500
 * Blog / Guide: 50-300
 * Translation / Docs: 100-400
 */
export const CONTRIBUTION_POINTS_RANGES: Record<ContributionCategory, { min: number; max: number }> = {
  [ContributionCategory.TWITTER_POST]: { min: 10, max: 50 },
  [ContributionCategory.TWITTER_THREAD]: { min: 50, max: 200 },
  [ContributionCategory.VIDEO]: { min: 100, max: 500 },
  [ContributionCategory.BLOG]: { min: 50, max: 300 },
  [ContributionCategory.TRANSLATION]: { min: 100, max: 400 },
};

/**
 * Weekly community points cap per wallet
 */
export const COMMUNITY_POINTS_WEEKLY_CAP = 2000;
