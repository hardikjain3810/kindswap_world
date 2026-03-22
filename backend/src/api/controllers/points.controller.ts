import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  BadRequestException,
  InternalServerErrorException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PointsService } from '../services/points.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { AdminPermission } from '../../admin/enums/admin-permission.enum';
import {
  LogSwapDto,
  UserPointsResponseDto,
  LeaderboardResponseDto,
  SwapLogResponseDto,
  AwardCommunityPointsDto,
  AwardCommunityPointsResponseDto,
  SwapTransactionDto,
  SwapHistoryResponseDto,
  PlatformStatsResponseDto,
} from '../dto';
import { isValidSolanaWallet } from '../utils/wallet-validation.util';

@Controller('api')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  /**
   * Log a completed swap
   * POST /api/swap/complete
   */
  @Post('swap/complete')
  async logSwapCompletion(@Body() dto: LogSwapDto): Promise<SwapLogResponseDto> {
    console.log('Received swap log:', dto);
    try {
      // Trim inputs to remove whitespace
      dto.wallet = dto.wallet?.trim();
      dto.signature = dto.signature?.trim();

      // Validate wallet format
      if (!isValidSolanaWallet(dto.wallet)) {
        throw new BadRequestException('Invalid wallet address');
      }

      // Validate signature for successful transactions
      if (dto.status !== 'failed') {
        if (!dto.signature) {
          throw new BadRequestException('Transaction signature is required');
        }

        // Solana signatures are 87-88 characters when base58 encoded
        if (dto.signature.length < 87 || dto.signature.length > 88) {
          throw new BadRequestException(
            `Invalid signature length: ${dto.signature.length} (expected 87-88 characters)`
          );
        }

        // Validate base58 characters
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;
        if (!base58Regex.test(dto.signature)) {
          throw new BadRequestException('Invalid signature format: must be base58 encoded');
        }
      } else {
        // Failed transactions use placeholder signatures
        if (!dto.signature) {
          throw new BadRequestException('Signature is required even for failed transactions');
        }
      }

      const result = await this.pointsService.logSwapCompletion(dto);
      console.log(result, "POINT CHECK");
      return {
        success: true,
        signature: dto.signature,
        pointsAwarded: result.pointsAwarded,
        wallet: dto.wallet,
        feeVerification: result.feeVerification,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Error logging swap:', error);
      throw new InternalServerErrorException('Failed to log swap completion');
    }
  }

  /**
   * Get user's points
   * GET /api/points/:wallet
   */
  @Get('points/:wallet')
  async getUserPoints(@Param('wallet') wallet: string): Promise<UserPointsResponseDto> {
    try {
      if (!isValidSolanaWallet(wallet)) {
        throw new BadRequestException('Invalid wallet address');
      }

      const userPoints = await this.pointsService.getUserPoints(wallet);

      if (!userPoints) {
        return {
          wallet,
          totalPoints: 0,
          swapPoints: 0,
          communityPoints: 0,
          knsPoints: 0,
          totalSwapVolumeUSD: '0',
          totalSwapsCount: 0,
          averageSwapSize: '0',
        };
      }

      return userPoints;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Error fetching user points:', error);
      throw new InternalServerErrorException('Failed to fetch user points');
    }
  }

  /**
   * Get leaderboard with pagination
   * GET /api/leaderboard?timeframe=allTime&limit=10&offset=0
   */
  @Get('leaderboard')
  async getLeaderboard(
    @Query('timeframe') timeframe: 'today' | 'week' | 'allTime' = 'allTime',
    @Query('limit') limit: string = '10',
    @Query('offset') offset: string = '0',
  ): Promise<LeaderboardResponseDto> {
    try {
      const limitNum = Math.min(parseInt(limit) || 10, 100); // Max 100 per page
      const offsetNum = Math.max(parseInt(offset) || 0, 0);

      // Pass timeframe to service for filtered leaderboard with pagination
      const result = await this.pointsService.getLeaderboard(limitNum, timeframe, offsetNum);

      return {
        timeframe,
        top100: result.entries,
        totalUsers: result.total,
        limit: result.limit,
        offset: result.offset,
      };
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      throw new InternalServerErrorException('Failed to fetch leaderboard');
    }
  }

  /**
   * Award community points (admin only)
   * POST /api/community/award
   *
   * SECURITY: Requires JwtAuthGuard authentication + CONTRIBUTIONS permission
   */
  @Post('community/award')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(AdminPermission.CONTRIBUTIONS)
  async awardCommunityPoints(
    @Request() req,
    @Body() dto: AwardCommunityPointsDto,
  ): Promise<AwardCommunityPointsResponseDto> {
    try {
      const adminWallet = req.adminWallet;

      if (!isValidSolanaWallet(dto.wallet)) {
        throw new BadRequestException('Invalid wallet address');
      }

      if (!dto.points || dto.points < 0) {
        throw new BadRequestException('Points must be a positive number');
      }

      if (!dto.reason || dto.reason.length === 0) {
        throw new BadRequestException('Reason is required');
      }

      const result = await this.pointsService.awardCommunityPoints(
        dto.wallet,
        dto.points,
        dto.reason,
      );

      // Log who awarded the points for audit trail
      console.log(`[ADMIN] ${adminWallet} awarded ${dto.points} points to ${dto.wallet}: ${dto.reason}`);

      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Error awarding community points:', error);
      throw new InternalServerErrorException('Failed to award community points');
    }
  }

  /**
   * Get user's swap history
   * GET /api/swaps/:wallet?limit=50&offset=0
   */
  @Get('swaps/:wallet')
  async getSwapHistory(
    @Param('wallet') wallet: string,
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ): Promise<SwapHistoryResponseDto> {
    try {
      if (!isValidSolanaWallet(wallet)) {
        throw new BadRequestException('Invalid wallet address');
      }

      const limitNum = Math.min(parseInt(limit) || 50, 100);
      const offsetNum = Math.max(parseInt(offset) || 0, 0);

      const result = await this.pointsService.getSwapHistory(wallet, limitNum, offsetNum);

      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Error fetching swap history:', error);
      throw new InternalServerErrorException('Failed to fetch swap history');
    }
  }

  /**
   * Get single swap transaction details
   * GET /api/swaps/transaction/:signature
   */
  @Get('swaps/transaction/:signature')
  async getSwapBySignature(@Param('signature') signature: string): Promise<SwapTransactionDto> {
    try {
      if (!signature || signature.length !== 88) {
        throw new BadRequestException('Invalid transaction signature');
      }

      const swap = await this.pointsService.getSwapBySignature(signature);

      if (!swap) {
        throw new BadRequestException('Swap transaction not found');
      }

      return swap;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Error fetching swap transaction:', error);
      throw new InternalServerErrorException('Failed to fetch swap transaction');
    }
  }

  /**
   * Get platform statistics
   * GET /api/stats
   */
  @Get('stats')
  async getPlatformStats(): Promise<PlatformStatsResponseDto> {
    try {
      const stats = await this.pointsService.getPlatformStats();
      return stats;
    } catch (error) {
      console.error('Error fetching platform stats:', error);
      throw new InternalServerErrorException('Failed to fetch platform statistics');
    }
  }

  /**
   * Health check endpoint
   * GET /api/health
   */
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Test Sentry error reporting
   * GET /api/test-sentry
   * Throws a test error to verify Sentry integration
   */
  @Get('test-sentry')
  testSentry() {
    throw new Error('Test Sentry error from PointsController');
  }
}
