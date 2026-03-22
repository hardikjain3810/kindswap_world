import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration: Create Points System Tables
 * Timestamp: 1705056000000
 * Description: Creates the core tables for the KindSwap Points System
 *
 * Tables created:
 * 1. users - Wallet holders in the system
 * 2. user_points - Points tracking (Swap, Community, KNS Holding)
 * 3. swap_transactions - Audit log for all swaps
 */
export class CreatePointsSystemTables1705056000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    /**
     * Users table
     * Stores wallet information and basic user data
     */
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'wallet',
            type: 'varchar',
            length: '88',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'knsBalance',
            type: 'bigint',
            default: '0',
            isNullable: false,
          },
          {
            name: 'lastBalanceCheckAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'optedOut',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Index on wallet for quick lookups
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USERS_WALLET',
        columnNames: ['wallet'],
        isUnique: true,
      }),
    );

    /**
     * User Points table
     * Tracks all types of points earned by users
     * Primary table for leaderboard rankings
     */
    await queryRunner.createTable(
      new Table({
        name: 'user_points',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'wallet',
            type: 'varchar',
            length: '88',
            isNullable: false,
          },
          {
            name: 'swapPoints',
            type: 'integer',
            default: 0,
            isNullable: false,
          },
          {
            name: 'communityPoints',
            type: 'integer',
            default: 0,
            isNullable: false,
          },
          {
            name: 'knsPoints',
            type: 'integer',
            default: 0,
            isNullable: false,
          },
          {
            name: 'totalPoints',
            type: 'integer',
            default: 0,
            isNullable: false,
          },
          {
            name: 'swapPointsToday',
            type: 'integer',
            default: 0,
            isNullable: false,
          },
          {
            name: 'lastSwapDayReset',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'communityPointsThisWeek',
            type: 'integer',
            default: 0,
            isNullable: false,
          },
          {
            name: 'lastWeekReset',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'currentRank',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'previousRank',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'totalSwapVolumeUSD',
            type: 'decimal',
            precision: 20,
            scale: 2,
            default: '0',
            isNullable: false,
          },
          {
            name: 'totalSwapsCount',
            type: 'integer',
            default: 0,
            isNullable: false,
          },
          {
            name: 'averageSwapSize',
            type: 'decimal',
            precision: 18,
            scale: 2,
            default: '0',
            isNullable: false,
          },
          {
            name: 'lastPointsUpdate',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'lastTopRankTime',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'version',
            type: 'integer',
            default: 0,
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['wallet'],
            referencedTableName: 'users',
            referencedColumnNames: ['wallet'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Indexes for leaderboard queries
    await queryRunner.createIndex(
      'user_points',
      new TableIndex({
        name: 'IDX_USER_POINTS_TOTAL_WALLET',
        columnNames: ['totalPoints', 'wallet'],
      }),
    );

    await queryRunner.createIndex(
      'user_points',
      new TableIndex({
        name: 'IDX_USER_POINTS_SWAP_POINTS',
        columnNames: ['swapPoints'],
      }),
    );

    await queryRunner.createIndex(
      'user_points',
      new TableIndex({
        name: 'IDX_USER_POINTS_COMMUNITY_POINTS',
        columnNames: ['communityPoints'],
      }),
    );

    await queryRunner.createIndex(
      'user_points',
      new TableIndex({
        name: 'IDX_USER_POINTS_KNS_POINTS',
        columnNames: ['knsPoints'],
      }),
    );

    await queryRunner.createIndex(
      'user_points',
      new TableIndex({
        name: 'IDX_USER_POINTS_WALLET_UPDATED',
        columnNames: ['wallet', 'updatedAt'],
      }),
    );

    /**
     * Swap Transactions table
     * Audit log for all swap transactions
     * Used for points verification and analytics
     */
    await queryRunner.createTable(
      new Table({
        name: 'swap_transactions',
        columns: [
          {
            name: 'signature',
            type: 'varchar',
            length: '88',
            isPrimary: true,
            isNullable: false,
          },
          {
            name: 'wallet',
            type: 'varchar',
            length: '88',
            isNullable: false,
          },
          {
            name: 'inputMint',
            type: 'varchar',
            length: '44',
            isNullable: false,
          },
          {
            name: 'outputMint',
            type: 'varchar',
            length: '44',
            isNullable: false,
          },
          {
            name: 'inputAmount',
            type: 'varchar',
            length: '80',
            isNullable: false,
          },
          {
            name: 'outputAmount',
            type: 'varchar',
            length: '80',
            isNullable: false,
          },
          {
            name: 'inputDecimals',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'outputDecimals',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'inputAmountUSD',
            type: 'decimal',
            precision: 20,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'outputAmountUSD',
            type: 'decimal',
            precision: 20,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'feeTier',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'discountPercent',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'effectiveFeeBps',
            type: 'decimal',
            precision: 5,
            scale: 1,
            isNullable: false,
          },
          {
            name: 'feeAmountUSD',
            type: 'decimal',
            precision: 20,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'charityAmountUSD',
            type: 'decimal',
            precision: 20,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'kindswapFeeUSD',
            type: 'decimal',
            precision: 20,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'routeData',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'blockHeight',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'pointsAwardedAmount',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'pointsAwarded',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'slippageBps',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'actualPriceImpactPct',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'knsBalanceAtSwap',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'userAgent',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'verifiedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'executedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['wallet'],
            referencedTableName: 'users',
            referencedColumnNames: ['wallet'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Indexes for swap transaction queries
    await queryRunner.createIndex(
      'swap_transactions',
      new TableIndex({
        name: 'IDX_SWAP_TX_WALLET_EXECUTED',
        columnNames: ['wallet', 'executedAt'],
      }),
    );

    await queryRunner.createIndex(
      'swap_transactions',
      new TableIndex({
        name: 'IDX_SWAP_TX_STATUS_EXECUTED',
        columnNames: ['status', 'executedAt'],
      }),
    );

    await queryRunner.createIndex(
      'swap_transactions',
      new TableIndex({
        name: 'IDX_SWAP_TX_POINTS_AWARDED',
        columnNames: ['pointsAwardedAmount'],
      }),
    );

    await queryRunner.createIndex(
      'swap_transactions',
      new TableIndex({
        name: 'IDX_SWAP_TX_CREATED',
        columnNames: ['createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (respecting foreign keys)
    await queryRunner.dropTable('swap_transactions', true);
    await queryRunner.dropTable('user_points', true);
    await queryRunner.dropTable('users', true);
  }
}
