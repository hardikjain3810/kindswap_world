import { Buffer } from "buffer";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import bs58 from "bs58";
import {
  STAKING_PROGRAM_ID,
  STAKING_RPC_ENDPOINT,
  KNS_DECIMALS,
  USER_STAKE_DISCRIMINATOR,
  LOCK_TIER_BY_INDEX,
  LOCK_TIER_MULTIPLIERS,
  LockTierKey,
  CLAIM_DISCRIMINATOR,
  DISTRIBUTE_REWARDS_DISCRIMINATOR,
  USDC_DECIMALS,
  REWARD_PRECISION,
} from "./constants";
import { StakingStats, UserStakeInfo, UserRewards, StakingHistoryEntry, RewardDistributionHistoryEntry } from "./types";

function readU128LE(buffer: Buffer, offset: number): bigint {
  const low = buffer.readBigUInt64LE(offset);
  const high = buffer.readBigUInt64LE(offset + 8);
  return low + (high << 64n);
}

/**
 * Fetch global staking statistics from on-chain data
 */
export async function fetchStakingStats(
  rpcEndpoint: string = STAKING_RPC_ENDPOINT
): Promise<StakingStats | null> {
  const connection = new Connection(rpcEndpoint, "confirmed");

  // Derive config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    STAKING_PROGRAM_ID
  );

  // Fetch config for total weighted stake
  const configInfo = await connection.getAccountInfo(configPda);
  if (!configInfo) return null;

  const configData = configInfo.data;
  // Offset: discriminator(8) + admin(32) + kns_mint(32) + usdc_mint(32) + paused_deposits(1) + paused_claims(1)
  const totalWeightedStake = readU128LE(configData, 106);

  // Fetch all UserStake accounts
  const userStakeAccounts = await connection.getProgramAccounts(STAKING_PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: bs58.encode(USER_STAKE_DISCRIMINATOR) } }],
  });

  let totalKnsStakedRaw = 0n;
  let activeStakers = 0;
  const stakersByTier: Record<LockTierKey, number> = {
    Flexible: 0, M3: 0, M6: 0, M9: 0, M12: 0,
  };

  for (const { account } of userStakeAccounts) {
    const data = account.data;
    const active = data[40] === 1; // offset: discriminator(8) + owner(32)
    if (!active) continue;

    activeStakers++;
    const amount = data.readBigUInt64LE(41); // after active flag
    const lockTier = data[49]; // after amount(8)
    totalKnsStakedRaw += amount;

    const tierKey = LOCK_TIER_BY_INDEX[lockTier];
    if (tierKey) stakersByTier[tierKey]++;
  }

  const totalKnsStaked = Number(totalKnsStakedRaw) / Math.pow(10, KNS_DECIMALS);
  const avgMultiplier = totalKnsStakedRaw > 0n
    ? Number(totalWeightedStake) / Number(totalKnsStakedRaw)
    : 0;

  return {
    totalKnsStaked,
    totalWeightedStake,
    avgMultiplier,
    activeStakers,
    stakersByTier,
  };
}

/**
 * Fetch user staking data from their staking PDA
 */
