/**
 * KNS Holder Points Distribution Script
 *
 * This script triggers the KNS scheduler manually to award points to all KNS holders.
 * Fetches all holders from Helius RPC and calculates TWAB for each.
 *
 * Usage:
 *   npm run script:kns-distribute    # Trigger manual distribution
 *
 * Environment variables required:
 *   - HELIUS_API_KEY: Helius RPC API key
 *   - DATABASE_URL: PostgreSQL connection string
 *   - SOLSCAN_API_KEY: Solscan API key (for TWAB calculation)
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { KnsSchedulerService } from '../api/services/kns-scheduler.service';

async function bootstrap() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   KNS HOLDER POINTS DISTRIBUTION - MANUAL RUN    ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log('');
  console.log('⚠️  WARNING: This will award points to all KNS holders!');
  console.log('   Distribution uses Time-Weighted Average Balance (TWAB)');
  console.log('   to prevent flash balance gaming.');
  console.log('');

  try {
    // Create NestJS application context
    console.log('🔧 Initializing application...');
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    // Get the scheduler service
    const schedulerService = app.get(KnsSchedulerService);

    console.log('🚀 Starting distribution...');
    console.log('');

    const startTime = Date.now();

    // Trigger manual distribution
    const result = await schedulerService.triggerManualDistribution();

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

    // Display results
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('           DISTRIBUTION COMPLETE');
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log(`✅ Wallets Processed: ${result.walletsProcessed.toLocaleString()}`);
    console.log(`💰 Total Points Awarded: ${result.pointsAwarded.toLocaleString()}`);
    console.log(`❌ Errors: ${result.errors}`);
    console.log(`⏱️  Duration: ${durationSec}s`);
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log('✅ Points have been successfully distributed!');
    console.log('');

    // Close the application
    await app.close();

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Fatal Error:', error);
    console.error('');
    process.exit(1);
  }
}

bootstrap();
