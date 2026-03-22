import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration: Create Admin Table for RBAC
 * Timestamp: 1739270000000 (Feb 11, 2026)
 * Description: Creates the admins table for role-based access control
 *
 * Tables created:
 * 1. admins - Admin accounts with permissions and Super Admin flag
 */
export class CreateAdminTable1739270000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    /**
     * Admins table
     * Stores admin accounts with role-based permissions
     */
    await queryRunner.createTable(
      new Table({
        name: 'admins',
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
            length: '100',
            isNullable: false,
          },
          {
            name: 'wallet_address',
            type: 'varchar',
            length: '44',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'is_super_admin',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'permissions',
            type: 'text',
            isNullable: false,
            default: "''",
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
            isNullable: false,
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

    // Create index on wallet_address for faster lookups
    await queryRunner.createIndex(
      'admins',
      new TableIndex({
        name: 'IDX_ADMIN_WALLET_ADDRESS',
        columnNames: ['wallet_address'],
      }),
    );

    // Create index on is_super_admin for faster Super Admin checks
    await queryRunner.createIndex(
      'admins',
      new TableIndex({
        name: 'IDX_ADMIN_IS_SUPER_ADMIN',
        columnNames: ['is_super_admin'],
      }),
    );

    console.log('[MIGRATION] Created admins table with indexes');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('admins', 'IDX_ADMIN_IS_SUPER_ADMIN');
    await queryRunner.dropIndex('admins', 'IDX_ADMIN_WALLET_ADDRESS');

    // Drop table
    await queryRunner.dropTable('admins');

    console.log('[MIGRATION] Dropped admins table');
  }
}
