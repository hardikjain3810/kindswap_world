// Business Logic: Fee Discounts & Points System
// Source of Truth: LEADERBOARD, POINTS & KNS BALANCE-BASED FEE DISCOUNT — FULL SPEC

export interface FeeDiscountTier {
  name: "No Tier" | "Tier 1" | "Tier 2" | "Tier 3" | "Tier 4";
  knsMin: number;
  discount: number; // percentage (0, 5, 10, 15, 20)
  effectiveFeeBps: number; // basis points (10.0, 9.5, 9.0, 8.5, 8.0)
}

export interface FeeCalculation {
  tier: FeeDiscountTier;
  baseFeeBesBps: number;
  discountPercent: number;
  effectiveFeeBps: number;
  isEligible: boolean;
}

export interface PointsCalculation {
  swapPoints: number;
  communityPoints: number;
  knsPoints: number;
  totalPoints: number;
  earnedThisSwap: number;
  dailySwapCapRemaining: number;
}

// ============================================
// FEE DISCOUNT TIERS (Section 8.2)
// ============================================

const FEE_TIERS: FeeDiscountTier[] = [
  { name: "No Tier", knsMin: 0, discount: 0, effectiveFeeBps: 1000 },
  { name: "Tier 1", knsMin: 5000, discount: 5, effectiveFeeBps: 950 },
  { name: "Tier 2", knsMin: 25000, discount: 10, effectiveFeeBps: 900 },
  { name: "Tier 3", knsMin: 100000, discount: 15, effectiveFeeBps: 850 },
  { name: "Tier 4", knsMin: 500000, discount: 20, effectiveFeeBps: 800 },
];

const BASE_FEE_BPS = 1000; // 10 bps = 0.10%
const CHARITY_PORTION = 0.5; // 50% of fee goes to charity (0.05% of total)

/**
 * Calculate fee discount based on KNS balance
 * (Section 8.3: Balance checked at swap execution time)
 */
export function calculateFeeDiscount(knsBalance: number): FeeCalculation {
  // Find highest eligible tier (Tier 4 first, then Tier 3, etc.)
  let tier = FEE_TIERS[0]; // Default to "No Tier"

  for (let i = FEE_TIERS.length - 1; i >= 0; i--) {
    if (knsBalance >= FEE_TIERS[i].knsMin) {
      tier = FEE_TIERS[i];
      break;
    }
  }

  return {
    tier,
    baseFeeBesBps: BASE_FEE_BPS,
    discountPercent: tier.discount,
    effectiveFeeBps: tier.effectiveFeeBps,
    isEligible: knsBalance >= 5000, // Minimum for any discount
  };
}

/**
 * Calculate fee amounts for a swap
 */
export function calculateFeeAmounts(
  outputAmount: number,
  effectiveFeeBps: number
): {
  totalFeeBps: number;
  totalFeeAmount: number;
  charityFeeAmount: number;
  kindswapFeeAmount: number;
  netOutputAmount: number;
} {
  const totalFeeAmount = (outputAmount * effectiveFeeBps) / 10000;
  const charityFeeAmount = totalFeeAmount * CHARITY_PORTION;
  const kindswapFeeAmount = totalFeeAmount - charityFeeAmount;
  const netOutputAmount = outputAmount - totalFeeAmount;

  return {
    totalFeeBps: effectiveFeeBps,
    totalFeeAmount,
    charityFeeAmount,
    kindswapFeeAmount,
    netOutputAmount,
  };
}

// ============================================
// SWAP USAGE POINTS (Section 3)
// ============================================

const SWAP_POINTS_MIN_USD = 5; // Minimum $5 for points (3.2)
const SWAP_POINTS_DAILY_CAP = 10000; // Max 10,000 points per day (3.3)

/**
 * Calculate swap points earned
 * Base: 1 point = $1 USD swapped
 * Min: $5 minimum
 * Cap: 10,000 per day per wallet (3.3)
 */
export function calculateSwapPoints(
  swapUsdValue: number,
  alreadyEarnedToday: number = 0
): { points: number; capped: boolean } {
  // Check minimum (3.2)
  if (swapUsdValue < SWAP_POINTS_MIN_USD) {
    return { points: 0, capped: false };
  }

  // Calculate remaining capacity for today
  const remainingCapacity = Math.max(0, SWAP_POINTS_DAILY_CAP - alreadyEarnedToday);

  // Award points, capped by daily limit
  const points = Math.min(Math.floor(swapUsdValue), remainingCapacity);
  const isCapped = points < Math.floor(swapUsdValue);

  return { points, capped: isCapped };
}

// ============================================
// KNS HOLDING POINTS (Section 5)
// ============================================

interface KNSPointsBracket {
  balanceMin: number;
  balanceMax: number;
  pointsPerDay: number;
}

const KNS_HOLDING_BRACKETS: KNSPointsBracket[] = [
  { balanceMin: 0, balanceMax: 9999, pointsPerDay: 0 },
  { balanceMin: 10000, balanceMax: 49999, pointsPerDay: 50 },
  { balanceMin: 50000, balanceMax: 99999, pointsPerDay: 150 },
  { balanceMin: 100000, balanceMax: 249999, pointsPerDay: 300 },
  { balanceMin: 250000, balanceMax: Infinity, pointsPerDay: 500 }, // MAX
];

