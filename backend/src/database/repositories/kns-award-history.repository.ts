import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { KnsAwardHistory } from '../entities/kns-award-history.entity';
import { TWABResult } from '../../api/services/kns-balance.service';

@Injectable()
export class KnsAwardHistoryRepository {
  constructor(
    @InjectRepository(KnsAwardHistory)
    private readonly repository: Repository<KnsAwardHistory>,
  ) {}

  /**
   * Check if award already exists for wallet on date
   */
  async hasAwardForDate(wallet: string, date: Date): Promise<boolean> {
    const dateOnly = this.toDateOnly(date);
    const existing = await this.repository.findOne({
      where: {
        wallet,
        awardDate: dateOnly,
      },
    });
    return !!existing;
  }

  /**
   * Create award record from TWAB result
   */
  async createAwardRecord(twabResult: TWABResult, awardDate: Date): Promise<KnsAwardHistory> {
    const record = this.repository.create({
      wallet: twabResult.wallet,
      awardDate: this.toDateOnly(awardDate),
      currentBalance: twabResult.currentBalance.toString(),
      timeWeightedAverageBalance: twabResult.timeWeightedAverageBalance.toString(),
      tierName: twabResult.tierName,
      pointsAwarded: twabResult.pointsEarned,
      transferCount: twabResult.transferCount,
      periodStart: twabResult.periodStart.toString(),
      periodEnd: twabResult.periodEnd.toString(),
      status: twabResult.pointsEarned > 0 ? 'success' : 'skipped',
    });

    return this.repository.save(record);
  }

  /**
   * Create error record for failed processing
   */
  async createErrorRecord(
    wallet: string,
    awardDate: Date,
    errorMessage: string,
  ): Promise<KnsAwardHistory> {
    const record = this.repository.create({
      wallet,
      awardDate: this.toDateOnly(awardDate),
      currentBalance: '0',
      timeWeightedAverageBalance: '0',
      tierName: 'error',
      pointsAwarded: 0,
      transferCount: 0,
      periodStart: '0',
      periodEnd: '0',
      status: 'error',
      errorMessage,
    });

    return this.repository.save(record);
  }

