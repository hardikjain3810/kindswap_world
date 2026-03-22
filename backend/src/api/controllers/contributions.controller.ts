import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { AdminPermission } from '../../admin/enums/admin-permission.enum';
import {
  ContributionSubmissionRepository,
  WEEKLY_CATEGORY_LIMITS,
} from '../../database/repositories/contribution-submission.repository';
import { UserRepository } from '../../database/repositories/user.repository';
import { UserPointsRepository } from '../../database/repositories/user-points.repository';
import {
  ContributionCategory,
  SubmissionStatus,
} from '../../database/entities/contribution-submission.entity';
import {
  SubmitContributionDto,
  ContributionResponseDto,
  ContributionListResponseDto,
  SubmissionLimitsResponseDto,
  WeeklyLimitsDto,
  ApproveContributionDto,
  RejectContributionDto,
  PendingSubmissionsResponseDto,
  ReviewResponseDto,
  ADMIN_POINTS_RANGES,
  COMMUNITY_POINTS_WEEKLY_CAP,
  COMMUNITY_POINTS_MAX_PERCENTAGE,
} from '../dto';
import { isValidSolanaWallet } from '../utils/wallet-validation.util';

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate contribution category
 */
function isValidCategory(category: string): category is ContributionCategory {
  return Object.values(ContributionCategory).includes(category as ContributionCategory);
}

@Controller('api')
export class ContributionsController {
  private readonly logger = new Logger(ContributionsController.name);

  constructor(
    private readonly contributionRepository: ContributionSubmissionRepository,
    private readonly userRepository: UserRepository,
    private readonly userPointsRepository: UserPointsRepository,
  ) {}

  /**
   * Submit a new contribution
   * POST /api/contributions/submit
   */
  @Post('contributions/submit')
  async submitContribution(
    @Body() dto: SubmitContributionDto,
  ): Promise<ContributionResponseDto> {
    try {
      // Validate wallet format
      if (!dto.wallet || !isValidSolanaWallet(dto.wallet)) {
        throw new BadRequestException('Invalid wallet address');
      }

      // Validate content URL
      if (!dto.contentLink || !isValidUrl(dto.contentLink)) {
        throw new BadRequestException('Invalid content URL');
      }

      // Validate category
      if (!dto.category || !isValidCategory(dto.category)) {
        throw new BadRequestException(
          `Invalid category. Must be one of: ${Object.values(ContributionCategory).join(', ')}`,
        );
      }

      // Validate description length if provided
      if (dto.description && dto.description.length > 500) {
        throw new BadRequestException('Description must be 500 characters or less');
      }

      // Check for duplicate content link
      const isDuplicate = await this.contributionRepository.existsByWalletAndLink(
        dto.wallet,
        dto.contentLink,
      );
      if (isDuplicate) {
        throw new BadRequestException('This content has already been submitted');
      }

      // Check weekly limit for this category
      const hasReachedLimit = await this.contributionRepository.hasReachedWeeklyLimit(
        dto.wallet,
        dto.category,
      );
      if (hasReachedLimit) {
        const limit = this.contributionRepository.getWeeklyLimit(dto.category);
        throw new BadRequestException(
          `Weekly limit reached for this category (${limit} per week)`,
        );
      }

      // Ensure user exists (creates if not)
      await this.userRepository.getOrCreate(dto.wallet);

      // Create the submission
      const submission = await this.contributionRepository.create({
        wallet: dto.wallet,
        contentLink: dto.contentLink,
        category: dto.category,
        description: dto.description,
      });

      // TODO: Send email notification to contributions@kindswap.world
      // For now, log to console as placeholder
      console.log(`[EMAIL] New contribution from ${dto.wallet}: ${dto.category}`);
      console.log(`[EMAIL] Content: ${dto.contentLink}`);

      return this.mapToResponseDto(submission);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Error submitting contribution:', error);
      throw new InternalServerErrorException('Failed to submit contribution');
    }
  }

