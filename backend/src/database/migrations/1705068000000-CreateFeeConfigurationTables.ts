import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration: Create Fee Configuration Tables
 * Timestamp: 1705068000000
 * Date: 2026-01-13
 *
 * Creates 4 new tables for managing dynamic fee tiers and platform configuration:
 * 1. fee_configuration - Global platform fee config (singleton: 1 row)
 * 2. fee_tiers - 5 fee tiers based on KNS balance (5 rows)
 * 3. fee_configuration_audit - Audit trail for fee config changes
 * 4. fee_tier_audit - Audit trail for fee tier changes
 *
 * Seed data includes current production values:
 * - Base fee: 10.0 bps (0.10%)
 * - Charity split: 50% / 50%
 * - 5 tiers: No Tier → Tier 4 with 0-20% discounts
 */
export class CreateFeeConfigurationTables1705068000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    /**
     * fee_configuration table
     * Singleton table - should only have 1 active row
     * Stores global platform fee configuration
     */
    await queryRunner.createTable(
      new Table({
        name: 'fee_configuration',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'base_fee_bps',
            type: 'numeric',
            precision: 5,
            scale: 1,
            default: '10.0',
            isNullable: false,
          },
          {
            name: 'charity_portion',
            type: 'numeric',
            precision: 5,
            scale: 4,
            default: '0.5',
            isNullable: false,
          },
          {
            name: 'kindswap_portion',
            type: 'numeric',
            precision: 5,
            scale: 4,
            default: '0.5',
            isNullable: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'version',
            type: 'integer',
            default: 0,
            isNullable: false,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    /**
     * fee_tiers table
     * Stores 5 fee tiers based on KNS balance holdings
     * Tiers define discount and effective fee based on KNS minimum balance
     */
    await queryRunner.createTable(
      new Table({
        name: 'fee_tiers',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'kns_min',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'discount_percent',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'effective_fee_bps',
            type: 'numeric',
            precision: 5,
            scale: 1,
            isNullable: false,
          },
          {
            name: 'tier_order',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'version',
            type: 'integer',
            default: 0,
            isNullable: false,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Indexes for performance
    await queryRunner.createIndex(
      'fee_tiers',
      new TableIndex({
        name: 'IDX_FEE_TIERS_ORDER',
        columnNames: ['tier_order'],
      }),
    );

    await queryRunner.createIndex(
      'fee_tiers',
      new TableIndex({
        name: 'IDX_FEE_TIERS_KNS_MIN',
        columnNames: ['kns_min'],
      }),
    );

    /**
     * fee_configuration_audit table
     * Audit log for all changes to fee_configuration
     * Automatically populated when configuration changes
     */
    await queryRunner.createTable(
      new Table({
        name: 'fee_configuration_audit',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'config_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'base_fee_bps',
            type: 'numeric',
            precision: 5,
            scale: 1,
            isNullable: false,
          },
          {
            name: 'charity_portion',
            type: 'numeric',
            precision: 5,
            scale: 4,
            isNullable: false,
          },
          {
            name: 'kindswap_portion',
            type: 'numeric',
            precision: 5,
            scale: 4,
            isNullable: false,
          },
          {
            name: 'changed_by',
            type: 'varchar',
            length: '88',
            isNullable: true,
          },
          {
            name: 'change_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'changed_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    /**
     * fee_tier_audit table
     * Audit log for all changes to fee_tiers
     * Automatically populated when tiers change
     */
    await queryRunner.createTable(
      new Table({
        name: 'fee_tier_audit',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'tier_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'kns_min',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'discount_percent',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'effective_fee_bps',
            type: 'numeric',
            precision: 5,
            scale: 1,
            isNullable: false,
          },
          {
            name: 'tier_order',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'changed_by',
            type: 'varchar',
            length: '88',
            isNullable: true,
          },
          {
            name: 'change_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'changed_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    /**
     * SEED DATA: Insert initial configuration
     * Base fee: 10.0 bps (0.10%)
     * Charity split: 50% / KindSwap: 50%
     */
    await queryRunner.query(`
      INSERT INTO fee_configuration (id, base_fee_bps, charity_portion, kindswap_portion, is_active, version, notes, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        10.0,
        0.5,
        0.5,
        true,
        0,
        'Initial configuration - 0.1% total fee, 50/50 charity/platform split',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    `);

    /**
     * SEED DATA: Insert 5 fee tiers
     * Tier progression: No Tier → Tier 4 with increasing KNS requirements and discounts
     */
    await queryRunner.query(`
      INSERT INTO fee_tiers (id, name, kns_min, discount_percent, effective_fee_bps, tier_order, is_active, version, notes, created_at, updated_at)
      VALUES
        (gen_random_uuid(), 'No Tier', 0, 0, 10.0, 0, true, 0, 'Default tier for users without KNS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'Tier 1', 5000, 5, 9.5, 1, true, 0, 'Tier 1 - 5k KNS minimum - 5% discount', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'Tier 2', 25000, 10, 9.0, 2, true, 0, 'Tier 2 - 25k KNS minimum - 10% discount', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'Tier 3', 100000, 15, 8.5, 3, true, 0, 'Tier 3 - 100k KNS minimum - 15% discount', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'Tier 4', 500000, 20, 8.0, 4, true, 0, 'Tier 4 - 500k+ KNS minimum - 20% discount (max)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (respecting foreign key dependencies if added later)
    await queryRunner.dropTable('fee_tier_audit', true);
    await queryRunner.dropTable('fee_configuration_audit', true);
    await queryRunner.dropTable('fee_tiers', true);
    await queryRunner.dropTable('fee_configuration', true);
  }
}
