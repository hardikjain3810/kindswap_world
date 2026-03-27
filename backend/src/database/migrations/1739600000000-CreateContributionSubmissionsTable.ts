import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration: Create Contribution Submissions Table
 * Timestamp: 1739600000000 (February 15, 2025 - before leaderboard migration)
 * Description: Creates the contribution_submissions table for tracking community contributions
 *
 * This table stores user submissions for community contributions (articles, videos, translations, etc.)
 * Each submission can be reviewed and approved by admins, awarding community points to the user.
 */
export class CreateContributionSubmissionsTable1739600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    /**
     * Create contribution_submissions table
     */
    await queryRunner.createTable(
      new Table({
        name: 'contribution_submissions',
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
            name: 'contentLink',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'category',
            type: 'enum',
            enum: ['twitter_post', 'twitter_thread', 'video', 'blog', 'translation'],
            isNullable: false,
          },
          {
            name: 'description',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'approved', 'rejected'],
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'pointsAwarded',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'rejectionReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'reviewedBy',
            type: 'varchar',
            length: '88',
            isNullable: true,
          },
          {
            name: 'reviewedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['wallet'],
            referencedTableName: 'users',
            referencedColumnNames: ['wallet'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    /**
     * Create indexes for query performance
     */
    await queryRunner.createIndex(
      'contribution_submissions',
      new TableIndex({
        columnNames: ['wallet'],
        name: 'idx_contribution_wallet',
      }),
    );

    await queryRunner.createIndex(
      'contribution_submissions',
      new TableIndex({
        columnNames: ['status'],
        name: 'idx_contribution_status',
      }),
    );

    await queryRunner.createIndex(
      'contribution_submissions',
      new TableIndex({
        columnNames: ['createdAt'],
        name: 'idx_contribution_created_at',
      }),
    );

    await queryRunner.createIndex(
      'contribution_submissions',
      new TableIndex({
        columnNames: ['wallet', 'category', 'createdAt'],
        name: 'idx_contribution_wallet_category_date',
      }),
    );

    await queryRunner.createIndex(
      'contribution_submissions',
      new TableIndex({
        columnNames: ['reviewedBy'],
        name: 'idx_contribution_reviewed_by',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('contribution_submissions', true);
  }
}
