// Mock Backend API
// This simulates backend endpoints for points logging and leaderboard
// In production, replace these with real API calls

export interface SwapCompletionPayload {
  wallet: string;
  swapUsdValue: number;
  signature: string;
  timestamp: number;
}

export interface SwapCompletionResponse {
  pointsEarned: number;
  newTotalPoints: number;
  message: string;
}

export interface UserPointsResponse {
  wallet: string;
  swapPoints: number;
  communityPoints: number;
  knsPoints: number;
  totalPoints: number;
  rank: number | null; // null if outside top 100
  lastUpdated: number;
}

export interface LeaderboardEntry {
  rank: number;
  wallet: string;
  totalPoints: number;
  swapPoints: number;
  communityPoints: number;
  knsPoints: number;
}

export interface LeaderboardResponse {
  timeframe: "today" | "week" | "allTime";
  top100: LeaderboardEntry[];
  userRank?: LeaderboardEntry;
  lastUpdated: number;
}

// ============================================
// MOCK DATA (In-memory storage for Phase 1)
// ============================================

// Mock leaderboard data
const MOCK_LEADERBOARD: Record<string, UserPointsResponse> = {
  "7dTp9ZYsmV8Ry4Wkk3XkP3R4mJ5kL6": {
    wallet: "7dTp9ZYsmV8Ry4Wkk3XkP3R4mJ5kL6",
    swapPoints: 85200,
    communityPoints: 15230,
    knsPoints: 25000,
    totalPoints: 125430,
    rank: 1,
    lastUpdated: Date.now(),
  },
  "9kN2mP8vL5sR3tQ1xW4yZ6uB7fA": {
    wallet: "9kN2mP8vL5sR3tQ1xW4yZ6uB7fA",
    swapPoints: 72000,
    communityPoints: 12500,
    knsPoints: 15000,
    totalPoints: 99500,
    rank: 2,
    lastUpdated: Date.now(),
  },
  "4tR9sL2kJ6mP3vN8wX1yZ5qA": {
    wallet: "4tR9sL2kJ6mP3vN8wX1yZ5qA",
    swapPoints: 67320,
    communityPoints: 10230,
    knsPoints: 10000,
    totalPoints: 87550,
    rank: 3,
    lastUpdated: Date.now(),
  },
};

// Simple in-memory point tracker
const pointsHistory: Map<string, { timestamp: number; points: number }[]> = new Map();

// ============================================
// LEADERBOARD ENDPOINTS
// ============================================

/**
 * Fetch user's points and rank
 * GET /api/points/:wallet
 */
export async function fetchUserPoints(wallet: string): Promise<UserPointsResponse> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Return mock data or create new entry
  if (MOCK_LEADERBOARD[wallet]) {
    return { ...MOCK_LEADERBOARD[wallet], lastUpdated: Date.now() };
  }

  return {
    wallet,
    swapPoints: 0,
    communityPoints: 0,
    knsPoints: 0,
    totalPoints: 0,
    rank: null,
    lastUpdated: Date.now(),
  };
}

/**
 * Fetch full leaderboard with optional filters
 * GET /api/leaderboard?timeframe=allTime&limit=100
 */
export async function fetchLeaderboard(
  timeframe: "today" | "week" | "allTime" = "allTime",
  userWallet?: string
): Promise<LeaderboardResponse> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 150));

  // Sort by total points descending
  const sorted = Object.values(MOCK_LEADERBOARD)
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 100)
    .map((entry, index) => ({
      rank: index + 1,
      wallet: entry.wallet,
      totalPoints: entry.totalPoints,
      swapPoints: entry.swapPoints,
      communityPoints: entry.communityPoints,
      knsPoints: entry.knsPoints,
    }));

  // Find user rank if provided
  const userRank =
    userWallet && MOCK_LEADERBOARD[userWallet]
      ? ({
          rank: MOCK_LEADERBOARD[userWallet].rank,
          wallet: userWallet,
          totalPoints: MOCK_LEADERBOARD[userWallet].totalPoints,
          swapPoints: MOCK_LEADERBOARD[userWallet].swapPoints,
          communityPoints: MOCK_LEADERBOARD[userWallet].communityPoints,
          knsPoints: MOCK_LEADERBOARD[userWallet].knsPoints,
        } as LeaderboardEntry)
      : undefined;

  return {
    timeframe,
    top100: sorted,
    userRank,
    lastUpdated: Date.now(),
  };
}

// ============================================
// SWAP COMPLETION & POINTS LOGGING
// ============================================

