import axios from "axios";
import { CONFIG } from "../jupiter/constants";
import {
  QuoteRoute,
  SwapInstructionsResponse,
  SwapRequest,
  SwapResponse,
  TokenInfo,
} from "./jupiter";

export interface TokenPrice {
  id: string;
  type: string;
  price: string;
}

export class JupiterAPIService {
  private authApi = axios.create({
    baseURL: CONFIG.JUPITER_API,
    headers: {
      "Content-Type": "application/json",
      ...(CONFIG.JUPITER_API_KEY && { "x-api-key": CONFIG.JUPITER_API_KEY }),
    },
  });

  private publicApi = axios.create({
    baseURL: CONFIG.JUPITER_API,
    headers: {
      "Content-Type": "application/json",
    },
  });

  /**
   * Fetch verified token list from Jupiter (tagged as verified)
   * Used for initial token list on page load
   * Includes retry logic for transient network failures (mobile/Phantom browser)
   * @returns Array of verified tokens
   */
  async getTokenList(retries = 3, delayMs = 1000): Promise<TokenInfo[]> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.authApi.get("/tokens/v2/tag?query=verified");

        // Explicitly map fields to match TokenInfo interface (same as searchTokens)
        return response.data.map((token: any) => ({
          id: token.id, // Jupiter API uses 'id' field (not 'address')
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          icon: token.icon || token.logoURI, // Handle both field names
          tags: token.tags || [],
          isVerified: token.tags?.includes('verified') || false, // Check tags array
        }));
      } catch (error) {
        if (attempt === retries) {
          console.error("Failed to fetch token list after retries:", error);
          // Include original error message for better debugging in Sentry
          const errorMsg = error instanceof Error ? error.message : String(error);
          throw new Error(`Token list unavailable: ${errorMsg}`);
        }
        // Exponential backoff: wait longer between each retry
        await new Promise(res => setTimeout(res, delayMs * attempt));
      }
    }
    // TypeScript requires explicit return for all code paths
    throw new Error("Token list unavailable.");
  }

  /**
   * Search tokens dynamically using Jupiter's search API
   * Allows users to discover any token by symbol, name, or mint address
   * @param query Search term (min 2 characters)
   * @returns Array of matching tokens with verification status
   */
  async searchTokens(query: string): Promise<TokenInfo[]> {
    try {
      if (!query || query.length < 2) return [];

      const response = await this.authApi.get(
        `/tokens/v2/search?query=${encodeURIComponent(query)}`
      );

      // Map search results to TokenInfo format
      return response.data.map((token: any) => ({
        id: token.id, // ✅ Jupiter search API uses 'id' field (not 'address')
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        icon: token.icon || token.logoURI, // Handle both 'icon' and 'logoURI' field names
        tags: token.tags || [],
        isVerified: token.tags?.includes('verified') || false,
      }));
    } catch (error) {
      console.error('Token search failed:', error);
      return [];
    }
  }

  async getTokenInfo(mintAddress: string): Promise<TokenInfo> {
    const tokens = await this.getTokenList();
    const token = tokens.find((t) => t.id === mintAddress);
    console.log("tokens" + token);

    if (!token) {
      throw new Error(`Token ${mintAddress} not found`);
    }

    return token;
  }

  async getQuote(params: {
    inputMint: string;
    outputMint: string;
    amount: string;
    slippageBps?: number;
    onlyDirectRoutes?: boolean;
    maxAccounts?: number;
    swapMode?: 'ExactIn' | 'ExactOut';
  }): Promise<QuoteRoute> {
    try {
      const queryParams = new URLSearchParams({
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount,
        slippageBps: (params.slippageBps ?? 50).toString(),
        onlyDirectRoutes: (params.onlyDirectRoutes ?? false).toString(),
        maxAccounts: (params.maxAccounts ?? 64).toString(),
        swapMode: params.swapMode ?? 'ExactIn',
      });

      console.log(params);


      const response = await this.authApi.get(
        `/swap/v1/quote?${queryParams.toString()}`
      );

      return response.data;
    } catch (error: any) {
      console.error("Quote API error:", error.response?.data || error.message);
      throw new Error("Failed to fetch quote");
    }
  }

  async getSwapTransaction(swapRequest: SwapRequest): Promise<SwapResponse> {
    try {
      const response = await this.authApi.post("/swap/v1/swap", swapRequest);

      return response.data;
    } catch (error: any) {
      console.error("Swap API error:", error.response?.data || error.message);
      throw new Error("Failed to build swap transaction");
    }
  }

  async getSwapInstructions(
    swapRequest: SwapRequest
  ): Promise<SwapInstructionsResponse> {
    try {
      const response = await this.authApi.post(
        "/swap/v1/swap-instructions",
        swapRequest
      );
      const data = response.data as Partial<SwapInstructionsResponse>;
      const isValid =
        !!data &&
        Array.isArray(data.computeBudgetInstructions) &&
        Array.isArray(data.setupInstructions) &&
        !!data.swapInstruction &&
        Array.isArray(data.otherInstructions) &&
        Array.isArray(data.addressLookupTableAddresses);

      if (!isValid) {
        throw new Error("Invalid swap instructions response from Jupiter");
      }

      return data as SwapInstructionsResponse;
    } catch (error: any) {
      console.error(
        "Swap Instructions API error:",
        error.response?.data || error.message
      );
      throw new Error(`Failed to get swap instructions: ${error.message || "Unknown error"}`);
    }
  }

  /**
   * Fetch real-time token prices from Jupiter Price API
   * @param mintAddresses Array of token mint addresses
   * @returns Record of mint address to USD price
   */
  async getTokenPrices(mintAddresses: string[]): Promise<Record<string, number>> {
    try {
      const ids = mintAddresses.join(",");
      const response = await this.authApi.get(`/price/v3?ids=${ids}`);

      const prices: Record<string, number> = {};
      const data = response?.data || {};

      // Iterate over response data keys and extract USD prices
      for (let mintAddress of Object.keys(data)) {
        if (data[mintAddress]?.usdPrice) {
          prices[mintAddress] = parseFloat(data[mintAddress].usdPrice);
        }
      }

      return prices;
    } catch (error: any) {
      console.error("Price API error:", error.response?.data || error.message);
      return {};
    }
  }

  /**
   * Fetch price for a single token
   * @param mintAddress Token mint address
   * @returns USD price or null if unavailable
   */
  async getTokenPrice(mintAddress: string): Promise<number | null> {
    const prices = await this.getTokenPrices([mintAddress]);
    return prices[mintAddress] || null;
  }
}
