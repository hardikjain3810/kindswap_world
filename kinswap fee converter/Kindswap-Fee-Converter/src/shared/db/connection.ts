/**
 * PostgreSQL database connection manager
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { logger } from '@shared/utils/logger';

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

class Database {
  private pool: Pool | null = null;
  private config: DatabaseConfig;

  constructor() {
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'kindsoul_fee_conversion',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };
  }

  /**
   * Get database connection pool
   */
  public getPool(): Pool {
    if (!this.pool) {
      this.pool = new Pool(this.config);

      this.pool.on('error', (err) => {
        logger.error('Unexpected database pool error', { error: err.message });
      });

      this.pool.on('connect', () => {
        logger.debug('New database connection established');
      });

      logger.info('Database pool created', {
        host: this.config.host,
        database: this.config.database,
      });
    }

    return this.pool;
  }

  /**
   * Execute a query
   */
  public async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const pool = this.getPool();
    const start = Date.now();

    try {
      const result = await pool.query<T>(text, params);
      const duration = Date.now() - start;

      logger.debug('Query executed', {
        duration: `${duration}ms`,
        rows: result.rowCount,
      });

      return result;
    } catch (error) {
      logger.error('Query execution failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: text,
      });
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  public async getClient(): Promise<PoolClient> {
    const pool = this.getPool();
    return await pool.connect();
  }

  /**
   * Close all connections
   */
  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database pool closed');
    }
  }
}

// Export singleton instance
export const db = new Database();
export default db;
