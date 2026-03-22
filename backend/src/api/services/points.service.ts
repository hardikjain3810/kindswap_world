import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as Sentry from '@sentry/node';
import { DataSource } from 'typeorm';
import { UserRepository } from '../../database/repositories/user.repository';
import { UserPointsRepository } from '../../database/repositories/user-points.repository';
import { SwapTransactionRepository } from '../../database/repositories/swap-transaction.repository';
import { ContributionSubmissionRepository } from '../../database/repositories/contribution-submission.repository';
import { KnsAwardHistoryRepository } from '../../database/repositories/kns-award-history.repository';
import { ConfigService } from './config.service';
import { TransactionVerificationService } from './transaction-verification.service';
import { LogSwapDto } from '../dto';
import { addSwapBreadcrumb, captureError, setUserContext } from '../../common/sentry.utils';

/**
 * Sentry Cron Monitor configuration for daily swap points reset
 */
const SWAP_DAILY_RESET_MONITOR_SLUG = 'swap-points-daily-reset';
const SWAP_DAILY_RESET_MONITOR_CONFIG = {
  schedule: {
    type: 'crontab' as const,
    value: '59 23 * * *', // 23:59 UTC daily
  },
  timezone: 'UTC',
  checkinMargin: 5, // Alert if job doesn't start within 5 minutes
  maxRuntime: 10, // Alert if job runs longer than 10 minutes
  failureIssueThreshold: 2,
  recoveryThreshold: 1,
};

/**
 * Sentry Cron Monitor configuration for weekly community points reset
 */
const COMMUNITY_WEEKLY_RESET_MONITOR_SLUG = 'community-points-weekly-reset';
const COMMUNITY_WEEKLY_RESET_MONITOR_CONFIG = {
  schedule: {
    type: 'crontab' as const,
    value: '0 0 * * 1', // Every Monday at 00:00 UTC
  },
  timezone: 'UTC',
  checkinMargin: 5,
  maxRuntime: 10,
  failureIssueThreshold: 2,
  recoveryThreshold: 1,
};

// Points system constants
const SWAP_POINTS_MIN_USD = 0.5;
const SWAP_POINTS_DAILY_CAP = 10000;
const COMMUNITY_POINTS_WEEKLY_CAP = 2000;

// Fee verification tolerance (for floating point comparisons)
const FEE_TOLERANCE_BPS = 0.01; // 0.01 bps tolerance
const FEE_TOLERANCE_USD = 0.01; // $0.01 tolerance

/**
 * Fee verification result structure
 */
interface FeeVerificationResult {
  isValid: boolean;
  calculated: {
    tierName: string;
    discountPercent: number;
    effectiveFeeBps: number;
    feeAmountUSD: number;
    charityAmountUSD: number;
    kindswapFeeUSD: number;
  };
  frontend: {
    tierName: string;
    discountPercent: number;
    effectiveFeeBps: number;
    feeAmountUSD: number;
    charityAmountUSD: number;
    kindswapFeeUSD: number;
  };
  mismatches: string[];
}

