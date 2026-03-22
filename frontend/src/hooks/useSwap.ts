import { useState, useCallback, useEffect, useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import {
  fetchJupiterQuote,
  fetchJupiterTokenList,
  fromSmallestUnit,
  toSmallestUnit,
  JupiterQuoteResponse,
  TokenInfo,
  buildSwapTransaction,
  parseRouteBreakdown,
} from "@/lib/api/jupiter";
import {
  calculateFeeDiscount,
  calculateSwapPoints,
  calculateFeeAmounts,
  FeeCalculation,
} from "@/lib/business-logic/feeDiscountAndPoints";
import { swapLoggingService, buildSwapLogPayload } from "@/contexts/api/swapLoggingService";
import { JupiterAPIService } from "@/contexts/jupiter/jupiterService";

// Constants
const QUOTE_REFRESH_INTERVAL = 30000; // 30 seconds
const SLIPPAGE_BPS = 50; // 0.5%

export interface SwapInputs {
  fromToken: TokenInfo | null;
  toToken: TokenInfo | null;
  inputAmount: string; // UI value
  slippageBps: number;
}

export interface SwapState {
  quote: JupiterQuoteResponse | null;
  outputAmount: string; // UI value
  loading: boolean;
  error: string | null;
  swapping: boolean;
  swapError: string | null;
  quoteExpiry: number;
  routeBreakdown: ReturnType<typeof parseRouteBreakdown> | null;
}

export interface SwapResult {
  signature: string;
  inputAmount: number;
  outputAmount: number;
  usdValue: number;
  pointsEarned: number;
  feeApplied: FeeCalculation;
}

/**
 * Hook for managing swap logic
 * Handles quote fetching, fee calculation, and swap execution
 */
export function useSwap(knsBalance: number = 0) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  // Jupiter API service instance
  const jupiterService = useMemo(() => new JupiterAPIService(), []);

  // State
  const [inputs, setInputs] = useState<SwapInputs>({
    fromToken: null,
    toToken: null,
    inputAmount: "",
    slippageBps: SLIPPAGE_BPS,
  });

  const [state, setState] = useState<SwapState>({
    quote: null,
    outputAmount: "0.00",
    loading: false,
    error: null,
    swapping: false,
    swapError: null,
    quoteExpiry: 0,
    routeBreakdown: null,
  });

  const [tokenList, setTokenList] = useState<TokenInfo[]>([]);

  // Token prices from Jupiter Price API
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});

  // Load token list on mount
  useEffect(() => {
    let isMounted = true;

    fetchJupiterTokenList()
      .then(tokens => {
        if (isMounted) setTokenList(tokens);
      })
      .catch(error => {
        console.error("Failed to load token list:", error);
        if (isMounted) setState(prev => ({ ...prev, error: "Failed to load token list" }));
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch token prices when tokens change
  useEffect(() => {
    const fetchPrices = async () => {
      const mintAddresses: string[] = [];

      if (inputs.fromToken?.address) {
        mintAddresses.push(inputs.fromToken.address);
      }
      if (inputs.toToken?.address) {
        mintAddresses.push(inputs.toToken.address);
      }

      if (mintAddresses.length === 0) return;

      try {
        const prices = await jupiterService.getTokenPrices(mintAddresses);
        setTokenPrices(prevPrices => ({ ...prevPrices, ...prices }));
      } catch (error) {
        console.error("[useSwap] Failed to fetch token prices:", error);
        // Don't show error to user, just log it
      }
    };

    fetchPrices();
  }, [inputs.fromToken, inputs.toToken, jupiterService]);

  // Calculate fee discount based on KNS balance
  const feeDiscount = useMemo(() => {
    // Convert KNS balance to number (assuming it's in smallest units)
    const balanceNum = typeof knsBalance === "bigint" ? Number(knsBalance) / 1e6 : knsBalance;
    return calculateFeeDiscount(balanceNum);
  }, [knsBalance]);

  // Fetch quote when inputs change
  useEffect(() => {
    if (
      !inputs.fromToken ||
      !inputs.toToken ||
      !inputs.inputAmount ||
      parseFloat(inputs.inputAmount) === 0
    ) {
      setState(prev => ({ ...prev, outputAmount: "0.00", quote: null, routeBreakdown: null }));
      return;
    }

    let debounceTimer: NodeJS.Timeout;
    let isMounted = true;

    const fetchQuote = async () => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const inputAmountSmallest = toSmallestUnit(
          parseFloat(inputs.inputAmount),
          inputs.fromToken!.decimals
        );

        const quote = await fetchJupiterQuote(
          inputs.fromToken!.address,
          inputs.toToken!.address,
          inputAmountSmallest,
          inputs.slippageBps
        );

        if (!isMounted) return;

        const outputUI = fromSmallestUnit(quote.outAmount, inputs.toToken!.decimals);
        const breakdown = parseRouteBreakdown(quote);

        setState(prev => ({
          ...prev,
          quote,
          outputAmount: outputUI.toFixed(6),
          routeBreakdown: breakdown,
          quoteExpiry: Date.now() + QUOTE_REFRESH_INTERVAL,
          loading: false,
        }));
      } catch (error) {
        if (!isMounted) return;

        const errorMsg = error instanceof Error ? error.message : "Failed to fetch quote";
        setState(prev => ({ ...prev, error: errorMsg, loading: false }));
      }
    };

    // Debounce quote fetching
    debounceTimer = setTimeout(() => {
      fetchQuote();
    }, 300);

    return () => {
      clearTimeout(debounceTimer);
      isMounted = false;
    };
  }, [inputs]);

  // Check if quote is expired
  const isQuoteExpired = useMemo(() => {
    return state.quoteExpiry > 0 && Date.now() > state.quoteExpiry;
  }, [state.quoteExpiry]);

  // Calculate USD value of swap (input amount)
  const swapUsdValue = useMemo(() => {
    if (!inputs.inputAmount || !inputs.fromToken) return 0;

    // Use real-time price from Jupiter Price API
    const price = tokenPrices[inputs.fromToken.address] || 0;
    return parseFloat(inputs.inputAmount) * price;
  }, [inputs.inputAmount, inputs.fromToken, tokenPrices]);

  // Calculate USD value of output amount
  const outputUsdValue = useMemo(() => {
    if (!state.outputAmount || !inputs.toToken) return 0;

    // Use real-time price from Jupiter Price API
    const price = tokenPrices[inputs.toToken.address] || 0;
    return parseFloat(state.outputAmount) * price;
  }, [state.outputAmount, inputs.toToken, tokenPrices]);

  // Calculate points earned
  const pointsEarned = useMemo(() => {
    const { points } = calculateSwapPoints(swapUsdValue);
    return points;
  }, [swapUsdValue]);

  // Update inputs
  const updateInputs = useCallback(
    (updates: Partial<SwapInputs>) => {
      setInputs(prev => ({ ...prev, ...updates }));
    },
    []
  );

  // Set from token
  const setFromToken = useCallback(
    (token: TokenInfo | null) => {
      updateInputs({ fromToken: token });
    },
    [updateInputs]
  );

  // Set to token
  const setToToken = useCallback(
    (token: TokenInfo | null) => {
      updateInputs({ toToken: token });
    },
    [updateInputs]
  );

  // Set input amount
  const setInputAmount = useCallback(
    (amount: string) => {
      updateInputs({ inputAmount: amount });
    },
    [updateInputs]
  );

  // Swap tokens (reverse from/to)
  const reverseTokens = useCallback(() => {
    setInputs(prev => ({
      ...prev,
      fromToken: prev.toToken,
      toToken: prev.fromToken,
      inputAmount: state.outputAmount,
    }));
  }, [state.outputAmount]);

  // Execute swap
  const executeSwap = useCallback(async (): Promise<SwapResult | null> => {
    if (
      !publicKey ||
      !inputs.fromToken ||
      !inputs.toToken ||
      !state.quote ||
      isQuoteExpired
    ) {
      setState(prev => ({
        ...prev,
        swapError: "Invalid swap state or quote expired",
      }));
      return null;
    }

    setState(prev => ({ ...prev, swapping: true, swapError: null }));

    try {
      // Build swap transaction
      const { swapTransaction } = await buildSwapTransaction(state.quote, publicKey.toString());

      // Decode transaction
      const transactionBuffer = Buffer.from(swapTransaction, "base64");
      const transaction = VersionedTransaction.deserialize(transactionBuffer);

      // Send transaction via wallet adapter (Phantom path uses signAndSendTransaction).
      const signature = await sendTransaction(transaction, connection);

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, "confirmed");

      if (confirmation.value.err) {
        throw new Error("Transaction failed");
      }

      // Log swap completion to backend (fire and forget)
      swapLoggingService.logSwapFireAndForget({
        wallet: publicKey.toString(),
        signature,
        status: 'confirmed',
        inputAmountUSD: swapUsdValue,
        outputAmountUSD: swapUsdValue, // Approximate, same as input for now
        inputMint: inputs.fromToken!.address,
        outputMint: inputs.toToken!.address,
        inputAmount: toSmallestUnit(parseFloat(inputs.inputAmount), inputs.fromToken!.decimals).toString(),
        outputAmount: state.quote!.outAmount,
        inputDecimals: inputs.fromToken!.decimals,
        outputDecimals: inputs.toToken!.decimals,
        feeTier: feeDiscount.tier.name,
        discountPercent: feeDiscount.discountPercent,
        effectiveFeeBps: feeDiscount.effectiveFeeBps,
        feeAmountUSD: swapUsdValue * (feeDiscount.effectiveFeeBps / 10000),
        charityAmountUSD: swapUsdValue * (feeDiscount.effectiveFeeBps / 10000) * 0.25,
        kindswapFeeUSD: swapUsdValue * (feeDiscount.effectiveFeeBps / 10000) * 0.75,
        slippageBps: inputs.slippageBps,
        knsBalanceAtSwap: knsBalance.toString(),
      });

      const result: SwapResult = {
        signature,
        inputAmount: parseFloat(inputs.inputAmount),
        outputAmount: parseFloat(state.outputAmount),
        usdValue: swapUsdValue,
        pointsEarned,
        feeApplied: feeDiscount,
      };

      setState(prev => ({
        ...prev,
        swapping: false,
        quote: null,
        outputAmount: "0.00",
        inputAmount: "",
      }));

      setInputs(prev => ({ ...prev, inputAmount: "" }));

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Swap failed";
      setState(prev => ({ ...prev, swapping: false, swapError: errorMsg }));
      return null;
    }
  }, [
    publicKey,
    inputs.fromToken,
    inputs.toToken,
    inputs.inputAmount,
    inputs.slippageBps,
    state.quote,
    state.outputAmount,
    isQuoteExpired,
    sendTransaction,
    connection,
    swapUsdValue,
    pointsEarned,
    feeDiscount,
    knsBalance,
  ]);

  return {
    // Inputs
    inputs,
    updateInputs,
    setFromToken,
    setToToken,
    setInputAmount,
    reverseTokens,

    // State
    ...state,
    isQuoteExpired,
    feeDiscount,
    swapUsdValue,
    outputUsdValue,
    pointsEarned,
    tokenList,

    // Actions
    executeSwap,

    // Computed
    isReady: !!(
      publicKey &&
      inputs.fromToken &&
      inputs.toToken &&
      inputs.inputAmount &&
      !state.loading &&
      !isQuoteExpired &&
      parseFloat(inputs.inputAmount) > 0
    ),
    isInsufficientBalance: false, // This would be calculated based on actual balance
  };
}
