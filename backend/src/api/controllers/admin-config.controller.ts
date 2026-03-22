import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { AdminPermission } from '../../admin/enums/admin-permission.enum';
import { ConfigService } from '../services/config.service';
import { UpdateFeeConfigDto, AdminOperationResponseDto, FeeConfigResponseDto } from '../dto/config.dto';

/**
 * Admin Config Controller
 *
 * Handles admin fee configuration endpoints under /api/v1/admin/config
 * All endpoints require admin authentication via JwtAuthGuard.
 */
@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard)
export class AdminConfigController {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Get current fee configuration (Admin only)
   * GET /api/v1/admin/config/fee-config
   *
   * Returns full fee configuration with 4-way distribution
   * Requires FEE_CONFIG permission
   */
  @Get('config/fee-config')
  @RequirePermission(AdminPermission.FEE_CONFIG)
  @HttpCode(HttpStatus.OK)
  async getFeeConfig(): Promise<FeeConfigResponseDto> {
    try {
      const config = await this.configService.getFeeConfiguration();

      if (!config) {
        throw new NotFoundException('Fee configuration not found');
      }

      return {
        baseFeeBps: config.baseFeeBps as unknown as number,
        charityPortion: config.charityPortion as unknown as number,
        kindswapPortion: config.kindswapPortion as unknown as number,
        rebatePortion: (config.rebatePortion ?? 0) as unknown as number,
        stakingPortion: (config.stakingPortion ?? 0) as unknown as number,
        platformWallet: config.platformWallet,
        charityWallet: config.charityWallet,
        rebateWallet: config.rebateWallet ?? '',
        stakingWallet: config.stakingWallet ?? '',
        updatedAt: config.updatedAt,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('[AdminConfigController] Error fetching fee configuration:', error);
      throw new InternalServerErrorException('Failed to fetch fee configuration');
    }
  }

  /**
   * Update fee configuration (Admin only)
   * PUT /api/v1/admin/config/fee-config
   *
   * Allows updating fee percentages and wallet addresses
   * Supports 4-way fee distribution: charity, platform, rebate, staking
   * Requires FEE_CONFIG permission
   *
   * Validation:
   * - All 4 portions must sum to 1.0 (±0.0001 tolerance)
   * - Each portion must be 0.0 to 1.0
   * - Wallet addresses must be valid Solana addresses (32-44 chars, base58)
   *
   * Error Responses:
   * - 400: Invalid portion sum or wallet addresses
   * - 404: Fee configuration not found
   * - 500: Internal server error
   */
  @Put('config/fee-config')
  @RequirePermission(AdminPermission.FEE_CONFIG)
  @HttpCode(HttpStatus.OK)
  async updateFeeConfig(
    @Request() req: any,
    @Body() dto: UpdateFeeConfigDto,
  ): Promise<AdminOperationResponseDto> {
    try {
      const adminWallet = req.adminWallet;

      await this.configService.updateFeeConfiguration(
        dto.baseFeeBps,
        dto.charityPortion,
        dto.kindswapPortion,
        dto.rebatePortion,
        dto.stakingPortion,
        dto.platformWallet,
        dto.charityWallet,
        dto.rebateWallet,
        dto.stakingWallet,
        adminWallet,
        dto.changeReason,
      );

      return {
        success: true,
        message: 'Fee configuration updated successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        // Validation errors from service (portion sum, invalid wallets, etc.)
        throw error;
      }
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('[AdminConfigController] Error updating fee configuration:', error);
      throw new InternalServerErrorException(
        'Failed to update fee configuration. Please try again later.'
      );
    }
  }
}
