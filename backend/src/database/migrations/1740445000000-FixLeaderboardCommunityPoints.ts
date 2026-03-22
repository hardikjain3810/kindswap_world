import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Fix Leaderboard Community Points
 * Timestamp: 1740445000000
 * Description: Updates leaderboard stored procedure to use user_points table for allTime queries
 *
 * Issue: Community points weren't showing in leaderboard because stored procedure was querying
 * contribution_submission table directly, while user_points table has the aggregated data.
 *
 * Fix: For allTime queries, use user_points table. For today/week queries, use transaction tables.
 */
export class FixLeaderboardCommunityPoints1740445000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check which tables exist
    const tables = await queryRunner.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('swap_transactions', 'contribution_submission', 'kns_award_history', 'user_points');
    `);
    const existingTables = new Set(tables.map((t: any) => t.tablename));
    const hasContributionTable = existingTables.has('contribution_submission');
    const hasKnsTable = existingTables.has('kns_award_history');
    const hasUserPointsTable = existingTables.has('user_points');

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
        -- For allTime, use aggregated user_points table for accuracy
        IF p_timeframe = 'allTime' AND EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_points') THEN
          RETURN QUERY
          SELECT
            up.wallet,
            COALESCE(up."swapPoints", 0)::BIGINT AS swap_points,
            COALESCE(up."communityPoints", 0)::BIGINT AS community_points,
            COALESCE(up."knsPoints", 0)::BIGINT AS kns_points,
            COALESCE(up."totalPoints", 0)::BIGINT AS total_points
          FROM user_points up
          WHERE up."totalPoints" > 0
          ORDER BY up."totalPoints" DESC, up.wallet ASC
          LIMIT p_limit
          OFFSET p_offset;
        ELSE
          -- For today/week, aggregate from transaction tables
          -- Determine date filter based on timeframe
          CASE p_timeframe
            WHEN 'today' THEN
              v_date_filter := CURRENT_DATE;
            WHEN 'week' THEN
              v_date_filter := CURRENT_DATE - INTERVAL '7 days';
            ELSE
              v_date_filter := NULL;
          END CASE;

          -- Return combined leaderboard data from transaction tables
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
            FROM contribution_submission cs
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
        END IF;
      END;
      $$;
    `);

    console.log('✅ Updated get_leaderboard stored procedure to use user_points for allTime queries');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to previous version (not implemented - would need to keep original SP)
    console.log('⚠️  Rollback not implemented - use previous migration to restore');
  }
}
