import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';

/**
 * Structured Logger Service
 *
 * Features:
 * - JSON format in production (for log aggregation)
 * - Colored output in development
 * - Log levels: error, warn, info, debug
 * - Automatic timestamp
 * - Context tagging
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;

  constructor() {
    const isProduction = process.env.NODE_ENV !== 'development';

    this.logger = winston.createLogger({
      level: isProduction ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        isProduction
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
                const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                return `${timestamp} [${context || 'App'}] ${level}: ${message}${metaStr}`;
              }),
            ),
      ),
      transports: [
        new winston.transports.Console(),
      ],
    });
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context });
  }

  // Custom methods for structured logging
  logAdminAction(adminWallet: string, action: string, details?: Record<string, unknown>) {
    this.logger.info('Admin action', {
      context: 'Admin',
      adminWallet: adminWallet.slice(0, 8) + '...',
      action,
      ...details,
    });
  }

  logApiRequest(method: string, path: string, duration: number, statusCode: number) {
    this.logger.info('API Request', {
      context: 'HTTP',
      method,
      path,
      duration: `${duration}ms`,
      statusCode,
    });
  }
}
