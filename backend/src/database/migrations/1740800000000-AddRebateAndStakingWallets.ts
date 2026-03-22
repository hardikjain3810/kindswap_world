import { MigrationInterface, QueryRunner, TableColumn, TableCheck } from 'typeorm';

/**
 * Migration: Add Rebate and Staking Wallets
 * Timestamp: 1740800000000
 * Date: 2026-03-05
 *
 * Expands fee distribution from 2-way to 4-way split:
 * - Current: Platform (75%) + Charity (25%)
 * - New: Platform + Charity + Rebate + Staking
 *
 * Changes:
 * 1. Adds 4 columns to fee_configuration:
 *    - rebate_portion (DECIMAL 5,4, default 0.0)
 *    - staking_portion (DECIMAL 5,4, default 0.0)
 *    - rebate_wallet (VARCHAR 88, nullable)
 *    - staking_wallet (VARCHAR 88, nullable)
 *
 * 2. Updates constraint: all 4 portions must sum to 1.0 (tolerance 0.0001)
 *
 * 3. Adds 2 columns to swap_transactions:
 *    - rebateAmountUSD (DECIMAL 20,6, default 0.0)
 *    - stakingAmountUSD (DECIMAL 20,6, default 0.0)
 *
 * 4. Adds 4 columns to fee_configuration_audit:
 *    - rebate_portion
 *    - staking_portion
 *    - rebate_wallet
 *    - staking_wallet
 *
 * Backward Compatibility:
 * - Existing records default to 0.0 for new portions
 * - Current 2-way split (Platform 75% + Charity 25%) remains valid
 */
export class AddRebateAndStakingWallets1740800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // =============================================
    // 1. Add columns to fee_configuration table
    // =============================================

    // Add rebate_portion column
    await queryRunner.addColumn(
      'fee_configuration',
      new TableColumn({
        name: 'rebate_portion',
        type: 'numeric',
        precision: 5,
        scale: 4,
        default: '0.0',
        isNullable: false,
      }),
    );

    // Add staking_portion column
    await queryRunner.addColumn(
      'fee_configuration',
      new TableColumn({
        name: 'staking_portion',
        type: 'numeric',
        precision: 5,
        scale: 4,
        default: '0.0',
        isNullable: false,
      }),
    );

    // Add rebate_wallet column
    await queryRunner.addColumn(
      'fee_configuration',
      new TableColumn({
        name: 'rebate_wallet',
        type: 'varchar',
        length: '88',
        isNullable: true,
      }),
    );

    // Add staking_wallet column
    await queryRunner.addColumn(
      'fee_configuration',
      new TableColumn({
        name: 'staking_wallet',
        type: 'varchar',
        length: '88',
        isNullable: true,
      }),
    );

    // =============================================
    // 2. Update constraint to enforce 100% sum
    // =============================================

    // Drop old constraint if it exists (from previous migrations)
    await queryRunner.query(`
      ALTER TABLE fee_configuration
      DROP CONSTRAINT IF EXISTS chk_fee_portions_sum_100;
    `);

    // Add new constraint: all 4 portions must sum to 1.0 (with tolerance)
    // Note: Using camelCase column names to match existing database schema
    await queryRunner.createCheckConstraint(
      'fee_configuration',
      new TableCheck({
        name: 'chk_fee_portions_sum_100',
        expression: `ABS("charityPortion" + "kindswapPortion" + rebate_portion + staking_portion - 1.0) < 0.0001`,
      }),
    );

    // =============================================
    // 3. Add columns to swap_transactions table
    // =============================================

    // Add rebateAmountUSD column
    await queryRunner.addColumn(
      'swap_transactions',
      new TableColumn({
        name: 'rebateAmountUSD',
        type: 'decimal',
        precision: 20,
        scale: 6,
        default: '0.0',
        isNullable: false,
      }),
    );

    // Add stakingAmountUSD column
    await queryRunner.addColumn(
      'swap_transactions',
      new TableColumn({
        name: 'stakingAmountUSD',
        type: 'decimal',
        precision: 20,
        scale: 6,
        default: '0.0',
        isNullable: false,
      }),
    );

    // =============================================
    // 4. Add columns to fee_configuration_audit table
    // =============================================

    // Add rebate_portion to audit
    await queryRunner.addColumn(
      'fee_configuration_audit',
      new TableColumn({
        name: 'rebate_portion',
        type: 'numeric',
        precision: 5,
        scale: 4,
        default: '0.0',
        isNullable: false,
      }),
    );

    // Add staking_portion to audit
    await queryRunner.addColumn(
      'fee_configuration_audit',
      new TableColumn({
        name: 'staking_portion',
        type: 'numeric',
        precision: 5,
        scale: 4,
        default: '0.0',
        isNullable: false,
      }),
    );

    // Add rebate_wallet to audit
    await queryRunner.addColumn(
      'fee_configuration_audit',
      new TableColumn({
        name: 'rebate_wallet',
        type: 'varchar',
        length: '88',
        isNullable: true,
      }),
    );

    // Add staking_wallet to audit
    await queryRunner.addColumn(
      'fee_configuration_audit',
      new TableColumn({
        name: 'staking_wallet',
        type: 'varchar',
        length: '88',
        isNullable: true,
      }),
    );

    // =============================================
    // 5. Verify data integrity
    // =============================================

    // Log migration completion
    console.log('✅ Migration completed: AddRebateAndStakingWallets1740800000000');
    console.log('   - Added rebate_portion and staking_portion to fee_configuration');
    console.log('   - Added rebate_wallet and staking_wallet to fee_configuration');
    console.log('   - Updated constraint to enforce 100% sum (4 portions)');
    console.log('   - Added rebateAmountUSD and stakingAmountUSD to swap_transactions');
    console.log('   - Added audit columns to fee_configuration_audit');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // =============================================
    // Rollback: Remove all changes in reverse order
    // =============================================

    // Remove columns from fee_configuration_audit
    await queryRunner.dropColumn('fee_configuration_audit', 'staking_wallet');
    await queryRunner.dropColumn('fee_configuration_audit', 'rebate_wallet');
    await queryRunner.dropColumn('fee_configuration_audit', 'staking_portion');
    await queryRunner.dropColumn('fee_configuration_audit', 'rebate_portion');

    // Remove columns from swap_transactions
    await queryRunner.dropColumn('swap_transactions', 'stakingAmountUSD');
    await queryRunner.dropColumn('swap_transactions', 'rebateAmountUSD');

    // Drop the 4-way constraint
    await queryRunner.query(`
      ALTER TABLE fee_configuration
      DROP CONSTRAINT IF EXISTS chk_fee_portions_sum_100;
    `);

    // Restore original 2-way constraint (optional, if previous migration had it)
    // This ensures charityPortion + kindswapPortion = 1.0
    await queryRunner.query(`
      ALTER TABLE fee_configuration
      ADD CONSTRAINT chk_fee_portions_sum_100
      CHECK (ABS("charityPortion" + "kindswapPortion" - 1.0) < 0.0001);
    `);

    // Remove columns from fee_configuration
    await queryRunner.dropColumn('fee_configuration', 'staking_wallet');
    await queryRunner.dropColumn('fee_configuration', 'rebate_wallet');
    await queryRunner.dropColumn('fee_configuration', 'staking_portion');
    await queryRunner.dropColumn('fee_configuration', 'rebate_portion');

    console.log('⏪ Rollback completed: AddRebateAndStakingWallets1740800000000');
    console.log('   - Reverted to 2-way fee distribution (Platform + Charity)');
  }
}
