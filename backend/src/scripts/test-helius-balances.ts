/**
 * Test script to verify Helius RPC returns correct KNS balances
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { HeliusRpcService } from '../api/services/helius-rpc.service';
import { KnsBalanceService } from '../api/services/kns-balance.service';

async function testHeliusBalances() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   TEST HELIUS RPC BALANCES                        ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const heliusRpc = app.get(HeliusRpcService);
    const knsBalance = app.get(KnsBalanceService);

    // Fetch all holders
    console.log('🔍 Fetching all KNS holders from Helius RPC...');
    const holders = await heliusRpc.getAllKNSHolders();
    console.log(`✅ Found ${holders.length} holders\n`);

    // Show top 10 holders by balance
    const sortedHolders = holders
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);

    console.log('📊 Top 10 holders by balance:');
    console.log('─'.repeat(80));
    console.log(
      'Wallet'.padEnd(45),
      'Balance'.padStart(15),
      'Tier'.padStart(15),
    );
    console.log('─'.repeat(80));

    for (const holder of sortedHolders) {
      const tier = knsBalance.getTierForBalance(holder.balance);
      console.log(
        holder.owner.padEnd(45),
        holder.balance.toLocaleString().padStart(15),
        `${tier.tierName} (${tier.pointsPerDay}pts)`.padStart(15),
      );
    }

    console.log('─'.repeat(80));

    // Balance distribution
    console.log('\n📈 Balance tier distribution:');
    const tierCounts = new Map<string, number>();
    for (const holder of holders) {
      const tier = knsBalance.getTierForBalance(holder.balance);
      tierCounts.set(tier.tierName, (tierCounts.get(tier.tierName) || 0) + 1);
    }

    for (const [tierName, count] of tierCounts) {
      const percentage = ((count / holders.length) * 100).toFixed(1);
      console.log(`  ${tierName.padEnd(15)}: ${count.toString().padStart(3)} holders (${percentage}%)`);
    }

    console.log('\n✅ Test complete!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

testHeliusBalances().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
