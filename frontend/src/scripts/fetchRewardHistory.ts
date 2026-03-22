/**
 * Script to fetch reward distribution and claim history
 *
 * This script fetches:
 * 1. All reward distribution events (when protocol distributes USDC rewards)
 * 2. All user claim events (when users claim their USDC rewards)
 *
 * Usage:
 * - Run: ts-node src/scripts/fetchRewardHistory.ts
 * - Or import functions and use programmatically
 */

import { Buffer } from "buffer";
import { Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

// ============================================================================
// Constants
// ============================================================================

const STAKING_PROGRAM_ID = new PublicKey("FaYTrVJ2KSH5iqjjEW5KmPQH9yt9WbuRSkzYk8b3NuwK");
const STAKING_RPC_ENDPOINT = "https://api.devnet.solana.com";
const USDC_DECIMALS = 6;

// Instruction discriminators (first 8 bytes of instruction data)
// These are generated from the IDL using anchor's method name hash
const DISTRIBUTE_REWARDS_DISCRIMINATOR = Buffer.from([60, 184, 132, 183, 145, 176, 221, 199]); // distribute_rewards
const CLAIM_DISCRIMINATOR = Buffer.from([62, 198, 214, 193, 213, 159, 108, 210]); // claim

// User stake account discriminator for filtering
const USER_STAKE_DISCRIMINATOR = Buffer.from([102, 53, 163, 107, 9, 138, 87, 153]);

// ============================================================================
// Types
// ============================================================================

/**
 * Reward distribution/claim history entry
 */
export interface RewardHistoryEntry {
  /** Transaction date */
  date: Date;
  /** Action type: distribute (admin) or claim (user) */
  action: "distribute" | "claim";
  /** Amount of USDC */
  amount: number;
  /** User address (for claims) or "Protocol" (for distributions) */
  user: string;
  /** Transaction signature for Solscan link */
  txSignature: string;
  /** Block time as unix timestamp */
  blockTime: number;
}

/**
 * Summary statistics for reward history
 */
export interface RewardHistorySummary {
  /** Total number of distribution events */
  totalDistributions: number;
  /** Total USDC distributed by protocol */
  totalDistributedUsdc: number;
  /** Total number of claim events */
  totalClaims: number;
  /** Total USDC claimed by users */
  totalClaimedUsdc: number;
  /** Number of unique users who have claimed */
  uniqueClaimers: number;
  /** Most recent distribution date */
  lastDistribution: Date | null;
  /** Most recent claim date */
  lastClaim: Date | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if instruction data matches a discriminator
 */
function matchesDiscriminator(data: Buffer, discriminator: Buffer): boolean {
  if (data.length < 8) return false;
  return data.subarray(0, 8).equals(discriminator);
}

/**
 * Parse distribute_rewards instruction data
 * Layout: discriminator(8) + amount(8)
 */
function parseDistributeRewardsData(data: Buffer): number | null {
  if (data.length < 16) return null;
  const amountRaw = data.readBigUInt64LE(8);
  return Number(amountRaw) / Math.pow(10, USDC_DECIMALS);
}

/**
 * Get USDC balance change from transaction meta for claim transactions
 * Handles cases where the user's USDC account is created during the claim (ATA creation)
 */
function getUsdcBalanceChange(
  meta: { preTokenBalances?: any[]; postTokenBalances?: any[] } | null,
  ownerAddress: string
): number {
  if (!meta?.postTokenBalances) {
    return 0;
  }

  for (const post of meta.postTokenBalances) {
    if (post.owner !== ownerAddress) continue;

    // Try to find matching pre-balance
    const pre = meta.preTokenBalances?.find(
      (p: any) => p.accountIndex === post.accountIndex
    );

    // Calculate pre and post amounts
    const preAmount = pre ? parseFloat(pre.uiTokenAmount?.uiAmountString || "0") : 0;
    const postAmount = parseFloat(post.uiTokenAmount?.uiAmountString || "0");
    const change = postAmount - preAmount;

    // Only return positive changes (claims add USDC to user balance)
    if (change > 0) {
      return change;
    }
  }

  return 0;
}

// ============================================================================
// Main Fetch Functions
// ============================================================================

/**
 * Fetch all reward distribution events (admin distributes USDC to stakers)
 * This queries the config PDA for all distribute_rewards transactions
 */
export async function fetchRewardDistributions(
  rpcEndpoint: string = STAKING_RPC_ENDPOINT,
  limit: number = 100
): Promise<RewardHistoryEntry[]> {
  const connection = new Connection(rpcEndpoint, "confirmed");

  // Derive config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    STAKING_PROGRAM_ID
  );

  console.log("Fetching reward distributions from config PDA:", configPda.toBase58());

  // Get all transaction signatures for the config PDA
  const signatures = await connection.getSignaturesForAddress(configPda, {
    limit,
  });

  console.log(`Found ${signatures.length} transactions for config PDA`);

  const distributions: RewardHistoryEntry[] = [];

  // Fetch and parse each transaction
  for (const sig of signatures) {
    try {
      const tx = await connection.getTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx || !tx.transaction.message) continue;

      const message = tx.transaction.message;
      const blockTime = tx.blockTime ? new Date(tx.blockTime * 1000) : new Date();

      // Get account keys
      const accountKeys = message.staticAccountKeys || (message as any).accountKeys || [];

      // Find program index
      const programIndex = accountKeys.findIndex(
        (key: PublicKey) => key.toBase58() === STAKING_PROGRAM_ID.toBase58()
      );

      if (programIndex === -1) continue;

      // Get compiled instructions
      const instructions = message.compiledInstructions || (message as any).instructions || [];

      for (const ix of instructions) {
        const programIdIndex = ix.programIdIndex;
        if (programIdIndex !== programIndex) continue;

        const data = Buffer.from(ix.data);

        // Check if this is a distribute_rewards instruction
        if (matchesDiscriminator(data, DISTRIBUTE_REWARDS_DISCRIMINATOR)) {
          const amount = parseDistributeRewardsData(data);
          if (amount !== null && amount > 0) {
            distributions.push({
              date: blockTime,
              action: "distribute",
              amount,
              user: "Protocol",
              txSignature: sig.signature,
              blockTime: tx.blockTime || 0,
            });
            console.log(`Found distribution: ${amount} USDC at ${blockTime.toISOString()}`);
          }
        }
      }
    } catch (err) {
      console.error(`Error parsing tx ${sig.signature}:`, err);
    }
  }

  // Sort by date descending (newest first)
  distributions.sort((a, b) => b.date.getTime() - a.date.getTime());

  return distributions;
}

