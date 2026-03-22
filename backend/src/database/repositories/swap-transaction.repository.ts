import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SwapTransaction } from '../entities/swap-transaction.entity';

@Injectable()
export class SwapTransactionRepository {
  constructor(
    @InjectRepository(SwapTransaction)
    private readonly repository: Repository<SwapTransaction>,
  ) {}

  /**
   * Find swap by signature (transaction ID)
   */
  async findBySignature(signature: string): Promise<SwapTransaction | null> {
    return this.repository.findOne({
      where: { signature },
    });
  }

  /**
   * Create new swap transaction record
   */
  async create(data: Partial<SwapTransaction>): Promise<SwapTransaction> {
    const transaction = this.repository.create(data);
    return this.repository.save(transaction);
  }

  /**
   * Update swap transaction status
   */
  async updateStatus(
    signature: string,
    status: 'pending' | 'confirmed' | 'failed' | 'cancelled',
    blockHeight?: string,
  ): Promise<SwapTransaction> {
    await this.repository.update(
      { signature },
      {
        status,
        blockHeight,
      },
    );

    const updated = await this.findBySignature(signature);
    if (!updated) {
      throw new Error(`Swap transaction ${signature} not found`);
    }
    return updated;
  }

  /**
   * Get all swaps for a wallet
   */
  async findByWallet(wallet: string, limit: number = 100, offset: number = 0): Promise<SwapTransaction[]> {
    return this.repository.find({
      where: { wallet },
      order: { executedAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get recent swaps
   */
  async getRecentSwaps(limit: number = 50): Promise<SwapTransaction[]> {
    return this.repository.find({
      where: { status: 'confirmed' },
      order: { executedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get pending swaps
   */
  async getPendingSwaps(limit: number = 100): Promise<SwapTransaction[]> {
    return this.repository.find({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  /**
   * Get failed swaps
   */
  async getFailedSwaps(limit: number = 100, offset: number = 0): Promise<SwapTransaction[]> {
    return this.repository.find({
      where: { status: 'failed' },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Count swaps by wallet
   */
  async countByWallet(wallet: string): Promise<number> {
    return this.repository.count({ where: { wallet } });
  }

  /**
   * Get total volume by wallet
   */
  async getTotalVolumeByWallet(wallet: string): Promise<string> {
    const result = await this.repository
      .createQueryBuilder('st')
      .select('SUM(st.inputAmountUSD)', 'total')
      .where('st.wallet = :wallet', { wallet })
      .andWhere('st.status = :status', { status: 'confirmed' })
      .getRawOne();

    return result?.total || '0';
  }

  /**
   * Get swaps by status
   */
  async findByStatus(
    status: 'pending' | 'confirmed' | 'failed' | 'cancelled',
    limit: number = 100,
  ): Promise<SwapTransaction[]> {
    return this.repository.find({
      where: { status },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Count total swaps
   */
  async countTotal(): Promise<number> {
    return this.repository.count();
  }

  /**
   * Count confirmed swaps
   */
  async countConfirmed(): Promise<number> {
    return this.repository.count({ where: { status: 'confirmed' } });
  }

  /**
   * Mark swap as verified
   */
  async markVerified(signature: string): Promise<SwapTransaction> {
    await this.repository.update(
      { signature },
      { verifiedAt: new Date() },
    );

    const updated = await this.findBySignature(signature);
    if (!updated) {
      throw new Error(`Swap transaction ${signature} not found`);
    }
    return updated;
  }

  /**
   * Get total volume across all confirmed swaps
   */
  async getTotalVolume(): Promise<string> {
    const result = await this.repository
      .createQueryBuilder('st')
      .select('SUM(st.inputAmountUSD)', 'total')
      .where('st.status = :status', { status: 'confirmed' })
      .getRawOne();

    return result?.total || '0';
  }

  /**
   * Find swaps needing points award
   */
  async findSwapsNeedingPointsAward(limit: number = 100): Promise<SwapTransaction[]> {
    return this.repository.find({
      where: {
        status: 'confirmed',
        pointsAwarded: false,
      },
      order: { executedAt: 'ASC' },
      take: limit,
    });
  }

  /**
   * Update points awarded flag
   */
  async updatePointsAwarded(
    signature: string,
    pointsAwarded: boolean,
    pointsAwardedAmount: number = 0,
  ): Promise<SwapTransaction> {
    await this.repository.update(
      { signature },
      {
        pointsAwarded,
        pointsAwardedAmount,
      },
    );

    const updated = await this.findBySignature(signature);
    if (!updated) {
      throw new Error(`Swap transaction ${signature} not found`);
    }
    return updated;
  }

  /**
   * Get swap points grouped by wallet within a timeframe
   * Used for timeframe-based leaderboard
   */
  async getSwapPointsByTimeframe(
    timeframe: 'today' | 'week' | 'allTime',
    limit: number = 100,
  ): Promise<{ wallet: string; swapPoints: number }[]> {
    const qb = this.repository
      .createQueryBuilder('st')
      .select('st.wallet', 'wallet')
      .addSelect('COALESCE(SUM(st.pointsAwardedAmount), 0)', 'swapPoints')
      .where('st.status = :status', { status: 'confirmed' })
      .andWhere('st.pointsAwarded = :awarded', { awarded: true });

    // Apply timeframe filter
    if (timeframe === 'today') {
      qb.andWhere('st.executedAt >= CURRENT_DATE');
    } else if (timeframe === 'week') {
      qb.andWhere("st.executedAt >= CURRENT_DATE - INTERVAL '7 days'");
    }
    // 'allTime' has no date filter

    return qb
      .groupBy('st.wallet')
      .orderBy('"swapPoints"', 'DESC')
      .limit(limit)
      .getRawMany();
  }
}
