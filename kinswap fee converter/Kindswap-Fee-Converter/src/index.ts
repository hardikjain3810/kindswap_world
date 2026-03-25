/**
 * Development HTTP Server
 * This file provides a local development environment with health checks and monitoring
 */

import { config } from 'dotenv';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { db } from '@shared/db/connection';
import { logger } from '@shared/utils/logger';

// Load environment variables
config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Service status tracking
interface ServiceStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  message?: string;
  lastChecked?: string;
}

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceStatus;
    localstack: ServiceStatus;
    redis: ServiceStatus;
  };
  environment: {
    nodeVersion: string;
    nodeEnv: string;
    region: string;
  };
}

// Startup banner
function printBanner() {
  console.log('\n' + '='.repeat(50));
  console.log('Lambda Fee Converter - Development Server');
  console.log('='.repeat(50));
  console.log(`Node Version:    ${process.version}`);
  console.log(`Environment:     ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database:        ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  console.log(`LocalStack:      ${process.env.AWS_ENDPOINT || 'http://localstack:4566'}`);
  console.log(`Server:          http://${HOST}:${PORT}`);
  console.log('='.repeat(50) + '\n');
}

// Check database connection
async function checkDatabase(): Promise<ServiceStatus> {
  try {
    const result = await db.query('SELECT NOW() as current_time, version() as pg_version');
    const row = result.rows[0];

    logger.debug('Database health check passed', {
      currentTime: row.current_time,
      version: row.pg_version,
    });

    return {
      status: 'healthy',
      message: 'Connected to PostgreSQL',
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Database health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Connection failed',
      lastChecked: new Date().toISOString(),
    };
  }
}

// Check LocalStack connection
async function checkLocalStack(): Promise<ServiceStatus> {
  try {
    const endpoint = process.env.AWS_ENDPOINT || 'http://localstack:4566';
    const response = await fetch(`${endpoint}/_localstack/health`);

    if (response.ok) {
      const data = await response.json() as { services: Record<string, string> };
      logger.debug('LocalStack health check passed', { services: data.services });

      return {
        status: 'healthy',
        message: 'LocalStack services available',
        lastChecked: new Date().toISOString(),
      };
    } else {
      return {
        status: 'unhealthy',
        message: `HTTP ${response.status}`,
        lastChecked: new Date().toISOString(),
      };
    }
  } catch (error) {
    logger.error('LocalStack health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Connection failed',
      lastChecked: new Date().toISOString(),
    };
  }
}

// Check Redis connection
async function checkRedis(): Promise<ServiceStatus> {
  // TODO: Implement Redis health check when Redis client is added
  return {
    status: 'unknown',
    message: 'Redis client not configured',
    lastChecked: new Date().toISOString(),
  };
}

// Perform comprehensive health check
async function performHealthCheck(): Promise<HealthCheckResponse> {
  const [database, localstack, redis] = await Promise.all([
    checkDatabase(),
    checkLocalStack(),
    checkRedis(),
  ]);

  const services = { database, localstack, redis };

  // Determine overall status
  const hasUnhealthy = Object.values(services).some(s => s.status === 'unhealthy');
  const hasUnknown = Object.values(services).some(s => s.status === 'unknown');

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (hasUnhealthy) {
    overallStatus = 'unhealthy';
  } else if (hasUnknown) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'healthy';
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services,
    environment: {
      nodeVersion: process.version,
      nodeEnv: process.env.NODE_ENV || 'development',
      region: process.env.AWS_REGION || 'ap-south-1',
    },
  };
}

// Route handler
async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = req.url || '/';
  const method = req.method || 'GET';

  logger.debug(`${method} ${url}`);

  try {
    // Health check endpoint
    if (url === '/health' || url === '/') {
      const healthCheck = await performHealthCheck();
      const statusCode = healthCheck.status === 'healthy' ? 200 : 503;

      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(healthCheck, null, 2));
      return;
    }

    // Info endpoint
    if (url === '/info') {
      const info = {
        name: 'Lambda Fee Converter',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        lambdaFunctions: [
          { name: 'feeIndexer', trigger: 'EventBridge (every 10s)', status: 'configured' },
          { name: 'conversionPlanner', trigger: 'EventBridge (every 15m)', status: 'configured' },
          { name: 'conversionExecutor', trigger: 'SQS Queue', status: 'configured' },
          { name: 'usdcDistributor', trigger: 'EventBridge (every 1h)', status: 'configured' },
        ],
        endpoints: {
          health: 'GET /health',
          info: 'GET /info',
          lambdas: 'GET /lambdas',
        },
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(info, null, 2));
      return;
    }

    // Lambda functions status endpoint
    if (url === '/lambdas') {
      const lambdas = {
        functions: [
          {
            name: 'feeIndexer',
            description: 'Monitor Ops wallet for incoming fee deposits',
            handler: 'src/functions/fee-indexer/index.handler',
            trigger: 'EventBridge Schedule (every 10 seconds)',
            memory: '512 MB',
            timeout: '60 seconds',
            status: 'available',
          },
          {
            name: 'conversionPlanner',
            description: 'Decide which tokens to convert and create jobs',
            handler: 'src/functions/conversion-planner/index.handler',
            trigger: 'EventBridge Schedule (every 15 minutes)',
            memory: '512 MB',
            timeout: '120 seconds',
            status: 'available',
          },
          {
            name: 'conversionExecutor',
            description: 'Execute token → USDC swap on Solana',
            handler: 'src/functions/conversion-executor/index.handler',
            trigger: 'SQS Queue (conversion-jobs)',
            memory: '1024 MB',
            timeout: '180 seconds',
            status: 'available',
          },
          {
            name: 'usdcDistributor',
            description: 'Distribute accumulated USDC to cold wallets',
            handler: 'src/functions/usdc-distributor/index.handler',
            trigger: 'EventBridge Schedule (every 1 hour)',
            memory: '512 MB',
            timeout: '120 seconds',
            status: 'available',
          },
        ],
        note: 'Use serverless invoke local -f <functionName> to test locally',
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(lambdas, null, 2));
      return;
    }

    // 404 Not Found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found', path: url }, null, 2));
  } catch (error) {
    logger.error('Request handler error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      url,
      method,
    });

    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, null, 2));
  }
}

// Start server
async function main() {
  try {
    printBanner();

    // Create HTTP server
    const server = createServer(handleRequest);

    server.listen(PORT, HOST, () => {
      logger.info(`Development server started on http://${HOST}:${PORT}`);
      logger.info('Available endpoints:');
      logger.info('  - GET /health   - Health check with service status');
      logger.info('  - GET /info     - Application information');
      logger.info('  - GET /lambdas  - Lambda functions status');

      // Perform initial health check
      performHealthCheck().then(health => {
        logger.info('Initial health check:', { status: health.status });

        if (health.services.database.status === 'healthy') {
          logger.info('✓ Database connection verified');
        } else {
          logger.warn('✗ Database connection failed:', {
            message: health.services.database.message
          });
        }

        if (health.services.localstack.status === 'healthy') {
          logger.info('✓ LocalStack connection verified');
        } else {
          logger.warn('✗ LocalStack connection failed:', {
            message: health.services.localstack.message
          });
        }
      });
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');

      server.close(() => {
        logger.info('HTTP server closed');
      });

      await db.close();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed to start server:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

main();
