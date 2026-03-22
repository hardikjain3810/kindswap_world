export { LogSwapDto } from './log-swap.dto';
export {
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
} from './contribution.dto';

/**
 * User points response DTO
 */
export class UserPointsResponseDto {
  wallet: string;
  totalPoints: number;
  swapPoints: number;
  communityPoints: number;
  knsPoints: number;
  currentRank?: number;
  totalSwapVolumeUSD: string;
  totalSwapsCount: number;
  averageSwapSize: string;
}

/**
 * Leaderboard entry DTO
 */
export class LeaderboardEntryDto {
  rank: number;
  wallet: string;
  totalPoints: number;
  swapPoints: number;
  communityPoints: number;
  knsPoints: number;
}

/**
 * Leaderboard response DTO with pagination
 */
export class LeaderboardResponseDto {
  timeframe: 'today' | 'week' | 'allTime';
  top100: LeaderboardEntryDto[]; // Keep same name for backward compatibility
  totalUsers: number;
  limit?: number; // Optional for backward compatibility
  offset?: number; // Optional for backward compatibility
}

/**
 * Calculated fee values DTO
 */
export class CalculatedFeeDto {
  tierName: string;
  discountPercent: number;
  effectiveFeeBps: number;
  feeAmountUSD: number;
  charityAmountUSD: number;
  kindswapFeeUSD: number;
}

/**
 * Fee verification result DTO
 */
export class FeeVerificationDto {
  isValid: boolean;
  calculated: CalculatedFeeDto;
  frontend: CalculatedFeeDto;
  mismatches: string[];
}

/**
 * Swap log response DTO
 */
export class SwapLogResponseDto {
  success: boolean;
  signature: string;
  pointsAwarded: number;
  wallet: string;
  feeVerification?: FeeVerificationDto;
}

/**
 * Community points award DTO
 */
export class AwardCommunityPointsDto {
  wallet: string;
  points: number;
  reason: string;
}

/**
 * Community points award response DTO
 */
export class AwardCommunityPointsResponseDto {
  success: boolean;
  wallet: string;
  pointsAwarded: number;
  totalCommunityPoints: number;
}

/**
 * Single swap transaction DTO (for history/details)
 */
export class SwapTransactionDto {
  signature: string;
  wallet: string;
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
  inputAmountUSD: string;
  outputAmountUSD: string;
  inputDecimals: number;
  outputDecimals: number;
  feeTier: string;
  discountPercent: number;
  effectiveFeeBps: number;
  feeAmountUSD: string;
  charityAmountUSD: string;
  kindswapFeeUSD: string;
  pointsAwarded: number;
  status: string;
  executedAt: Date;
  createdAt: Date;
}

/**
 * Swap history response DTO
 */
export class SwapHistoryResponseDto {
  wallet: string;
  swaps: SwapTransactionDto[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Platform stats response DTO
 */
export class PlatformStatsResponseDto {
  totalSwaps: number;
  confirmedSwaps: number;
  totalVolumeUSD: string;
  totalUsersCount: number;
}
