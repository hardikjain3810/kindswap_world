import { Buffer } from "buffer";
import { PublicKey } from "@solana/web3.js";

export const STAKING_PROGRAM_ID = new PublicKey("FaYTrVJ2KSH5iqjjEW5KmPQH9yt9WbuRSkzYk8b3NuwK");
export const STAKING_RPC_ENDPOINT = "https://api.devnet.solana.com";
export const KNS_DECIMALS = 9;

export const USER_STAKE_DISCRIMINATOR = Buffer.from([102, 53, 163, 107, 9, 138, 87, 153]);
export const CLAIM_DISCRIMINATOR = Buffer.from([62, 198, 214, 193, 213, 159, 108, 210]);
export const DISTRIBUTE_REWARDS_DISCRIMINATOR = Buffer.from([60, 184, 132, 183, 145, 176, 221, 199]);
export const USDC_DECIMALS = 6;
export const REWARD_PRECISION = 1_000_000_000_000n; // 1e12

export type LockTierKey = "Flexible" | "M3" | "M6" | "M9" | "M12";

export const LOCK_TIER_BY_INDEX: Record<number, LockTierKey> = {
  0: "Flexible",
  1: "M3",
  2: "M6",
  3: "M9",
  4: "M12",
};

export const LOCK_TIER_MULTIPLIERS: Record<LockTierKey, number> = {
  Flexible: 1.0,
  M3: 1.0,
  M6: 1.5,
  M9: 2.0,
  M12: 3.0,
};