/**
 * Fetch all user claim events
 * This queries all user_stake PDAs for claim transactions
 */
export async function fetchAllUserClaims(
  rpcEndpoint: string = STAKING_RPC_ENDPOINT,
  limit: number = 50
): Promise<RewardHistoryEntry[]> {
  const connection = new Connection(rpcEndpoint, "confirmed");

  console.log("Fetching all user stake accounts...");

  // Fetch all UserStake accounts
  const userStakeAccounts = await connection.getProgramAccounts(STAKING_PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: bs58.encode(USER_STAKE_DISCRIMINATOR) } }],
  });

  console.log(`Found ${userStakeAccounts.length} user stake accounts`);

  const allClaims: RewardHistoryEntry[] = [];

  // For each user stake account, fetch claim transactions
  for (const { pubkey, account } of userStakeAccounts) {
    try {
      // Parse owner from user stake account (offset 8: discriminator + owner)
      const owner = new PublicKey(account.data.subarray(8, 40)).toBase58();

      // Get transaction signatures for this user_stake PDA
      const signatures = await connection.getSignaturesForAddress(pubkey, {
        limit,
      });

      // Parse each transaction
      for (const sig of signatures) {
        try {
          const tx = await connection.getTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (!tx || !tx.transaction.message) continue;

          const message = tx.transaction.message;
          const blockTime = tx.blockTime ? new Date(tx.blockTime * 1000) : new Date();

          // Get account keys
          const accountKeys = message.staticAccountKeys || (message as any).accountKeys || [];

          // Find program index
          const programIndex = accountKeys.findIndex(
            (key: PublicKey) => key.toBase58() === STAKING_PROGRAM_ID.toBase58()
          );

          if (programIndex === -1) continue;

          // Get compiled instructions
          const instructions = message.compiledInstructions || (message as any).instructions || [];

          for (const ix of instructions) {
            const programIdIndex = ix.programIdIndex;
            if (programIdIndex !== programIndex) continue;

            const data = Buffer.from(ix.data);

            // Check if this is a claim instruction
            if (matchesDiscriminator(data, CLAIM_DISCRIMINATOR)) {
              // Get USDC balance change from transaction metadata
              const amount = getUsdcBalanceChange(tx.meta, owner);

              if (amount > 0) {
                allClaims.push({
                  date: blockTime,
                  action: "claim",
                  amount,
                  user: owner,
                  txSignature: sig.signature,
                  blockTime: tx.blockTime || 0,
                });
                console.log(`Found claim: ${amount} USDC by ${owner.slice(0, 8)}... at ${blockTime.toISOString()}`);
              }
            }
          }
        } catch (err) {
          console.error(`Error parsing tx ${sig.signature}:`, err);
        }
      }
    } catch (err) {
      console.error(`Error fetching claims for ${pubkey.toBase58()}:`, err);
    }
  }

  // Sort by date descending (newest first)
  allClaims.sort((a, b) => b.date.getTime() - a.date.getTime());

  return allClaims;
}

