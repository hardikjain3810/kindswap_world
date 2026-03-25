/**
 * Retry utility with exponential backoff for handling transient network failures
 */

export interface RetryOptions {
  /**
   * Maximum number of retry attempts (default: 3)
   */
  maxRetries?: number;

  /**
   * Initial delay in milliseconds before first retry (default: 1000)
   */
  initialDelay?: number;

  /**
   * Maximum delay in milliseconds between retries (default: 30000)
   */
  maxDelay?: number;

  /**
   * Multiplier for exponential backoff (default: 2)
   */
  backoffMultiplier?: number;

  /**
   * Function to determine if error should trigger retry (default: all errors)
   */
  shouldRetry?: (error: Error) => boolean;

  /**
   * Callback invoked before each retry attempt
   */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

export interface FetchWithRetryOptions extends RetryOptions {
  /**
   * AbortSignal to cancel the request
   */
  signal?: AbortSignal;

  /**
   * Request timeout in milliseconds (default: 10000)
   */
  timeout?: number;
}

/**
 * Checks if error is a transient network error that should be retried
 */
export function isTransientNetworkError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('load failed') ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('aborted') ||
    message.includes('http 502') ||
    message.includes('http 503') ||
    message.includes('http 504') ||
    message.includes('http 429') ||
    error.name === 'AbortError'
  );
}

/**
 * Executes an async function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    shouldRetry = isTransientNetworkError,
    onRetry,
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if it's the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Don't retry if error shouldn't be retried
      if (!shouldRetry(lastError)) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const currentDelay = Math.min(delay, maxDelay);

      // Invoke retry callback
      if (onRetry) {
        onRetry(attempt + 1, lastError, currentDelay);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, currentDelay));

      // Increase delay for next attempt
      delay *= backoffMultiplier;
    }
  }

  // All retries exhausted, throw last error
  throw lastError!;
}

/**
 * Fetch with automatic retry logic and timeout
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    timeout = 10000,
    signal,
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    shouldRetry = isTransientNetworkError,
    onRetry,
  } = options;

  return withRetry(
    async () => {
      // Create timeout controller
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), timeout);

      // Combine signals if provided
      const combinedSignal = signal
        ? combineAbortSignals([signal, timeoutController.signal])
        : timeoutController.signal;

      try {
        const response = await fetch(url, {
          ...init,
          signal: combinedSignal,
        });

        clearTimeout(timeoutId);

        // Treat HTTP errors as failures that should be retried
        // 304 Not Modified is not an error - the browser will use cached response
        if (!response.ok && response.status !== 304) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    },
    {
      maxRetries,
      initialDelay,
      maxDelay,
      backoffMultiplier,
      shouldRetry,
      onRetry,
    }
  );
}

/**
 * Combines multiple AbortSignals into one
 */
function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }

    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return controller.signal;
}

/**
 * Adaptive polling manager that adjusts interval based on errors
 */
export class AdaptivePoller {
  private baseInterval: number;
  private maxInterval: number;
  private currentInterval: number;
  private consecutiveFailures: number = 0;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(baseInterval: number = 30000, maxInterval: number = 300000) {
    this.baseInterval = baseInterval;
    this.maxInterval = maxInterval;
    this.currentInterval = baseInterval;
  }

  /**
   * Starts polling with adaptive interval
   */
  start(callback: () => Promise<void>): void {
    this.stop(); // Clear any existing interval

    const poll = async () => {
      try {
        await callback();
        // Success - reset to base interval
        this.consecutiveFailures = 0;
        this.currentInterval = this.baseInterval;
      } catch (error) {
        // Failure - increase interval
        this.consecutiveFailures++;
        this.currentInterval = Math.min(
          this.baseInterval * Math.pow(2, this.consecutiveFailures),
          this.maxInterval
        );

        console.warn(
          `[AdaptivePoller] Failure ${this.consecutiveFailures}, backing off to ${this.currentInterval}ms`
        );
      }

      // Schedule next poll
      this.intervalId = setTimeout(poll, this.currentInterval);
    };

    // Start first poll immediately
    poll();
  }

  /**
   * Stops polling
   */
  stop(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Gets current polling interval
   */
  getCurrentInterval(): number {
    return this.currentInterval;
  }

  /**
   * Gets consecutive failure count
   */
  getFailureCount(): number {
    return this.consecutiveFailures;
  }
}
