import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import {
  ContributionSubmission,
  ContributionCategory,
  SubmissionStatus,
} from '../entities/contribution-submission.entity';

/**
 * Weekly submission limits per category
 */
export const WEEKLY_CATEGORY_LIMITS: Record<ContributionCategory, number> = {
  [ContributionCategory.TWITTER_POST]: 2,
  [ContributionCategory.TWITTER_THREAD]: 1,
  [ContributionCategory.VIDEO]: 1,  // YouTube / TikTok
  [ContributionCategory.BLOG]: 1,
  [ContributionCategory.TRANSLATION]: 1,
};

@Injectable()
export class ContributionSubmissionRepository {
  constructor(
    @InjectRepository(ContributionSubmission)
    private readonly repository: Repository<ContributionSubmission>,
  ) {}

  /**
   * Get the start of the current week (Monday 00:00:00 UTC)
   */
  private getWeekStart(): Date {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - daysToMonday);
    weekStart.setUTCHours(0, 0, 0, 0);
    return weekStart;
  }

  /**
   * Create a new contribution submission
   */
  async create(data: {
    wallet: string;
    contentLink: string;
    category: ContributionCategory;
    description?: string;
  }): Promise<ContributionSubmission> {
    const submission = this.repository.create({
      ...data,
      status: SubmissionStatus.PENDING,
    });
    return this.repository.save(submission);
  }

  /**
   * Find submissions by wallet with pagination
   */
  async findByWallet(
    wallet: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ submissions: ContributionSubmission[]; total: number }> {
    const [submissions, total] = await this.repository.findAndCount({
      where: { wallet },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { submissions, total };
  }

  /**
   * Find a single submission by ID
   */
  async findById(id: string): Promise<ContributionSubmission | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  /**
   * Count submissions by wallet and category for the current week
   */
  async countByWalletCategoryThisWeek(
    wallet: string,
    category: ContributionCategory,
  ): Promise<number> {
    const weekStart = this.getWeekStart();

    return this.repository.count({
      where: {
        wallet,
        category,
        createdAt: MoreThanOrEqual(weekStart),
      },
    });
  }

  /**
   * Check if a content link already exists for this wallet
   */
  async existsByWalletAndLink(
    wallet: string,
    contentLink: string,
  ): Promise<boolean> {
    const existing = await this.repository.findOne({
      where: { wallet, contentLink },
    });
    return !!existing;
  }

  /**
   * Get the weekly limit for a category
   */
  getWeeklyLimit(category: ContributionCategory): number {
    return WEEKLY_CATEGORY_LIMITS[category];
  }

  /**
   * Check if wallet has reached weekly limit for a category
   */
  async hasReachedWeeklyLimit(
    wallet: string,
    category: ContributionCategory,
  ): Promise<boolean> {
    const count = await this.countByWalletCategoryThisWeek(wallet, category);
    const limit = this.getWeeklyLimit(category);
    return count >= limit;
  }

  /**
   * Get remaining submissions allowed for a category this week
   */
  async getRemainingSubmissions(
    wallet: string,
    category: ContributionCategory,
  ): Promise<number> {
    const count = await this.countByWalletCategoryThisWeek(wallet, category);
    const limit = this.getWeeklyLimit(category);
    return Math.max(0, limit - count);
  }

  // ============================================
  // Admin Methods
  // ============================================

  /**
   * Find all pending submissions with pagination
   * Ordered by createdAt ASC (oldest first for review queue)
   */
  async findPending(
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ submissions: ContributionSubmission[]; total: number }> {
    const [submissions, total] = await this.repository.findAndCount({
      where: { status: SubmissionStatus.PENDING },
      order: { createdAt: 'ASC' },
      take: limit,
      skip: offset,
    });

    return { submissions, total };
  }

  /**
   * Find all approved submissions with pagination
   * Ordered by reviewedAt DESC (most recently approved first)
   */
  async findApproved(
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ submissions: ContributionSubmission[]; total: number }> {
    const [submissions, total] = await this.repository.findAndCount({
      where: { status: SubmissionStatus.APPROVED },
      order: { reviewedAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { submissions, total };
  }

  /**
   * Find all rejected submissions with pagination
   * Ordered by reviewedAt DESC (most recently rejected first)
   */
  async findRejected(
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ submissions: ContributionSubmission[]; total: number }> {
    const [submissions, total] = await this.repository.findAndCount({
      where: { status: SubmissionStatus.REJECTED },
      order: { reviewedAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { submissions, total };
  }

  /**
   * Count total pending submissions
   */
  async countPending(): Promise<number> {
    return this.repository.count({
      where: { status: SubmissionStatus.PENDING },
    });
  }

  /**
   * Update submission status (for approve/reject)
   */
  async updateStatus(
    id: string,
    status: SubmissionStatus,
    options?: {
      pointsAwarded?: number;
      rejectionReason?: string;
      reviewedBy?: string;
    },
  ): Promise<ContributionSubmission | null> {
    const submission = await this.findById(id);
    if (!submission) {
      return null;
    }

    submission.status = status;
    submission.reviewedAt = new Date();

    if (options?.pointsAwarded !== undefined) {
      submission.pointsAwarded = options.pointsAwarded;
    }
    if (options?.rejectionReason !== undefined) {
      submission.rejectionReason = options.rejectionReason;
    }
    if (options?.reviewedBy !== undefined) {
      submission.reviewedBy = options.reviewedBy;
    }

    return this.repository.save(submission);
  }

  /**
   * Get approved points for a wallet this week (for weekly cap check)
   */
  async getApprovedPointsThisWeek(wallet: string): Promise<number> {
    const weekStart = this.getWeekStart();

    const result = await this.repository
      .createQueryBuilder('submission')
      .select('SUM(submission.pointsAwarded)', 'total')
      .where('submission.wallet = :wallet', { wallet })
      .andWhere('submission.status = :status', { status: SubmissionStatus.APPROVED })
      .andWhere('submission.reviewedAt >= :weekStart', { weekStart })
      .getRawOne();

    return parseInt(result?.total || '0', 10);
  }

  /**
   * Get community points grouped by wallet within a timeframe
   * Used for timeframe-based leaderboard
   */
  async getCommunityPointsByTimeframe(
    timeframe: 'today' | 'week' | 'allTime',
    limit: number = 100,
  ): Promise<{ wallet: string; communityPoints: number }[]> {
    const qb = this.repository
      .createQueryBuilder('cs')
      .select('cs.wallet', 'wallet')
      .addSelect('COALESCE(SUM(cs.pointsAwarded), 0)', 'communityPoints')
      .where('cs.status = :status', { status: SubmissionStatus.APPROVED });

    // Apply timeframe filter based on reviewedAt (when points were awarded)
    if (timeframe === 'today') {
      qb.andWhere('cs.reviewedAt >= CURRENT_DATE');
    } else if (timeframe === 'week') {
      qb.andWhere("cs.reviewedAt >= CURRENT_DATE - INTERVAL '7 days'");
    }
    // 'allTime' has no date filter

    return qb
      .groupBy('cs.wallet')
      .orderBy('"communityPoints"', 'DESC')
      .limit(limit)
      .getRawMany();
  }
}