@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly userPointsRepository: UserPointsRepository,
    private readonly swapTransactionRepository: SwapTransactionRepository,
    private readonly contributionSubmissionRepository: ContributionSubmissionRepository,
    private readonly knsAwardHistoryRepository: KnsAwardHistoryRepository,
    private readonly configService: ConfigService,
    private readonly transactionVerificationService: TransactionVerificationService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Log a swap transaction (success or failure)
   * Points awarding is currently disabled - only stores transaction and user
   * Includes backend fee verification against frontend-provided values
   */
  async logSwapCompletion(dto: LogSwapDto): Promise<{ pointsAwarded: number; feeVerification?: FeeVerificationResult }> {
    console.log('Received swap log:', dto);
    // Validate input
    if (!dto.wallet || !dto.signature) {
      throw new BadRequestException('Wallet and signature are required');
    }

    // Set user context for Sentry error tracking
    setUserContext(dto.wallet);

    // Add breadcrumb for swap initiation
    addSwapBreadcrumb('initiated', {
      wallet: dto.wallet,
      inputToken: dto.inputMint,
      outputToken: dto.outputMint,
      inputAmountUSD: dto.inputAmountUSD,
    });

    try {
      // Ensure user exists (creates if not found)
      await this.userRepository.getOrCreate(dto.wallet);

      // ✅ STEP 1: VERIFY TRANSACTION ON-CHAIN (NEW - prevents fake signatures + amount fraud)
      this.logger.log(`🔍 Verifying transaction on-chain: ${dto.signature.slice(0, 20)}...`);

      const verification = await this.transactionVerificationService.verifySwapTransaction(
        dto.signature,
        dto.wallet,
        dto.inputMint,
        dto.outputMint,
        dto.inputAmountUSD,
        5, // 5% tolerance for price fluctuations
      );

      // If verification failed, reject the request
      if (!verification.isValid) {
        this.logger.warn(
          `❌ Transaction verification failed: ${verification.errorMessage}`,
        );

        // Add breadcrumb for verification failure
        addSwapBreadcrumb('verification_failed', {
          wallet: dto.wallet,
          signature: dto.signature,
          reason: verification.errorMessage,
        });

        throw new BadRequestException(
          `Transaction verification failed: ${verification.errorMessage}`,
        );
      }

      // Log successful verification
      this.logger.log(`✅ Transaction verified on-chain: ${dto.signature.slice(0, 20)}...`);
      addSwapBreadcrumb('verification_passed', {
        wallet: dto.wallet,
        signature: dto.signature,
        actualUSD: verification.swapDetails?.inputAmountUSD,
      });

      // Use verified data from blockchain (overrides frontend values for security)
      const verifiedSwapDetails = verification.swapDetails!;

    // Determine transaction status (from on-chain verification)
    const transactionStatus = verifiedSwapDetails.status;

    // Verify fee calculations from frontend against backend calculations
    const feeVerification = await this.verifyFeeCalculation(dto);

    // Log any fee mismatches for monitoring
    if (!feeVerification.isValid) {
      this.logger.warn(
        `Fee mismatch detected for signature ${dto.signature}: ${JSON.stringify(feeVerification.mismatches)}`,
      );
    }

    // Create swap transaction record (stores all transactions including failed ones)
    // ✅ Use VERIFIED on-chain values for storage (not frontend values)
    await this.swapTransactionRepository.create({
      signature: dto.signature,
      wallet: verifiedSwapDetails.wallet,
      inputMint: verifiedSwapDetails.inputMint,
      outputMint: verifiedSwapDetails.outputMint,
      inputAmount: verifiedSwapDetails.inputAmount,
      outputAmount: verifiedSwapDetails.outputAmount,
      inputDecimals: verifiedSwapDetails.inputDecimals,
      outputDecimals: verifiedSwapDetails.outputDecimals,
      inputAmountUSD: verifiedSwapDetails.inputAmountUSD.toString(),
      outputAmountUSD: verifiedSwapDetails.outputAmountUSD.toString(),
      feeTier: feeVerification.calculated.tierName,
      discountPercent: feeVerification.calculated.discountPercent,
      effectiveFeeBps: feeVerification.calculated.effectiveFeeBps.toString(),
      feeAmountUSD: feeVerification.calculated.feeAmountUSD.toFixed(6),
      charityAmountUSD: feeVerification.calculated.charityAmountUSD.toFixed(6),
      kindswapFeeUSD: feeVerification.calculated.kindswapFeeUSD.toFixed(6),
      routeData: dto.routeData,
      status: transactionStatus,
      slippageBps: dto.slippageBps || 0,
      knsBalanceAtSwap: dto.knsBalanceAtSwap || '0',
      userAgent: dto.userAgent,
      ipAddress: dto.ipAddress,
      errorMessage: dto.errorMessage,
      pointsAwardedAmount: 0,
      pointsAwarded: false,
      verifiedAt: new Date(), // ✅ Timestamp of on-chain verification
    });

    // Only award points for confirmed transactions above minimum ($5 USD)
    // ✅ Use VERIFIED on-chain USD value for points calculation (not frontend value)
    let pointsAwarded = 0;
    const verifiedInputAmountUSD = verifiedSwapDetails.inputAmountUSD;

    if (transactionStatus === 'confirmed' && verifiedInputAmountUSD >= SWAP_POINTS_MIN_USD) {
      const pointsEarned = this.calculateSwapPoints(verifiedInputAmountUSD);

      if (pointsEarned > 0) {
        const userPoints = await this.userPointsRepository.getOrCreate(dto.wallet);
        const pointsAlreadyToday = userPoints.swapPointsToday || 0;

        const pointsCanAward = Math.min(
          pointsEarned,
          SWAP_POINTS_DAILY_CAP - pointsAlreadyToday,
        );

        if (pointsCanAward > 0) {
          await this.userPointsRepository.addSwapPoints(dto.wallet, pointsCanAward);
          // ✅ Use verified USD amount for stats (not frontend value)
          await this.userPointsRepository.updateSwapStats(dto.wallet, verifiedInputAmountUSD);
          await this.swapTransactionRepository.updatePointsAwarded(
            dto.signature,
            true,
            pointsCanAward,
          );

          pointsAwarded = pointsCanAward;
        }
      }
    }

    // Add breadcrumb for swap confirmation
    addSwapBreadcrumb('confirmed', {
      wallet: dto.wallet,
      signature: dto.signature,
    });

    return { pointsAwarded, feeVerification };
    } catch (error) {
      // Add breadcrumb for swap failure
      addSwapBreadcrumb('failed', {
        wallet: dto.wallet,
        signature: dto.signature,
        error: error instanceof Error ? error.message : String(error),
      });

      // Capture error with context
      captureError(error, {
        tags: { service: 'PointsService', method: 'logSwapCompletion' },
        extra: { dto },
      });

      throw error;
    }
  }

  /**
   * Calculate swap points based on USD value
   * Formula: 1 point = $1 USD (minimum $5)
   */
  private calculateSwapPoints(usdValue: number): number {
    if (usdValue < SWAP_POINTS_MIN_USD) {
      return 0;
    }
    return Math.floor(usdValue);
  }

  /**
   * Verify fee calculation from frontend against backend calculations
   * Uses the knsBalanceAtSwap to determine the correct tier and fees
   *
   * FEE SPLIT MODEL:
   * - feeAmountUSD = total fee (effectiveFeeBps applied to inputAmountUSD)
   * - charityAmountUSD = feeAmountUSD × charityPortion (25% of total fee)
   * - kindswapFeeUSD = feeAmountUSD × kindswapPortion (75% of total fee)
   * Example: $100 swap at No Tier (10 bps) → total=$0.10, charity=$0.025, kindswap=$0.075
   */
  private async verifyFeeCalculation(dto: LogSwapDto): Promise<FeeVerificationResult> {
    const mismatches: string[] = [];

    // Get the KNS balance (convert from string to number)
    const knsBalance = parseInt(dto.knsBalanceAtSwap || '0', 10);

    // Calculate expected fee using ConfigService
    const feeCalc = await this.configService.calculateFeeForBalance(knsBalance);
    const feeConfig = await this.configService.getFeeConfiguration();

    // FEE SPLIT MODEL: Total fee is split between charity and kindswap
    // feeAmountUSD = total fee charged to user (effectiveFeeBps)
    // charityAmountUSD = feeAmountUSD × charityPortion (e.g., 25%)
    // kindswapFeeUSD = feeAmountUSD × kindswapPortion (e.g., 75%)
    const inputAmountUSD = dto.inputAmountUSD || 0;
    const charityPortion = feeConfig.charityPortion as unknown as number;
    const kindswapPortion = feeConfig.kindswapPortion as unknown as number;

    // Total fee charged to user (based on tier's effectiveFeeBps)
    const calculatedFeeAmountUSD = (inputAmountUSD * feeCalc.effectiveFeeBps) / 10000;
    // Charity gets charityPortion of total fee (e.g., 25%)
    const calculatedCharityAmountUSD = calculatedFeeAmountUSD * charityPortion;
    // KindSwap gets kindswapPortion of total fee (e.g., 75%)
    const calculatedKindswapFeeUSD = calculatedFeeAmountUSD * kindswapPortion;

    // Build calculated values object
    const calculated = {
      tierName: feeCalc.tier.name,
      discountPercent: feeCalc.discountPercent,
      effectiveFeeBps: feeCalc.effectiveFeeBps,
      feeAmountUSD: calculatedFeeAmountUSD,
      charityAmountUSD: calculatedCharityAmountUSD,
      kindswapFeeUSD: calculatedKindswapFeeUSD,
    };

    // Build frontend values object
    const frontend = {
      tierName: dto.feeTier || 'No Tier',
      discountPercent: dto.discountPercent || 0,
      effectiveFeeBps: dto.effectiveFeeBps || 10,
      feeAmountUSD: dto.feeAmountUSD || 0,
      charityAmountUSD: dto.charityAmountUSD || 0,
      kindswapFeeUSD: dto.kindswapFeeUSD || 0,
    };

    // Compare tier name
    if (calculated.tierName !== frontend.tierName) {
      mismatches.push(
        `Tier mismatch: expected "${calculated.tierName}" (KNS: ${knsBalance}), got "${frontend.tierName}"`,
      );
    }

    // Compare discount percent
    if (calculated.discountPercent !== frontend.discountPercent) {
      mismatches.push(
        `Discount mismatch: expected ${calculated.discountPercent}%, got ${frontend.discountPercent}%`,
      );
    }

    // Compare effective fee BPS (with tolerance)
    if (Math.abs(calculated.effectiveFeeBps - frontend.effectiveFeeBps) > FEE_TOLERANCE_BPS) {
      mismatches.push(
        `EffectiveFeeBps mismatch: expected ${calculated.effectiveFeeBps}, got ${frontend.effectiveFeeBps}`,
      );
    }

    // Compare fee amounts (with tolerance for floating point)
    if (Math.abs(calculated.feeAmountUSD - frontend.feeAmountUSD) > FEE_TOLERANCE_USD) {
      mismatches.push(
        `FeeAmountUSD mismatch: expected $${calculated.feeAmountUSD.toFixed(4)}, got $${frontend.feeAmountUSD.toFixed(4)}`,
      );
    }

    if (Math.abs(calculated.charityAmountUSD - frontend.charityAmountUSD) > FEE_TOLERANCE_USD) {
      mismatches.push(
        `CharityAmountUSD mismatch: expected $${calculated.charityAmountUSD.toFixed(4)}, got $${frontend.charityAmountUSD.toFixed(4)}`,
      );
    }

    if (Math.abs(calculated.kindswapFeeUSD - frontend.kindswapFeeUSD) > FEE_TOLERANCE_USD) {
      mismatches.push(
        `KindswapFeeUSD mismatch: expected $${calculated.kindswapFeeUSD.toFixed(4)}, got $${frontend.kindswapFeeUSD.toFixed(4)}`,
      );
    }

    return {
      isValid: mismatches.length === 0,
      calculated,
      frontend,
      mismatches,
    };
  }

  /**
   * Get user's current points
   */
  async getUserPoints(wallet: string) {
    const userPoints = await this.userPointsRepository.findByWallet(wallet);

    if (!userPoints) {
      return null;
    }

    return {
      wallet,
      totalPoints: userPoints.totalPoints,
      swapPoints: userPoints.swapPoints,
      communityPoints: userPoints.communityPoints,
      knsPoints: userPoints.knsPoints,
      currentRank: userPoints.currentRank,
      totalSwapVolumeUSD: userPoints.totalSwapVolumeUSD,
      totalSwapsCount: userPoints.totalSwapsCount,
      averageSwapSize: userPoints.averageSwapSize,
    };
  }

  /**
   * Award community points (admin endpoint)
   */
  async awardCommunityPoints(wallet: string, points: number, reason: string) {
    if (points < 0) {
      throw new BadRequestException('Points must be positive');
    }

    // Ensure user exists
    await this.userRepository.getOrCreate(wallet);

    const userPoints = await this.userPointsRepository.getOrCreate(wallet);
    const pointsThisWeek = userPoints.communityPointsThisWeek || 0;

    if (pointsThisWeek + points > COMMUNITY_POINTS_WEEKLY_CAP) {
      throw new BadRequestException(
        `Weekly community points cap is ${COMMUNITY_POINTS_WEEKLY_CAP}. Already awarded: ${pointsThisWeek}`,
      );
    }

    const updated = await this.userPointsRepository.addCommunityPoints(wallet, points);

    return {
      success: true,
      wallet,
      pointsAwarded: points,
      totalCommunityPoints: updated.communityPoints,
      reason,
    };
  }

  /**
   * Get leaderboard with pagination support
   * Uses optimized stored procedure for single DB round-trip
   */
  async getLeaderboard(
    limit: number = 10,
    timeframe: 'today' | 'week' | 'allTime' = 'allTime',
    offset: number = 0,
  ): Promise<{
    entries: Array<{
      rank: number;
      wallet: string;
      totalPoints: number;
      swapPoints: number;
      communityPoints: number;
      knsPoints: number;
    }>;
    total: number;
    limit: number;
    offset: number;
  }> {
    try {
      // Call stored procedures for leaderboard data and total count
      const [result, countResult] = await Promise.all([
        this.dataSource.query(
          'SELECT * FROM get_leaderboard($1, $2, $3)',
          [timeframe, limit, offset]
        ),
        this.dataSource.query(
          'SELECT get_leaderboard_count($1)',
          [timeframe]
        ),
      ]);

      const total = countResult[0]?.get_leaderboard_count || 0;

      // Map results to expected format with proper rank calculation
      const entries = result.map((entry: any, index: number) => ({
        rank: offset + index + 1,
        wallet: entry.wallet,
        totalPoints: parseInt(entry.total_points) || 0,
        swapPoints: parseInt(entry.swap_points) || 0,
        communityPoints: parseInt(entry.community_points) || 0,
        knsPoints: parseInt(entry.kns_points) || 0,
      }));

      return {
        entries,
        total,
        limit,
        offset,
      };
    } catch (error) {
      this.logger.error('Error fetching leaderboard from stored procedure:', error);

      // Fallback to old implementation if stored procedure fails
      this.logger.warn('Falling back to legacy leaderboard implementation');
      return this.getLeaderboardLegacy(limit, timeframe, offset);
    }
  }

  /**
   * Legacy leaderboard implementation (fallback)
   * Kept for backwards compatibility in case stored procedure fails
   */
  private async getLeaderboardLegacy(
    limit: number = 10,
    timeframe: 'today' | 'week' | 'allTime' = 'allTime',
    offset: number = 0,
  ) {
    // For allTime, use the optimized query that returns only needed fields
    // This prevents any N+1 queries by using explicit SELECT (no relations loaded)
    if (timeframe === 'allTime') {
      const allEntries = await this.userPointsRepository.getAllRanked(10000); // Get all for sorting
      const total = allEntries.length;
      const paginatedEntries = allEntries.slice(offset, offset + limit);

      const entries = paginatedEntries.map((entry, index) => ({
        rank: offset + index + 1,
        wallet: entry.wallet,
        totalPoints: Number(entry.totalPoints) || 0,
        swapPoints: Number(entry.swapPoints) || 0,
        communityPoints: Number(entry.communityPoints) || 0,
        knsPoints: Number(entry.knsPoints) || 0,
      }));

      return {
        entries,
        total,
        limit,
        offset,
      };
    }

    // For today/week, aggregate from individual transaction tables
    const [swapPoints, communityPoints, knsPoints] = await Promise.all([
      this.swapTransactionRepository.getSwapPointsByTimeframe(timeframe, 1000),
      this.contributionSubmissionRepository.getCommunityPointsByTimeframe(timeframe, 1000),
      this.knsAwardHistoryRepository.getKnsPointsByTimeframe(timeframe, 1000),
    ]);

    // Combine all points by wallet
    const walletPointsMap = new Map<string, {
      wallet: string;
      swapPoints: number;
      communityPoints: number;
      knsPoints: number;
      totalPoints: number;
    }>();

    // Add swap points
    for (const entry of swapPoints) {
      const points = parseInt(String(entry.swapPoints)) || 0;
      walletPointsMap.set(entry.wallet, {
        wallet: entry.wallet,
        swapPoints: points,
        communityPoints: 0,
        knsPoints: 0,
        totalPoints: points,
      });
    }

    // Add community points
    for (const entry of communityPoints) {
      const points = parseInt(String(entry.communityPoints)) || 0;
      const existing = walletPointsMap.get(entry.wallet);
      if (existing) {
        existing.communityPoints = points;
        existing.totalPoints += points;
      } else {
        walletPointsMap.set(entry.wallet, {
          wallet: entry.wallet,
          swapPoints: 0,
          communityPoints: points,
          knsPoints: 0,
          totalPoints: points,
        });
      }
    }

    // Add KNS points
    for (const entry of knsPoints) {
      const points = parseInt(String(entry.knsPoints)) || 0;
      const existing = walletPointsMap.get(entry.wallet);
      if (existing) {
        existing.knsPoints = points;
        existing.totalPoints += points;
      } else {
        walletPointsMap.set(entry.wallet, {
          wallet: entry.wallet,
          swapPoints: 0,
          communityPoints: 0,
          knsPoints: points,
          totalPoints: points,
        });
      }
    }

    // Sort by total points and apply pagination
    const sortedAll = Array.from(walletPointsMap.values())
      .sort((a, b) => b.totalPoints - a.totalPoints);

    const total = sortedAll.length;
    const paginatedEntries = sortedAll.slice(offset, offset + limit);

    const entries = paginatedEntries.map((entry, index) => ({
      rank: offset + index + 1,
      wallet: entry.wallet,
      totalPoints: entry.totalPoints,
      swapPoints: entry.swapPoints,
      communityPoints: entry.communityPoints,
      knsPoints: entry.knsPoints,
    }));

    return {
      entries,
      total,
      limit,
      offset,
    };
  }

  /**
   * Reset daily swap points counters (scheduled job)
   * Runs at 23:59 UTC daily (just before KNS distribution at 00:05)
   * Wrapped with Sentry Cron Monitor for observability
   * OPTIMIZED: Uses single batch UPDATE query instead of N+1 queries
   */
  @Cron('59 23 * * *') // 23:59 UTC daily
  async resetDailyCounters() {
    return await Sentry.withMonitor(
      SWAP_DAILY_RESET_MONITOR_SLUG,
      async () => {
        const affectedCount = await this.userPointsRepository.batchResetDailySwapCounters();
        this.logger.log(`[Scheduler] Reset daily swap counters for ${affectedCount} users`);
        return affectedCount;
      },
      SWAP_DAILY_RESET_MONITOR_CONFIG,
    );
  }

  /**
   * Reset weekly community points counters (scheduled job)
   * Runs every Monday at 00:00 UTC
   * Wrapped with Sentry Cron Monitor for observability
   * OPTIMIZED: Uses single batch UPDATE query instead of N+1 queries
   */
  @Cron('0 0 * * 1') // Every Monday at 00:00 UTC
  async resetWeeklyCounters() {
    return await Sentry.withMonitor(
      COMMUNITY_WEEKLY_RESET_MONITOR_SLUG,
      async () => {
        const affectedCount = await this.userPointsRepository.batchResetWeeklyCounters();
        this.logger.log(`[Scheduler] Reset weekly community counters for ${affectedCount} users`);
        return affectedCount;
      },
      COMMUNITY_WEEKLY_RESET_MONITOR_CONFIG,
    );
  }

  /**
   * Get user's swap history
   */
  async getSwapHistory(wallet: string, limit: number = 50, offset: number = 0) {
    const swaps = await this.swapTransactionRepository.findByWallet(wallet, limit, offset);
    const total = await this.swapTransactionRepository.countByWallet(wallet);

    return {
      wallet,
      swaps: swaps.map((swap) => ({
        signature: swap.signature,
        wallet: swap.wallet,
        inputMint: swap.inputMint,
        outputMint: swap.outputMint,
        inputAmount: swap.inputAmount,
        outputAmount: swap.outputAmount,
        inputAmountUSD: swap.inputAmountUSD,
        outputAmountUSD: swap.outputAmountUSD,
        inputDecimals: swap.inputDecimals,
        outputDecimals: swap.outputDecimals,
        feeTier: swap.feeTier,
        discountPercent: swap.discountPercent,
        effectiveFeeBps: parseFloat(swap.effectiveFeeBps),
        feeAmountUSD: swap.feeAmountUSD,
        charityAmountUSD: swap.charityAmountUSD,
        kindswapFeeUSD: swap.kindswapFeeUSD,
        pointsAwarded: swap.pointsAwardedAmount,
        status: swap.status,
        executedAt: swap.executedAt,
        createdAt: swap.createdAt,
      })),
      total,
      limit,
      offset,
    };
  }

  /**
   * Get single swap by signature
   */
  async getSwapBySignature(signature: string) {
    const swap = await this.swapTransactionRepository.findBySignature(signature);

    if (!swap) {
      return null;
    }

    return {
      signature: swap.signature,
      wallet: swap.wallet,
      inputMint: swap.inputMint,
      outputMint: swap.outputMint,
      inputAmount: swap.inputAmount,
      outputAmount: swap.outputAmount,
      inputAmountUSD: swap.inputAmountUSD,
      outputAmountUSD: swap.outputAmountUSD,
      inputDecimals: swap.inputDecimals,
      outputDecimals: swap.outputDecimals,
      feeTier: swap.feeTier,
      discountPercent: swap.discountPercent,
      effectiveFeeBps: parseFloat(swap.effectiveFeeBps),
      feeAmountUSD: swap.feeAmountUSD,
      charityAmountUSD: swap.charityAmountUSD,
      kindswapFeeUSD: swap.kindswapFeeUSD,
      pointsAwarded: swap.pointsAwardedAmount,
      status: swap.status,
      executedAt: swap.executedAt,
      createdAt: swap.createdAt,
    };
  }

  /**
   * Get platform statistics
   */
  async getPlatformStats() {
    const totalSwaps = await this.swapTransactionRepository.countTotal();
    const confirmedSwaps = await this.swapTransactionRepository.countConfirmed();
    const totalVolumeUSD = await this.swapTransactionRepository.getTotalVolume();
    const totalUsersCount = await this.userRepository.count();

    return {
      totalSwaps,
      confirmedSwaps,
      totalVolumeUSD,
      totalUsersCount,
    };
  }
}