export async function fetchUserStake(
  userPubkey: PublicKey,
  rpcEndpoint: string = STAKING_RPC_ENDPOINT
): Promise<UserStakeInfo | null> {
  const connection = new Connection(rpcEndpoint, "confirmed");

  // Derive user_stake PDA
  const [userStakePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_stake"), userPubkey.toBuffer()],
    STAKING_PROGRAM_ID
  );

  const accountInfo = await connection.getAccountInfo(userStakePda);
  if (!accountInfo) return null;

  const data = accountInfo.data;

  // Parse UserStake account data (offsets based on IDL)
  // Layout: discriminator(8) + owner(32) + active(1) + amount(8) + lock_tier(1)
  //         + start_ts(8) + start_day(8) + multiplier_bps(2) + weighted_stake(16)
  let offset = 8; // skip discriminator
  const owner = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
  offset += 32;
  const active = data[offset] === 1;
  offset += 1;
  const amount = data.readBigUInt64LE(offset);
  offset += 8;
  const lockTierIndex = data[offset];
  offset += 1;
  const startTs = Number(data.readBigInt64LE(offset)) * 1000;
  offset += 8;
  offset += 8; // skip start_day
  const multiplierBps = data.readUInt16LE(offset);
  offset += 2;
  const weightedStake = readU128LE(data, offset);

  const lockTier = LOCK_TIER_BY_INDEX[lockTierIndex] || "Flexible";
  const multiplier = multiplierBps / 10000;
  const stakedAmount = Number(amount) / Math.pow(10, KNS_DECIMALS);

  // Calculate lock end time based on tier
  const lockDurations: Record<LockTierKey, number> = {
    Flexible: 0,
    M3: 90 * 24 * 60 * 60 * 1000,
    M6: 180 * 24 * 60 * 60 * 1000,
    M9: 270 * 24 * 60 * 60 * 1000,
    M12: 365 * 24 * 60 * 60 * 1000,
  };
  const lockEndTime = startTs + lockDurations[lockTier];

  // Fetch config for total weighted stake to calculate pool share
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    STAKING_PROGRAM_ID
  );
  const configInfo = await connection.getAccountInfo(configPda);
  const totalWeightedStake = configInfo ? readU128LE(configInfo.data, 106) : 0n;

  const poolSharePercent = totalWeightedStake > 0n
    ? (Number(weightedStake) / Number(totalWeightedStake)) * 100
    : 0;

  return {
    owner,
    active,
    stakedAmount,
    lockTier,
    multiplier,
    startTime: new Date(startTs),
    lockEndTime: new Date(lockEndTime),
    weightedStake,
    poolSharePercent,
  };
}

/**
 * Fetch all stakers and their staking data (for dev view)
 */
export async function fetchAllStakers(
  rpcEndpoint: string = STAKING_RPC_ENDPOINT
): Promise<UserStakeInfo[]> {
  const connection = new Connection(rpcEndpoint, "confirmed");

  // Fetch config for total weighted stake
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    STAKING_PROGRAM_ID
  );
  const configInfo = await connection.getAccountInfo(configPda);
  const totalWeightedStake = configInfo ? readU128LE(configInfo.data, 106) : 0n;

  // Fetch all UserStake accounts
  const userStakeAccounts = await connection.getProgramAccounts(STAKING_PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: bs58.encode(USER_STAKE_DISCRIMINATOR) } }],
  });

  const lockDurations: Record<LockTierKey, number> = {
    Flexible: 0,
    M3: 90 * 24 * 60 * 60 * 1000,
    M6: 180 * 24 * 60 * 60 * 1000,
    M9: 270 * 24 * 60 * 60 * 1000,
    M12: 365 * 24 * 60 * 60 * 1000,
  };

  const stakers: UserStakeInfo[] = [];

  for (const { account } of userStakeAccounts) {
    const data = account.data;

    let offset = 8;
    const owner = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
    offset += 32;
    const active = data[offset] === 1;
    offset += 1;
    const amount = data.readBigUInt64LE(offset);
    offset += 8;
    const lockTierIndex = data[offset];
    offset += 1;
    const startTs = Number(data.readBigInt64LE(offset)) * 1000;
    offset += 8;
    offset += 8; // skip start_day
    const multiplierBps = data.readUInt16LE(offset);
    offset += 2;
    const weightedStake = readU128LE(data, offset);

    const lockTier = LOCK_TIER_BY_INDEX[lockTierIndex] || "Flexible";
    const multiplier = multiplierBps / 10000;
    const stakedAmount = Number(amount) / Math.pow(10, KNS_DECIMALS);
    const lockEndTime = startTs + lockDurations[lockTier];

    const poolSharePercent = totalWeightedStake > 0n
      ? (Number(weightedStake) / Number(totalWeightedStake)) * 100
      : 0;

    stakers.push({
      owner,
      active,
      stakedAmount,
      lockTier,
      multiplier,
      startTime: new Date(startTs),
      lockEndTime: new Date(lockEndTime),
      weightedStake,
      poolSharePercent,
    });
  }

  return stakers;
}

/**
 * Fetch user's KNS token balance from their associated token account
 */
