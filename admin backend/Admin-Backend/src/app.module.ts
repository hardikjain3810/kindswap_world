import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { getDatabaseConfig } from './database/database.config';
import { User } from './database/entities/user.entity';
import { Admin } from './database/entities/admin.entity';
import { AdminModule } from './api/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'], // Prefer .env.local for development
      ignoreEnvFile: false,
    }),
    // Using in-memory cache for local development
    // TODO: Switch to Redis for production
    CacheModule.register({
      isGlobal: true,
      ttl: 3600000, // Default 1 hour TTL in milliseconds
    }),
    // SECURITY: Rate limiting to prevent brute force and DoS attacks
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // 100 requests per minute globally
      },
    ]),
    TypeOrmModule.forRoot(getDatabaseConfig()),
    TypeOrmModule.forFeature([User, Admin]),
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
