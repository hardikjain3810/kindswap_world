import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { UserPoints } from './entities/user-points.entity';
import { User } from './entities/user.entity';
import { SwapTransaction } from './entities/swap-transaction.entity';
import { FeeConfiguration } from './entities/fee-configuration.entity';
import { FeeTier } from './entities/fee-tier.entity';
import { FeeConfigurationAudit } from './entities/fee-configuration-audit.entity';
import { FeeTierAudit } from './entities/fee-tier-audit.entity';
import { ContributionSubmission } from './entities/contribution-submission.entity';
import { KnsAwardHistory } from './entities/kns-award-history.entity';
import { Admin } from './entities/admin.entity';

export const getDatabaseConfig = (): TypeOrmModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  const dbHost = process.env.DB_HOST || 'localhost';
  const isRemoteDb = dbHost !== 'localhost' && dbHost !== '127.0.0.1';

  return {
    type: 'postgres',
    host: dbHost,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'kindsoul_user',
    password: process.env.DB_PASSWORD || 'kindsoul_secure_password_change_me',
    database: process.env.DB_NAME || 'kindsoul_db',
    entities: [User, UserPoints, SwapTransaction, FeeConfiguration, FeeTier, FeeConfigurationAudit, FeeTierAudit, ContributionSubmission, KnsAwardHistory, Admin],

    // DEVELOPMENT: Use synchronize to auto-create tables from entities
    // PRODUCTION: Use migrations for all schema changes
    synchronize: isDevelopment, // Auto-sync schema in development, use migrations in production
    logging: !isProduction,

    // Enable migrations for production (run automatically on app start)
    migrations: ['dist/database/migrations/*.js'], // Use compiled JS files in production
    migrationsRun: isProduction, // Auto-run migrations in production only

    ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
    extra: {
      max: 20, // Connection pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    },
  };
};

export const getDatabaseMigrationConfig = (): TypeOrmModuleOptions => {
  return {
    ...getDatabaseConfig(),
    synchronize: false,
    migrationsRun: false,
  };
};
