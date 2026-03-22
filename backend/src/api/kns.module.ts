import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnsAwardHistory } from '../database/entities/kns-award-history.entity';
import { UserPoints } from '../database/entities/user-points.entity';
import { KnsAwardHistoryRepository } from '../database/repositories/kns-award-history.repository';
import { UserPointsRepository } from '../database/repositories/user-points.repository';
import { KnsSchedulerService } from './services/kns-scheduler.service';
import { KnsBalanceService } from './services/kns-balance.service';
import { SolscanService } from './services/solscan.service';
import { HeliusRpcService } from './services/helius-rpc.service';
import { KnsController } from './controllers/kns.controller';

/**
 * KNS Module
 * Handles KNS holding points distribution via daily cron job
 *
 * Schedule: Daily at 00:05 UTC
 * - Calculates Time-Weighted Average Balance (TWAB) for each wallet
 * - Awards points based on holding tier
 * - Records history for audit trail
 */
@Module({
  imports: [TypeOrmModule.forFeature([KnsAwardHistory, UserPoints])],
  controllers: [KnsController],
  providers: [
    // Services
    KnsSchedulerService,
    KnsBalanceService,
    SolscanService,
    HeliusRpcService,
    // Repositories
    KnsAwardHistoryRepository,
    UserPointsRepository,
  ],
  exports: [KnsSchedulerService, KnsBalanceService, HeliusRpcService],
})
export class KnsModule {}
