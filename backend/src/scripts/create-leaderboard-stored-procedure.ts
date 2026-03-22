import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Script to create the leaderboard stored procedure
 * Run this manually: npm run script:create-leaderboard-sp
 */
async function createLeaderboardStoredProcedure() {
  console.log('🚀 Creating leaderboard stored procedure...');

  // Create DataSource with explicit configuration
  const dbHost = process.env.DB_HOST || 'localhost';
  const isRemoteDb = dbHost !== 'localhost' && dbHost !== '127.0.0.1';

  const dataSource = new DataSource({
    type: 'postgres',
    host: dbHost,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'kindsoul_user',
    password: process.env.DB_PASSWORD || 'kindsoul_secure_password_change_me',
    database: process.env.DB_NAME || 'kindsoul_db',
    ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
    extra: {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    },
  });

  try {
    // Initialize connection
    await dataSource.initialize();
    console.log('✅ Database connection established');

    // Check if function already exists
    const checkResult = await dataSource.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'get_leaderboard'
      );
    `);

    if (checkResult[0]?.exists) {
      console.log('⚠️  Stored procedure already exists. Dropping and recreating...');
      await dataSource.query('DROP FUNCTION IF EXISTS get_leaderboard;');
    }

    // Check which tables exist
    console.log('📝 Checking which tables exist...');
    const tables = await dataSource.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('swap_transactions', 'contribution_submission', 'kns_award_history');
    `);
    const existingTables = new Set(tables.map((t: any) => t.tablename));
    console.log('   Existing tables:', Array.from(existingTables).join(', '));

    // Create the stored procedure with dynamic table checks
    console.log('📝 Creating stored procedure...');
    const hasContributionTable = existingTables.has('contribution_submission');
    const hasKnsTable = existingTables.has('kns_award_history');

    await dataSource.query(`
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

    console.log('✅ Stored procedure created successfully');

    // Create count function
    console.log('📝 Creating count function for pagination...');
    await dataSource.query(`
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
          FROM contribution_submission cs
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

    console.log('✅ Count function created successfully');

    // Create supporting indexes if they don't exist
    console.log('📝 Creating supporting indexes...');

    // Helper to create index only if table exists
    const createIndexIfTableExists = async (indexName: string, tableName: string, indexDefinition: string) => {
      try {
        const tableExists = await dataSource.query(`
          SELECT EXISTS (
            SELECT FROM pg_tables
            WHERE schemaname = 'public' AND tablename = $1
          );
        `, [tableName]);

        if (tableExists[0]?.exists) {
          await dataSource.query(indexDefinition);
          console.log(`✅ Created index: ${indexName}`);
        } else {
          console.log(`⚠️  Skipped index ${indexName} - table ${tableName} does not exist`);
        }
      } catch (error) {
        console.log(`⚠️  Failed to create index ${indexName}:`, error.message);
      }
    };

    await createIndexIfTableExists(
      'idx_swap_tx_executed_at_status',
      'swap_transactions',
      `CREATE INDEX IF NOT EXISTS idx_swap_tx_executed_at_status
       ON swap_transactions ("executedAt", status, "pointsAwarded");`
    );

    await createIndexIfTableExists(
      'idx_contribution_reviewed_at_status',
      'contribution_submission',
      `CREATE INDEX IF NOT EXISTS idx_contribution_reviewed_at_status
       ON contribution_submission ("reviewedAt", status);`
    );

    await createIndexIfTableExists(
      'idx_kns_award_date_status',
      'kns_award_history',
      `CREATE INDEX IF NOT EXISTS idx_kns_award_date_status
       ON kns_award_history ("awardDate", status);`
    );

    // Test the stored procedure
    console.log('\n🧪 Testing stored procedure...');
    const testResult = await dataSource.query(
      'SELECT * FROM get_leaderboard($1, $2, $3)',
      ['allTime', 5, 0]
    );
    console.log(`✅ Test successful! Returned ${testResult.length} entries`);

    if (testResult.length > 0) {
      console.log('\nTop entry:');
      console.log(JSON.stringify(testResult[0], null, 2));
    }

    // Test count function
    console.log('\n🧪 Testing count function...');
    const countResult = await dataSource.query(
      'SELECT get_leaderboard_count($1)',
      ['allTime']
    );
    console.log(`✅ Total leaderboard entries: ${countResult[0].get_leaderboard_count}`);

    console.log('\n✅ Leaderboard stored procedure setup complete!');
  } catch (error) {
    console.error('❌ Error creating stored procedure:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    console.log('✅ Database connection closed');
  }
}

// Run the script
createLeaderboardStoredProcedure()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