/**
 * Fetch complete reward history (distributions + claims)
 */
export async function fetchCompleteRewardHistory(
  rpcEndpoint: string = STAKING_RPC_ENDPOINT,
  distributionLimit: number = 100,
  claimLimit: number = 50
): Promise<RewardHistoryEntry[]> {
  console.log("Fetching complete reward history...");

  const [distributions, claims] = await Promise.all([
    fetchRewardDistributions(rpcEndpoint, distributionLimit),
    fetchAllUserClaims(rpcEndpoint, claimLimit),
  ]);

  // Combine and sort
  const combined = [...distributions, ...claims];
  combined.sort((a, b) => b.date.getTime() - a.date.getTime());

  return combined;
}

/**
 * Calculate summary statistics from reward history
 */
export function calculateRewardSummary(history: RewardHistoryEntry[]): RewardHistorySummary {
  const distributions = history.filter(h => h.action === "distribute");
  const claims = history.filter(h => h.action === "claim");

  const totalDistributions = distributions.length;
  const totalDistributedUsdc = distributions.reduce((sum, d) => sum + d.amount, 0);

  const totalClaims = claims.length;
  const totalClaimedUsdc = claims.reduce((sum, c) => sum + c.amount, 0);

  const uniqueClaimers = new Set(claims.map(c => c.user)).size;

  const lastDistribution = distributions.length > 0 ? distributions[0].date : null;
  const lastClaim = claims.length > 0 ? claims[0].date : null;

  return {
    totalDistributions,
    totalDistributedUsdc,
    totalClaims,
    totalClaimedUsdc,
    uniqueClaimers,
    lastDistribution,
    lastClaim,
  };
}

/**
 * Fetch reward history for a specific user
 */
