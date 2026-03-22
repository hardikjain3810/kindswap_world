/**
 * SwapLoggingService - Fire-and-forget swap transaction logging
 *
 * This service logs swap transactions to the backend API without blocking
 * the user experience. Uses fire-and-forget pattern for speed.
 */

import { API_BASE_URL, API_ENDPOINTS, API_TIMEOUT_MS } from '@/config/api';
import * as Sentry from '@sentry/react';

// Types matching the backend API schema
export interface SwapLogPayload {
  wallet: string;
  signature: string;
  status: 'confirmed' | 'failed' | 'pending' | 'cancelled';
  txMode?: 'single_tx' | 'legacy_two_tx';
  inputAmountUSD: number;
  outputAmountUSD: number;
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
  inputDecimals: number;
  outputDecimals: number;
  feeTier: string;
  discountPercent: number;
  effectiveFeeBps: number;
  feeAmountUSD: number;
  charityAmountUSD: number;
  kindswapFeeUSD: number;
  slippageBps: number;
  knsBalanceAtSwap: string;
  routeData?: Record<string, unknown>;
  composeStage?: string;
  instructionCount?: number;
  userAgent?: string;
  ipAddress?: string;
  errorMessage?: string;
}

export interface SwapLogResponse {
  success: boolean;
  signature: string;
  pointsAwarded: number;
  wallet: string;
  feeVerification?: {
    isValid: boolean;
    calculated: Record<string, unknown>;
    frontend: Record<string, unknown>;
    mismatches: string[];
  };
}

// Debug log on module load
if (import.meta.env.DEV) {
  console.log('[SwapLogging] Service initialized with API_BASE_URL:', API_BASE_URL || '(not configured)');
}

/**
 * SwapLoggingService - Handles all swap transaction logging
 */
export class SwapLoggingService {
  private static instance: SwapLoggingService;
  private baseUrl: string;
  private pendingLogs: Map<string, AbortController> = new Map();

  private constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SwapLoggingService {
    if (!SwapLoggingService.instance) {
      SwapLoggingService.instance = new SwapLoggingService();
    }
    return SwapLoggingService.instance;
  }

  /**
   * Check if logging is enabled (API URL is configured)
   */
  isEnabled(): boolean {
    return Boolean(this.baseUrl);
  }

  /**
   * Log a swap transaction - Fire and forget (non-blocking)
   * Returns immediately, logging happens in background
   */
  logSwapFireAndForget(payload: SwapLogPayload): void {
    if (!this.isEnabled()) {
      console.debug('[SwapLogging] Skipped - API URL not configured');
      return;
    }

    // Fire and forget - don't await
    this.logSwap(payload).catch((error) => {
      console.warn('[SwapLogging] Background log failed:', error.message);
    });
  }