/**
 * Calculate daily KNS holding points
 * (Section 5.1: Daily accrual based on average balance)
 */
export function calculateKNSHoldingPoints(knsBalance: number): number {
  for (const bracket of KNS_HOLDING_BRACKETS) {
    if (knsBalance >= bracket.balanceMin && knsBalance <= bracket.balanceMax) {
      return bracket.pointsPerDay;
    }
  }
  return 0; // Fallback (should never reach here)
}

/**
 * Get KNS holding points tier description
 */
export function getKNSHoldingTierDescription(knsBalance: number): string {
  const points = calculateKNSHoldingPoints(knsBalance);
  if (points === 0) return "No KNS holding";
  if (points === 50) return "10,000 - 49,999 KNS";
  if (points === 150) return "50,000 - 99,999 KNS";
  if (points === 300) return "100,000 - 249,999 KNS";
  if (points === 500) return "250,000+ KNS (MAX)";
  return "Unknown";
}

// ============================================
// COMMUNITY CONTRIBUTION POINTS (Section 4)
// ============================================

const COMMUNITY_POINTS_WEEKLY_CAP = 2000;
const COMMUNITY_POINTS_MAX_PERCENT_OF_TOTAL = 0.3; // 30%

/**
 * Validate community points against caps
 */
export function validateCommunityPoints(
  earnedThisWeek: number,
  totalWalletPoints: number
): { valid: boolean; reason?: string } {
  // Cap 1: 2,000 per week
  if (earnedThisWeek > COMMUNITY_POINTS_WEEKLY_CAP) {
    return { valid: false, reason: "Weekly community points cap (2,000) exceeded" };
  }

  // Cap 2: ≤ 30% of total points
  const communityPercent = earnedThisWeek / (totalWalletPoints || 1);
  if (communityPercent > COMMUNITY_POINTS_MAX_PERCENT_OF_TOTAL) {
    return { valid: false, reason: "Community points exceed 30% of total points" };
  }

  return { valid: true };
}

// ============================================
// TOTAL POINTS FORMULA (Section 6)
// ============================================

/**
 * Calculate total effective points
 * Total = Swap Points + Community Points + KNS Holding Points
 * (No multipliers in Phase-1, fully additive)
 */
export function calculateTotalPoints(
  swapPoints: number,
  communityPoints: number,
  knsPoints: number
): number {
  return swapPoints + communityPoints + knsPoints;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format fee for display
 */
export function formatFeeForDisplay(feeBps: number): string {
  return (feeBps / 100).toFixed(2) + "%";
}

/**
 * Get tier description with discount info
 */
export function getTierDescription(tier: FeeDiscountTier): string {
  if (tier.discount === 0) return "No KNS discount";
  return `${tier.discount}% KNS holder discount`;
}

/**
 * Get tier label for display in UI
 */
export function getTierLabel(tier: FeeDiscountTier): string {
  if (tier.name === "No Tier") return "KNS holder discount available";
  return `${tier.name} - ${tier.discount}% discount`;
}

/**
 * Check if a balance qualifies for any discount
 */
export function qualifiesForDiscount(knsBalance: number): boolean {
  return knsBalance >= 5000;
}

/**
 * Get next tier threshold and requirement
 */
export function getNextTierInfo(
  knsBalance: number
): { nextTier: FeeDiscountTier | null; needed: number } {
  const currentTierIndex = FEE_TIERS.findIndex(t => knsBalance >= t.knsMin);

  if (currentTierIndex === -1 || currentTierIndex === FEE_TIERS.length - 1) {
    return { nextTier: null, needed: 0 }; // Already at max or no tier
  }

  const nextTier = FEE_TIERS[currentTierIndex + 1];
  const needed = Math.max(0, nextTier.knsMin - knsBalance);

  return { nextTier, needed };
}

/**
 * Calculate progress to next tier (for UI progress bars)
 */
export function calculateTierProgress(knsBalance: number): {
  currentTier: FeeDiscountTier;
  currentProgress: number; // 0-1
  nextTier: FeeDiscountTier | null;
  knsNeeded: number;
} {
  // Find current tier
  let currentTier = FEE_TIERS[0];
  for (let i = FEE_TIERS.length - 1; i >= 0; i--) {
    if (knsBalance >= FEE_TIERS[i].knsMin) {
      currentTier = FEE_TIERS[i];
      break;
    }
  }

  // Get next tier
  const currentTierIndex = FEE_TIERS.indexOf(currentTier);
  const nextTier = currentTierIndex < FEE_TIERS.length - 1 ? FEE_TIERS[currentTierIndex + 1] : null;

  // Calculate progress
  if (!nextTier) {
    return { currentTier, currentProgress: 1, nextTier: null, knsNeeded: 0 };
  }

  const tierRange = nextTier.knsMin - currentTier.knsMin;
  const currentBalance = knsBalance - currentTier.knsMin;
  const progress = Math.min(1, Math.max(0, currentBalance / tierRange));

  return {
    currentTier,
    currentProgress: progress,
    nextTier,
    knsNeeded: Math.max(0, nextTier.knsMin - knsBalance),
  };
}

/**
 * Export all fee tiers for display
 */
export function getAllFeeTiers(): FeeDiscountTier[] {
  return [...FEE_TIERS];
}
