import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration: Add Charity Wallet to Fee Configuration
 * Timestamp: 1739460000000
 * Date: 2026-02-13
 *
 * Adds charity_wallet column to fee_configuration table to store
 * the Solana wallet address where charity fees will be sent.
 *
 * Changes:
 * - Adds charity_wallet column (VARCHAR(44)) to fee_configuration table
 * - Sets default value to: ksw2N41N4a2UXGCxj3hhZczdaC5P5wPBNCC35kutD28
 * - Column is NOT NULL with default
 */
export class AddCharityWalletToFeeConfiguration1739460000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'fee_configuration',
      new TableColumn({
        name: 'charity_wallet',
        type: 'varchar',
        length: '44',
        default: "'ksw2N41N4a2UXGCxj3hhZczdaC5P5wPBNCC35kutD28'",
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('fee_configuration', 'charity_wallet');
  }
}
