import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  BadRequestException,
  InternalServerErrorException,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '../services/config.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { AdminPermission } from '../../admin/enums/admin-permission.enum';
import {
  FeeConfigResponseDto,
  FeeTierResponseDto,
  UpdateFeeConfigDto,
  UpdateFeeTierDto,
  FeeCalculationResultDto,
  AdminOperationResponseDto,
  FeeConfigAuditEntryDto,
  FeeTierAuditEntryDto,
} from '../dto/config.dto';

/**
 * ConfigController
 * Handles all fee configuration endpoints
 *
 * Routes:
 * - PUBLIC: GET /api/config/* (no auth required)
 * - ADMIN: PUT /api/admin/config/* (requires JWT authentication & FEE_CONFIG permission)
 *
 * SECURITY: All admin endpoints protected with JwtAuthGuard + permission checks
 */
@Controller('api')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  // ============================================================================
  // PUBLIC ENDPOINTS (No authentication required)
  // ============================================================================

  /**
   * Get current fee configuration
   * GET /api/config/fee-config
   *
   * @returns Current fee configuration with 4-way distribution
   */
  @Get('config/fee-config')
  async getFeeConfig(): Promise<FeeConfigResponseDto> {
    try {
      const config = await this.configService.getFeeConfiguration();

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
      console.error('Error fetching fee configuration:', error);
      throw new InternalServerErrorException('Failed to fetch fee configuration');
    }
  }

  /**
   * Get all active fee tiers
   * GET /api/config/fee-tiers
   *
   * @returns Array of 5 fee tiers ordered by tier order
   */
  @Get('config/fee-tiers')
  async getFeeTiers(): Promise<FeeTierResponseDto[]> {
    try {
      const tiers = await this.configService.getFeeTiers();

      return tiers.map((tier) => ({
        id: tier.id,
        name: tier.name,
        knsMin: tier.knsMin,
        discountPercent: tier.discountPercent,
        effectiveFeeBps: tier.effectiveFeeBps as unknown as number,
        tierOrder: tier.tierOrder,
      }));
    } catch (error) {
      console.error('Error fetching fee tiers:', error);
      throw new InternalServerErrorException('Failed to fetch fee tiers');
    }
  }

  /**
   * Get specific fee tier by ID
   * GET /api/config/fee-tiers/:id
   *
   * @param id - Tier ID (UUID)
   * @returns Fee tier details
   */
  @Get('config/fee-tiers/:id')
  async getFeeTier(@Param('id') id: string): Promise<FeeTierResponseDto> {
    try {
      if (!id || id.length !== 36) {
        throw new BadRequestException('Invalid tier ID format');
      }

      const tier = await this.configService.getTierById(id);

      return {
        id: tier.id,
        name: tier.name,
        knsMin: tier.knsMin,
        discountPercent: tier.discountPercent,
        effectiveFeeBps: tier.effectiveFeeBps as unknown as number,
        tierOrder: tier.tierOrder,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error fetching fee tier:', error);
      throw new InternalServerErrorException('Failed to fetch fee tier');
    }
  }

  /**
   * Calculate fee for given KNS balance
   * GET /api/config/calculate-fee?knsBalance=100000
   *
   * @param knsBalance - KNS balance to calculate fee for
   * @returns Applicable tier and fee information
   */
  @Get('config/calculate-fee')
  async calculateFee(@Query('knsBalance') knsBalance: string): Promise<FeeCalculationResultDto> {
    try {
      if (!knsBalance) {
        throw new BadRequestException('knsBalance query parameter is required');
      }

      const balance = parseInt(knsBalance);
      if (isNaN(balance) || balance < 0) {
        throw new BadRequestException('knsBalance must be a non-negative number');
      }

      const result = await this.configService.calculateFeeForBalance(balance);

      return {
        tier: {
          id: result.tier.id,
          name: result.tier.name,
          knsMin: result.tier.knsMin,
          discountPercent: result.tier.discountPercent,
          effectiveFeeBps: result.tier.effectiveFeeBps as unknown as number,
          tierOrder: result.tier.tierOrder,
        },
        effectiveFeeBps: result.effectiveFeeBps as unknown as number,
        discountPercent: result.discountPercent,
        charityPortion: result.charityPortion as unknown as number,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error calculating fee:', error);
      throw new InternalServerErrorException('Failed to calculate fee');
    }
  }

  // ============================================================================
  // ADMIN ENDPOINTS (Authentication required - TODO)
  // ============================================================================

  /**
   * Update fee configuration
   * PUT /api/admin/config/fee-config
   *
   * @param req - Request with authenticated admin info
   * @param dto - Updated fee configuration values (4-way distribution)
   * @returns Success response
   *
   * SECURITY: Requires JwtAuthGuard authentication + FEE_CONFIG permission
   * RATE LIMIT: 5 requests per minute (stricter limit for critical operation)
   */
  @Put('admin/config/fee-config')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(AdminPermission.FEE_CONFIG)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async updateFeeConfig(
    @Request() req,
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
        throw error;
      }
      console.error('Error updating fee configuration:', error);
      throw new InternalServerErrorException('Failed to update fee configuration');
    }
  }

  /**
   * Update specific fee tier
   * PUT /api/admin/config/fee-tiers/:id
   *
   * @param req - Request with authenticated admin info
   * @param id - Tier ID (UUID)
   * @param dto - Updated tier values
   * @returns Success response
   *
   * SECURITY: Requires JwtAuthGuard authentication + FEE_CONFIG permission
   */
  @Put('admin/config/fee-tiers/:id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(AdminPermission.FEE_CONFIG)
  async updateFeeTier(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateFeeTierDto,
  ): Promise<AdminOperationResponseDto> {
    try {
      if (!id || id.length !== 36) {
        throw new BadRequestException('Invalid tier ID format');
      }

      const adminWallet = req.adminWallet;

      await this.configService.updateFeeTier(
        id,
        dto.name,
        dto.knsMin,
        dto.discountPercent,
        dto.effectiveFeeBps,
        adminWallet,
        dto.changeReason,
      );

      return {
        success: true,
        message: `Fee tier ${id} updated successfully`,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error updating fee tier:', error);
      throw new InternalServerErrorException('Failed to update fee tier');
    }
  }

  /**
   * Get fee configuration audit history
   * GET /api/admin/config/audit-log/fee-config?limit=50
   *
   * @param req - Request with authenticated admin info
   * @param limit - Number of records to return
   * @returns Audit trail of configuration changes (4-way distribution)
   *
   * SECURITY: Requires JwtAuthGuard authentication + FEE_CONFIG permission
   */
  @Get('admin/config/audit-log/fee-config')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(AdminPermission.FEE_CONFIG)
  async getFeeConfigAuditLog(
    @Request() req,
    @Query('limit') limit: string = '50',
  ): Promise<FeeConfigAuditEntryDto[]> {
    try {
      const limitNum = Math.min(parseInt(limit) || 50, 1000);

      const auditEntries = await this.configService.getFeeConfigurationAuditHistory(limitNum);

      return auditEntries.map((entry) => ({
        id: entry.id,
        baseFeeBps: entry.baseFeeBps as unknown as number,
        charityPortion: entry.charityPortion as unknown as number,
        kindswapPortion: entry.kindswapPortion as unknown as number,
        rebatePortion: (entry.rebatePortion ?? 0) as unknown as number,
        stakingPortion: (entry.stakingPortion ?? 0) as unknown as number,
        rebateWallet: entry.rebateWallet ?? '',
        stakingWallet: entry.stakingWallet ?? '',
        changedBy: entry.changedBy,
        changeReason: entry.changeReason,
        changedAt: entry.changedAt,
      }));
    } catch (error) {
      console.error('Error fetching fee config audit log:', error);
      throw new InternalServerErrorException('Failed to fetch audit log');
    }
  }

  /**
   * Get fee tier audit history
   * GET /api/admin/config/audit-log/fee-tiers?tierId=xxx&limit=50
   *
   * @param req - Request with authenticated admin info
   * @param tierId - Optional tier ID to filter by
   * @param limit - Number of records to return
   * @returns Audit trail of tier changes
   *
   * SECURITY: Requires JwtAuthGuard authentication + FEE_CONFIG permission
   */
  @Get('admin/config/audit-log/fee-tiers')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(AdminPermission.FEE_CONFIG)
  async getFeeTierAuditLog(
    @Request() req,
    @Query('tierId') tierId: string,
    @Query('limit') limit: string = '50',
  ): Promise<FeeTierAuditEntryDto[]> {
    try {
      const limitNum = Math.min(parseInt(limit) || 50, 1000);

      const auditEntries = await this.configService.getFeeTierAuditHistory(tierId, limitNum);

      return auditEntries.map((entry) => ({
        id: entry.id,
        tierId: entry.tierId,
        name: entry.name,
        knsMin: entry.knsMin,
        discountPercent: entry.discountPercent,
        effectiveFeeBps: entry.effectiveFeeBps as unknown as number,
        changedBy: entry.changedBy,
        changeReason: entry.changeReason,
        changedAt: entry.changedAt,
      }));
    } catch (error) {
      console.error('Error fetching fee tier audit log:', error);
      throw new InternalServerErrorException('Failed to fetch audit log');
    }
  }

  /**
   * Deactivate a fee tier (soft delete)
   * PUT /api/admin/config/fee-tiers/:id/deactivate
   *
   * @param req - Request with authenticated admin info
   * @param id - Tier ID (UUID)
   * @returns Success response
   *
   * SECURITY: Requires JwtAuthGuard authentication + FEE_CONFIG permission
   */
  @Put('admin/config/fee-tiers/:id/deactivate')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(AdminPermission.FEE_CONFIG)
  async deactivateFeeTier(
    @Request() req,
    @Param('id') id: string,
  ): Promise<AdminOperationResponseDto> {
    try {
      if (!id || id.length !== 36) {
        throw new BadRequestException('Invalid tier ID format');
      }

      const adminWallet = req.adminWallet;

      await this.configService.deactivateTier(id, adminWallet, 'Tier deactivated via API');

      return {
        success: true,
        message: `Fee tier ${id} deactivated successfully`,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error deactivating fee tier:', error);
      throw new InternalServerErrorException('Failed to deactivate fee tier');
    }
  }

  /**
   * Reactivate a fee tier
   * PUT /api/admin/config/fee-tiers/:id/activate
   *
   * @param req - Request with authenticated admin info
   * @param id - Tier ID (UUID)
   * @returns Success response
   *
   * SECURITY: Requires JwtAuthGuard authentication + FEE_CONFIG permission
   */
  @Put('admin/config/fee-tiers/:id/activate')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(AdminPermission.FEE_CONFIG)
  async activateFeeTier(
    @Request() req,
    @Param('id') id: string,
  ): Promise<AdminOperationResponseDto> {
    try {
      if (!id || id.length !== 36) {
        throw new BadRequestException('Invalid tier ID format');
      }

      const adminWallet = req.adminWallet;

      await this.configService.activateTier(id, adminWallet, 'Tier reactivated via API');

      return {
        success: true,
        message: `Fee tier ${id} reactivated successfully`,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error reactivating fee tier:', error);
      throw new InternalServerErrorException('Failed to reactivate fee tier');
    }
  }
}
