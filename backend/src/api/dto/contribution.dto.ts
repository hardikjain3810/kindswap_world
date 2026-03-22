import {
  ContributionCategory,
  SubmissionStatus,
} from '../../database/entities/contribution-submission.entity';

/**
 * DTO for submitting a new contribution
 */
export class SubmitContributionDto {
  /**
   * Wallet address of the submitter
   */
  wallet: string;

  /**
   * URL link to the contributed content
   * Must be a valid URL
   */
  contentLink: string;

  /**
   * Category of the contribution
   */
  category: ContributionCategory;

  /**
   * Optional description of the contribution (max 500 chars)
   */
  description?: string;
}

/**
 * DTO for contribution response
 */
export class ContributionResponseDto {
  id: string;
  wallet: string;
  contentLink: string;
  category: ContributionCategory;
  description: string | null;
  status: SubmissionStatus;
  pointsAwarded: number | null;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for paginated contribution list response
 */
export class ContributionListResponseDto {
  submissions: ContributionResponseDto[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * DTO for weekly submission limits info
 */
export class WeeklyLimitsDto {
  category: ContributionCategory;
  limit: number;
  used: number;
  remaining: number;
}

/**
 * DTO for submission limits response
 */
export class SubmissionLimitsResponseDto {
  wallet: string;
  weekStartDate: Date;
  limits: WeeklyLimitsDto[];
}

// ============================================
// Admin DTOs
// ============================================

/**
 * Points ranges for admin approval by category
 */
export const ADMIN_POINTS_RANGES: Record<ContributionCategory, { min: number; max: number }> = {
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

/**
 * Max percentage of total points that can come from community contributions
 */
export const COMMUNITY_POINTS_MAX_PERCENTAGE = 30;

/**
 * DTO for approving a contribution
 */
export class ApproveContributionDto {
  /**
   * Points to award (must be within category range)
   */
  pointsAwarded: number;
}

/**
 * DTO for rejecting a contribution
 */
export class RejectContributionDto {
  /**
   * Reason for rejection (min 10 chars)
   */
  reason: string;
}

/**
 * DTO for pending submissions list (admin view)
 */
export class PendingSubmissionsResponseDto {
  submissions: ContributionResponseDto[];
  total: number;
  pendingCount: number;
  limit: number;
  offset: number;
}

/**
 * DTO for approve/reject response
 */
export class ReviewResponseDto {
  submission: ContributionResponseDto;
  pointsAwarded?: number;
  userTotalPoints?: number;
  userCommunityPoints?: number;
  weeklyPointsUsed?: number;
  weeklyPointsRemaining?: number;
}
