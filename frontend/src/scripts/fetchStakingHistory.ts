/**
 * Fetch staking/unstaking history for a wallet
 *
 * Usage:
 *   npx tsx src/scripts/fetchStakingHistory.ts <WALLET_ADDRESS>
 *
 * Example:
 *   npx tsx src/scripts/fetchStakingHistory.ts 9fM3X4AVgSuAnj7hSCTVXvWujAF2B2Be758UHUxUpS7c
 *
 * Returns: date, action, amount, lock tier, multiplier, tx hash
 */

import { Connection, PublicKey } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("FaYTrVJ2KSH5iqjjEW5KmPQH9yt9WbuRSkzYk8b3NuwK");
const RPC = "https://api.devnet.solana.com";

// KNS has 9 decimals
const KNS_DECIMALS = 9;

// Instruction discriminators from IDL
const STAKE_DISCRIMINATOR = Buffer.from([206, 176, 202, 18, 200, 209, 179, 108]);
const WITHDRAW_DISCRIMINATOR = Buffer.from([183, 18, 70, 156, 148, 109, 161, 34]);

// Lock tier mapping
const LOCK_TIER_LABELS: Record<number, string> = {
  0: "Flexible",
  1: "3 Months",
  2: "6 Months",
  3: "9 Months",
  4: "12 Months",
};

const LOCK_TIER_MULTIPLIERS: Record<number, number> = {
  0: 1.0,
  1: 1.0,
  2: 1.5,
  3: 2.0,
  4: 3.0,
};

interface StakingHistoryEntry {
  date: Date;
  action: "stake" | "unstake";
  amount: number;
  lockPeriod: string | null;
  multiplier: number | null;
  txSignature: string;
}

/**
 * Check if instruction data matches a discriminator
 */
function matchesDiscriminator(data: Buffer, discriminator: Buffer): boolean {
  if (data.length < 8) return false;
  return data.subarray(0, 8).equals(discriminator);
}

/**
 * Parse stake instruction data
 * Layout: discriminator(8) + amount(8) + lock_tier(1)
 */
function parseStakeInstruction(data: Buffer): { amount: number; lockTier: number } | null {
  if (data.length < 17) return null;

  const amount = Number(data.readBigUInt64LE(8)) / Math.pow(10, KNS_DECIMALS);
  const lockTier = data[16];

  return { amount, lockTier };
}

/**
 * Get token balance change from transaction meta
 */
function getTokenBalanceChange(
  meta: { preTokenBalances?: any[]; postTokenBalances?: any[] } | null,
  ownerAddress: string
): number {
  if (!meta?.preTokenBalances || !meta?.postTokenBalances) {
    return 0;
  }

  // Find the owner's KNS token account balance change
  for (const post of meta.postTokenBalances) {
    if (post.owner !== ownerAddress) continue;

    const pre = meta.preTokenBalances.find(
      (p: any) => p.accountIndex === post.accountIndex
    );

    if (pre) {
      const preAmount = parseFloat(pre.uiTokenAmount?.uiAmountString || "0");
      const postAmount = parseFloat(post.uiTokenAmount?.uiAmountString || "0");
      return postAmount - preAmount;
    }
  }

  return 0;
}

/**
 * Fetch staking history for a wallet
 */
