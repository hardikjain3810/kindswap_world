import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Convert admin permissions column from simple text to text[]
 * Timestamp: 1739356400000 (Feb 12, 2026)
 */
export class ChangeAdminPermissionsToArray1739356400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE admins
      ALTER COLUMN permissions TYPE text[]
      USING (
        CASE
          WHEN permissions IS NULL OR permissions = '' THEN ARRAY[]::text[]
          ELSE string_to_array(permissions, ',')
        END
      )
    `);

    await queryRunner.query(`
      ALTER TABLE admins
      ALTER COLUMN permissions SET DEFAULT ARRAY[]::text[]
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE admins
      ALTER COLUMN permissions DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE admins
      ALTER COLUMN permissions TYPE text
      USING (
        CASE
          WHEN permissions IS NULL OR array_length(permissions, 1) IS NULL THEN ''
          ELSE array_to_string(permissions, ',')
        END
      )
    `);

    await queryRunner.query(`
      ALTER TABLE admins
      ALTER COLUMN permissions SET DEFAULT ''
    `);
  }
}
