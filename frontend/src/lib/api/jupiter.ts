// Jupiter DEX Aggregator API Integration
// https://station.jup.ag/docs/apis

import * as Sentry from '@sentry/react';

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
}

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  priceImpactPct: string;
  marketInfos: Array<{
    id: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    notEnoughLiquidity: boolean;
    priceImpactPct: string;
    lpFee: {
      amount: string;
      mint: string;
      pct: string;
    };
    platformFee: {
      amount: string;
      mint: string;
      pct: string;
    } | null;
  }>;
  routePlan: Array<{
    swapInfo: {
      ammLabel: string;
      ammKey: string;
      tokenAIn: string;
      tokenAOut: string;
      inAmount: string;
      outAmount: string;
    };
    percent: number;
  }>;
}

const JUPITER_API_BASE = "https://api.jup.ag/v6";
const TOKEN_LIST_URL = "https://token.jup.ag/all";

// Cache tokens for 24 hours
let tokenCache: { tokens: TokenInfo[]; timestamp: number } | null = null;
const TOKEN_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch token list from Jupiter
 */
export async function fetchJupiterTokenList(): Promise<TokenInfo[]> {
  // Check cache
  if (tokenCache && Date.now() - tokenCache.timestamp < TOKEN_CACHE_TTL) {
    return tokenCache.tokens;
  }

  try {
    const response = await fetch(TOKEN_LIST_URL);
    if (!response.ok) throw new Error(`Failed to fetch token list: ${response.status}`);

    const tokens: TokenInfo[] = await response.json();

    // Cache the result
    tokenCache = { tokens, timestamp: Date.now() };

    return tokens;
  } catch (error) {
    console.error("Error fetching Jupiter token list:", error);
    Sentry.captureException(error, {
      tags: { feature: 'jupiter-api', action: 'fetch-token-list' },
      level: 'error',
    });
    throw error;
  }
}

/**
 * Get a token by mint address
 */
export async function getTokenByMint(mint: string): Promise<TokenInfo | null> {
  const tokens = await fetchJupiterTokenList();
  return tokens.find(t => t.address === mint) || null;
}

/**
 * Fetch a swap quote from Jupiter
 */
export async function fetchJupiterQuote(
  inputMint: string,
  outputMint: string,
  inputAmount: string | number, // in smallest units (lamports/base units)
  slippageBps: number = 50, // default 0.5% slippage
  feeBps: number = 0 // KindSwap fee in basis points (will be added to output deduction)
): Promise<JupiterQuoteResponse> {
  // Ensure inputAmount is a string (Jupiter requires string for precision)
  const amountStr = typeof inputAmount === 'number' ? inputAmount.toString() : inputAmount;

  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amountStr,
    slippageBps: slippageBps.toString(),
    onlyDirectRoutes: "false",
    asLegacyTransaction: "false",
  });

  try {
    const response = await fetch(`${JUPITER_API_BASE}/quote?${params}`);
    if (!response.ok) throw new Error(`Quote failed: ${response.status}`);

    const quote: JupiterQuoteResponse = await response.json();
    return quote;
  } catch (error) {
    console.error("Error fetching Jupiter quote:", error);
    Sentry.captureException(error, {
      tags: { feature: 'jupiter-api', action: 'get-quote' },
      level: 'error',
    });
    throw error;
  }
}

/**
 * Build a swap transaction
 * This returns the serialized transaction that you need to sign
 */
export async function buildSwapTransaction(
  quote: JupiterQuoteResponse,
  userPublicKey: string,
  feeBps: number = 0
): Promise<{ swapTransaction: string }> {
  try {
    const response = await fetch(`${JUPITER_API_BASE}/swap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        dynamicSlippageBaseBps: 100,
        prioritizationFeeLamports: {
          priorityLevel: "medium",
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Swap build failed: ${error}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error building swap transaction:", error);
    Sentry.captureException(error, {
      tags: { feature: 'jupiter-api', action: 'build-transaction' },
      level: 'error',
    });
    throw error;
  }
}

/**
 * Parse route breakdown for display
 */
export function parseRouteBreakdown(quote: JupiterQuoteResponse) {
  return {
    inputAmount: quote.inAmount,
    outputAmount: quote.outAmount,
    priceImpact: quote.priceImpactPct,
    routes: quote.routePlan.map(plan => ({
      dex: plan.swapInfo.ammLabel,
      percentage: plan.percent,
      inputAmount: plan.swapInfo.inAmount,
      outputAmount: plan.swapInfo.outAmount,
    })),
    marketInfos: quote.marketInfos.map(info => ({
      dex: info.label,
      inputAmount: info.inAmount,
      outputAmount: info.outAmount,
      lpFee: info.lpFee,
      platformFee: info.platformFee,
    })),
  };
}

/**
 * Convert token amount from UI value to smallest units (lamports)
 */
export function toSmallestUnit(amount: number, decimals: number): string {
  return Math.floor(amount * Math.pow(10, decimals)).toString();
}

/**
 * Convert token amount from smallest units to UI value
 */
export function fromSmallestUnit(amount: string | number, decimals: number): number {
  const amountNum = typeof amount === 'string' ? parseInt(amount) : amount;
  return amountNum / Math.pow(10, decimals);
}
