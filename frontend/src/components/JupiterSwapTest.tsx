import React, { useState, useEffect, useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { JupiterAPIService } from "../contexts/jupiter/jupiterService";
import {
  FeeCalculator,
  calculateSwapFees,
} from "../contexts/jupiter/feeCalculator";
import { CONFIG } from "../contexts/jupiter/constants";
import {
  TokenInfo,
  FeeCalculation,
  FeeConfig,
} from "../contexts/jupiter/jupiter";
import {
  JupiterSwapService,
  SwapState,
  SwapStatus,
  SwapParams,
} from "../contexts/jupiter/jupiterSwap";
import { feeWalletService } from "../contexts/api/feeWalletService";
import "@solana/wallet-adapter-react-ui/styles.css";

const jupiterService = new JupiterAPIService();

const JupiterSwapTest: React.FC = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, connected } = wallet;

  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [inputToken, setInputToken] = useState<string>("");
  const [outputToken, setOutputToken] = useState<string>("");
  const [inputAmount, setInputAmount] = useState<string>("");
  const [slippageBps, setSlippageBps] = useState<number>(50);
  const [knsBalance, setKnsBalance] = useState<number>(0);
  const [feeCalculation, setFeeCalculation] = useState<FeeCalculation | null>(
    null
  );
  const [loadingFees, setLoadingFees] = useState(false);
  const [quote, setQuote] = useState<any | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string>("");
  const [solBalance, setSolBalance] = useState<number>(0);
  const [maxSwappableAmount, setMaxSwappableAmount] = useState<string>("");
  const [swapState, setSwapState] = useState<SwapState>({
    status: SwapStatus.IDLE,
  });
  const [isExecutingSwap, setIsExecutingSwap] = useState(false);
  const [platformFeeWallet, setPlatformFeeWallet] = useState<string>(CONFIG.PLATFORM_FEE_WALLET);

  const singleStepSwapService = useMemo(
    () => new JupiterSwapService(connection),
    [connection]
  );

  // Fetch platform fee wallet on mount
  useEffect(() => {
    async function loadPlatformWallet() {
      const wallet = await feeWalletService.getPlatformWallet();
      setPlatformFeeWallet(wallet);
    }
    loadPlatformWallet();
  }, []);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!connected || !publicKey) {
        setSolBalance(0);
        return;
      }

      try {
        const balance = await connection.getBalance(publicKey);
        setSolBalance(balance);

        const SOL_MINT = "So11111111111111111111111111111111111111112";
        if (inputToken === SOL_MINT) {
          const RESERVE = 890880 + 50000;
          const maxSwap = Math.max(0, balance - RESERVE);
          const selectedToken = tokens.find((t) => t.id === inputToken);
          if (selectedToken) {
            setMaxSwappableAmount(
              (maxSwap / Math.pow(10, selectedToken.decimals)).toFixed(6)
            );
          }
        }
      } catch (error) {
        console.error("Failed to fetch balance:", error);
      }
    };

    fetchBalance();
  }, [connected, publicKey, connection, inputToken, tokens]);

  const handleMaxClick = () => {
    if (maxSwappableAmount) {
      setInputAmount(maxSwappableAmount);
    }
  };

  useEffect(() => {
    const fetchTokens = async () => {
      setLoadingTokens(true);
      try {
        const tokenList = await jupiterService.getTokenList();
        setTokens(tokenList);
      } catch (error) {
        console.error("Failed to fetch tokens:", error);
      } finally {
        setLoadingTokens(false);
      }
    };

    fetchTokens();
  }, []);

  useEffect(() => {
    const calculateFees = async () => {
      if (!connected || !publicKey || !inputAmount || !inputToken) {
        setFeeCalculation(null);
        setKnsBalance(0);
        return;
      }

      const selectedToken = tokens.find((t) => t.id === inputToken);
      if (!selectedToken) return;

      setLoadingFees(true);
      try {
        const feeConfig: FeeConfig = {
          baseFeePercentage: CONFIG.DEFAULT_BASE_FEE_BPS,
          charityFeePercentage: CONFIG.DEFAULT_CHARITY_FEE_BPS,
          platformWallet: platformFeeWallet,
          charityWallet: CONFIG.CHARITY_FEE_WALLET,
        };

        const fees = await calculateSwapFees(
          connection,
          publicKey.toBase58(),
          inputAmount,
          selectedToken.decimals,
          feeConfig
        );

        setFeeCalculation(fees);

        const calculator = new FeeCalculator(connection, feeConfig);
        const balance = await calculator.getKNSBalance(publicKey.toBase58());
        setKnsBalance(balance);
      } catch (error) {
        console.error("Failed to calculate fees:", error);
      } finally {
        setLoadingFees(false);
      }
    };

    calculateFees();
  }, [connected, publicKey, inputAmount, inputToken, tokens, connection]);

  const handleGetQuote = async () => {
    if (!inputToken || !outputToken || !inputAmount || !feeCalculation) {
      setQuoteError(
        "Please select tokens, enter amount and ensure fees are calculated"
      );
      return;
    }

    const selectedToken = tokens.find((t) => t.id === inputToken);
    const selectedOutputToken = tokens.find((t) => t.id === outputToken);
    if (!selectedToken || !selectedOutputToken) return;

    setLoadingQuote(true);
    setQuoteError("");
    setQuote(null);

    try {
      const amountInUnits = (
        parseFloat(inputAmount) * Math.pow(10, selectedToken.decimals)
      ).toString();

      const quoteResponse = await singleStepSwapService.getQuote(
        inputToken,
        outputToken,
        amountInUnits,
        feeCalculation,
        slippageBps
      );

      const enrichedQuote = {
        ...quoteResponse,
        inputMint: inputToken,
        outputMint: outputToken,
        timeTaken: 0,
      };

      setQuote(enrichedQuote);
    } catch (error: any) {
      console.error("Failed to get quote:", error);
      setQuoteError(error.message || "Failed to fetch quote");
    } finally {
      setLoadingQuote(false);
    }
  };

  const handleExecuteSwap = async () => {
    if (
      !connected ||
      !publicKey ||
      !feeCalculation ||
      !inputToken ||
      !outputToken ||
      !inputAmount
    ) {
      alert("Please connect wallet and get a quote first");
      return;
    }

    const selectedToken = tokens.find((t) => t.id === inputToken);
    const selectedOutputToken = tokens.find((t) => t.id === outputToken);
    if (!selectedToken || !selectedOutputToken) return;

    setIsExecutingSwap(true);
    setSwapState({ status: SwapStatus.IDLE });

    try {
      const amountInUnits = (
        parseFloat(inputAmount) * Math.pow(10, selectedToken.decimals)
      ).toString();

      const swapParams: SwapParams = {
        inputMint: inputToken,
        outputMint: outputToken,
        inputAmount: amountInUnits,
        inputDecimals: selectedToken.decimals,
        outputDecimals: selectedOutputToken.decimals,
        feeCalculation,
        platformFeeWallet: platformFeeWallet,
        charityFeeWallet: CONFIG.CHARITY_FEE_WALLET,
        slippageBps: slippageBps,
      };

      const result = await singleStepSwapService.executeSwap(
        wallet,
        swapParams,
        (state) => {
          setSwapState(state);
        }
      );

      console.log("Swap completed:", result);

      if (swapState.status === SwapStatus.CONFIRMED) {
        setInputAmount("");
        setQuote(null);
      }
    } catch (error: any) {
      console.error("Swap execution failed:", error);
      alert(`Swap failed: ${error.message}`);
    } finally {
      setIsExecutingSwap(false);
    }
  };

  const getTokenInfo = (address: string): TokenInfo | undefined => {
    return tokens.find((t) => t.id === address);
  };

  const formatAmount = (amount: string, decimals: number): string => {
    const num = parseFloat(amount) / Math.pow(10, decimals);
    return num.toLocaleString(undefined, { maximumFractionDigits: 6 });
  };

  const discountPercentage = useMemo(() => {
    if (!feeCalculation) return 0;
    const baseFeeBps = CONFIG.DEFAULT_BASE_FEE_BPS;
    const discount =
      ((baseFeeBps - feeCalculation.effectiveFeeBps) / baseFeeBps) * 100;
    return discount;
  }, [feeCalculation]);

  const getStatusColor = (status: SwapStatus) => {
    switch (status) {
      case SwapStatus.CONFIRMED:
        return "text-green-400";
      case SwapStatus.FAILED:
        return "text-red-400";
      case SwapStatus.GETTING_QUOTE:
      case SwapStatus.BUILDING_TRANSACTION:
      case SwapStatus.AWAITING_SIGNATURE:
      case SwapStatus.CONFIRMING:
        return "text-yellow-400";
      default:
        return "text-gray-400";
    }
  };

  const getStatusIcon = (status: SwapStatus) => {
    switch (status) {
      case SwapStatus.CONFIRMED:
        return "✓";
      case SwapStatus.FAILED:
        return "✗";
      case SwapStatus.IDLE:
        return "○";
      default:
        return "⋯";
    }
  };

  const feeBreakdown = useMemo(() => {
    if (!inputToken || !inputAmount || !feeCalculation) return null;
    const selectedToken = tokens.find((t) => t.id === inputToken);
    if (!selectedToken) return null;

    return {
      platformFee: (
        feeCalculation.platformFeeAmount / Math.pow(10, selectedToken.decimals)
      ).toFixed(6),
      charityFee: (
        feeCalculation.charityFeeAmount / Math.pow(10, selectedToken.decimals)
      ).toFixed(6),
      totalFee: (
        feeCalculation.feeAmountInInputToken /
        Math.pow(10, selectedToken.decimals)
      ).toFixed(6),
      symbol: selectedToken.symbol,
    };
  }, [inputToken, inputAmount, feeCalculation, tokens]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-3 mt-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-3">Jupiter Swap</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Left Column */}
          <div className="space-y-3">
            {/* Token Selection */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-3 border border-gray-700">
              <h2 className="text-sm font-semibold mb-2 text-purple-300">
                Token Selection
              </h2>
              {loadingTokens ? (
                <div className="text-xs text-gray-400 animate-pulse">
                  Loading...
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={inputToken}
                    onChange={(e) => setInputToken(e.target.value)}
                    className="w-full px-2 py-2 text-sm bg-gray-900 border border-gray-600 rounded text-white focus:ring-1 focus:ring-purple-500 outline-none"
                  >
                    <option value="">Input Token</option>
                    {tokens.map((token) => (
                      <option key={token.id} value={token.id}>
                        {token.symbol} - {token.name}
                      </option>
                    ))}
                  </select>

                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        const temp = inputToken;
                        setInputToken(outputToken);
                        setOutputToken(temp);
                        setInputAmount("");
                        setQuote(null);
                        setQuoteError("");
                      }}
                      disabled={!inputToken && !outputToken}
                      className="p-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-full transition-all"
                      title="Swap tokens"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                        />
                      </svg>
                    </button>
                  </div>

                  <select
                    value={outputToken}
                    onChange={(e) => setOutputToken(e.target.value)}
                    className="w-full px-2 py-2 text-sm bg-gray-900 border border-gray-600 rounded text-white focus:ring-1 focus:ring-purple-500 outline-none"
                  >
                    <option value="">Output Token</option>
                    {tokens.map((token) => (
                      <option key={token.id} value={token.id}>
                        {token.symbol} - {token.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Amount & Slippage */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-3 border border-gray-700">
              <h2 className="text-sm font-semibold mb-2 text-purple-300">
                Amount & Slippage
              </h2>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-gray-300">Amount</label>
                    {inputToken ===
                      "So11111111111111111111111111111111111111112" && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">
                          {(solBalance / 1e9).toFixed(4)} SOL
                        </span>
                        <button
                          onClick={handleMaxClick}
                          className="text-xs px-1.5 py-0.5 bg-purple-600 hover:bg-purple-700 rounded"
                        >
                          MAX
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    value={inputAmount}
                    onChange={(e) => setInputAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-2 py-2 text-sm bg-gray-900 border border-gray-600 rounded text-white focus:ring-1 focus:ring-purple-500 outline-none"
                    step="0.000001"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-300 mb-1 block">
                    Slippage (%)
                  </label>
                  <input
                    type="number"
                    value={slippageBps / 100}
                    onChange={(e) =>
                      setSlippageBps(parseFloat(e.target.value) * 100)
                    }
                    placeholder="0.5"
                    className="w-full px-2 py-2 text-sm bg-gray-900 border border-gray-600 rounded text-white focus:ring-1 focus:ring-purple-500 outline-none"
                    step="0.1"
                  />
                </div>
              </div>
            </div>

            {/* Fee Info */}
            {connected && feeCalculation && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-3 border border-gray-700">
                <h2 className="text-sm font-semibold mb-2 text-purple-300">
                  Fees & Discount
                </h2>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="bg-gray-900/50 p-2 rounded">
                    <div className="text-xs text-gray-400">KNS</div>
                    <div className="text-sm font-semibold">
                      {knsBalance.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-gray-900/50 p-2 rounded">
                    <div className="text-xs text-gray-400">Discount</div>
                    <div className="text-sm font-semibold text-green-400">
                      {discountPercentage.toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-gray-900/50 p-2 rounded">
                    <div className="text-xs text-gray-400">Total Fee</div>
                    <div className="text-sm font-semibold text-purple-400">
                      {feeCalculation.totalFeeBps.toFixed(2)}%
                    </div>
                  </div>
                </div>
                {feeBreakdown && (
                  <div className="bg-purple-900/20 p-2 rounded border border-purple-500/30">
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Platform:</span>
                        <span>
                          {feeCalculation.platformFeeAmount.toFixed(5)}{" "}
                          {feeBreakdown.symbol}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Charity:</span>
                        <span>
                          {feeCalculation.charityFeeAmount.toFixed(5)}{" "}
                          {feeBreakdown.symbol}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-3 border border-gray-700">
              <div className="flex gap-2">
                <button
                  onClick={handleGetQuote}
                  disabled={
                    !inputToken ||
                    !outputToken ||
                    !inputAmount ||
                    !feeCalculation ||
                    loadingQuote
                  }
                  className="flex-1 py-2 px-3 text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded font-semibold"
                >
                  {loadingQuote ? "Loading..." : "Get Quote"}
                </button>
                <button
                  onClick={handleExecuteSwap}
                  disabled={
                    !connected || !quote || !feeCalculation || isExecutingSwap
                  }
                  className="flex-1 py-2 px-3 text-sm bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded font-semibold"
                >
                  {isExecutingSwap ? "Executing..." : "Execute"}
                </button>
              </div>
              {quoteError && (
                <div className="mt-2 p-2 bg-red-900/50 border border-red-700 rounded text-xs text-red-200">
                  {quoteError}
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-3">
            {/* Swap Status */}
            {swapState.status !== SwapStatus.IDLE && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-3 border border-gray-700">
                <h2 className="text-sm font-semibold mb-2 text-purple-300">
                  Swap Status
                </h2>
                <div className="space-y-2">
                  <div className="bg-gray-900/50 p-2 rounded">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs ${getStatusColor(
                          swapState.status
                        )}`}
                      >
                        {swapState.status}
                      </span>
                      <span
                        className={`text-lg ${getStatusColor(
                          swapState.status
                        )}`}
                      >
                        {getStatusIcon(swapState.status)}
                      </span>
                    </div>
                    {swapState.message && (
                      <div className="text-xs text-gray-300 mt-1">
                        {swapState.message}
                      </div>
                    )}
                    {swapState.swapSignature && (
                      <div className="text-xs text-green-400 font-mono mt-1">
                        <a
                          href={`https://solscan.io/tx/${swapState.swapSignature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {swapState.swapSignature.slice(0, 8)}...
                          {swapState.swapSignature.slice(-8)}
                        </a>
                      </div>
                    )}
                    {swapState.error && (
                      <div className="text-xs text-red-400 mt-1">
                        {swapState.error}
                      </div>
                    )}
                  </div>
                  <div className="bg-gray-900/50 p-2 rounded">
                    <div className="space-y-1">
                      {[
                        { status: SwapStatus.GETTING_QUOTE, label: "Quote" },
                        {
                          status: SwapStatus.BUILDING_TRANSACTION,
                          label: "Building",
                        },
                        {
                          status: SwapStatus.AWAITING_SIGNATURE,
                          label: "Signature",
                        },
                        { status: SwapStatus.CONFIRMING, label: "Confirming" },
                        { status: SwapStatus.CONFIRMED, label: "Done" },
                      ].map((step, index) => {
                        const isActive = swapState.status === step.status;
                        const isPast =
                          Object.values(SwapStatus).indexOf(swapState.status) >
                          Object.values(SwapStatus).indexOf(step.status);
                        return (
                          <div
                            key={index}
                            className={`flex items-center gap-2 p-1 rounded ${
                              isActive ? "bg-purple-900/30" : ""
                            }`}
                          >
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${
                                isPast || isActive
                                  ? "bg-green-400"
                                  : "bg-gray-500"
                              } ${isActive ? "animate-pulse" : ""}`}
                            />
                            <span className="text-xs">{step.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quote Summary */}
            {quote && (
              <>
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-3 border border-gray-700">
                  <h2 className="text-sm font-semibold mb-2 text-purple-300">
                    Quote
                  </h2>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-gray-900/50 rounded">
                      <span className="text-xs text-gray-400">Input</span>
                      <span className="text-sm font-semibold">
                        {formatAmount(
                          quote.inAmount,
                          getTokenInfo(quote.inputMint)?.decimals || 9
                        )}{" "}
                        {getTokenInfo(quote.inputMint)?.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-green-900/20 rounded border border-green-700/50">
                      <span className="text-xs text-gray-400">Output</span>
                      <span className="text-sm font-semibold text-green-400">
                        {formatAmount(
                          quote.outAmount,
                          getTokenInfo(quote.outputMint)?.decimals || 9
                        )}{" "}
                        {getTokenInfo(quote.outputMint)?.symbol}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2 bg-gray-900/50 rounded">
                        <div className="text-xs text-gray-500">Impact</div>
                        <div className="text-xs font-semibold">
                          {parseFloat(quote.priceImpactPct).toFixed(3)}%
                        </div>
                      </div>
                      <div className="p-2 bg-gray-900/50 rounded">
                        <div className="text-xs text-gray-500">Slippage</div>
                        <div className="text-xs font-semibold">
                          {quote.slippageBps / 100}%
                        </div>
                      </div>
                      <div className="p-2 bg-gray-900/50 rounded">
                        <div className="text-xs text-gray-500">Mode</div>
                        <div className="text-xs font-semibold">
                          {quote.swapMode}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Route Plan */}
                {quote.routePlan && quote.routePlan.length > 0 && (
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-3 border border-gray-700">
                    <h2 className="text-sm font-semibold mb-2 text-purple-300">
                      Route ({quote.routePlan.length} step
                      {quote.routePlan.length > 1 ? "s" : ""})
                    </h2>
                    <div className="space-y-2">
                      {quote.routePlan.map((step: any, index: number) => (
                        <div
                          key={index}
                          className="bg-gray-900/50 rounded p-2 border border-gray-600"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-purple-400">
                              Step {index + 1}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-purple-600/30 rounded border border-purple-500/50">
                              {step.swapInfo.label}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">In:</span>
                              <span>
                                {formatAmount(
                                  step.swapInfo.inAmount,
                                  getTokenInfo(step.swapInfo.inputMint)
                                    ?.decimals || 9
                                )}{" "}
                                {getTokenInfo(step.swapInfo.inputMint)?.symbol}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Out:</span>
                              <span className="text-green-400">
                                {formatAmount(
                                  step.swapInfo.outAmount,
                                  getTokenInfo(step.swapInfo.outputMint)
                                    ?.decimals || 9
                                )}{" "}
                                {getTokenInfo(step.swapInfo.outputMint)?.symbol}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JupiterSwapTest;