export async function fetchUserRewardHistory(
  userPubkey: PublicKey,
  rpcEndpoint: string = STAKING_RPC_ENDPOINT,
  limit: number = 50
): Promise<RewardHistoryEntry[]> {
  const connection = new Connection(rpcEndpoint, "confirmed");

  // Derive user_stake PDA
  const [userStakePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_stake"), userPubkey.toBuffer()],
    STAKING_PROGRAM_ID
  );

  console.log(`Fetching claim history for user: ${userPubkey.toBase58()}`);

  // Get all transaction signatures for the user_stake PDA
  const signatures = await connection.getSignaturesForAddress(userStakePda, {
    limit,
  });

  const claims: RewardHistoryEntry[] = [];

  // Fetch and parse each transaction
  for (const sig of signatures) {
    try {
      const tx = await connection.getTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx || !tx.transaction.message) continue;

      const message = tx.transaction.message;
      const blockTime = tx.blockTime ? new Date(tx.blockTime * 1000) : new Date();

      // Get account keys
      const accountKeys = message.staticAccountKeys || (message as any).accountKeys || [];

      // Find program index
      const programIndex = accountKeys.findIndex(
        (key: PublicKey) => key.toBase58() === STAKING_PROGRAM_ID.toBase58()
      );

      if (programIndex === -1) continue;

      // Get compiled instructions
      const instructions = message.compiledInstructions || (message as any).instructions || [];

      for (const ix of instructions) {
        const programIdIndex = ix.programIdIndex;
        if (programIdIndex !== programIndex) continue;

        const data = Buffer.from(ix.data);

        // Check if this is a claim instruction
        if (matchesDiscriminator(data, CLAIM_DISCRIMINATOR)) {
          // Get USDC balance change from transaction metadata
          const amount = getUsdcBalanceChange(tx.meta, userPubkey.toBase58());

          if (amount > 0) {
            claims.push({
              date: blockTime,
              action: "claim",
              amount,
              user: userPubkey.toBase58(),
              txSignature: sig.signature,
              blockTime: tx.blockTime || 0,
            });
          }
        }
      }
    } catch (err) {
      console.error(`Error parsing tx ${sig.signature}:`, err);
    }
  }

  // Sort by date descending (newest first)
  claims.sort((a, b) => b.date.getTime() - a.date.getTime());

  return claims;
}

// ============================================================================
// CLI Execution
// ============================================================================

/**
 * Main execution function when run as a script
 */
async function main() {
  console.log("=".repeat(80));
  console.log("REWARD HISTORY FETCHER");
  console.log("=".repeat(80));
  console.log();

  try {
    // Fetch complete history
    const history = await fetchCompleteRewardHistory();

    console.log();
    console.log("=".repeat(80));
    console.log("RESULTS");
    console.log("=".repeat(80));
    console.log();

    // Calculate summary
    const summary = calculateRewardSummary(history);

    console.log("SUMMARY:");
    console.log(`  Total Distributions: ${summary.totalDistributions}`);
    console.log(`  Total Distributed USDC: ${summary.totalDistributedUsdc.toFixed(2)}`);
    console.log(`  Total Claims: ${summary.totalClaims}`);
    console.log(`  Total Claimed USDC: ${summary.totalClaimedUsdc.toFixed(2)}`);
    console.log(`  Unique Claimers: ${summary.uniqueClaimers}`);
    console.log(`  Last Distribution: ${summary.lastDistribution?.toISOString() || "N/A"}`);
    console.log(`  Last Claim: ${summary.lastClaim?.toISOString() || "N/A"}`);
    console.log();

    // Show recent history
    console.log("RECENT HISTORY (last 10 events):");
    console.log("-".repeat(80));

    const recentHistory = history.slice(0, 10);
    for (const entry of recentHistory) {
      const action = entry.action === "distribute" ? "DISTRIBUTE" : "CLAIM";
      const user = entry.user === "Protocol" ? entry.user : `${entry.user.slice(0, 8)}...`;
      const date = entry.date.toISOString();
      const tx = entry.txSignature.slice(0, 8);

      console.log(`[${action}] ${entry.amount.toFixed(2)} USDC | ${user} | ${date} | TX: ${tx}...`);
    }

    console.log();
    console.log("=".repeat(80));
    console.log("View full transactions on Solscan:");
    console.log(`https://solscan.io/account/${STAKING_PROGRAM_ID.toBase58()}?cluster=devnet`);
    console.log("=".repeat(80));

  } catch (error) {
    console.error("Error fetching reward history:", error);
    process.exit(1);
  }
}

// Run main if executed directly
// Note: In ES modules, we can check if the script is being run directly
main().catch(console.error);
