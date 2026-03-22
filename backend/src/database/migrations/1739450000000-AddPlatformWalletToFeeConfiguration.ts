import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration: Add Platform Wallet to Fee Configuration
 * Timestamp: 1739450000000
 * Date: 2026-02-13
 *
 * Adds platform_wallet column to fee_configuration table to store
 * the Solana wallet address where platform fees will be sent.
 *
 * Changes:
 * - Adds platform_wallet column (VARCHAR(44)) to fee_configuration table
 * - Sets default value to: ksw2N41N4a2UXGCxj3hhZczdaC5P5wPBNCC35kutD28
 * - Column is NOT NULL with default
 */
export class AddPlatformWalletToFeeConfiguration1739450000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'fee_configuration',
      new TableColumn({
        name: 'platform_wallet',
        type: 'varchar',
        length: '44',
        default: "'ksw2N41N4a2UXGCxj3hhZczdaC5P5wPBNCC35kutD28'",
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('fee_configuration', 'platform_wallet');
  }
}
