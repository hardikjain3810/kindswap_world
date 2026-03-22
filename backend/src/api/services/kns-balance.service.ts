import { Injectable, Logger } from '@nestjs/common';
import { HeliusRpcService } from './helius-rpc.service';

/**
 * Token transfer data (generic format from any source)
 */
interface TokenTransfer {
  blockTime: number;
  txHash: string;
  amount: string;
  decimals: number;
  changeType: 'inc' | 'dec';
}

// KNS Token configuration
const KNS_TOKEN_MINT = 'CVfniqNEj2f4Yd8Z4TEtaTU49gWNTwUyCiDDUbsZpump';
const KNS_DECIMALS = 6;

// KNS Holding Points Tiers (Section 6.1 of spec)
export const KNS_HOLDING_TIERS = [
  { minBalance: 0, maxBalance: 9999, pointsPerDay: 0, tierName: '< 10k' },
  { minBalance: 10000, maxBalance: 49999, pointsPerDay: 50, tierName: '10k-49k' },
  { minBalance: 50000, maxBalance: 99999, pointsPerDay: 150, tierName: '50k-99k' },
  { minBalance: 100000, maxBalance: 249999, pointsPerDay: 300, tierName: '100k-249k' },
  { minBalance: 250000, maxBalance: Infinity, pointsPerDay: 500, tierName: '250k+' },
];

/**
 * Balance change event for time-weighted calculation
 */
interface BalanceChange {
  timestamp: number; // Unix timestamp in seconds
  balance: number; // KNS balance after this change
}

/**
 * Result of time-weighted average balance calculation
 */
export interface TWABResult {
  wallet: string;
  currentBalance: number;
  timeWeightedAverageBalance: number;
  tierName: string;
  pointsEarned: number;
  periodStart: number;
  periodEnd: number;
  transferCount: number;
}

/**
 * KNS Balance Service
 * Calculates time-weighted average balance for KNS holding points
 * Prevents gaming via flash balance manipulation
 */
@Injectable()
export class KnsBalanceService {
  private readonly logger = new Logger(KnsBalanceService.name);

  constructor(
    private readonly heliusRpcService: HeliusRpcService,
  ) {}

  /**
   * Get the tier for a given KNS balance
   */
  getTierForBalance(balance: number): {
    tierName: string;
    pointsPerDay: number;
    minBalance: number;
    maxBalance: number;
  } {
    for (const tier of KNS_HOLDING_TIERS) {
      if (balance >= tier.minBalance && balance <= tier.maxBalance) {
        return tier;
      }
    }
    // Default to lowest tier
    return KNS_HOLDING_TIERS[0];
  }

  /**
   * Convert raw token amount to KNS (human-readable)
   */
  rawToKns(rawBalance: string | number | bigint): number {
    const raw = typeof rawBalance === 'string' ? BigInt(rawBalance) : BigInt(rawBalance);
    return Number(raw) / Math.pow(10, KNS_DECIMALS);
  }

  /**
   * Calculate time-weighted average balance for a wallet over the last 24 hours
   * This is the core anti-gaming mechanism
   *
   * Formula:
   * TWAB = Σ(balance_i × duration_i) / total_duration
   *
   * @param wallet - Wallet address
   * @param currentBalanceOverride - Optional current balance (from Helius RPC)
   */
  async calculateTimeWeightedAverageBalance(
    wallet: string,
    currentBalanceOverride?: number,
  ): Promise<TWABResult> {
    const now = Math.floor(Date.now() / 1000);
    const periodStart = now - 24 * 60 * 60; // 24 hours ago
    const periodEnd = now;
    const totalDuration = periodEnd - periodStart;

    // Get current balance - use override if provided (from Helius), otherwise fetch from Helius
    let currentBalance: number;
    if (currentBalanceOverride !== undefined) {
      currentBalance = currentBalanceOverride;
      this.logger.debug(`Using provided balance for ${wallet}: ${currentBalance} KNS`);
    } else {
      currentBalance = await this.heliusRpcService.getTokenBalance(wallet);
      this.logger.debug(`Fetched balance for ${wallet}: ${currentBalance} KNS`);
    }

    // FAST PATH OPTIMIZATION: Check if wallet has any transactions in last 24h
    // If no transactions, TWAB = current balance (saves expensive Solscan API call)
    const hasRecentTx = await this.heliusRpcService.hasTransactionsInWindow(wallet, 24);

    if (!hasRecentTx) {
      // FAST PATH: No transfers in 24h → TWAB = current balance
      const tier = this.getTierForBalance(currentBalance);
      this.logger.debug(
        `Fast path for ${wallet}: No recent transactions, TWAB = current balance (${currentBalance.toFixed(2)} KNS)`,
      );
      return {
        wallet,
        currentBalance,
        timeWeightedAverageBalance: currentBalance,
        tierName: tier.tierName,
        pointsEarned: tier.pointsPerDay,
        periodStart,
        periodEnd,
        transferCount: 0,
      };
    }

    // SLOW PATH: Has transfers → Need detailed history from Helius RPC
    this.logger.debug(`Slow path for ${wallet}: Has recent transactions, fetching detailed history`);
    const transfers = await this.heliusRpcService.getTokenTransfers(
      wallet,
      KNS_TOKEN_MINT,
      24, // 24 hours = 1 day
      100, // Max 100 transactions
    );

    // If no transfers, the balance was constant throughout the period
    if (transfers.length === 0) {
      const tier = this.getTierForBalance(currentBalance);
      return {
        wallet,
        currentBalance,
        timeWeightedAverageBalance: currentBalance,
        tierName: tier.tierName,
        pointsEarned: tier.pointsPerDay,
        periodStart,
        periodEnd,
        transferCount: 0,
      };
    }

    // Build balance change timeline
    // Start from current balance and work backwards
    const balanceChanges = this.buildBalanceTimeline(transfers, currentBalance, periodStart, now);

    // Calculate time-weighted average
    const twab = this.calculateTWAB(balanceChanges, periodStart, periodEnd);

    const tier = this.getTierForBalance(twab);

    return {
      wallet,
      currentBalance,
      timeWeightedAverageBalance: Math.floor(twab), // Round down to prevent gaming
      tierName: tier.tierName,
      pointsEarned: tier.pointsPerDay,
      periodStart,
      periodEnd,
      transferCount: transfers.length,
    };
  }

