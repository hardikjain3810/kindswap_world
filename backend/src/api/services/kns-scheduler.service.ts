import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as Sentry from '@sentry/node';
import { KnsBalanceService } from './kns-balance.service';
import { HeliusRpcService } from './helius-rpc.service';
import { KnsAwardHistoryRepository } from '../../database/repositories/kns-award-history.repository';
import { UserPointsRepository } from '../../database/repositories/user-points.repository';

/**
 * Sentry Cron Monitor configuration for KNS daily distribution
 */
const KNS_DAILY_MONITOR_SLUG = 'kns-daily-points-distribution';
const KNS_DAILY_MONITOR_CONFIG = {
  schedule: {
    type: 'crontab' as const,
    value: '5 0 * * *', // 00:05 UTC daily
  },
  timezone: 'UTC',
  // Alert if job doesn't start within 10 minutes of scheduled time
  checkinMargin: 10,
  // Alert if job runs longer than 180 minutes (3 hours)
  // Increased from 60 to handle large wallet counts with TWAB calculations
  maxRuntime: 180,
  // Number of consecutive failures before alerting
  failureIssueThreshold: 2,
  // Number of consecutive successes before resolving alert
  recoveryThreshold: 1,
};

// Batch processing configuration
const BATCH_SIZE = 100; // Process 100 wallets concurrently (increased from 10 for fast path optimization)
const PROGRESS_LOG_INTERVAL = 100; // Log progress every 100 wallets

/**
 * KNS Scheduler Service
 * Runs daily cron job to award KNS holding points
 *
 * Schedule: Every day at 00:05 UTC
 * - Fetches ALL KNS token holders from Helius RPC
 * - Calculates TWAB (Time-Weighted Average Balance) for each holder
 * - Awards points based on tier (0, 50, 150, 300, or 500 points)
 * - Records award in history table
 *
 * TWAB prevents gaming:
 * - Wallets with no transfers in 24h: TWAB = current balance
 * - Wallets with transfers: TWAB = time-weighted average over 24h
 */
@Injectable()
export class KnsSchedulerService {
  private readonly logger = new Logger(KnsSchedulerService.name);
  private isProcessing = false;

  constructor(
    private readonly knsBalanceService: KnsBalanceService,
    private readonly heliusRpcService: HeliusRpcService,
    private readonly knsAwardHistoryRepo: KnsAwardHistoryRepository,
    private readonly userPointsRepo: UserPointsRepository,
  ) {}

  /**
   * Daily KNS holding points distribution
   * Runs at 00:05 UTC every day
   * Wrapped with Sentry Cron Monitor for observability
   */
  @Cron('5 0 * * *') // 00:05 UTC daily
  async processDaily() {
    if (this.isProcessing) {
      this.logger.warn('KNS points distribution already in progress, skipping');
      return;
    }

    // Wrap the entire job with Sentry Cron Monitor
    await Sentry.withMonitor(
      KNS_DAILY_MONITOR_SLUG,
      async () => {
        await this.executeDistribution();
      },
      KNS_DAILY_MONITOR_CONFIG,
    );
  }