/**
 * Log a completed swap and award swap points
 * POST /api/swap/complete
 */
export async function logSwapCompletion(
  payload: SwapCompletionPayload
): Promise<SwapCompletionResponse> {
  // Simulate network delay and backend processing
  await new Promise(resolve => setTimeout(resolve, 200));

  const { wallet, swapUsdValue, signature, timestamp } = payload;

  // Award points: 1 point = $1 USD swapped (min $5)
  const pointsEarned = swapUsdValue >= 5 ? Math.floor(swapUsdValue) : 0;

  // Get or create user entry
  if (!MOCK_LEADERBOARD[wallet]) {
    MOCK_LEADERBOARD[wallet] = {
      wallet,
      swapPoints: 0,
      communityPoints: 0,
      knsPoints: 0,
      totalPoints: 0,
      rank: null,
      lastUpdated: Date.now(),
    };
  }

  // Award points
  const entry = MOCK_LEADERBOARD[wallet];
  entry.swapPoints += pointsEarned;
  entry.totalPoints = entry.swapPoints + entry.communityPoints + entry.knsPoints;
  entry.lastUpdated = Date.now();

  // Track in history
  if (!pointsHistory.has(wallet)) {
    pointsHistory.set(wallet, []);
  }
  pointsHistory.get(wallet)!.push({
    timestamp,
    points: pointsEarned,
  });

  // Recalculate ranks
  recalculateRanks();

  return {
    pointsEarned,
    newTotalPoints: entry.totalPoints,
    message: `Awarded ${pointsEarned} points for $${swapUsdValue.toFixed(2)} swap`,
  };
}

/**
 * Award community contribution points
 * POST /api/community/award
 */
export async function awardCommunityPoints(
  wallet: string,
  points: number,
  description: string
): Promise<{ success: boolean; message: string }> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));

  if (!MOCK_LEADERBOARD[wallet]) {
    MOCK_LEADERBOARD[wallet] = {
      wallet,
      swapPoints: 0,
      communityPoints: 0,
      knsPoints: 0,
      totalPoints: 0,
      rank: null,
      lastUpdated: Date.now(),
    };
  }

  const entry = MOCK_LEADERBOARD[wallet];
  entry.communityPoints += points;
  entry.totalPoints = entry.swapPoints + entry.communityPoints + entry.knsPoints;
  entry.lastUpdated = Date.now();

  recalculateRanks();

  return {
    success: true,
    message: `Awarded ${points} community points: ${description}`,
  };
}

/**
 * Verify a swap was recorded and points awarded
 * This would normally check the blockchain or database
 */
export async function verifySwapPoints(
  wallet: string,
  signature: string
): Promise<{ verified: boolean; pointsAward: number }> {
  // Simulate verification
  await new Promise(resolve => setTimeout(resolve, 100));

  const userHistory = pointsHistory.get(wallet) || [];
  const recentSwap = userHistory[userHistory.length - 1];

  // Mock verification: always true for now
  return {
    verified: true,
    pointsAward: recentSwap?.points || 0,
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Recalculate all ranks based on total points
 */
function recalculateRanks(): void {
  const sorted = Object.values(MOCK_LEADERBOARD)
    .sort((a, b) => b.totalPoints - a.totalPoints);

  sorted.forEach((entry, index) => {
    entry.rank = index < 100 ? index + 1 : null;
  });
}

/**
 * Get all data for debugging
 */
export function __DEBUG_getAllData() {
  return {
    leaderboard: MOCK_LEADERBOARD,
    history: Object.fromEntries(pointsHistory),
  };
}

/**
 * Reset mock data for testing
 */
export function __DEBUG_resetMockData(): void {
  Object.keys(MOCK_LEADERBOARD).forEach(key => {
    if (!key.includes("7dTp") && !key.includes("9kN2") && !key.includes("4tR9")) {
      delete MOCK_LEADERBOARD[key];
    }
  });
  pointsHistory.clear();
}

/**
 * Add mock user for testing
 */
export function __DEBUG_addMockUser(
  wallet: string,
  swapPoints: number = 0,
  communityPoints: number = 0,
  knsPoints: number = 0
): void {
  MOCK_LEADERBOARD[wallet] = {
    wallet,
    swapPoints,
    communityPoints,
    knsPoints,
    totalPoints: swapPoints + communityPoints + knsPoints,
    rank: null,
    lastUpdated: Date.now(),
  };
  recalculateRanks();
}