  /**
   * Build a timeline of balance changes from transfers
   * Works backwards from current balance
   */
  private buildBalanceTimeline(
    transfers: TokenTransfer[],
    currentBalance: number,
    periodStart: number,
    periodEnd: number,
  ): BalanceChange[] {
    // Sort transfers by time descending (most recent first)
    const sortedTransfers = [...transfers].sort((a, b) => b.blockTime - a.blockTime);

    const timeline: BalanceChange[] = [];
    let runningBalance = currentBalance;

    // Start with current balance at period end
    timeline.push({
      timestamp: periodEnd,
      balance: currentBalance,
    });

    // Work backwards through transfers
    for (const tx of sortedTransfers) {
      // Only consider transfers within our period
      if (tx.blockTime < periodStart) {
        break;
      }

      // Calculate the balance change
      const amount = this.rawToKns(tx.amount);

      // Reverse the change to get previous balance
      // 'inc' means balance increased, so before it was lower
      // 'dec' means balance decreased, so before it was higher
      if (tx.changeType === 'inc') {
        runningBalance -= amount;
      } else if (tx.changeType === 'dec') {
        runningBalance += amount;
      }

      // Add balance point just before this transfer
      timeline.push({
        timestamp: tx.blockTime,
        balance: Math.max(0, runningBalance), // Balance can't go negative
      });
    }

    // Add starting balance at period start (the balance before any transfers in our window)
    timeline.push({
      timestamp: periodStart,
      balance: Math.max(0, runningBalance),
    });

    // Sort by timestamp ascending for TWAB calculation
    timeline.sort((a, b) => a.timestamp - b.timestamp);

    return timeline;
  }

  /**
   * Calculate Time-Weighted Average Balance from timeline
   */
  private calculateTWAB(
    timeline: BalanceChange[],
    periodStart: number,
    periodEnd: number,
  ): number {
    if (timeline.length === 0) {
      return 0;
    }

    const totalDuration = periodEnd - periodStart;
    if (totalDuration <= 0) {
      return timeline[timeline.length - 1]?.balance || 0;
    }

    let weightedSum = 0;

    for (let i = 0; i < timeline.length - 1; i++) {
      const current = timeline[i];
      const next = timeline[i + 1];

      // Duration this balance was held
      const duration = next.timestamp - current.timestamp;

      // Add weighted contribution
      weightedSum += current.balance * duration;
    }

    // Add the final segment (from last change to period end)
    const lastChange = timeline[timeline.length - 1];
    if (lastChange.timestamp < periodEnd) {
      const finalDuration = periodEnd - lastChange.timestamp;
      weightedSum += lastChange.balance * finalDuration;
    }

    return weightedSum / totalDuration;
  }

  /**
   * Batch calculate TWAB for multiple wallets
   * Used by the daily scheduler
   * @param wallets - Array of wallet addresses
   * @param balancesMap - Optional map of wallet -> current balance (from Helius RPC)
   */
  async calculateTWABForWallets(
    wallets: string[],
    balancesMap?: Map<string, number>,
  ): Promise<TWABResult[]> {
    const results: TWABResult[] = [];

    for (const wallet of wallets) {
      try {
        const currentBalance = balancesMap?.get(wallet);
        const result = await this.calculateTimeWeightedAverageBalance(wallet, currentBalance);
        results.push(result);

        // Small delay between wallets to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        this.logger.error(`Failed to calculate TWAB for ${wallet}: ${error}`);
        // Continue with other wallets
      }
    }

    return results;
  }

  /**
   * Get KNS token mint address
   */
  getKnsTokenMint(): string {
    return KNS_TOKEN_MINT;
  }
}
