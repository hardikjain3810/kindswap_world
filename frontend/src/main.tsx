import { Buffer } from "buffer";

// Polyfill Buffer for browser environment
globalThis.Buffer = Buffer;

import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Sentry configuration from environment
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const SENTRY_ENVIRONMENT = import.meta.env.VITE_SENTRY_ENVIRONMENT ||
                          import.meta.env.VITE_ENV ||
                          import.meta.env.MODE ||
                          'production';
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

// Only initialize Sentry in production (not localhost) and when DSN is provided
const isProduction = !window.location.hostname.includes("localhost") &&
                     !window.location.hostname.includes("127.0.0.1");

if (SENTRY_DSN && isProduction) {
  console.log(`[Sentry Frontend] Initializing for environment: ${SENTRY_ENVIRONMENT}`);
  console.log(`[Sentry Frontend] Release: kindswap-frontend@${APP_VERSION}`);

  Sentry.init({
    dsn: SENTRY_DSN,
    release: `kindswap-frontend@${APP_VERSION}`,
    environment: SENTRY_ENVIRONMENT,

    // Enable performance monitoring and session replay
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Privacy settings - don't mask text for better debugging
        maskAllText: false,
        // Don't block media for full visual replay
        blockAllMedia: false,
        // Mask sensitive inputs (passwords, credit cards, etc.)
        maskAllInputs: false,
        // Block sensitive selectors (add wallet private keys, etc.)
        block: ['.private-key', '.seed-phrase', '[data-sensitive]'],
        // Capture network requests for debugging API issues
        networkDetailAllowUrls: [
          window.location.origin,
          /api\./,
          /\.kindswap\./,
          /\.kindsoul\./,
        ],
        // Capture request/response bodies for debugging (be careful with sensitive data)
        networkCaptureBodies: true,
        // Capture console logs for debugging
        networkRequestHeaders: ['X-Request-Id', 'Authorization'],
        networkResponseHeaders: ['X-Request-Id'],
      }),
      // Capture console logs and errors in replay
      Sentry.replayCanvasIntegration(),
    ],

    // Performance Monitoring - capture 20% of transactions
    tracesSampleRate: 0.2,

    // Session Replay - capture 10% of sessions, 100% on error
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Send PII data (wallet addresses for debugging)
    sendDefaultPii: true,

    // Filter out noisy errors
    beforeSend(event) {
      const stackFrames = event.exception?.values?.[0]?.stacktrace?.frames || [];
      const errorValue = event.exception?.values?.[0]?.value || '';

      // Filter 1: Browser extension URLs (enhanced detection)
      if (stackFrames.some(frame =>
        frame.filename?.includes('extension://') ||
        frame.filename?.includes('chrome-extension://') ||
        frame.filename?.includes('moz-extension://') ||
        frame.filename?.includes('safari-extension://') ||
        frame.filename?.includes('extension')
      )) {
        console.warn('[Sentry] Filtered browser extension error');
        return null;
      }

      // Filter 2: Backbone.js errors (likely from extensions in a React app)
      if (
        stackFrames.some(frame => frame.filename?.includes('views.js')) &&
        (errorValue.includes('updateFrom') ||
         errorValue.includes('this.collection') ||
         errorValue.includes('Backbone'))
      ) {
        console.warn('[Sentry] Filtered suspected extension error (Backbone.js):', errorValue);
        return null;
      }

      // Filter 3: Phantom Sentry paths (mis-resolved source maps)
      if (stackFrames.some(frame =>
        frame.filename?.includes('../../sentry/scripts/') ||
        frame.filename?.includes('../sentry/scripts/')
      )) {
        console.warn('[Sentry] Filtered phantom Sentry path error');
        return null;
      }

      // Filter 4: Transient network errors (handled by retry logic with backoff)
      // These are temporary connection issues, not application bugs
      if (
        errorValue.includes('Failed to fetch') ||
        errorValue.includes('NetworkError') ||
        errorValue.includes('Load failed') ||
        errorValue.includes('timeout') ||
        errorValue.includes('network request failed')
      ) {
        console.warn('[Sentry] Filtered transient network error (handled by retry logic)');
        return null;
      }

      // Filter 5: ResizeObserver errors (benign browser quirk)
      if (errorValue.includes('ResizeObserver loop')) {
        return null;
      }

      // Filter 6: Solana blockhash errors (handled by retry logic)
      if (
        errorValue.includes('Blockhash not found') ||
        errorValue.includes('block height exceeded') ||
        errorValue.includes('TransactionExpiredBlockheightExceededError')
      ) {
        console.warn('[Sentry] Filtered Solana blockhash error (handled by retry logic)');
        return null;
      }

      // Filter 7: Invalid account data errors during swap retries (handled gracefully)
      // These occur when account state changes between retry attempts
      if (
        errorValue.includes('Account state changed during retry') ||
        (errorValue.includes('invalid account data for instruction') &&
         stackFrames.some(frame =>
           frame.filename?.includes('jupiterSwap') ||
           frame.filename?.includes('useSwap')
         ))
      ) {
        console.warn('[Sentry] Filtered handled swap retry error');
        return null;
      }

      // Filter 8: Invalid content URL errors (handled by client-side validation)
      if (
        errorValue.includes('Invalid content URL') ||
        errorValue.includes('Invalid URL')
      ) {
        console.warn('[Sentry] Filtered invalid URL error (handled by validation)');
        return null;
      }

      // Filter 9: Wallet user rejections (user action, not application error)
      const errorType = event.exception?.values?.[0]?.type || '';
      if (
        errorType.includes('WalletSignTransactionError') ||
        errorType.includes('WalletSendTransactionError') ||
        errorValue.includes('User rejected the request') ||
        errorValue.includes('User cancelled') ||
        errorValue.includes('User denied')
      ) {
        console.warn('[Sentry] Filtered wallet user rejection (expected user action)');
        return null;
      }

      // Filter 10: Transaction simulation failures (handled gracefully in UI)
      if (
        errorValue.includes('Simulation failed') ||
        errorValue.includes('Transaction simulation failed') ||
        errorValue.includes('Error processing Instruction') ||
        errorValue.includes('custom program error')
      ) {
        console.warn('[Sentry] Filtered transaction simulation failure (handled in UI)');
        return null;
      }

      // Filter 11: Wallet connection errors (user action or network)
      if (
        errorType.includes('WalletNotConnectedError') ||
        errorType.includes('WalletConnectionError') ||
        errorValue.includes('Wallet not connected') ||
        errorValue.includes('Failed to connect wallet')
      ) {
        console.warn('[Sentry] Filtered wallet connection error (user action)');
        return null;
      }

      return event;
    },
  });
}

createRoot(document.getElementById("root")!).render(<App />);
