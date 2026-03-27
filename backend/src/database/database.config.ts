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
import * as fs from 'fs';
import * as path from 'path';

type DbOverrides = {
  host?: string;
  port?: string;
  user?: string;
  password?: string;
  database?: string;
};

const getFileDbOverrides = (): DbOverrides => {
  const credentialsPath = process.env.DB_CREDENTIALS_PATH;
  if (!credentialsPath || !fs.existsSync(credentialsPath)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(credentialsPath, 'utf8').trim();
    if (!raw) {
      return {};
    }

    // JSON secret format (common for Secrets Manager)
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw);
      return {
        host: parsed.host ?? parsed.hostname,
        port: parsed.port != null ? String(parsed.port) : undefined,
        user: parsed.username ?? parsed.user,
        password: parsed.password,
        database: parsed.dbname ?? parsed.database,
      };
    }

    // KEY=VALUE fallback format
    const map: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const idx = line.indexOf('=');
      if (idx > 0) {
        map[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    }

    return {
      host: map.DB_HOST || map.host || map.hostname,
      port: map.DB_PORT || map.port,
      user: map.DB_USER || map.DB_USERNAME || map.username || map.user,
      password: map.DB_PASSWORD || map.password,
      database: map.DB_NAME || map.DB_DATABASE || map.dbname || map.database,
    };
  } catch {
    return {};
  }
};

export const getDatabaseConfig = (): TypeOrmModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  const fileDb = getFileDbOverrides();
  const dbHost = process.env.DB_HOST || fileDb.host || 'localhost';
  const isRemoteDb = dbHost !== 'localhost' && dbHost !== '127.0.0.1';

  return {
    type: 'postgres',
    host: dbHost,
    port: parseInt(process.env.DB_PORT || fileDb.port || '5432'),
    username: process.env.DB_USER || fileDb.user || 'kindsoul_user',
    password: process.env.DB_PASSWORD || fileDb.password || 'kindsoul_secure_password_change_me',
    database: process.env.DB_NAME || fileDb.database || 'kindsoul_db',
    entities: [User, UserPoints, SwapTransaction, FeeConfiguration, FeeTier, FeeConfigurationAudit, FeeTierAudit, ContributionSubmission, KnsAwardHistory, Admin],

    // DEVELOPMENT: Use synchronize to auto-create tables from entities
    // PRODUCTION: Use migrations for all schema changes
    synchronize: isDevelopment, // Auto-sync schema in development, use migrations in production
    logging: !isProduction,

    // Enable migrations for production (run automatically on app start)
    // Use absolute path with glob pattern for reliable discovery in Docker
    // TypeORM uses glob patterns: migrations: [path/to/**/*.{js,ts}]
    // At runtime in Docker: __dirname = /app/dist/database → migrations are in /app/dist/database/migrations/
    migrations: [path.join(__dirname, 'migrations', '**.js')], 
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