async function fetchStakingHistory(walletAddress: string): Promise<StakingHistoryEntry[]> {
  const connection = new Connection(RPC, "confirmed");

  let userWallet: PublicKey;
  try {
    userWallet = new PublicKey(walletAddress);
  } catch {
    console.error("Invalid wallet address:", walletAddress);
    return [];
  }

  // Derive user_stake PDA
  const [userStakePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_stake"), userWallet.toBuffer()],
    PROGRAM_ID
  );

  console.log(`\nFetching staking history for: ${userWallet.toBase58()}`);
  console.log(`User Stake PDA: ${userStakePda.toBase58()}`);
  console.log("Network: Devnet\n");

  // Get all transaction signatures for the user_stake PDA
  const signatures = await connection.getSignaturesForAddress(userStakePda, {
    limit: 100,
  });

  if (signatures.length === 0) {
    console.log("No transactions found for this wallet.");
    return [];
  }

  console.log(`Found ${signatures.length} transactions. Parsing...\n`);

  const history: StakingHistoryEntry[] = [];

  // Fetch and parse each transaction using raw format
  for (const sig of signatures) {
    try {
      // Use getTransaction with raw format to get instruction data
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
        (key: PublicKey) => key.toBase58() === PROGRAM_ID.toBase58()
      );

      if (programIndex === -1) continue;

      // Get compiled instructions
      const instructions = message.compiledInstructions || (message as any).instructions || [];

      for (const ix of instructions) {
        // Check if this instruction targets our program
        const programIdIndex = ix.programIdIndex;
        if (programIdIndex !== programIndex) continue;

        // Get instruction data
        const data = Buffer.from(ix.data);

        if (matchesDiscriminator(data, STAKE_DISCRIMINATOR)) {
          const parsed = parseStakeInstruction(data);
          if (parsed) {
            history.push({
              date: blockTime,
              action: "stake",
              amount: parsed.amount,
              lockPeriod: LOCK_TIER_LABELS[parsed.lockTier] || "Unknown",
              multiplier: LOCK_TIER_MULTIPLIERS[parsed.lockTier] || 1.0,
              txSignature: sig.signature,
            });
          }
        } else if (matchesDiscriminator(data, WITHDRAW_DISCRIMINATOR)) {
          // For withdraw, get amount from token balance change
          const balanceChange = getTokenBalanceChange(tx.meta, userWallet.toBase58());
          history.push({
            date: blockTime,
            action: "unstake",
            amount: Math.abs(balanceChange), // Balance change is positive for receiving tokens
            lockPeriod: null,
            multiplier: null,
            txSignature: sig.signature,
          });
        }
      }
    } catch (err) {
      console.error(`Error parsing tx ${sig.signature}:`, err);
    }
  }

  // Sort by date descending (newest first)
  history.sort((a, b) => b.date.getTime() - a.date.getTime());

  return history;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Format number with commas
 */
function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

async function main() {
  const walletArg = process.argv[2];

  if (!walletArg) {
    console.log("Usage: npx tsx src/scripts/fetchStakingHistory.ts <WALLET_ADDRESS>");
    console.log("\nExample: npx tsx src/scripts/fetchStakingHistory.ts 9fM3X4AVgSuAnj7hSCTVXvWujAF2B2Be758UHUxUpS7c");
    return;
  }

  const history = await fetchStakingHistory(walletArg);

  if (history.length === 0) {
    console.log("No staking/unstaking history found.");
    return;
  }

  console.log("========== STAKING & UNSTAKING HISTORY ==========\n");

  // Table header
  console.log(
    "DATE".padEnd(12) +
    "ACTION".padEnd(10) +
    "AMOUNT (KNS)".padEnd(18) +
    "LOCK PERIOD".padEnd(14) +
    "MULTIPLIER".padEnd(12) +
    "TX HASH"
  );
  console.log("-".repeat(100));

  // Table rows
  for (const entry of history) {
    const date = formatDate(entry.date);
    const action = entry.action.toUpperCase();
    const amount = formatNumber(entry.amount);
    const lockPeriod = entry.lockPeriod || "—";
    const multiplier = entry.multiplier ? `${entry.multiplier.toFixed(1)}x` : "—";
    const txHash = `${entry.txSignature.slice(0, 8)}...${entry.txSignature.slice(-4)}`;

    console.log(
      date.padEnd(12) +
      action.padEnd(10) +
      amount.padEnd(18) +
      lockPeriod.padEnd(14) +
      multiplier.padEnd(12) +
      txHash
    );
  }

  console.log("\n" + "=".repeat(50));
  console.log(`Total entries: ${history.length}`);
  console.log(`Stakes: ${history.filter((h) => h.action === "stake").length}`);
  console.log(`Unstakes: ${history.filter((h) => h.action === "unstake").length}`);

  // Output as JSON for programmatic use
  console.log("\n========== JSON OUTPUT ==========");
  console.log(JSON.stringify(history.map(h => ({
    ...h,
    date: h.date.toISOString(),
  })), null, 2));
}

main().catch(console.error);