export async function fetchKnsBalance(
  userPubkey: PublicKey,
  rpcEndpoint: string = STAKING_RPC_ENDPOINT
): Promise<number> {
  const connection = new Connection(rpcEndpoint, "confirmed");

  // Get KNS mint from config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    STAKING_PROGRAM_ID
  );

  const configInfo = await connection.getAccountInfo(configPda);
  if (!configInfo) return 0;

  // KNS mint is at offset 40: discriminator(8) + admin(32)
  const knsMint = new PublicKey(configInfo.data.subarray(40, 72));

  // Derive user's associated token account for KNS
  const userAta = getAssociatedTokenAddressSync(knsMint, userPubkey);

  // Fetch token account balance
  const tokenAccountInfo = await connection.getAccountInfo(userAta);
  if (!tokenAccountInfo) return 0;

  // Token account data layout: mint(32) + owner(32) + amount(8) + ...
  const balance = tokenAccountInfo.data.readBigUInt64LE(64);

  return Number(balance) / Math.pow(10, KNS_DECIMALS);
}

// USDC has 6 decimals
const USDC_DECIMALS_LOCAL = 6;

// Precision factor for reward calculation (matches on-chain)
const REWARD_PRECISION_LOCAL = 1_000_000_000_000n; // 1e12

/**
 * Fetch user's USDC rewards from on-chain data
 * - unclaimedUsdc: pending = (weighted_amount * acc_reward_per_weight / PRECISION) - reward_debt
 * - totalRevenue: reward_debt (already credited) + pending unclaimed
 * - nextPayoutDays: days until next bi-weekly claim period
 */
export async function fetchUserRewards(
  userPubkey: PublicKey,
  rpcEndpoint: string = STAKING_RPC_ENDPOINT
): Promise<UserRewards> {
  const connection = new Connection(rpcEndpoint, "confirmed");

  // Default return for no stake
  const defaultRewards: UserRewards = { unclaimedUsdc: 0, totalClaimed: 0, totalRevenue: 0, nextPayoutDays: 0 };

  // Derive config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    STAKING_PROGRAM_ID
  );

  // Fetch config for acc_reward_per_weight
  const configInfo = await connection.getAccountInfo(configPda);
  if (!configInfo) {
    return defaultRewards;
  }

  // Parse acc_reward_per_weight from config
  // Offset: discriminator(8) + admin(32) + kns_mint(32) + usdc_mint(32) + paused_deposits(1) + paused_claims(1) + total_weighted_stake(16)
  const accRewardPerWeight = readU128LE(configInfo.data, 8 + 32 + 32 + 32 + 1 + 1 + 16);

  // Derive user_stake PDA
  const [userStakePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_stake"), userPubkey.toBuffer()],
    STAKING_PROGRAM_ID
  );

  // Fetch user stake account
  const userStakeInfo = await connection.getAccountInfo(userStakePda);
  if (!userStakeInfo) {
    return defaultRewards;
  }

  const data = userStakeInfo.data;

  // Parse user stake data
  // Layout: discriminator(8) + owner(32) + active(1) + amount(8) + lock(1) + start_ts(8) + start_day(8) + multiplier_bps(2) + weighted_amount(16) + reward_debt(16) + last_claim_period(8)
  const active = data[40] === 1;
  if (!active) {
    return defaultRewards;
  }

  // weighted_amount at offset 68: 8 + 32 + 1 + 8 + 1 + 8 + 8 + 2 = 68
  const weightedAmount = readU128LE(data, 68);

  // reward_debt at offset 84: 68 + 16 = 84
  const rewardDebt = readU128LE(data, 84);

  // last_claim_period at offset 100: 84 + 16 = 100
  const lastClaimPeriod = data.readBigInt64LE(100);

  // Calculate pending rewards
  // pending = (weighted_amount * acc_reward_per_weight / PRECISION) - reward_debt
  const accumulatedRewards = (weightedAmount * accRewardPerWeight) / REWARD_PRECISION_LOCAL;
  const pendingRaw = accumulatedRewards > rewardDebt ? accumulatedRewards - rewardDebt : 0n;

  // Convert to USDC (6 decimals)
  const unclaimedUsdc = Number(pendingRaw) / Math.pow(10, USDC_DECIMALS_LOCAL);

  // Total revenue = reward_debt (already credited/claimed) + pending unclaimed
  // Note: reward_debt represents cumulative rewards credited to user over time
  const totalRevenueRaw = rewardDebt + pendingRaw;
  const totalRevenue = Number(totalRevenueRaw) / Math.pow(10, USDC_DECIMALS_LOCAL);

  // Calculate next payout days (bi-weekly = 14 days)
  const currentDay = BigInt(Math.floor(Date.now() / 1000 / 86400));
  const currentPeriod = currentDay / 14n;

  let nextPayoutDays: number;
  if (lastClaimPeriod < currentPeriod) {
    // User can claim now (hasn't claimed in current period)
    nextPayoutDays = 0;
  } else {
    // User already claimed in current period, calculate days until next period
    const nextPeriodStartDay = (currentPeriod + 1n) * 14n;
    nextPayoutDays = Number(nextPeriodStartDay - currentDay);
  }

  // Total claimed = total revenue - unclaimed (what's already been claimed)
  const totalClaimed = totalRevenue - unclaimedUsdc;

  return { unclaimedUsdc, totalClaimed, totalRevenue, nextPayoutDays };
}

