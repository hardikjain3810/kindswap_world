import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { getDatabaseConfig } from './database/database.config';
import { User } from './database/entities/user.entity';
import { UserPoints } from './database/entities/user-points.entity';
import { SwapTransaction } from './database/entities/swap-transaction.entity';
import { PointsModule } from './api/points.module';
import { ConfigModule as FeConfigModule } from './api/config.module';
import { KnsModule } from './api/kns.module';
import { AdminModule } from './api/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Using in-memory cache for local development
    // NOTE: Challenges will be lost on server restart - this is temporary
    // TODO: Switch to Redis for production (see app.module.ts.redis-example)
    CacheModule.register({
      isGlobal: true,
      ttl: 3600000, // Default 1 hour TTL in milliseconds
    }),
    ScheduleModule.forRoot(),
    // SECURITY: Rate limiting to prevent brute force and DoS attacks
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // 100 requests per minute globally
      },
    ]),
    TypeOrmModule.forRoot(getDatabaseConfig()),
    TypeOrmModule.forFeature([User, UserPoints, SwapTransaction]),
    PointsModule,
    FeConfigModule,
    KnsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    // SECURITY: Apply rate limiting globally to all endpoints
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
