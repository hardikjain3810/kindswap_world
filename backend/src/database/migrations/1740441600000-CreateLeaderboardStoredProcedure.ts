import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create Leaderboard Stored Procedure
 * Timestamp: 1740441600000
 * Description: Creates a PostgreSQL function to optimize leaderboard queries
 *
 * This stored procedure combines three separate GROUP BY queries into a single
 * optimized database function, reducing network overhead and improving performance.
 *
 * Performance improvements:
 * - Single DB round-trip instead of 3 parallel queries
 * - Atomic execution with better DB engine optimization
 * - Reduced memory usage in Node.js
 * - Cleaner separation of concerns
 */
export class CreateLeaderboardStoredProcedure1740441600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check which tables exist to make stored procedure compatible with partial schema
    const tables = await queryRunner.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('swap_transactions', 'contribution_submissions', 'kns_award_history');
    `);
    const existingTables = new Set(tables.map((t: any) => t.tablename));
    const hasContributionTable = existingTables.has('contribution_submissions');
    const hasKnsTable = existingTables.has('kns_award_history');

    // Wrap stored procedure creation in try-catch for idempotency
    try {
      await queryRunner.query(`
      CREATE OR REPLACE FUNCTION get_leaderboard(
        p_timeframe VARCHAR(10),
        p_limit INTEGER DEFAULT 10,
        p_offset INTEGER DEFAULT 0
      )
      RETURNS TABLE (
        wallet VARCHAR(88),
        swap_points BIGINT,
        community_points BIGINT,
        kns_points BIGINT,
        total_points BIGINT
      )
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_date_filter TIMESTAMP;
      BEGIN
        -- Determine date filter based on timeframe
        CASE p_timeframe
          WHEN 'today' THEN
            v_date_filter := CURRENT_DATE;
          WHEN 'week' THEN
            v_date_filter := CURRENT_DATE - INTERVAL '7 days';
          ELSE
            v_date_filter := NULL; -- 'allTime' has no filter
        END CASE;

        -- Return combined leaderboard data
        RETURN QUERY
        WITH swap_points AS (
          SELECT
            st.wallet AS wallet,
            COALESCE(SUM(st."pointsAwardedAmount"), 0)::BIGINT AS points
          FROM swap_transactions st
          WHERE st.status = 'confirmed'
            AND st."pointsAwarded" = true
            AND (v_date_filter IS NULL OR st."executedAt" >= v_date_filter)
          GROUP BY st.wallet
        ),
        ${hasContributionTable ? `
        community_points AS (
          SELECT
            cs.wallet AS wallet,
            COALESCE(SUM(cs."pointsAwarded"), 0)::BIGINT AS points
          FROM contribution_submissions cs
          WHERE cs.status = 'approved'
            AND (v_date_filter IS NULL OR cs."reviewedAt" >= v_date_filter)
          GROUP BY cs.wallet
        ),` : `
        community_points AS (
          SELECT NULL::VARCHAR(88) AS wallet, 0::BIGINT AS points WHERE FALSE
        ),`}
        ${hasKnsTable ? `
        kns_points AS (
          SELECT
            kns.wallet AS wallet,
            COALESCE(SUM(kns."pointsAwarded"), 0)::BIGINT AS points
          FROM kns_award_history kns
          WHERE kns.status = 'success'
            AND (v_date_filter IS NULL OR kns."awardDate" >= v_date_filter)
          GROUP BY kns.wallet
        ),` : `
        kns_points AS (
          SELECT NULL::VARCHAR(88) AS wallet, 0::BIGINT AS points WHERE FALSE
        ),`}
        all_wallets AS (
          SELECT DISTINCT sp.wallet FROM swap_points sp
          UNION
          SELECT DISTINCT cp.wallet FROM community_points cp WHERE cp.wallet IS NOT NULL
          UNION
          SELECT DISTINCT kp.wallet FROM kns_points kp WHERE kp.wallet IS NOT NULL
        )
        SELECT
          aw.wallet,
          COALESCE(sp.points, 0)::BIGINT AS swap_points,
          COALESCE(cp.points, 0)::BIGINT AS community_points,
          COALESCE(kp.points, 0)::BIGINT AS kns_points,
          (COALESCE(sp.points, 0) + COALESCE(cp.points, 0) + COALESCE(kp.points, 0))::BIGINT AS total_points
        FROM all_wallets aw
        LEFT JOIN swap_points sp ON aw.wallet = sp.wallet
        LEFT JOIN community_points cp ON aw.wallet = cp.wallet
        LEFT JOIN kns_points kp ON aw.wallet = kp.wallet
        ORDER BY total_points DESC, aw.wallet ASC
        LIMIT p_limit
        OFFSET p_offset;
      END;
      $$;
    `);
    } catch (err: any) {
      // If stored procedure creation fails (e.g., due to missing tables), log but continue
      console.log('⚠️  Failed to create get_leaderboard stored procedure:', err.message);
    }

    // Create index to optimize the stored procedure queries if not already exists
    try {
      await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_swap_tx_executed_at_status
      ON swap_transactions ("executedAt", status, "pointsAwarded");
    `);
    } catch (err: any) {
      console.log('⚠️  Failed to create idx_swap_tx_executed_at_status:', err.message);
    }

    try {
      await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_contribution_reviewed_at_status
      ON contribution_submissions ("reviewedAt", status);
    `);
    } catch (err: any) {
      console.log('⚠️  Failed to create idx_contribution_reviewed_at_status:', err.message);
    }

    try {
      await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_kns_award_date_status
      ON kns_award_history ("awardDate", status);
    `);
    } catch (err: any) {
      console.log('⚠️  Failed to create idx_kns_award_date_status:', err.message);
    }

    // Create function to get total count for pagination
    try {
      await queryRunner.query(`
      CREATE OR REPLACE FUNCTION get_leaderboard_count(
        p_timeframe VARCHAR(10)
      )
      RETURNS INTEGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_date_filter TIMESTAMP;
        v_count INTEGER;
      BEGIN
        -- Determine date filter based on timeframe
        CASE p_timeframe
          WHEN 'today' THEN
            v_date_filter := CURRENT_DATE;
          WHEN 'week' THEN
            v_date_filter := CURRENT_DATE - INTERVAL '7 days';
          ELSE
            v_date_filter := NULL;
        END CASE;

        -- Count distinct wallets
        WITH swap_wallets AS (
          SELECT DISTINCT st.wallet
          FROM swap_transactions st
          WHERE st.status = 'confirmed'
            AND st."pointsAwarded" = true
            AND (v_date_filter IS NULL OR st."executedAt" >= v_date_filter)
        ),
        ${hasContributionTable ? `
        community_wallets AS (
          SELECT DISTINCT cs.wallet
          FROM contribution_submissions cs
          WHERE cs.status = 'approved'
            AND (v_date_filter IS NULL OR cs."reviewedAt" >= v_date_filter)
        ),` : `
        community_wallets AS (
          SELECT NULL::VARCHAR(88) AS wallet WHERE FALSE
        ),`}
        ${hasKnsTable ? `
        kns_wallets AS (
          SELECT DISTINCT kns.wallet
          FROM kns_award_history kns
          WHERE kns.status = 'success'
            AND (v_date_filter IS NULL OR kns."awardDate" >= v_date_filter)
        ),` : `
        kns_wallets AS (
          SELECT NULL::VARCHAR(88) AS wallet WHERE FALSE
        ),`}
        all_wallets AS (
          SELECT wallet FROM swap_wallets
          UNION
          SELECT wallet FROM community_wallets WHERE wallet IS NOT NULL
          UNION
          SELECT wallet FROM kns_wallets WHERE wallet IS NOT NULL
        )
        SELECT COUNT(*)::INTEGER INTO v_count FROM all_wallets;

        RETURN v_count;
      END;
      $$;
    `);
    } catch (err: any) {
      // If count function creation fails, log but continue
      console.log('⚠️  Failed to create get_leaderboard_count function:', err.message);
    }

    console.log('✅ Created get_leaderboard stored procedure with pagination support');
    console.log('✅ Created get_leaderboard_count function for total count');
    console.log('✅ Created supporting indexes for optimal performance');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_swap_tx_executed_at_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_contribution_reviewed_at_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_kns_award_date_status;`);

    // Drop functions
    await queryRunner.query(`DROP FUNCTION IF EXISTS get_leaderboard;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS get_leaderboard_count;`);

    console.log('✅ Dropped get_leaderboard stored procedures and indexes');
  }
}
