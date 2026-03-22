import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
config();

/**
 * TypeORM Data Source for Migrations
 *
 * This file is used exclusively by TypeORM CLI to run migrations.
 * It should NOT be imported by the main NestJS application.
 *
 * Usage:
 * - npm run migration:run      - Run pending migrations
 * - npm run migration:revert    - Rollback last migration
 * - npm run migration:generate  - Generate migration from entity changes
 * - npm run migration:create    - Create empty migration file
 * - npm run migration:show      - Show all migrations and their status
 *
 * Environment Variables Required:
 * - DB_HOST (default: localhost)
 * - DB_PORT (default: 5432)
 * - DB_USER (default: kindsoul_user)
 * - DB_PASSWORD
 * - DB_NAME (default: kindsoul_db)
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'kindsoul_user',
  password: process.env.DB_PASSWORD || 'kindsoul_secure_password_change_me',
  database: process.env.DB_NAME || 'kindsoul_db',

  // Entity paths - used for generating migrations from entity changes
  entities: [path.join(__dirname, 'entities', '*.entity{.ts,.js}')],

  // Migration configuration
  migrations: [path.join(__dirname, 'migrations', '*{.ts,.js}')],
  migrationsTableName: 'migrations',
  migrationsRun: false, // Don't auto-run migrations (manual control)

  // IMPORTANT: Never use synchronize with migrations
  synchronize: false,

  // Enable logging to see SQL queries
  logging: process.env.NODE_ENV !== 'production',

  // SSL configuration for remote databases
  ssl:
    process.env.DB_HOST &&
    process.env.DB_HOST !== 'localhost' &&
    process.env.DB_HOST !== '127.0.0.1'
      ? { rejectUnauthorized: false }
      : false,

  // Connection pool settings
  extra: {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
});

// Initialize connection (optional - for testing)
if (require.main === module) {
  AppDataSource.initialize()
    .then(() => {
      console.log('✅ Data Source initialized successfully');
      console.log(`📊 Database: ${process.env.DB_NAME || 'kindsoul_db'}`);
      console.log(`🔌 Host: ${process.env.DB_HOST || 'localhost'}`);
      console.log(`📂 Migrations: ${AppDataSource.options.migrations}`);
      return AppDataSource.destroy();
    })
    .catch((error) => {
      console.error('❌ Error initializing Data Source:', error);
      process.exit(1);
    });
}
