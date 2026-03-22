import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { UserPoints } from '../entities/user-points.entity';

@Injectable()
export class UserPointsRepository {
  constructor(
    @InjectRepository(UserPoints)
    private readonly repository: Repository<UserPoints>,
  ) {}

  /**
   * Find points record by wallet
   */
  async findByWallet(wallet: string): Promise<UserPoints | null> {
    return this.repository.findOne({
      where: { wallet },
    });
  }

  /**
   * Get or create points record for wallet
   */
  async getOrCreate(wallet: string): Promise<UserPoints> {
    let record = await this.findByWallet(wallet);

    if (!record) {
      record = this.repository.create({
        wallet,
        swapPoints: 0,
        communityPoints: 0,
        knsPoints: 0,
        totalPoints: 0,
        swapPointsToday: 0,
        communityPointsThisWeek: 0,
        totalSwapVolumeUSD: '0',
        totalSwapsCount: 0,
        averageSwapSize: '0',
        version: 0,
      });
      await this.repository.save(record);
    }

    return record;
  }

  /**
   * Add swap points
   */
  async addSwapPoints(wallet: string, points: number): Promise<UserPoints> {
    const record = await this.getOrCreate(wallet);
    record.swapPoints += points;
    record.swapPointsToday += points;
    record.totalPoints += points;
    record.lastPointsUpdate = new Date();
    return this.repository.save(record);
  }

  /**
   * Add community points
   */
  async addCommunityPoints(wallet: string, points: number): Promise<UserPoints> {
    const record = await this.getOrCreate(wallet);
    record.communityPoints += points;
    record.communityPointsThisWeek += points;
    record.totalPoints += points;
    record.lastPointsUpdate = new Date();
    return this.repository.save(record);
  }

  /**
   * Add KNS holding points
   */
  async addKNSPoints(wallet: string, points: number): Promise<UserPoints> {
    const record = await this.getOrCreate(wallet);
    record.knsPoints += points;
    record.totalPoints += points;
    record.lastPointsUpdate = new Date();
    return this.repository.save(record);
  }

  /**
   * Reset daily swap points counter
   */
  async resetDailySwapCounter(wallet: string): Promise<UserPoints> {
    const record = await this.getOrCreate(wallet);
    record.swapPointsToday = 0;
    record.lastSwapDayReset = new Date();
    return this.repository.save(record);
  }

  /**
   * Reset weekly community points counter
   */
  async resetWeeklyCounter(wallet: string): Promise<UserPoints> {
    const record = await this.getOrCreate(wallet);
    record.communityPointsThisWeek = 0;
    record.lastWeekReset = new Date();
    return this.repository.save(record);
  }

  /**
   * Update swap volume and stats
   */
  async updateSwapStats(
    wallet: string,
    volumeUSD: number,
  ): Promise<UserPoints> {
    const record = await this.getOrCreate(wallet);
    const prevVolume = parseFloat(record.totalSwapVolumeUSD);
    const newVolume = prevVolume + volumeUSD;
    const newCount = record.totalSwapsCount + 1;
    const newAverage = newVolume / newCount;

    record.totalSwapVolumeUSD = newVolume.toString();
    record.totalSwapsCount = newCount;
    record.averageSwapSize = newAverage.toFixed(2);
    record.lastPointsUpdate = new Date();

    return this.repository.save(record);
  }

  /**
   * Update rank
   */
  async updateRank(wallet: string, currentRank: number, previousRank?: number): Promise<UserPoints> {
    const record = await this.getOrCreate(wallet);
    record.previousRank = record.currentRank ?? previousRank ?? undefined;
    record.currentRank = currentRank;

    if (currentRank === 1) {
      record.lastTopRankTime = new Date();
    }

    return this.repository.save(record);
  }

  /**
   * Get top 100 leaderboard for timeframe
   */
  async getLeaderboard(limit: number = 100): Promise<UserPoints[]> {
    return this.repository
      .find({
        where: { currentRank: IsNull() },
        order: { totalPoints: 'DESC' },
        take: limit,
      })
      .then(results => {
        // Filter and sort by totalPoints if ranks aren't set
        return results.sort((a, b) => b.totalPoints - a.totalPoints);
      });
  }

  /**
   * Get all users ranked - optimized to prevent N+1 queries
   * Uses explicit SELECT to avoid loading any relations
   */
  async getAllRanked(limit: number = 100): Promise<{
    wallet: string;
    totalPoints: number;
    swapPoints: number;
    communityPoints: number;
    knsPoints: number;
  }[]> {
    return this.repository
      .createQueryBuilder('up')
      .select([
        'up.wallet AS wallet',
        'up.totalPoints AS "totalPoints"',
        'up.swapPoints AS "swapPoints"',
        'up.communityPoints AS "communityPoints"',
        'up.knsPoints AS "knsPoints"',
      ])
      .orderBy('up.totalPoints', 'DESC')
      .limit(limit)
      .getRawMany();
  }

