import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Script to check KNS points in the database
 */
async function checkKnsPoints() {
  console.log('🔍 Checking KNS points in database...\n');

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
  });

  try {
    await dataSource.initialize();
    console.log('✅ Connected to database\n');

    // Check kns_award_history table
    console.log('📊 KNS Award History (kns_award_history table):');
    console.log('='.repeat(80));

    const knsHistory = await dataSource.query(`
      SELECT
        COUNT(*) as total_records,
        COUNT(DISTINCT wallet) as unique_wallets,
        SUM(CASE WHEN status = 'success' THEN "pointsAwarded" ELSE 0 END) as total_points_awarded,
        MIN("awardDate") as first_award_date,
        MAX("awardDate") as last_award_date
      FROM kns_award_history;
    `);

    console.log('Total records:', knsHistory[0].total_records);
    console.log('Unique wallets:', knsHistory[0].unique_wallets);
    console.log('Total points awarded:', knsHistory[0].total_points_awarded);
    console.log('First award date:', knsHistory[0].first_award_date);
    console.log('Last award date:', knsHistory[0].last_award_date);

    // Top 10 wallets in kns_award_history
    console.log('\n📈 Top 10 wallets by KNS points (from kns_award_history):');
    console.log('='.repeat(80));

    const topKnsAwardHistory = await dataSource.query(`
      SELECT
        wallet,
        SUM("pointsAwarded") as total_kns_points,
        COUNT(*) as award_count
      FROM kns_award_history
      WHERE status = 'success'
      GROUP BY wallet
      ORDER BY total_kns_points DESC
      LIMIT 10;
    `);

    if (topKnsAwardHistory.length === 0) {
      console.log('❌ NO RECORDS FOUND in kns_award_history table!');
      console.log('   This means the KNS distribution script never saved any data.\n');
    } else {
      topKnsAwardHistory.forEach((row: any, i: number) => {
        console.log(`${i + 1}. ${row.wallet}: ${row.total_kns_points} points (${row.award_count} awards)`);
      });
    }

    // Check user_points table
    console.log('\n\n📊 User Points Table (user_points):');
    console.log('='.repeat(80));

    const userPointsStats = await dataSource.query(`
      SELECT
        COUNT(*) as total_users,
        SUM("knsPoints") as total_kns_points,
        SUM("swapPoints") as total_swap_points,
        SUM("communityPoints") as total_community_points,
        SUM("totalPoints") as grand_total_points
      FROM user_points
      WHERE "knsPoints" > 0 OR "swapPoints" > 0 OR "communityPoints" > 0;
    `);

    console.log('Total users with points:', userPointsStats[0].total_users);
    console.log('Total KNS points:', userPointsStats[0].total_kns_points);
    console.log('Total Swap points:', userPointsStats[0].total_swap_points);
    console.log('Total Community points:', userPointsStats[0].total_community_points);
    console.log('Grand total points:', userPointsStats[0].grand_total_points);

    // Top 10 wallets in user_points
    console.log('\n📈 Top 10 wallets by KNS points (from user_points):');
    console.log('='.repeat(80));

    const topUserPoints = await dataSource.query(`
      SELECT
        wallet,
        "knsPoints",
        "swapPoints",
        "communityPoints",
        "totalPoints"
      FROM user_points
      WHERE "knsPoints" > 0
      ORDER BY "knsPoints" DESC
      LIMIT 10;
    `);

    if (topUserPoints.length === 0) {
      console.log('❌ NO WALLETS with KNS points in user_points table!');
      console.log('   This means the points were never added to user_points.\n');
    } else {
      topUserPoints.forEach((row: any, i: number) => {
        console.log(
          `${i + 1}. ${row.wallet}: ` +
          `KNS=${row.knsPoints} Swap=${row.swapPoints} ` +
          `Community=${row.communityPoints} Total=${row.totalPoints}`
        );
      });
    }

    // Check if there's a mismatch between tables
    console.log('\n\n🔍 Checking for data consistency:');
    console.log('='.repeat(80));

    const mismatch = await dataSource.query(`
      SELECT
        COALESCE(h.wallet, u.wallet) as wallet,
        COALESCE(h.history_points, 0) as points_in_history,
        COALESCE(u."knsPoints", 0) as points_in_user_points,
        COALESCE(h.history_points, 0) - COALESCE(u."knsPoints", 0) as difference
      FROM (
        SELECT wallet, SUM("pointsAwarded") as history_points
        FROM kns_award_history
        WHERE status = 'success'
        GROUP BY wallet
      ) h
      FULL OUTER JOIN user_points u ON h.wallet = u.wallet
      WHERE COALESCE(h.history_points, 0) != COALESCE(u."knsPoints", 0)
      ORDER BY ABS(COALESCE(h.history_points, 0) - COALESCE(u."knsPoints", 0)) DESC
      LIMIT 10;
    `);

    if (mismatch.length === 0) {
      console.log('✅ Data is consistent between both tables');
    } else {
      console.log(`⚠️  Found ${mismatch.length} wallets with mismatched points:\n`);
      mismatch.forEach((row: any, i: number) => {
        console.log(
          `${i + 1}. ${row.wallet}: ` +
          `History=${row.points_in_history} vs UserPoints=${row.points_in_user_points} ` +
          `(diff: ${row.difference})`
        );
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Check complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

checkKnsPoints()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