  /**
   * Get user's contributions
   * GET /api/contributions/:wallet
   */
  @Get('contributions/:wallet')
  async getUserContributions(
    @Param('wallet') wallet: string,
    @Query('limit') limit: string = '20',
    @Query('offset') offset: string = '0',
  ): Promise<ContributionListResponseDto> {
    try {
      // Validate wallet format
      if (!isValidSolanaWallet(wallet)) {
        throw new BadRequestException('Invalid wallet address');
      }

      const limitNum = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
      const offsetNum = Math.max(parseInt(offset) || 0, 0);

      const { submissions, total } = await this.contributionRepository.findByWallet(
        wallet,
        limitNum,
        offsetNum,
      );

      return {
        submissions: submissions.map(s => this.mapToResponseDto(s)),
        total,
        limit: limitNum,
        offset: offsetNum,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Error fetching contributions:', error);
      throw new InternalServerErrorException('Failed to fetch contributions');
    }
  }

  /**
   * Get a single submission by ID
   * GET /api/contributions/submission/:id
   */
  @Get('contributions/submission/:id')
  async getSubmissionById(
    @Param('id') id: string,
  ): Promise<ContributionResponseDto> {
    try {
      const submission = await this.contributionRepository.findById(id);

      if (!submission) {
        throw new BadRequestException('Submission not found');
      }

      return this.mapToResponseDto(submission);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Error fetching submission:', error);
      throw new InternalServerErrorException('Failed to fetch submission');
    }
  }

  /**
   * Get weekly submission limits for a wallet
   * GET /api/contributions/:wallet/limits
   */
  @Get('contributions/:wallet/limits')
  async getSubmissionLimits(
    @Param('wallet') wallet: string,
  ): Promise<SubmissionLimitsResponseDto> {
    try {
      // Validate wallet format
      if (!isValidSolanaWallet(wallet)) {
        throw new BadRequestException('Invalid wallet address');
      }

      const limits: WeeklyLimitsDto[] = [];

      // Get limits for each category
      for (const category of Object.values(ContributionCategory)) {
        const limit = WEEKLY_CATEGORY_LIMITS[category];
        const remaining = await this.contributionRepository.getRemainingSubmissions(
          wallet,
          category,
        );
        const used = limit - remaining;

        limits.push({
          category,
          limit,
          used,
          remaining,
        });
      }

      // Calculate week start (Monday 00:00:00 UTC)
      const now = new Date();
      const dayOfWeek = now.getUTCDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(now);
      weekStart.setUTCDate(now.getUTCDate() - daysToMonday);
      weekStart.setUTCHours(0, 0, 0, 0);

      return {
        wallet,
        weekStartDate: weekStart,
        limits,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Error fetching submission limits:', error);
      throw new InternalServerErrorException('Failed to fetch submission limits');
    }
  }

  /**
   * Map entity to response DTO
   */
  private mapToResponseDto(submission: any): ContributionResponseDto {
    return {
      id: submission.id,
      wallet: submission.wallet,
      contentLink: submission.contentLink,
      category: submission.category,
      description: submission.description || null,
      status: submission.status,
      pointsAwarded: submission.pointsAwarded || null,
      rejectionReason: submission.rejectionReason || null,
      reviewedBy: submission.reviewedBy || null,
      reviewedAt: submission.reviewedAt || null,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
    };
  }

  // ============================================
  // Admin Endpoints
  // ============================================

  /**
   * Verify if wallet is an admin
   * GET /api/v1/admin/verify
   * Returns 200 if admin, 403 if not
   */
  @Get('v1/admin/verify')
  @UseGuards(JwtAuthGuard)
  async verifyAdmin(@Req() req: Request): Promise<{ isAdmin: boolean; wallet: string }> {
    const adminWallet = (req as any).adminWallet;
    this.logger.log(`[verifyAdmin] Admin verified: ${adminWallet}`);
    return {
      isAdmin: true,
      wallet: adminWallet,
    };
  }

  /**
   * Get all pending contributions for review
   * GET /api/v1/admin/contributions/pending
   * Requires CONTRIBUTIONS permission
   */
  @Get('v1/admin/contributions/pending')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(AdminPermission.CONTRIBUTIONS)
  async getPendingContributions(
    @Req() req: Request,
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ): Promise<PendingSubmissionsResponseDto> {
    try {
      const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
      const offsetNum = Math.max(parseInt(offset) || 0, 0);

      const { submissions, total } = await this.contributionRepository.findPending(
        limitNum,
        offsetNum,
      );
      const pendingCount = await this.contributionRepository.countPending();

      return {
        submissions: submissions.map(s => this.mapToResponseDto(s)),
        total,
        pendingCount,
        limit: limitNum,
        offset: offsetNum,
      };
    } catch (error) {
      console.error('Error fetching pending contributions:', error);
      throw new InternalServerErrorException('Failed to fetch pending contributions');
    }
  }

  /**
   * Get all approved contributions
   * GET /api/v1/admin/contributions/approved
   * Requires CONTRIBUTIONS permission
   */
  @Get('v1/admin/contributions/approved')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(AdminPermission.CONTRIBUTIONS)
  async getApprovedContributions(
    @Req() req: Request,
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ): Promise<PendingSubmissionsResponseDto> {
    try {
      const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
      const offsetNum = Math.max(parseInt(offset) || 0, 0);

      const { submissions, total } = await this.contributionRepository.findApproved(
        limitNum,
        offsetNum,
      );
      const pendingCount = await this.contributionRepository.countPending();

      return {
        submissions: submissions.map(s => this.mapToResponseDto(s)),
        total,
        pendingCount,
        limit: limitNum,
        offset: offsetNum,
      };
    } catch (error) {
      console.error('Error fetching approved contributions:', error);
      throw new InternalServerErrorException('Failed to fetch approved contributions');
    }
  }

  /**
   * Get all rejected contributions
   * GET /api/v1/admin/contributions/rejected
   * Requires CONTRIBUTIONS permission
   */
  @Get('v1/admin/contributions/rejected')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(AdminPermission.CONTRIBUTIONS)
  async getRejectedContributions(
    @Req() req: Request,
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ): Promise<PendingSubmissionsResponseDto> {
    try {
      const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
      const offsetNum = Math.max(parseInt(offset) || 0, 0);

      const { submissions, total } = await this.contributionRepository.findRejected(
        limitNum,
        offsetNum,
      );
      const pendingCount = await this.contributionRepository.countPending();

      return {
        submissions: submissions.map(s => this.mapToResponseDto(s)),
        total,
        pendingCount,
        limit: limitNum,
        offset: offsetNum,
      };
    } catch (error) {
      console.error('Error fetching rejected contributions:', error);
      throw new InternalServerErrorException('Failed to fetch rejected contributions');
    }
  }

  /**
   * Approve a contribution and award points
   * POST /api/v1/admin/contributions/:id/approve
   * Requires CONTRIBUTIONS permission
   */
  @Post('v1/admin/contributions/:id/approve')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(AdminPermission.CONTRIBUTIONS)
  async approveContribution(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: ApproveContributionDto,
  ): Promise<ReviewResponseDto> {
    const adminWallet = (req as any).adminWallet;
    try {

      // Validate points
      if (!dto.pointsAwarded || typeof dto.pointsAwarded !== 'number' || dto.pointsAwarded <= 0) {
        throw new BadRequestException('Points must be a positive number');
      }

      // Get the submission
      const submission = await this.contributionRepository.findById(id);
      if (!submission) {
        throw new BadRequestException('Submission not found');
      }

      if (submission.status !== SubmissionStatus.PENDING) {
        throw new BadRequestException('Submission has already been reviewed');
      }

      // Validate points within category range
      const pointsRange = ADMIN_POINTS_RANGES[submission.category];
      if (dto.pointsAwarded < pointsRange.min || dto.pointsAwarded > pointsRange.max) {
        throw new BadRequestException(
          `Points must be between ${pointsRange.min} and ${pointsRange.max} for ${submission.category}`,
        );
      }

      // Get user points to check caps
      const userPoints = await this.userPointsRepository.getOrCreate(submission.wallet);

      // Check weekly cap (2000 community points/week)
      const weeklyPointsUsed = await this.contributionRepository.getApprovedPointsThisWeek(
        submission.wallet,
      );
      const weeklyRemaining = COMMUNITY_POINTS_WEEKLY_CAP - weeklyPointsUsed;

      if (dto.pointsAwarded > weeklyRemaining) {
        throw new BadRequestException(
          `Weekly cap exceeded. User has ${weeklyRemaining} community points remaining this week (cap: ${COMMUNITY_POINTS_WEEKLY_CAP})`,
        );
      }

      // Check 30% cap (community points <= 30% of total points)
      // Only enforce after user has at least 1000 total points to allow new users to earn community points
      const MIN_POINTS_FOR_CAP_ENFORCEMENT = 1000;
      const projectedCommunityPoints = userPoints.communityPoints + dto.pointsAwarded;
      const projectedTotalPoints = userPoints.totalPoints + dto.pointsAwarded;

      if (projectedTotalPoints >= MIN_POINTS_FOR_CAP_ENFORCEMENT) {
        const projectedPercentage = (projectedCommunityPoints / projectedTotalPoints) * 100;

        if (projectedPercentage > COMMUNITY_POINTS_MAX_PERCENTAGE) {
          throw new BadRequestException(
            `Community points cap exceeded. Would be ${projectedPercentage.toFixed(1)}% of total (max: ${COMMUNITY_POINTS_MAX_PERCENTAGE}%)`,
          );
        }
      }

      // Update submission status
      const updatedSubmission = await this.contributionRepository.updateStatus(
        id,
        SubmissionStatus.APPROVED,
        {
          pointsAwarded: dto.pointsAwarded,
          reviewedBy: adminWallet,
        },
      );

      // Award community points
      const updatedUserPoints = await this.userPointsRepository.addCommunityPoints(
        submission.wallet,
        dto.pointsAwarded,
      );

      console.log(`[ADMIN] Approved contribution ${id} from ${submission.wallet}: +${dto.pointsAwarded} points (${submission.category})`);

      return {
        submission: this.mapToResponseDto(updatedSubmission),
        pointsAwarded: dto.pointsAwarded,
        userTotalPoints: updatedUserPoints.totalPoints,
        userCommunityPoints: updatedUserPoints.communityPoints,
        weeklyPointsUsed: weeklyPointsUsed + dto.pointsAwarded,
        weeklyPointsRemaining: weeklyRemaining - dto.pointsAwarded,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Error approving contribution:', error);
      throw new InternalServerErrorException('Failed to approve contribution');
    }
  }

  /**
   * Reject a contribution
   * POST /api/v1/admin/contributions/:id/reject
   * Requires CONTRIBUTIONS permission
   */
  @Post('v1/admin/contributions/:id/reject')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(AdminPermission.CONTRIBUTIONS)
  async rejectContribution(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: RejectContributionDto,
  ): Promise<ReviewResponseDto> {
    const adminWallet = (req as any).adminWallet;
    try {
      // Validate rejection reason
      if (!dto.reason || typeof dto.reason !== 'string' || dto.reason.length < 10) {
        throw new BadRequestException('Rejection reason must be at least 10 characters');
      }

      // Get the submission
      const submission = await this.contributionRepository.findById(id);
      if (!submission) {
        throw new BadRequestException('Submission not found');
      }

      if (submission.status !== SubmissionStatus.PENDING) {
        throw new BadRequestException('Submission has already been reviewed');
      }

      // Update submission status
      const updatedSubmission = await this.contributionRepository.updateStatus(
        id,
        SubmissionStatus.REJECTED,
        {
          rejectionReason: dto.reason,
          reviewedBy: adminWallet,
        },
      );

      console.log(`[ADMIN] Rejected contribution ${id} from ${submission.wallet}: ${dto.reason.substring(0, 50)}...`);

      return {
        submission: this.mapToResponseDto(updatedSubmission),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Error rejecting contribution:', error);
      throw new InternalServerErrorException('Failed to reject contribution');
    }
  }
}