  /**
   * Batch reset daily swap counters - prevents N+1 queries
   * Resets all wallets that need resetting in a single query
   */
  async batchResetDailySwapCounters(): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .update(UserPoints)
      .set({
        swapPointsToday: 0,
        lastSwapDayReset: new Date(),
      })
      .where('lastSwapDayReset < CURRENT_DATE OR lastSwapDayReset IS NULL')
      .andWhere('swapPointsToday > 0')
      .execute();

    return result.affected || 0;
  }

  /**
   * Batch reset weekly community counters - prevents N+1 queries
   * Resets all wallets that need resetting in a single query
   */
  async batchResetWeeklyCounters(): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .update(UserPoints)
      .set({
        communityPointsThisWeek: 0,
        lastWeekReset: new Date(),
      })
      .where("lastWeekReset < CURRENT_DATE - INTERVAL '7 days' OR lastWeekReset IS NULL")
      .andWhere('communityPointsThisWeek > 0')
      .execute();

    return result.affected || 0;
  }

  /**
   * Find multiple wallets in a single query - for batch operations
   */
  async findByWallets(wallets: string[]): Promise<UserPoints[]> {
    if (wallets.length === 0) return [];

    return this.repository
      .createQueryBuilder('up')
      .where('up.wallet IN (:...wallets)', { wallets })
      .getMany();
  }

  /**
   * Get user rank by wallet
   */
  async getUserRank(wallet: string): Promise<number | null> {
    const record = await this.findByWallet(wallet);
    if (!record) return null;
    return record.currentRank || null;
  }

  /**
   * Count total users with points
   */
  async countActive(): Promise<number> {
    return this.repository.count({ where: { currentRank: IsNull() } });
  }

  /**
   * Bulk add KNS points to multiple wallets
   * Uses CASE WHEN for efficient bulk update
   * Processes in chunks to avoid query size limits
   *
   * @param walletPoints - Map of wallet address to points to add
   */
  async bulkAddKNSPoints(walletPoints: Map<string, number>): Promise<void> {
    if (walletPoints.size === 0) return;

    const wallets = Array.from(walletPoints.keys());
    const CHUNK_SIZE = 1000; // Process 1000 wallets per query

    for (let i = 0; i < wallets.length; i += CHUNK_SIZE) {
      const chunk = wallets.slice(i, i + CHUNK_SIZE);

      // Build CASE WHEN clauses
      let knsPointsCases = '';
      let totalPointsCases = '';

      for (const wallet of chunk) {
        const points = walletPoints.get(wallet)!;
        // Escape single quotes in wallet address
        const escapedWallet = wallet.replace(/'/g, "''");
        knsPointsCases += `WHEN '${escapedWallet}' THEN "knsPoints" + ${points} `;
        totalPointsCases += `WHEN '${escapedWallet}' THEN "totalPoints" + ${points} `;
      }

      const escapedWallets = chunk.map((w) => `'${w.replace(/'/g, "''")}'`).join(',');

      const query = `
        UPDATE user_points
        SET
          "knsPoints" = CASE wallet ${knsPointsCases} ELSE "knsPoints" END,
          "totalPoints" = CASE wallet ${totalPointsCases} ELSE "totalPoints" END,
          "lastPointsUpdate" = NOW()
        WHERE wallet IN (${escapedWallets})
      `;

      await this.repository.query(query);
    }

    const chunkCount = Math.ceil(wallets.length / CHUNK_SIZE);
    console.log(
      `[UserPointsRepo] Bulk updated ${walletPoints.size} wallets in ${chunkCount} batch${chunkCount > 1 ? 'es' : ''}`,
    );
  }

  /**
   * Ensure all wallets exist before bulk update
   * Create missing records in bulk
   * This prevents errors when trying to update non-existent records
   *
   * @param wallets - Array of wallet addresses
   */
  async ensureWalletsExist(wallets: string[]): Promise<void> {
    if (wallets.length === 0) return;

    // Find which wallets don't exist yet
    const existing = await this.findByWallets(wallets);
    const existingWallets = new Set(existing.map((up) => up.wallet));
    const missing = wallets.filter((w) => !existingWallets.has(w));

    if (missing.length === 0) return;

    // Bulk insert missing wallets
    const newRecords = missing.map((wallet) => ({
      wallet,
      swapPoints: 0,
      communityPoints: 0,
      knsPoints: 0,
      totalPoints: 0,
      swapPointsToday: 0,
      communityPointsThisWeek: 0,
      totalSwapVolumeUSD: '0',
      totalSwapsCount: 0,
      averageSwapSize: '0',
      version: 0,
    }));

    await this.repository
      .createQueryBuilder()
      .insert()
      .into(UserPoints)
      .values(newRecords)
      .execute();

    console.log(`[UserPointsRepo] Created ${missing.length} new user_points records`);
  }
}