  /**
   * Get award history for a wallet
   */
  async getAwardHistoryForWallet(
    wallet: string,
    limit: number = 30,
    offset: number = 0,
  ): Promise<{ records: KnsAwardHistory[]; total: number }> {
    const [records, total] = await this.repository.findAndCount({
      where: { wallet },
      order: { awardDate: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { records, total };
  }

  /**
   * Get total KNS points awarded to wallet
   */
  async getTotalPointsForWallet(wallet: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('award')
      .select('SUM(award.pointsAwarded)', 'total')
      .where('award.wallet = :wallet', { wallet })
      .andWhere('award.status = :status', { status: 'success' })
      .getRawOne();

    return parseInt(result?.total || '0', 10);
  }

  /**
   * Get awards for a specific date
   */
  async getAwardsForDate(date: Date): Promise<KnsAwardHistory[]> {
    return this.repository.find({
      where: { awardDate: this.toDateOnly(date) },
      order: { pointsAwarded: 'DESC' },
    });
  }

  /**
   * Get stats for a date range
   */
  async getStatsForDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalPoints: number;
    totalWallets: number;
    awardsByTier: Record<string, number>;
  }> {
    const start = this.toDateOnly(startDate);
    const end = this.toDateOnly(endDate);

    // Total points
    const totalResult = await this.repository
      .createQueryBuilder('award')
      .select('SUM(award.pointsAwarded)', 'total')
      .where('award.awardDate BETWEEN :start AND :end', { start, end })
      .andWhere('award.status = :status', { status: 'success' })
      .getRawOne();

    // Unique wallets
    const walletsResult = await this.repository
      .createQueryBuilder('award')
      .select('COUNT(DISTINCT award.wallet)', 'count')
      .where('award.awardDate BETWEEN :start AND :end', { start, end })
      .andWhere('award.status = :status', { status: 'success' })
      .getRawOne();

    // Awards by tier
    const tierResults = await this.repository
      .createQueryBuilder('award')
      .select('award.tierName', 'tier')
      .addSelect('COUNT(*)', 'count')
      .where('award.awardDate BETWEEN :start AND :end', { start, end })
      .andWhere('award.status = :status', { status: 'success' })
      .groupBy('award.tierName')
      .getRawMany();

    const awardsByTier: Record<string, number> = {};
    for (const row of tierResults) {
      awardsByTier[row.tier] = parseInt(row.count, 10);
    }

    return {
      totalPoints: parseInt(totalResult?.total || '0', 10),
      totalWallets: parseInt(walletsResult?.count || '0', 10),
      awardsByTier,
    };
  }

  /**
   * Get wallets that have not received award today
   * Returns list of wallets with KNS points > 0 that haven't been processed today
   */
  async getWalletsNotProcessedToday(
    allWallets: string[],
    today: Date,
  ): Promise<string[]> {
    if (allWallets.length === 0) return [];

    // Use date-only string format to avoid timezone issues with PostgreSQL DATE columns
    const todayDateString = today.toISOString().split('T')[0]; // '2026-03-02'

    console.log(`[DEBUG getWalletsNotProcessedToday] Checking ${allWallets.length} wallets for date ${todayDateString}`);
    console.log(`[DEBUG] Sample wallets: ${allWallets.slice(0, 3).join(', ')}`);

    // Use raw query to avoid TypeORM date handling issues
    const processed = await this.repository.query(
      `SELECT wallet FROM kns_award_history WHERE "awardDate" = $1 AND wallet = ANY($2)`,
      [todayDateString, allWallets]
    );

    console.log(`[DEBUG] Found ${processed.length} already processed wallets`);

    const processedWallets = new Set(processed.map((r: any) => r.wallet));
    const unprocessed = allWallets.filter((w) => !processedWallets.has(w));

    console.log(`[DEBUG] Returning ${unprocessed.length} unprocessed wallets`);

    return unprocessed;
  }

  /**
   * Convert Date to date-only (strip time)
   */
  private toDateOnly(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Get KNS points grouped by wallet within a timeframe
   * Used for timeframe-based leaderboard
   */
  async getKnsPointsByTimeframe(
    timeframe: 'today' | 'week' | 'allTime',
    limit: number = 100,
  ): Promise<{ wallet: string; knsPoints: number }[]> {
    const qb = this.repository
      .createQueryBuilder('kns')
      .select('kns.wallet', 'wallet')
      .addSelect('COALESCE(SUM(kns.pointsAwarded), 0)', 'knsPoints')
      .where('kns.status = :status', { status: 'success' });

    // Apply timeframe filter based on awardDate
    if (timeframe === 'today') {
      qb.andWhere('kns.awardDate >= CURRENT_DATE');
    } else if (timeframe === 'week') {
      qb.andWhere("kns.awardDate >= CURRENT_DATE - INTERVAL '7 days'");
    }
    // 'allTime' has no date filter

    return qb
      .groupBy('kns.wallet')
      .orderBy('"knsPoints"', 'DESC')
      .limit(limit)
      .getRawMany();
  }

  /**
   * Bulk insert award records
   * Uses PostgreSQL's INSERT INTO ... VALUES (...), (...), (...) for efficiency
   * Processes in chunks to avoid query size limits
   *
   * @param records - Array of award records to insert
   */
  async bulkInsertAwardRecords(
    records: Array<{
      wallet: string;
      awardDate: Date;
      currentBalance: string;
      timeWeightedAverageBalance: string;
      tierName: string;
      pointsAwarded: number;
      transferCount: number;
      periodStart: string;
      periodEnd: string;
      status: string;
    }>,
  ): Promise<void> {
    if (records.length === 0) return;

    // Batch insert in chunks of 1000 to avoid query size limits
    const CHUNK_SIZE = 1000;

    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE);

      await this.repository
        .createQueryBuilder()
        .insert()
        .into(KnsAwardHistory)
        .values(chunk)
        .execute();
    }

    const chunkCount = Math.ceil(records.length / CHUNK_SIZE);
    console.log(
      `[KnsAwardHistoryRepo] Bulk inserted ${records.length} award records in ${chunkCount} batch${chunkCount > 1 ? 'es' : ''}`,
    );
  }
}