  /**
   * Core distribution logic - extracted for reuse and testability
   * Now uses bulk database operations for 100x performance improvement
   */
  private async executeDistribution(): Promise<{
    successCount: number;
    skipCount: number;
    errorCount: number;
    totalPointsAwarded: number;
  }> {
    this.isProcessing = true;
    const today = new Date();
    const startTime = Date.now();
    this.logger.log(`Starting daily KNS points distribution for ${today.toISOString()}`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    let totalPointsAwarded = 0;

    try {
      // Get all wallets that should be processed (with balance data)
      const { wallets, balancesMap } = await this.getWalletsToProcess();
      this.logger.log(`Found ${wallets.length} total KNS holders from Helius RPC`);

      if (wallets.length === 0) {
        this.logger.log('No wallets to process');
        return { successCount, skipCount, errorCount, totalPointsAwarded };
      }

      // Filter out wallets with balance < 10,000 KNS (they get 0 points, so no need to process)
      const eligibleWallets = wallets.filter((wallet) => {
        const balance = balancesMap.get(wallet) || 0;
        return balance >= 10000;
      });
      this.logger.log(
        `${eligibleWallets.length} wallets have >= 10k KNS (eligible for points), ` +
          `${wallets.length - eligibleWallets.length} wallets skipped (< 10k KNS)`,
      );

      if (eligibleWallets.length === 0) {
        this.logger.log('No eligible wallets to process (all balances < 10k KNS)');
        return { successCount, skipCount, errorCount, totalPointsAwarded };
      }

      // Filter out wallets already processed today
      const unprocessedWallets = await this.knsAwardHistoryRepo.getWalletsNotProcessedToday(
        eligibleWallets,
        today,
      );
      this.logger.log(`${unprocessedWallets.length} eligible wallets not yet processed today`);

      if (unprocessedWallets.length === 0) {
        this.logger.log('All eligible wallets already processed today');
        return { successCount, skipCount, errorCount, totalPointsAwarded };
      }

      // Process wallets in batches - BULK OPERATIONS PHASE
      const totalWallets = unprocessedWallets.length;
      this.logger.log(`Processing ${totalWallets} wallets in batches of ${BATCH_SIZE}...`);

      // Accumulators for bulk operations
      const allAwardRecords: any[] = [];
      const allPointsUpdates = new Map<string, number>();

      for (let i = 0; i < totalWallets; i += BATCH_SIZE) {
        const batch = unprocessedWallets.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(totalWallets / BATCH_SIZE);

        // Process batch concurrently
        const batchPromises = batch.map(async (wallet) => {
          try {
            const currentBalance = balancesMap.get(wallet);
            const twabResult = await this.knsBalanceService.calculateTimeWeightedAverageBalance(
              wallet,
              currentBalance,
            );
            return { wallet, twabResult, error: null };
          } catch (error) {
            this.logger.error(`Failed to calculate TWAB for ${wallet}: ${error}`);
            return { wallet, twabResult: null, error };
          }
        });

        const batchResults = await Promise.all(batchPromises);

        // Collect results for bulk operations
        for (const { wallet, twabResult, error } of batchResults) {
          if (error) {
            errorCount++;
            // Create error record individually (errors are rare)
            try {
              await this.knsAwardHistoryRepo.createErrorRecord(
                wallet,
                today,
                error instanceof Error ? error.message : 'Unknown error',
              );
            } catch (recordError) {
              this.logger.error(`Failed to record error for ${wallet}: ${recordError}`);
            }
            continue;
          }

          if (twabResult && twabResult.pointsEarned > 0) {
            // Add to bulk operation buffers
            allAwardRecords.push({
              wallet: twabResult.wallet,
              awardDate: this.toDateOnly(today),
              currentBalance: twabResult.currentBalance.toString(),
              timeWeightedAverageBalance: twabResult.timeWeightedAverageBalance.toString(),
              tierName: twabResult.tierName,
              pointsAwarded: twabResult.pointsEarned,
              transferCount: twabResult.transferCount,
              periodStart: twabResult.periodStart.toString(),
              periodEnd: twabResult.periodEnd.toString(),
              status: 'success',
            });

            allPointsUpdates.set(wallet, twabResult.pointsEarned);
            successCount++;
            totalPointsAwarded += twabResult.pointsEarned;
          } else {
            skipCount++;
          }
        }

        // Log progress at intervals
        if (i % PROGRESS_LOG_INTERVAL === 0 || i + BATCH_SIZE >= totalWallets) {
          const processed = Math.min(i + BATCH_SIZE, totalWallets);
          const percentage = ((processed / totalWallets) * 100).toFixed(1);
          this.logger.log(
            `Progress: ${processed}/${totalWallets} wallets (${percentage}%) | ` +
              `Batch ${batchNumber}/${totalBatches} | ` +
              `Success: ${successCount}, Skipped: ${skipCount}, Errors: ${errorCount}`,
          );
        }

        // Small delay between batches to respect Helius RPC rate limits
        // Skip delay after last batch
        if (i + BATCH_SIZE < totalWallets) {
          await this.delay(500); // 500ms between batches
        }
      }

      // BULK DATABASE OPERATIONS (replaces N individual operations)
      this.logger.log(`Starting bulk database operations...`);

      // Ensure all wallets exist (creates missing user_points records)
      const walletsNeedingPoints = Array.from(allPointsUpdates.keys());
      if (walletsNeedingPoints.length > 0) {
        await this.userPointsRepo.ensureWalletsExist(walletsNeedingPoints);
      }

      // Bulk insert award records
      if (allAwardRecords.length > 0) {
        await this.knsAwardHistoryRepo.bulkInsertAwardRecords(allAwardRecords);
        this.logger.log(`✓ Bulk inserted ${allAwardRecords.length} award records`);
      }

      // Bulk update points
      if (allPointsUpdates.size > 0) {
        await this.userPointsRepo.bulkAddKNSPoints(allPointsUpdates);
        this.logger.log(`✓ Bulk updated ${allPointsUpdates.size} user points`);
      }

      const duration = Math.floor((Date.now() - startTime) / 1000 / 60); // minutes
      this.logger.log(
        `KNS points distribution complete in ${duration} minutes: ` +
          `${successCount} success, ${skipCount} skipped, ${errorCount} errors. ` +
          `Total points awarded: ${totalPointsAwarded}`,
      );

      // Alert if approaching timeout
      if (duration > 120) {
        this.logger.warn(
          `⚠️ Job took ${duration} minutes - approaching timeout threshold (180 min)`,
        );
      }

      return { successCount, skipCount, errorCount, totalPointsAwarded };
    } catch (error) {
      this.logger.error(`KNS points distribution failed: ${error}`);
      // Re-throw to mark the cron monitor as failed
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Convert Date to date-only (strip time)
   * Used for consistent date comparison in database
   */
  private toDateOnly(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Get list of wallets that should be processed for KNS points
   * Fetches ALL KNS holders from Helius RPC with their balances
   * Returns both wallet addresses and a map of balances
   */
  private async getWalletsToProcess(): Promise<{
    wallets: string[];
    balancesMap: Map<string, number>;
  }> {
    try {
      // Fetch all KNS holders from Helius RPC
      this.logger.log('Fetching all KNS holders from Helius RPC...');
      const holders = await this.heliusRpcService.getAllKNSHolders();
      this.logger.log(`Fetched ${holders.length} KNS holders from Helius RPC`);

      // Build balance map (wallet -> balance)
      const balancesMap = new Map<string, number>();
      for (const holder of holders) {
        balancesMap.set(holder.owner, holder.balance);
      }

      // Return unique wallet addresses with their balances
      const wallets = holders.map((h) => h.owner);
      return {
        wallets: [...new Set(wallets)], // Remove duplicates if any
        balancesMap,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch holders from Helius RPC: ${error}`);
      this.logger.warn('Falling back to database wallets...');

      // Fallback: Get wallets from database if Helius RPC fails
      const allRanked = await this.userPointsRepo.getAllRanked(10000);
      return {
        wallets: allRanked.map((up) => up.wallet),
        balancesMap: new Map(), // No balance data in fallback mode
      };
    }
  }

  /**
   * Manual trigger for testing (can be called via API)
   * Also wrapped with Sentry Cron Monitor for visibility
   */
  async triggerManualDistribution(): Promise<{
    walletsProcessed: number;
    pointsAwarded: number;
    errors: number;
  }> {
    if (this.isProcessing) {
      throw new Error('Distribution already in progress');
    }

    this.logger.log('Manual KNS distribution triggered');

    // Use Sentry.withMonitor for manual triggers as well (for visibility)
    const result = await Sentry.withMonitor(
      KNS_DAILY_MONITOR_SLUG,
      async () => {
        return await this.executeDistribution();
      },
      KNS_DAILY_MONITOR_CONFIG,
    );

    return {
      walletsProcessed: result.successCount + result.skipCount,
      pointsAwarded: result.totalPointsAwarded,
      errors: result.errorCount,
    };
  }

  /**
   * Check processing status
   */
  getProcessingStatus(): { isProcessing: boolean } {
    return { isProcessing: this.isProcessing };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