  /**
   * Log a swap transaction - Returns promise for cases where you need confirmation
   */
  async logSwap(payload: SwapLogPayload): Promise<SwapLogResponse | null> {
    console.log('[SwapLogging] logSwap called, baseUrl:', this.baseUrl);

    if (!this.isEnabled()) {
      console.warn('[SwapLogging] Skipped - API URL not configured. Set VITE_API_BASE_URL in .env');
      return null;
    }

    // Trim signature and wallet to remove any whitespace
    const sanitizedPayload = {
      ...payload,
      signature: payload.signature.trim(),
      wallet: payload.wallet.trim(),
      userAgent: payload.userAgent || 'KindSwap/1.0',
    };

    const fullUrl = `${this.baseUrl}${API_ENDPOINTS.SWAP_COMPLETE}`;
    console.log('[SwapLogging] Sending to:', fullUrl);

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), API_TIMEOUT_MS);

    // Track pending request by signature
    this.pendingLogs.set(sanitizedPayload.signature, abortController);

    try {
      console.log('[SwapLogging] Sending payload:', JSON.stringify(sanitizedPayload, null, 2));

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(sanitizedPayload),
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      console.log('[SwapLogging] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SwapLogging] Error response body:', errorText);
        let errorMessage = `HTTP ${response.status}: ${errorText.slice(0, 200)}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          // Response is not JSON, use raw text (already set above)
        }
        throw new Error(errorMessage);
      }

      const data: SwapLogResponse = await response.json();

      console.log('[SwapLogging] Success:', {
        signature: payload.signature.slice(0, 8) + '...',
        status: payload.status,
        pointsAwarded: data.pointsAwarded,
        feeVerification: data.feeVerification,
      });

      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[SwapLogging] Request timed out after', API_TIMEOUT_MS, 'ms');
        Sentry.captureException(error, {
          tags: { feature: 'swap-logging', action: 'timeout' },
          level: 'warning',
        });
      } else {
        console.error('[SwapLogging] Failed:', error);
        Sentry.captureException(error, {
          tags: { feature: 'swap-logging', action: 'log-swap' },
          level: 'error',
        });
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
      this.pendingLogs.delete(payload.signature);
    }
  }

  /**
   * Cancel a pending log request (useful if user navigates away)
   */
  cancelPendingLog(signature: string): void {
    const controller = this.pendingLogs.get(signature);
    if (controller) {
      controller.abort();
      this.pendingLogs.delete(signature);
    }
  }

  /**
   * Cancel all pending log requests
   */
  cancelAllPendingLogs(): void {
    this.pendingLogs.forEach((controller) => controller.abort());
    this.pendingLogs.clear();
  }
}

// Export singleton instance for convenience
export const swapLoggingService = SwapLoggingService.getInstance();

// ============================================
// HELPER FUNCTIONS FOR BUILDING PAYLOAD
// ============================================

/**
 * Build swap log payload from swap execution context
 * This helper makes it easy to construct the payload from your existing swap data
 */
export interface SwapContext {
  wallet: string;
  signature: string;
  status: 'confirmed' | 'failed' | 'pending' | 'cancelled';

  // Input token details
  inputMint: string;
  inputSymbol: string;
  inputAmount: string; // Raw amount (with decimals)
  inputDecimals: number;
  inputAmountUSD: number;

  // Output token details
  outputMint: string;
  outputSymbol: string;
  outputAmount: string; // Raw amount (with decimals)
  outputDecimals: number;
  outputAmountUSD: number;

  // Fee details
  feeTier: string;
  discountPercent: number;
  effectiveFeeBps: number;
  feeAmountUSD: number;
  charityAmountUSD: number;
  kindswapFeeUSD: number;

  // Other
  slippageBps: number;
  knsBalance: number;
  routeData?: Record<string, unknown>;
  errorMessage?: string;
}

export function buildSwapLogPayload(context: SwapContext): SwapLogPayload {
  return {
    wallet: context.wallet,
    signature: context.signature,
    status: context.status,
    inputAmountUSD: context.inputAmountUSD,
    outputAmountUSD: context.outputAmountUSD,
    inputMint: context.inputMint,
    outputMint: context.outputMint,
    inputAmount: context.inputAmount,
    outputAmount: context.outputAmount,
    inputDecimals: context.inputDecimals,
    outputDecimals: context.outputDecimals,
    feeTier: context.feeTier,
    discountPercent: context.discountPercent,
    effectiveFeeBps: context.effectiveFeeBps,
    feeAmountUSD: context.feeAmountUSD,
    charityAmountUSD: context.charityAmountUSD,
    kindswapFeeUSD: context.kindswapFeeUSD,
    slippageBps: context.slippageBps,
    knsBalanceAtSwap: context.knsBalance.toString(),
    routeData: context.routeData,
    errorMessage: context.errorMessage,
  };
}

/**
 * Quick helper for logging successful swaps
 */
export function logSuccessfulSwap(context: Omit<SwapContext, 'status' | 'errorMessage'>): void {
  const payload = buildSwapLogPayload({ ...context, status: 'confirmed' });
  swapLoggingService.logSwapFireAndForget(payload);
}

/**
 * Quick helper for logging failed swaps
 */
export function logFailedSwap(
  context: Omit<SwapContext, 'status'> & { errorMessage: string }
): void {
  const payload = buildSwapLogPayload({ ...context, status: 'failed' });
  swapLoggingService.logSwapFireAndForget(payload);
}
