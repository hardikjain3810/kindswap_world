/**
 * Shared TypeScript types and interfaces
 */

export interface ConversionPolicy {
  maxUsdPerTokenPerRun: number;
  maxUsdTotalPerRun: number;
  maxUsdTotalPerDay: number;
  maxSlippageBps: number;
  maxPriceImpactBps: number;
  minTokenValueUsd: number;
  treasurySplitPct: number;
  charitySplitPct: number;
  rebateSplitPct: number;
  stakingSplitPct: number;
  conversionsPaused: boolean;
  pauseReason?: string;
}

export interface TokenBalance {
  wallet: string;
  mint: string;
  balance: number;
  lastUpdated: Date;
}

export interface ConversionJob {
  id: string;
  mint: string;
  amount: number;
  expectedOut: number;
  actualOut?: number;
  routeMeta?: any;
  txSig?: string;
  status: 'planned' | 'executing' | 'success' | 'failed';
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  executedAt?: Date;
  confirmedAt?: Date;
}

export interface DistributionRecord {
  id: string;
  batchId: string;
  fromWallet: string;
  toWallet: string;
  amountUsdc: number;
  txSig: string;
  splitPct: number;
  createdAt: Date;
}

export interface WalletConfig {
  treasury: string;
  charity: string;
  staking: string;
  rebate: string;
}
