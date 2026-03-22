import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../database/entities/user.entity';
import { UserPoints } from '../database/entities/user-points.entity';
import { SwapTransaction } from '../database/entities/swap-transaction.entity';
import { ContributionSubmission } from '../database/entities/contribution-submission.entity';
import { KnsAwardHistory } from '../database/entities/kns-award-history.entity';
import { UserRepository } from '../database/repositories/user.repository';
import { UserPointsRepository } from '../database/repositories/user-points.repository';
import { SwapTransactionRepository } from '../database/repositories/swap-transaction.repository';
import { ContributionSubmissionRepository } from '../database/repositories/contribution-submission.repository';
import { KnsAwardHistoryRepository } from '../database/repositories/kns-award-history.repository';
import { PointsService } from './services/points.service';
import { PointsController } from './controllers/points.controller';
import { ContributionsController } from './controllers/contributions.controller';
import { ConfigModule } from './config.module';
import { AdminModule } from './admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserPoints, SwapTransaction, ContributionSubmission, KnsAwardHistory]),
    ConfigModule,
    AdminModule,
  ],
  controllers: [PointsController, ContributionsController],
  providers: [
    PointsService,
    UserRepository,
    UserPointsRepository,
    SwapTransactionRepository,
    ContributionSubmissionRepository,
    KnsAwardHistoryRepository,
  ],
  exports: [PointsService],
})
export class PointsModule {}
