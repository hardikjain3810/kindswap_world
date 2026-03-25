import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Admin } from './entities/admin.entity';

export const getDatabaseConfig = (): TypeOrmModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  const dbHost = process.env.DB_HOST || 'localhost';
  const isRemoteDb = dbHost !== 'localhost' && dbHost !== '127.0.0.1';

  return {
    type: 'postgres',
    host: dbHost,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'kindsoul_user',
    password: process.env.DB_PASSWORD || 'kindsoul_secure_password_change_me',
    database: process.env.DB_NAME || 'kindsoul_db',
    entities: [User, Admin],
    synchronize: !isProduction, // Only for development - auto-creates tables
    logging: !isProduction,
    // Migrations disabled in dev - using synchronize instead
    // migrations: ['src/database/migrations/*.ts'],
    // migrationsRun: true,
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
