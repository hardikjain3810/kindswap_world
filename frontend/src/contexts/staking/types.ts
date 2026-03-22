import { LockTierKey } from "./constants";

export interface StakingStats {
  totalKnsStaked: number;
  totalWeightedStake: bigint;
  avgMultiplier: number;
  activeStakers: number;
  stakersByTier: Record<LockTierKey, number>;
}

export interface UserStakeInfo {
  owner: string;
  active: boolean;
  stakedAmount: number;
  lockTier: LockTierKey;
  multiplier: number;
  startTime: Date;
  lockEndTime: Date;
  weightedStake: bigint;
  poolSharePercent: number;
}

/**
 * User's USDC rewards data
 */
export interface UserRewards {
  /** Unclaimed USDC amount (e.g., 1245.50) */
  unclaimedUsdc: number;
  /** Total USDC claimed historically */
  totalClaimed: number;
  /** Total revenue earned historically (sum of all claims + unclaimed) */
  totalRevenue: number;
  /** Days until next bi-weekly payout (0 = can claim now) */
  nextPayoutDays: number;
}

/**
 * Staking/unstaking history entry
 */
export interface StakingHistoryEntry {
  /** Transaction date */
  date: Date;
  /** Action type: stake or unstake */
  action: "stake" | "unstake";
  /** Amount of KNS tokens */
  amount: number;
  /** Lock period label (e.g., "3 Months") - null for unstake */
  lockPeriod: string | null;
  /** Multiplier value (e.g., 1.5) - null for unstake */
  multiplier: number | null;
  /** Transaction signature for Solscan link */
  txSignature: string;
}

/**
 * User's reward distribution history entry for table display
 */
export interface RewardDistributionHistoryEntry {
  /** Date when reward was claimed */
  date: Date;
  /** Distribution period start date */
  distributionPeriodStart: Date;
  /** Distribution period end date */
  distributionPeriodEnd: Date;
  /** Total USDC reward pool distributed in this period */
  totalRewardPool: number;
  /** User's weighted share percentage (e.g., 0.124 for 0.124%) */
  yourWeightedShare: number;
  /** USDC rewards earned by user in this claim */
  rewardsEarned: number;
  /** Transaction signature for Solscan link */
  txSignature: string;
  /** Block time as unix timestamp */
  blockTime: number;
}

/**
 * User's claim history entry for tracking when they claimed USDC rewards
 */
export interface ClaimHistoryEntry {
  /** Date when user claimed USDC rewards */
  date: Date;
  /** Amount of USDC claimed */
  amountClaimed: number;
  /** Transaction signature for Solscan link */
  txSignature: string;
  /** Block time as unix timestamp */
  blockTime: number;
}