// Stake instruction discriminator from IDL
const STAKE_DISCRIMINATOR = Buffer.from([206, 176, 202, 18, 200, 209, 179, 108]);

// Withdraw instruction discriminator from IDL
const WITHDRAW_DISCRIMINATOR = Buffer.from([183, 18, 70, 156, 148, 109, 161, 34]);

// Lock tier index mapping for instruction serialization
const LOCK_TIER_INDEX: Record<LockTierKey, number> = {
  Flexible: 0,
  M3: 1,
  M6: 2,
  M9: 3,
  M12: 4,
};

/**
 * Build a stake transaction for the user to sign and send
 */
export async function buildStakeTransaction(
  userPubkey: PublicKey,
  amount: number,
  lockTier: LockTierKey,
  rpcEndpoint: string = STAKING_RPC_ENDPOINT
): Promise<Transaction> {
  const connection = new Connection(rpcEndpoint, "confirmed");

  // Convert amount to lamports (raw token units)
  const amountLamports = BigInt(Math.floor(amount * Math.pow(10, KNS_DECIMALS)));

  // Derive config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    STAKING_PROGRAM_ID
  );

  // Get KNS mint from config
  const configInfo = await connection.getAccountInfo(configPda);
  if (!configInfo) {
    throw new Error("Staking program not initialized");
  }
  const knsMint = new PublicKey(configInfo.data.subarray(40, 72));

  // Derive user_stake PDA
  const [userStakePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_stake"), userPubkey.toBuffer()],
    STAKING_PROGRAM_ID
  );

  // Derive stake_vault PDA (per-user vault for KNS principal)
  const [stakeVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake_vault"), userPubkey.toBuffer()],
    STAKING_PROGRAM_ID
  );

  // Get user's KNS associated token account
  const ownerKnsAta = getAssociatedTokenAddressSync(knsMint, userPubkey);

  // Build instruction data: discriminator(8) + amount(8) + lock_tier(1)
  const instructionData = Buffer.alloc(17);
  STAKE_DISCRIMINATOR.copy(instructionData, 0);
  instructionData.writeBigUInt64LE(amountLamports, 8);
  instructionData.writeUInt8(LOCK_TIER_INDEX[lockTier], 16);

  // Build accounts array matching IDL order
  const accounts = [
    { pubkey: configPda, isSigner: false, isWritable: true },
    { pubkey: knsMint, isSigner: false, isWritable: false },
    { pubkey: userPubkey, isSigner: true, isWritable: true },
    { pubkey: userStakePda, isSigner: false, isWritable: true },
    { pubkey: stakeVaultPda, isSigner: false, isWritable: true },
    { pubkey: ownerKnsAta, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  // Create stake instruction
  const stakeInstruction = new TransactionInstruction({
    keys: accounts,
    programId: STAKING_PROGRAM_ID,
    data: instructionData,
  });

  // Build transaction
  const transaction = new Transaction().add(stakeInstruction);

  // Get recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = userPubkey;

  return transaction;
}

/**
 * Build a withdraw transaction for the user to sign and send
 * Note: Withdraw is full withdrawal only - all staked tokens are returned
 */
export async function buildWithdrawTransaction(
  userPubkey: PublicKey,
  rpcEndpoint: string = STAKING_RPC_ENDPOINT
): Promise<Transaction> {
  const connection = new Connection(rpcEndpoint, "confirmed");

  // Derive config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    STAKING_PROGRAM_ID
  );

  // Get KNS mint from config
  const configInfo = await connection.getAccountInfo(configPda);
  if (!configInfo) {
    throw new Error("Staking program not initialized");
  }
  const knsMint = new PublicKey(configInfo.data.subarray(40, 72));

  // Derive user_stake PDA
  const [userStakePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_stake"), userPubkey.toBuffer()],
    STAKING_PROGRAM_ID
  );

  // Derive stake_vault PDA
  const [stakeVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake_vault"), userPubkey.toBuffer()],
    STAKING_PROGRAM_ID
  );

  // Get user's KNS associated token account
  const ownerKnsAta = getAssociatedTokenAddressSync(knsMint, userPubkey);

  // Build instruction data: discriminator only (8 bytes, no args)
  const instructionData = WITHDRAW_DISCRIMINATOR;

  // Build accounts array matching IDL order (7 accounts)
  const accounts = [
    { pubkey: configPda, isSigner: false, isWritable: true },
    { pubkey: knsMint, isSigner: false, isWritable: false },
    { pubkey: userPubkey, isSigner: true, isWritable: true },
    { pubkey: userStakePda, isSigner: false, isWritable: true },
    { pubkey: stakeVaultPda, isSigner: false, isWritable: true },
    { pubkey: ownerKnsAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  // Create withdraw instruction
  const withdrawInstruction = new TransactionInstruction({
    keys: accounts,
    programId: STAKING_PROGRAM_ID,
    data: instructionData,
  });

  // Build transaction
  const transaction = new Transaction().add(withdrawInstruction);

  // Get recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = userPubkey;

  return transaction;
}

// Claim instruction discriminator from IDL (imported from constants)

/**
 * Build a claim rewards transaction for the user to sign and send
 * Claims all pending USDC rewards
 */
export async function buildClaimTransaction(
  userPubkey: PublicKey,
  rpcEndpoint: string = STAKING_RPC_ENDPOINT
): Promise<Transaction> {
  const connection = new Connection(rpcEndpoint, "confirmed");

  // Derive config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    STAKING_PROGRAM_ID
  );

  // Get USDC mint from config
  const configInfo = await connection.getAccountInfo(configPda);
  if (!configInfo) {
    throw new Error("Staking program not initialized");
  }
  // Config layout: discriminator(8) + admin(32) + kns_mint(32) + usdc_mint(32)
  const usdcMint = new PublicKey(configInfo.data.subarray(72, 104));

  // Derive user_stake PDA
  const [userStakePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_stake"), userPubkey.toBuffer()],
    STAKING_PROGRAM_ID
  );

  // Derive rewards_vault PDA
  const [rewardsVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("rewards_vault")],
    STAKING_PROGRAM_ID
  );

  // Get user's USDC associated token account
  const ownerUsdcAta = getAssociatedTokenAddressSync(usdcMint, userPubkey);

  // Create ATA instruction (idempotent - does nothing if account exists)
  const createAtaInstruction = createAssociatedTokenAccountIdempotentInstruction(
    userPubkey, // payer
    ownerUsdcAta, // associatedToken
    userPubkey, // owner
    usdcMint // mint
  );

  // Build instruction data: discriminator only (8 bytes, no args)
  const instructionData = CLAIM_DISCRIMINATOR;

  // Build accounts array matching IDL order (7 accounts)
  const accounts = [
    { pubkey: configPda, isSigner: false, isWritable: true },
    { pubkey: usdcMint, isSigner: false, isWritable: false },
    { pubkey: userPubkey, isSigner: true, isWritable: true },
    { pubkey: userStakePda, isSigner: false, isWritable: true },
    { pubkey: rewardsVaultPda, isSigner: false, isWritable: true },
    { pubkey: ownerUsdcAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  // Create claim instruction
  const claimInstruction = new TransactionInstruction({
    keys: accounts,
    programId: STAKING_PROGRAM_ID,
    data: instructionData,
  });

  // Build transaction: create ATA first (if needed), then claim
  const transaction = new Transaction().add(createAtaInstruction).add(claimInstruction);

  // Get recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = userPubkey;

  return transaction;
}

// Lock tier labels for history display
const LOCK_TIER_LABELS: Record<number, string> = {
  0: "Flexible",
  1: "3 Months",
  2: "6 Months",
  3: "9 Months",
  4: "12 Months",
};

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
function parseStakeInstructionData(data: Buffer): { amount: number; lockTier: number } | null {
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
 * Fetch staking/unstaking history for a wallet
 * Queries on-chain transaction history for all stake/unstake actions
 */
export async function fetchStakingHistory(
  userPubkey: PublicKey,
  rpcEndpoint: string = STAKING_RPC_ENDPOINT
): Promise<StakingHistoryEntry[]> {
  const connection = new Connection(rpcEndpoint, "confirmed");

  // Derive user_stake PDA
  const [userStakePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_stake"), userPubkey.toBuffer()],
    STAKING_PROGRAM_ID
  );

  // Get all transaction signatures for the user_stake PDA
  const signatures = await connection.getSignaturesForAddress(userStakePda, {
    limit: 100,
  });

  if (signatures.length === 0) {
    return [];
  }

  const history: StakingHistoryEntry[] = [];

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

        if (matchesDiscriminator(data, STAKE_DISCRIMINATOR)) {
          const parsed = parseStakeInstructionData(data);
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
          const balanceChange = getTokenBalanceChange(tx.meta, userPubkey.toBase58());
          history.push({
            date: blockTime,
            action: "unstake",
            amount: Math.abs(balanceChange),
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
 * Parse distribute_rewards instruction data
 * Layout: discriminator(8) + amount(8)
 */
function parseDistributeRewardsData(data: Buffer): number | null {
  if (data.length < 16) return null;
  const amountRaw = data.readBigUInt64LE(8);
  return Number(amountRaw) / Math.pow(10, USDC_DECIMALS);
}

/**
 * Get USDC balance change from transaction meta (for claim transactions)
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

/**
 * Calculate distribution period dates from claim period
 * Bi-weekly periods: period 0 = days 0-13, period 1 = days 14-27, etc.
 */
function calculateDistributionPeriod(claimPeriod: bigint): { start: Date; end: Date } {
  const periodStartDay = claimPeriod * 14n;
  const periodEndDay = periodStartDay + 13n;

  // Convert days to milliseconds from Unix epoch
  const startMs = Number(periodStartDay) * 86400 * 1000;
  const endMs = Number(periodEndDay) * 86400 * 1000;

  return {
    start: new Date(startMs),
    end: new Date(endMs),
  };
}

/**
 * Fetch user's reward distribution history
 * Returns formatted data for display in the reward distribution history table
 */
export async function fetchUserRewardDistributionHistory(
  userPubkey: PublicKey,
  rpcEndpoint: string = STAKING_RPC_ENDPOINT,
  limit: number = 50
): Promise<RewardDistributionHistoryEntry[]> {
  const connection = new Connection(rpcEndpoint, "confirmed");

  // Derive user_stake PDA to get user's weighted stake
  const [userStakePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_stake"), userPubkey.toBuffer()],
    STAKING_PROGRAM_ID
  );

  // Derive config PDA to fetch distribution transactions
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    STAKING_PROGRAM_ID
  );

  // Fetch user stake account to get user's weighted stake
  const userStakeInfo = await connection.getAccountInfo(userStakePda);
  if (!userStakeInfo) {
    return [];
  }

  // Get user's weighted stake
  const userWeightedStake = readU128LE(userStakeInfo.data, 68);

  if (userWeightedStake === 0n) {
    return [];
  }

  // Get all transaction signatures for the config PDA (where distribute_rewards happens)
  const signatures = await connection.getSignaturesForAddress(configPda, {
    limit,
  });

  if (signatures.length === 0) {
    return [];
  }

  const history: RewardDistributionHistoryEntry[] = [];

  // Fetch config to get total weighted stake at the time
  const configInfo = await connection.getAccountInfo(configPda);
  if (!configInfo) {
    return [];
  }

  const totalWeightedStake = readU128LE(configInfo.data, 106);

  // Calculate user's share percentage
  const yourWeightedShare = totalWeightedStake > 0n
    ? (Number(userWeightedStake) / Number(totalWeightedStake)) * 100
    : 0;

  // Get current claim period from user stake account (offset 100)
  const currentClaimPeriod = userStakeInfo.data.readBigInt64LE(100);

  // Fetch and parse each transaction for distribute_rewards instructions
  for (const sig of signatures) {
    try {
      const tx = await connection.getTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx || !tx.transaction.message) {
        continue;
      }

      const message = tx.transaction.message;
      const blockTime = tx.blockTime ? new Date(tx.blockTime * 1000) : new Date();

      // Get account keys
      const accountKeys = message.staticAccountKeys || (message as any).accountKeys || [];

      // Find program index
      const programIndex = accountKeys.findIndex(
        (key: PublicKey) => key.toBase58() === STAKING_PROGRAM_ID.toBase58()
      );

      if (programIndex === -1) {
        continue;
      }

      // Get compiled instructions
      const instructions = message.compiledInstructions || (message as any).instructions || [];

      for (const ix of instructions) {
        const programIdIndex = ix.programIdIndex;
        if (programIdIndex !== programIndex) continue;

        const data = Buffer.from(ix.data);

        // Check if this is a distribute_rewards instruction
        if (matchesDiscriminator(data, DISTRIBUTE_REWARDS_DISCRIMINATOR)) {
          // Parse the total reward amount from instruction data
          // Layout: discriminator(8) + amount(8)
          if (data.length < 16) {
            continue;
          }

          const totalRewardPool = Number(data.readBigUInt64LE(8)) / Math.pow(10, USDC_DECIMALS);

          // Calculate user's allocated rewards based on weighted share
          const rewardsEarned = totalRewardPool * (yourWeightedShare / 100);

          // Calculate which distribution period this corresponds to
          // Use the current claim period as reference
          const { start: distributionPeriodStart, end: distributionPeriodEnd } = calculateDistributionPeriod(currentClaimPeriod);

          const entry = {
            date: blockTime,
            distributionPeriodStart,
            distributionPeriodEnd,
            totalRewardPool,
            yourWeightedShare,
            rewardsEarned,
            txSignature: sig.signature,
            blockTime: tx.blockTime || 0,
          };

          history.push(entry);
        }
      }
    } catch (err) {
      // Silently continue on error
      continue;
    }
  }

  // Sort by date descending (newest first)
  history.sort((a, b) => b.date.getTime() - a.date.getTime());

  return history;
}

/**
 * Fetch user's USDC reward claim history
 * Shows when the user actually claimed their USDC rewards
 */
export async function fetchUserClaimHistory(
  userPubkey: PublicKey,
  rpcEndpoint: string = STAKING_RPC_ENDPOINT,
  limit: number = 50
): Promise<import("./types").ClaimHistoryEntry[]> {
  const connection = new Connection(rpcEndpoint, "confirmed");

  // Derive user_stake PDA
  const [userStakePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_stake"), userPubkey.toBuffer()],
    STAKING_PROGRAM_ID
  );

  // Get all transaction signatures for the user_stake PDA
  const signatures = await connection.getSignaturesForAddress(userStakePda, {
    limit,
  });

  if (signatures.length === 0) {
    return [];
  }

  const claims: import("./types").ClaimHistoryEntry[] = [];

  // Fetch and parse each transaction for claim instructions
  for (const sig of signatures) {
    try {
      const tx = await connection.getTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx || !tx.transaction.message) {
        continue;
      }

      const message = tx.transaction.message;
      const blockTime = tx.blockTime ? new Date(tx.blockTime * 1000) : new Date();

      // Get account keys
      const accountKeys = message.staticAccountKeys || (message as any).accountKeys || [];

      // Find program index
      const programIndex = accountKeys.findIndex(
        (key: PublicKey) => key.toBase58() === STAKING_PROGRAM_ID.toBase58()
      );

      if (programIndex === -1) {
        continue;
      }

      // Get compiled instructions
      const instructions = message.compiledInstructions || (message as any).instructions || [];

      for (const ix of instructions) {
        const programIdIndex = ix.programIdIndex;
        if (programIdIndex !== programIndex) continue;

        const data = Buffer.from(ix.data);

        // Check if this is a claim instruction
        if (matchesDiscriminator(data, CLAIM_DISCRIMINATOR)) {
          // Get USDC balance change from transaction metadata
          const amountClaimed = getUsdcBalanceChange(tx.meta, userPubkey.toBase58());

          if (amountClaimed > 0) {
            claims.push({
              date: blockTime,
              amountClaimed,
              txSignature: sig.signature,
              blockTime: tx.blockTime || 0,
            });
          }
        }
      }
    } catch (err) {
      // Silently continue on error
      continue;
    }
  }

  // Sort by date descending (newest first)
  claims.sort((a, b) => b.date.getTime() - a.date.getTime());

  return claims;
}
