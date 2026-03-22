/**
 * Sentry Instrumentation for NestJS Backend
 * This file MUST be imported before any other imports in main.ts
 *
 * Features enabled:
 * - Error tracking (all unhandled exceptions)
 * - Performance monitoring (API latency, DB queries)
 * - Transaction tracing
 * - Source maps correlation via release versioning
 */

// Load .env file before NestJS ConfigModule
import * as dotenv from 'dotenv';
dotenv.config();

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// Read version from package.json for release tracking
// When compiled to dist/instrument.js, need to go up 1 level to root
// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJson = require('../package.json');
const RELEASE_VERSION = `kindswap-api@${packageJson.version}`;

export function initSentry() {
  const isProduction = process.env.NODE_ENV !== 'development';

  if (!isProduction) {
    console.log('[Sentry] Skipped - running in development mode');
    return;
  }

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.warn('[Sentry] SENTRY_DSN not configured, skipping initialization');
    return;
  }

  // Determine Sentry environment with explicit fallback chain
  // Priority: SENTRY_ENVIRONMENT > NODE_ENV > 'production'
  const sentryEnvironment = process.env.SENTRY_ENVIRONMENT ||
                           process.env.NODE_ENV ||
                           'production';

  console.log(`[Sentry Backend] Initializing for environment: ${sentryEnvironment}`);
  console.log(`[Sentry Backend] Release: ${RELEASE_VERSION}`);

  Sentry.init({
    dsn,

    // Release version for source map correlation
    release: RELEASE_VERSION,

    // Environment tracking (staging, production)
    // Set SENTRY_ENVIRONMENT in your deployment platform:
    // - Staging: SENTRY_ENVIRONMENT=staging
    // - Production: SENTRY_ENVIRONMENT=production
    environment: sentryEnvironment,

    // Attach stack trace to all messages
    attachStacktrace: true,

    // Integrations for full observability
    integrations: [
      nodeProfilingIntegration(),
    ],

    // Performance Monitoring
    // Capture 100% of transactions in staging, 20% in production
    tracesSampleRate: sentryEnvironment === 'staging' ? 1.0 : 0.2,

    // Profiling - sample rate relative to tracesSampleRate
    profilesSampleRate: 1.0,

    // Send server name for debugging
    serverName: process.env.SERVER_NAME || 'kindswap-api',

    // Filter out health check noise
    beforeSend(event) {
      if (event.request?.url?.includes('/health')) {
        return null;
      }
      return event;
    },

    // Filter out high-volume transactions
    beforeSendTransaction(event) {
      if (event.transaction?.includes('/health')) {
        return null;
      }
      return event;
    },
  });

  console.log(`[Sentry] ✓ Initialized successfully - Environment: ${sentryEnvironment}`);
}

// Export Sentry for use in other modules
export { Sentry };
