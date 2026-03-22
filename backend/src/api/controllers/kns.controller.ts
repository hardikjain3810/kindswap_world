import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { KnsSchedulerService } from '../services/kns-scheduler.service';
import { KnsAwardHistoryRepository } from '../../database/repositories/kns-award-history.repository';
import { isValidSolanaWallet } from '../utils/wallet-validation.util';

@Controller('api/kns')
export class KnsController {
  constructor(
    private readonly knsSchedulerService: KnsSchedulerService,
    private readonly knsAwardHistoryRepo: KnsAwardHistoryRepository,
  ) {}

  /**
   * Manually trigger KNS points distribution
   * POST /api/kns/distribute
   *
   * TODO: Add admin authentication middleware
   */
  @Post('distribute')
  async triggerDistribution() {
    try {
      const result = await this.knsSchedulerService.triggerManualDistribution();

      return {
        success: true,
        message: 'KNS points distribution completed',
        ...result,
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'Distribution already in progress') {
        throw new BadRequestException('Distribution already in progress');
      }

      console.error('Error triggering KNS distribution:', error);
      throw new InternalServerErrorException('Failed to trigger KNS distribution');
    }
  }

  /**
   * Get distribution status
   * GET /api/kns/status
   */
  @Get('status')
  getStatus() {
    return this.knsSchedulerService.getProcessingStatus();
  }

  /**
   * Get KNS award history for a wallet
   * GET /api/kns/history/:wallet
   */
  @Get('history/:wallet')
  async getWalletHistory(
    @Param('wallet') wallet: string,
    @Query('limit') limit: string = '30',
    @Query('offset') offset: string = '0',
  ) {
    try {
      if (!isValidSolanaWallet(wallet)) {
        throw new BadRequestException('Invalid wallet address');
      }

      const limitNum = Math.min(parseInt(limit) || 30, 100);
      const offsetNum = Math.max(parseInt(offset) || 0, 0);

      const { records, total } = await this.knsAwardHistoryRepo.getAwardHistoryForWallet(
        wallet,
        limitNum,
        offsetNum,
      );

      return {
        wallet,
        records: records.map((r) => ({
          date: r.awardDate,
          currentBalance: r.currentBalance,
          twab: r.timeWeightedAverageBalance,
          tier: r.tierName,
          pointsAwarded: r.pointsAwarded,
          transferCount: r.transferCount,
          status: r.status,
        })),
        total,
        limit: limitNum,
        offset: offsetNum,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Error fetching KNS history:', error);
      throw new InternalServerErrorException('Failed to fetch KNS history');
    }
  }

  /**
   * Get KNS distribution stats for today
   * GET /api/kns/stats/today
   */
  @Get('stats/today')
  async getTodayStats() {
    try {
      const today = new Date();
      const awards = await this.knsAwardHistoryRepo.getAwardsForDate(today);

      const successCount = awards.filter((a) => a.status === 'success').length;
      const skippedCount = awards.filter((a) => a.status === 'skipped').length;
      const errorCount = awards.filter((a) => a.status === 'error').length;
      const totalPoints = awards
        .filter((a) => a.status === 'success')
        .reduce((sum, a) => sum + a.pointsAwarded, 0);

      return {
        date: today.toISOString().split('T')[0],
        walletsProcessed: awards.length,
        successCount,
        skippedCount,
        errorCount,
        totalPointsAwarded: totalPoints,
      };
    } catch (error) {
      console.error('Error fetching KNS stats:', error);
      throw new InternalServerErrorException('Failed to fetch KNS stats');
    }
  }
}
