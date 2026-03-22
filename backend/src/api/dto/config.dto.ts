/**
 * Fee Configuration Response DTO
 * Returned by GET /api/config/fee-config
 */
export class FeeConfigResponseDto {
  /**
   * Base fee in basis points (10.0 = 0.10%)
   */
  baseFeeBps: number;

  /**
   * Portion of fee going to charity (0.25 = 25%)
   */
  charityPortion: number;

  /**
   * Portion of fee going to platform (0.50 = 50%)
   */
  kindswapPortion: number;

  /**
   * Portion of fee going to rebates (0.15 = 15%)
   */
  rebatePortion: number;

  /**
   * Portion of fee going to staking (0.10 = 10%)
   */
  stakingPortion: number;

  /**
   * Platform fee wallet address (Solana address)
   */
  platformWallet: string;

  /**
   * Charity fee wallet address (Solana address)
   */
  charityWallet: string;

  /**
   * Rebate wallet address (Solana address)
   */
  rebateWallet: string;

  /**
   * Staking wallet address (Solana address)
   */
  stakingWallet: string;

  /**
   * When configuration was last updated
   */
  updatedAt: Date;
}

/**
 * Fee Tier Response DTO
 * Individual tier in GET /api/config/fee-tiers response
 */
export class FeeTierResponseDto {
  /**
   * Unique tier identifier (UUID)
   */
  id: string;

  /**
   * Tier name ("No Tier", "Tier 1", "Tier 2", "Tier 3", "Tier 4")
   */
  name: string;

  /**
   * Minimum KNS balance required for this tier
   */
  knsMin: string;

  /**
   * Discount percentage (0, 5, 10, 15, 20)
   */
  discountPercent: number;

  /**
   * Effective fee in basis points (10.0, 9.5, 9.0, 8.5, 8.0)
   */
  effectiveFeeBps: number;

  /**
   * Tier order for sorting (0-4)
   */
  tierOrder: number;
}

/**
 * List of Fee Tiers Response DTO
 * Returned by GET /api/config/fee-tiers
 */
export class FeeTiersListResponseDto {
  tiers: FeeTierResponseDto[];
}

import { IsOptional, IsNumber, Min, Max, IsString } from 'class-validator';
import { ValidatePortionsSum } from './validate-portions-sum.validator';

/**
 * Update Fee Configuration DTO
 * Request body for PUT /api/admin/config/fee-config
 *
 * Validates that all 4 portions sum to 1.0 (100%)
 */
export class UpdateFeeConfigDto {
  /**
   * New base fee in basis points (optional)
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  baseFeeBps?: number;

  /**
   * New charity portion (optional, 0.0 to 1.0)
   * Must sum with other portions to 1.0
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @ValidatePortionsSum()
  charityPortion?: number;

  /**
   * New kindswap portion (optional, 0.0 to 1.0)
   * Must sum with other portions to 1.0
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  kindswapPortion?: number;

  /**
   * New rebate portion (optional, 0.0 to 1.0)
   * Must sum with other portions to 1.0
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  rebatePortion?: number;

  /**
   * New staking portion (optional, 0.0 to 1.0)
   * Must sum with other portions to 1.0
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  stakingPortion?: number;

  /**
   * Platform fee wallet address (optional, must be valid Solana address)
   */
  @IsOptional()
  @IsString()
  platformWallet?: string;

  /**
   * Charity fee wallet address (optional, must be valid Solana address)
   */
  @IsOptional()
  @IsString()
  charityWallet?: string;

  /**
   * Rebate wallet address (optional, must be valid Solana address)
   */
  @IsOptional()
  @IsString()
  rebateWallet?: string;

  /**
   * Staking wallet address (optional, must be valid Solana address)
   */
  @IsOptional()
  @IsString()
  stakingWallet?: string;

  /**
   * Reason for change (optional)
   */
  @IsOptional()
  @IsString()
  changeReason?: string;
}

/**
 * Update Fee Tier DTO
 * Request body for PUT /api/admin/config/fee-tiers/:id
 */
export class UpdateFeeTierDto {
  /**
   * New tier name (optional)
   */
  name?: string;

  /**
   * New minimum KNS balance (optional)
   */
  knsMin?: string;

  /**
   * New discount percent (optional)
   */
  discountPercent?: number;

  /**
   * New effective fee BPS (optional)
   */
  effectiveFeeBps?: number;

  /**
   * Reason for change (optional)
   */
  changeReason?: string;
}

/**
 * Fee Calculation Result DTO
 * Returned when calculating fee for specific KNS balance
 */
export class FeeCalculationResultDto {
  /**
   * Applicable tier details
   */
  tier: FeeTierResponseDto;

  /**
   * Effective fee in basis points
   */
  effectiveFeeBps: number;

  /**
   * Discount percentage applied
   */
  discountPercent: number;

  /**
   * Charity portion of fee
   */
  charityPortion: number;
}

/**
 * Audit Log Entry Response DTO
 * Fee configuration change
   */
export class FeeConfigAuditEntryDto {
  /**
   * Unique audit entry ID
   */
  id: string;

  /**
   * Base fee at time of change
   */
  baseFeeBps: number;

  /**
   * Charity portion at time of change
   */
  charityPortion: number;

  /**
   * Kindswap portion at time of change
   */
  kindswapPortion: number;

  /**
   * Rebate portion at time of change
   */
  rebatePortion: number;

  /**
   * Staking portion at time of change
   */
  stakingPortion: number;

  /**
   * Rebate wallet at time of change
   */
  rebateWallet: string;

  /**
   * Staking wallet at time of change
   */
  stakingWallet: string;

  /**
   * Admin who made change
   */
  changedBy: string;

  /**
   * Reason for change
   */
  changeReason: string;

  /**
   * When change was made
   */
  changedAt: Date;
}

/**
 * Audit Log Entry Response DTO
 * Fee tier change
 */
export class FeeTierAuditEntryDto {
  /**
   * Unique audit entry ID
   */
  id: string;

  /**
   * Tier ID that changed
   */
  tierId: string;

  /**
   * Tier name at time of change
   */
  name: string;

  /**
   * KNS minimum at time of change
   */
  knsMin: string;

  /**
   * Discount percent at time of change
   */
  discountPercent: number;

  /**
   * Effective fee BPS at time of change
   */
  effectiveFeeBps: number;

  /**
   * Admin who made change
   */
  changedBy: string;

  /**
   * Reason for change
   */
  changeReason: string;

  /**
   * When change was made
   */
  changedAt: Date;
}

/**
 * Success Response DTO
 * Generic success response for admin operations
 */
export class AdminOperationResponseDto {
  /**
   * Operation succeeded
   */
  success: boolean;

  /**
   * Optional message
   */
  message?: string;
}
