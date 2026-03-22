/**
 * Sentry Utility Functions
 * Helper functions for consistent error tracking and monitoring
 */

import { Sentry } from '../instrument';

/**
 * Capture an error with optional context
 */
export function captureError(
  error: Error | unknown,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    user?: { id: string; [key: string]: unknown };
  },
) {
  if (context?.tags) {
    Sentry.setTags(context.tags);
  }
  if (context?.extra) {
    Object.entries(context.extra).forEach(([key, value]) => {
      Sentry.setExtra(key, value);
    });
  }
  if (context?.user) {
    Sentry.setUser(context.user);
  }

  if (error instanceof Error) {
    Sentry.captureException(error);
  } else {
    Sentry.captureException(new Error(String(error)));
  }
}

/**
 * Capture an API error with request context
 */
export function captureApiError(
  error: Error | unknown,
  apiName: string,
  endpoint: string,
  requestData?: Record<string, unknown>,
) {
  captureError(error, {
    tags: {
      api: apiName,
      endpoint: endpoint,
    },
    extra: {
      requestData,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Add a breadcrumb for tracing user actions
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
) {
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Add a swap-specific breadcrumb
 */
export function addSwapBreadcrumb(
  action: 'initiated' | 'confirmed' | 'failed' | 'points_awarded' | 'verification_passed' | 'verification_failed',
  data: Record<string, unknown>,
) {
  const level = (action === 'failed' || action === 'verification_failed') ? 'error' : 'info';
  addBreadcrumb('swap', `Swap ${action}`, data, level);
}

/**
 * Set user context for error tracking
 */
export function setUserContext(wallet: string, additionalData?: Record<string, unknown>) {
  Sentry.setUser({
    id: wallet,
    wallet,
    ...additionalData,
  });
}

/**
 * Clear user context
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Start a transaction for performance monitoring
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startSpan({ name, op }, () => {});
}

/**
 * Wrap an async function with a transaction
 */
export async function withTransaction<T>(
  name: string,
  op: string,
  fn: () => Promise<T>,
): Promise<T> {
  return Sentry.startSpan({ name, op }, async () => {
    return await fn();
  });
}

/**
 * Create a child span within the current transaction
 */
export async function withSpan<T>(
  op: string,
  description: string,
  fn: () => Promise<T>,
): Promise<T> {
  return Sentry.startSpan({ op, name: description }, async () => {
    return await fn();
  });
}

/**
 * Capture a message (non-error event)
 */
export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  extra?: Record<string, unknown>,
) {
  if (extra) {
    Sentry.setExtras(extra);
  }
  Sentry.captureMessage(message, level);
}

/**
 * Set tags for the current scope
 */
export function setTags(tags: Record<string, string>) {
  Sentry.setTags(tags);
}

/**
 * Set extra data for the current scope
 */
export function setExtra(key: string, value: unknown) {
  Sentry.setExtra(key, value);
}
