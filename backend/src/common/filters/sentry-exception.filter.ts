/**
 * Global Exception Filter for Sentry
 * Captures all unhandled exceptions and sends them to Sentry
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Sentry } from '../../instrument';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Determine HTTP status
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Only send 5xx errors to Sentry (not 4xx client errors)
    if (status >= 500) {
      // Set user context from request if available
      const wallet = this.extractWallet(request);
      if (wallet) {
        Sentry.setUser({ id: wallet, wallet });
      }

      // Set request context
      Sentry.setContext('request', {
        method: request.method,
        url: request.url,
        headers: this.sanitizeHeaders(request.headers),
        query: request.query,
        body: this.sanitizeBody(request.body),
      });

      // Set tags for filtering
      Sentry.setTags({
        url: request.url,
        method: request.method,
        statusCode: String(status),
      });

      // Capture the exception
      if (exception instanceof Error) {
        Sentry.captureException(exception);
      } else {
        Sentry.captureException(new Error(String(exception)));
      }
    }

    // Get error message
    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Send response
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: typeof message === 'string' ? message : (message as Record<string, unknown>).message || message,
    });
  }

  /**
   * Extract wallet address from request
   */
  private extractWallet(request: Request): string | null {
    // Check body for wallet
    if (request.body?.wallet) {
      return request.body.wallet;
    }
    // Check query params
    if (request.query?.wallet) {
      return request.query.wallet as string;
    }
    // Check headers
    if (request.headers['x-wallet-address']) {
      return request.headers['x-wallet-address'] as string;
    }
    return null;
  }

  /**
   * Remove sensitive headers before sending to Sentry
   */
  private sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...headers };
    const sensitiveKeys = ['authorization', 'cookie', 'x-api-key'];
    sensitiveKeys.forEach((key) => {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    });
    return sanitized;
  }

  /**
   * Remove sensitive body fields before sending to Sentry
   */
  private sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
    if (!body || typeof body !== 'object') {
      return body;
    }
    const sanitized = { ...body };
    const sensitiveKeys = ['password', 'token', 'secret', 'privateKey'];
    sensitiveKeys.forEach((key) => {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    });
    return sanitized;
  }
}
