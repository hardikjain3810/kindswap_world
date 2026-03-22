'use client';

import React, { useState, useEffect, useRef } from 'react';
// createPortal removed - rendering directly like RoutingModal for proper event handling
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Link } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { initCoinGeckoService, getCoinGeckoService } from '@/lib/api/coingecko';
import Header from '@/components/Header';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useScrollLock } from '@/hooks/useScrollLock';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent } from '@/components/ui/tooltip';
import {
  ArrowUpDown,
  ExternalLink,
  AlertCircle,
  Loader2,
  X,
  Search,
  Settings2,
  Menu,
  ChevronDown,
  Info,
  RefreshCw,
  Check,
  Copy,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import KindSwapLogo from '@/components/KindSwapLogo';
import { JupiterAPIService } from '@/contexts/jupiter/jupiterService';
import { JupiterSwapService, SwapStatus, SwapState as JupiterSwapState } from '@/contexts/jupiter/jupiterSwap';
import { TokenInfo, QuoteRoute } from '@/contexts/jupiter/jupiter';
import { CONFIG } from '@/contexts/jupiter/constants';
import { FeeCalculator } from '@/contexts/jupiter/feeCalculator';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { swapLoggingService, type SwapLogPayload } from '@/contexts/api/swapLoggingService';
import {
  feeConfigService,
  type FeeConfiguration,
  type FeeTier,
  getCurrentTierFromList,
  getNextTierFromList,
  calculateTierProgressFromList,
  formatKnsBalance,
  DEFAULT_FEE_CONFIG,
  DEFAULT_TIERS,
} from '@/contexts/api/feeConfigService';
import { feeWalletService } from '@/contexts/api/feeWalletService';
import { isMobileWithoutPhantom, getSession as getPhantomMobileSession } from '@/lib/wallet/phantomMobile';

// ============================================
// UTILITY FUNCTIONS
// ============================================
/**
 * Debounce function to limit API calls during user typing
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Format number with USD-style commas (1,500,000 not 15,00,000)
const formatUSD = (num: number, decimals: number = 2): string => {
  if (!isFinite(num) || isNaN(num)) return '0.00';
  if (Math.abs(num) >= 1e12) return num > 0 ? '999,999,999,999+' : '-999,999,999,999+';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// Format number with commas, no decimal constraint
const formatWithCommas = (num: number): string => {
  return num.toLocaleString('en-US');
};

/**
 * Get color class based on price impact
 * Grey for normal, Red when > 10%
 */
const getPriceImpactColor = (impact: number): string => {
  if (impact > 10) return 'text-red-400';
  return 'text-muted-foreground';
};

/**
 * Truncate contract address to first 4 + last 4 characters
 */
const truncateAddress = (address: string): string => {
  if (!address || address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

/**
 * Copy text to clipboard with feedback
 */
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    Sentry.captureException(err, {
      tags: { feature: 'clipboard', action: 'copy' },
      level: 'warning',
    });
    return false;
  }
};

// ============================================
// TOKEN DATA
// ============================================
interface Token {
  symbol: string;
  name: string;
  icon: string;
  color: string;
}

const TOKENS_LIST: Token[] = [
  { symbol: 'SOL', name: 'Solana', icon: '◎', color: 'from-[#9945FF] to-[#14F195]' },
  { symbol: 'USDC', name: 'USD Coin', icon: '$', color: 'from-[#2775CA] to-[#2775CA]' },
  { symbol: 'USDT', name: 'Tether USD', icon: '₮', color: 'from-[#26A17B] to-[#26A17B]' },
  { symbol: 'ETH', name: 'Ethereum', icon: 'Ξ', color: 'from-[#627EEA] to-[#627EEA]' },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', icon: '₿', color: 'from-[#F7931A] to-[#F7931A]' },
  { symbol: 'JPYC', name: 'JPY Coin', icon: '¥', color: 'from-[#FCD34D] to-[#FCD34D]' },
  { symbol: 'JPYC_V1', name: 'JPY Coin v1', icon: '¥', color: 'from-[#6B21A8] to-[#6B21A8]' },
  { symbol: 'XSGD', name: 'XSGD', icon: '🏧', color: 'from-[#3B82F6] to-[#3B82F6]' },
  { symbol: 'PEPE', name: 'Pepe 2nd Chance', icon: '🐸', color: 'from-[#22C55E] to-[#22C55E]' },
  { symbol: 'BRETT', name: 'Brett ETH', icon: '⚡', color: 'from-[#CA8A04] to-[#CA8A04]' },
  { symbol: 'KNS', name: 'KindSoul', icon: 'K', color: 'from-cyan-400 to-emerald-400' },
];

const POPULAR_TOKENS = ['SOL', 'ETH', 'USDC', 'USDT', 'WBTC', 'KNS'];

// Token mint addresses for Jupiter API (fallback for common tokens)
const TOKEN_MINT_ADDRESSES: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  ETH: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
  WBTC: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
  KNS: CONFIG.KNS_TOKEN_MINT,
};

// Stablecoin mints whose amount equals USD value (1:1)
const STABLECOIN_MINTS = new Set([
  TOKEN_MINT_ADDRESSES.USDC,
  TOKEN_MINT_ADDRESSES.USDT,
]);

const parseBooleanEnv = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return undefined;
};

const configuredSingleTxMode = parseBooleanEnv(import.meta.env.VITE_SINGLE_TX_SWAP_ENABLED);
const SWAP_TX_MODE: 'single_tx' | 'legacy_two_tx' =
  (configuredSingleTxMode ?? !import.meta.env.PROD) ? 'single_tx' : 'legacy_two_tx';

const extractComposeDiagnostics = (
  errorMessage: string
): { composeStage?: string; instructionCount?: number } => {
  const composeStageMatch = errorMessage.match(/composeStage=([^;\s.]+)/);
  const instructionCountMatch = errorMessage.match(/instructionCount=(\d+)/);
  return {
    composeStage: composeStageMatch?.[1],
    instructionCount: instructionCountMatch ? Number(instructionCountMatch[1]) : undefined,
  };
};

// SOL input swaps require extra balance for wrapped SOL account rent + tx fees.
const SOL_SWAP_RESERVE = 0.003;
const SOL_GAS_BUFFER_MULTIPLIER = 2;
const getRequiredSwapBalance = (
  inputAmount: number,
  estimatedGasFee: number,
  isInputSol: boolean
): number =>
  isInputSol
    ? inputAmount + estimatedGasFee * SOL_GAS_BUFFER_MULTIPLIER + SOL_SWAP_RESERVE
    : inputAmount;

// CoinGecko Pro API configuration
const COINGECKO_API_KEYS = [
  import.meta.env.VITE_COINGECKO_API_KEY_1 || 'CG-wFTREP3NAvzKHAB2bEN3yigA',
].filter(key => key && key !== 'undefined' && key !== '');

// Initialize CoinGecko service with multiple API keys for rotation
const coinGeckoService = initCoinGeckoService(COINGECKO_API_KEYS);
console.log(`[CoinGecko] Initialized with ${COINGECKO_API_KEYS.length} API key(s)`);

// Cached SOL price from CoinGecko API
let _cachedSolPrice: number = 0;
let _solPriceLastFetch: number = 0;
const SOL_PRICE_CACHE_MS = 60_000; // refresh every 60s

async function fetchSolPriceFallback(): Promise<number> {
  const now = Date.now();
  if (_cachedSolPrice > 0 && now - _solPriceLastFetch < SOL_PRICE_CACHE_MS) {
    return _cachedSolPrice;
  }
  try {
    const data = await coinGeckoService.getSimplePrice('solana', 'usd', false, SOL_PRICE_CACHE_MS);
    const price = data?.solana?.usd;
    if (price && price > 0) {
      _cachedSolPrice = price;
      _solPriceLastFetch = now;
      console.log('[SOL Price Fallback] Fetched:', price);
      return price;
    }
  } catch (err) {
    console.warn('[SOL Price Fallback] Failed:', err);
    Sentry.captureException(err, {
      tags: { feature: 'price-fetch', action: 'sol-price-fallback' },
      level: 'warning',
    });
  }
  return _cachedSolPrice; // return stale cache if fetch fails
}

/**
 * Derive USD values for a swap using token prices, with multiple fallbacks:
 *  1. tokenPrices from Jupiter Price API
 *  2. Stablecoin detection (USDC/USDT = $1)
 *  3. SOL price from CoinGecko (public, no key)
 *  4. Cross-derive: if one side is known, the other ≈ same USD value
 */
async function deriveSwapUSD(
  inputAmountNum: number,
  outputAmountNum: number,
  inputMint: string,
  outputMint: string,
  inputPrice: number,
  outputPrice: number,
): Promise<{ inputAmountUSD: number; outputAmountUSD: number }> {
  let inputUSD = inputAmountNum * inputPrice;
  let outputUSD = outputAmountNum * outputPrice;

  // If both prices are available, we're done
  if (inputUSD > 0 && outputUSD > 0) {
    return { inputAmountUSD: inputUSD, outputAmountUSD: outputUSD };
  }

  // Try stablecoin detection
  if (inputUSD === 0 && STABLECOIN_MINTS.has(inputMint)) {
    inputUSD = inputAmountNum;
  }
  if (outputUSD === 0 && STABLECOIN_MINTS.has(outputMint)) {
    outputUSD = outputAmountNum;
  }

  // Try SOL price fallback (CoinGecko, no API key needed)
  const solMint = TOKEN_MINT_ADDRESSES.SOL;
  if (inputUSD === 0 && inputMint === solMint) {
    const solPrice = await fetchSolPriceFallback();
    if (solPrice > 0) inputUSD = inputAmountNum * solPrice;
  }
  if (outputUSD === 0 && outputMint === solMint) {
    const solPrice = await fetchSolPriceFallback();
    if (solPrice > 0) outputUSD = outputAmountNum * solPrice;
  }

  // Cross-derive: swap input ≈ output in USD value
  if (inputUSD === 0 && outputUSD > 0) inputUSD = outputUSD;
  if (outputUSD === 0 && inputUSD > 0) outputUSD = inputUSD;

  return { inputAmountUSD: inputUSD, outputAmountUSD: outputUSD };
}

// Helper to get mint address from symbol - checks tokenList first, then fallback
const getMintAddressFromList = (symbol: string, tokenList: TokenInfo[], recentTokensRef?: React.MutableRefObject<Map<string, TokenInfo>>): string | undefined => {
  // First check recent tokens ref (for tokens just selected from search)
  if (recentTokensRef?.current) {
    const recentToken = recentTokensRef.current.get(symbol.toUpperCase());
    if (recentToken?.id) {
      return recentToken.id;
    }
  }

  // Then check the dynamic token list (has all tokens)
  const token = tokenList.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
  if (token?.id) {
    return token.id;
  }

  // Fallback to hardcoded addresses for common tokens
  return TOKEN_MINT_ADDRESSES[symbol];
};

// Helper to get token decimals from symbol
const getTokenDecimalsFromList = (symbol: string, tokenList: TokenInfo[], recentTokensRef?: React.MutableRefObject<Map<string, TokenInfo>>): number => {
  // First check recent tokens ref (for tokens just selected from search)
  if (recentTokensRef?.current) {
    const recentToken = recentTokensRef.current.get(symbol.toUpperCase());
    if (recentToken?.decimals !== undefined) {
      return recentToken.decimals;
    }
  }

  const token = tokenList.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
  if (token?.decimals !== undefined) {
    return token.decimals;
  }
  // Default decimals
  return symbol === 'SOL' ? 9 : 6;
};

// Fee Structure Constants (defaults - will be overridden by API)
const BASE_FEE_BPS = 10; // 0.10% base fee (10 basis points)
const DEFAULT_CHARITY_PORTION = 0.25; // 25% of total fee goes to charity
const DEFAULT_KINDSWAP_PORTION = 0.75; // 75% of total fee goes to KindSwap

// Helper to convert display tier from API tier
interface DisplayTier {
  name: string;
  kns: string;
  knsMin: number;
  discount: string;
  discountPercent: number;
  fee: string;
  effectiveFeeBps: number;
}

const convertToDisplayTier = (tier: FeeTier | typeof DEFAULT_TIERS[0]): DisplayTier => {
  const knsMin = typeof tier.knsMin === 'string' ? parseInt(tier.knsMin) : tier.knsMin;
  return {
    name: tier.name,
    kns: formatKnsBalance(knsMin),
    knsMin: knsMin,
    discount: `${tier.discountPercent}%`,
    discountPercent: tier.discountPercent,
    fee: `${(tier.effectiveFeeBps / 100).toFixed(3)}%`,
    effectiveFeeBps: tier.effectiveFeeBps,
  };
};

// Calculate fee breakdown for display
const calculateFeeBreakdown = (
  effectiveFeeBps: number,
  charityPortion: number,
  kindswapPortion: number
) => {
  const totalFeePercent = effectiveFeeBps / 100; // Convert bps to percent
  const charityFeePercent = totalFeePercent * charityPortion;
  const kindswapFeePercent = totalFeePercent * kindswapPortion;

  return {
    totalFeePercent,
    charityFeePercent,
    kindswapFeePercent,
  };
};

// ============================================
// ROUTING MODAL
// ============================================
interface RoutingModalProps {
  isOpen: boolean;
  onClose: () => void;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  currentQuote: QuoteRoute | null;
  tokenList: TokenInfo[];
}

const RoutingModal = ({
  isOpen,
  onClose,
  inputToken,
  outputToken,
  inputAmount,
  outputAmount,
  currentQuote,
  tokenList,
}: RoutingModalProps) => {
  const [inputImageError, setInputImageError] = useState(false);
  const [outputImageError, setOutputImageError] = useState(false);

  // Reset image errors when tokens change
  React.useEffect(() => {
    setInputImageError(false);
  }, [inputToken]);

  React.useEffect(() => {
    setOutputImageError(false);
  }, [outputToken]);

  if (!isOpen) return null;

  const tokenColorMap: Record<string, string> = {
    SOL: 'from-[#9945FF] to-[#14F195]',
    USDC: 'from-[#2775CA] to-[#2775CA]',
    USDT: 'from-[#26A17B] to-[#26A17B]',
    ETH: 'from-[#627EEA] to-[#627EEA]',
    WBTC: 'from-[#F7931A] to-[#F7931A]',
    KNS: 'from-cyan-400 to-emerald-400',
  };

  // Get token icon URL from Jupiter tokenList, fallback to static list
  const getTokenIconUrl = (symbol: string) => {
    const dynamicToken = tokenList.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase());
    return dynamicToken?.icon;
  };

  // Get fallback icon character from static list
  const getTokenFallbackIcon = (symbol: string) => {
    const token = TOKENS_LIST.find((t) => t.symbol === symbol);
    return token?.icon || symbol.charAt(0);
  };

  // Calculate dynamic route info from currentQuote
  const numRoutes = currentQuote?.routePlan?.length || 0;

  // Calculate unique markets/DEXes from all route steps
  const uniqueMarkets = new Set(
    currentQuote?.routePlan
      ?.flat() // Flatten all routes into a single array of steps
      ?.map(step => step.swapInfo.ammKey) // Extract ammKey from each step
      ?.filter(Boolean) // Remove any null/undefined values
  );
  const numMarkets = uniqueMarkets.size || 0;

  // Extract all unique route/DEX labels from the route plan
  const routeLabels = currentQuote?.routePlan
    ?.flat()
    ?.map(step => step.swapInfo.label)
    ?.filter((label): label is string => Boolean(label))
    ?.filter((label, index, arr) => arr.indexOf(label) === index) || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[384px] h-[224px] bg-gray-950 rounded-lg shadow-[0px_4px_4px_0px_rgba(34,203,142,0.20)] border border-cyan-400 overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <span className="text-stone-50 text-xs font-normal" style={{ fontFamily: 'Sora, sans-serif' }}>
            Routing
          </span>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center hover:bg-zinc-800 rounded-md transition-colors"
          >
            <X className="w-4 h-4 text-stone-50" />
          </button>
        </div>

        {/* Content with fixed layout */}
        <div className="relative h-[180px] px-4 py-4">
          {/* Token Row */}
          <div className="flex items-center justify-between">
            {/* Input Token */}
            <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800 rounded-xl border border-zinc-900 shadow-[0px_1px_2.7px_0px_rgba(87,231,231,0.20)] z-10">
              {getTokenIconUrl(inputToken) && !inputImageError ? (
                <img
                  src={getTokenIconUrl(inputToken)}
                  alt={inputToken}
                  className="w-6 h-6 rounded-full flex-shrink-0 object-cover"
                  onError={() => setInputImageError(true)}
                />
              ) : (
                <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${tokenColorMap[inputToken] || 'from-gray-500 to-gray-600'} flex items-center justify-center text-xs font-bold text-white`}>
                  {getTokenFallbackIcon(inputToken)}
                </div>
              )}
              <span className="text-stone-50 text-sm font-semibold whitespace-nowrap" style={{ fontFamily: 'Sora, sans-serif' }}>
                {inputAmount} {inputToken}
              </span>
            </div>

            {/* Output Token */}
            <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800 rounded-xl border border-zinc-900 shadow-[0px_1px_2.7px_0px_rgba(87,231,231,0.20)] z-10">
              {getTokenIconUrl(outputToken) && !outputImageError ? (
                <img
                  src={getTokenIconUrl(outputToken)}
                  alt={outputToken}
                  className="w-6 h-6 rounded-full flex-shrink-0 object-cover"
                  onError={() => setOutputImageError(true)}
                />
              ) : (
                <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${tokenColorMap[outputToken] || 'from-gray-500 to-gray-600'} flex items-center justify-center text-xs font-bold text-white`}>
                  {getTokenFallbackIcon(outputToken)}
                </div>
              )}
              <span className="text-stone-50 text-sm font-semibold whitespace-nowrap" style={{ fontFamily: 'Sora, sans-serif' }}>
                {parseFloat(outputAmount).toFixed(4)} {outputToken}
              </span>
            </div>
          </div>

          {/* Connecting Lines */}
          {/* Left Vertical Line */}
          <div className="absolute left-[60px] top-[52px] w-[1px] h-[63px] bg-neutral-700" />

          {/* Right Vertical Line */}
          <div className="absolute right-[80px] top-[52px] w-[1px] h-[63px] bg-neutral-700" />

          {/* Horizontal Line */}
          <div className="absolute left-[60px] right-[80px] top-[115px] h-[1px] bg-neutral-700" />

          {/* Route Labels Box - centered on horizontal line */}
          <div className="absolute left-[70px] top-[115px] -translate-y-1/2 flex flex-col gap-0.5 px-2 py-1.5 bg-neutral-800 rounded border border-zinc-900 shadow-[0px_1px_2.7px_0px_rgba(87,231,231,0.20)] z-10">
            {routeLabels.length > 0 ? (
              routeLabels.map((label, index) => (
                <span key={index} className="text-cyan-400 text-[10px] font-semibold leading-4" style={{ fontFamily: 'Sora, sans-serif' }}>
                  {label}
                </span>
              ))
            ) : (
              <span className="text-cyan-400 text-[10px] font-semibold leading-4" style={{ fontFamily: 'Sora, sans-serif' }}>
                Direct Route
              </span>
            )}
          </div>

          {/* Output Token Badge - centered on horizontal line */}
          <div className="absolute right-[90px] top-[115px] -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 bg-neutral-800 rounded border border-zinc-900 shadow-[0px_1px_2.7px_0px_rgba(87,231,231,0.20)] z-10">
            {getTokenIconUrl(outputToken) && !outputImageError ? (
              <img
                src={getTokenIconUrl(outputToken)}
                alt={outputToken}
                className="w-5 h-5 rounded-full flex-shrink-0 object-cover"
                onError={() => setOutputImageError(true)}
              />
            ) : (
              <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${tokenColorMap[outputToken] || 'from-gray-500 to-gray-600'} flex items-center justify-center text-[10px] font-bold text-white`}>
                {getTokenFallbackIcon(outputToken)}
              </div>
            )}
            <span className="text-stone-50 text-xs font-semibold" style={{ fontFamily: 'Sora, sans-serif' }}>
              {outputToken}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// SLIPPAGE SETTINGS MODAL
// ============================================
interface SlippageModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'auto' | 'manual';
  onModeChange: (mode: 'auto' | 'manual') => void;
  slippageValue: number;
  onSlippageChange: (value: number) => void;
  customSlippage: string;
  onCustomSlippageChange: (value: string) => void;
}

const SlippageModal = ({
  isOpen,
  onClose,
  mode,
  onModeChange,
  slippageValue,
  onSlippageChange,
  customSlippage,
  onCustomSlippageChange,
}: SlippageModalProps) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-gray-950 rounded-lg shadow-[0px_4px_4px_0px_rgba(34,203,142,0.20)] border border-cyan-400/30 overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-zinc-800">
          <h2 className="text-xs font-normal text-stone-50" style={{ fontFamily: 'Sora, sans-serif' }}>
            Swap Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-background/80 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-stone-50" />
          </button>
        </div>

        {/* Tabs - Rounded Pill Style */}
        <div className="px-3 pt-3">
          <div className="h-11 rounded-3xl border border-emerald-400 p-1.5 flex gap-1">
            <button
              onClick={
                () => {
                  onModeChange('auto');
                  onSlippageChange(0.5);
                }}
              className={`flex-1 h-8 rounded-2xl text-sm font-semibold transition-all ${mode === 'auto'
                ? 'bg-cyan-400/20 text-cyan-400'
                : 'text-cyan-400 hover:bg-cyan-400/10'
                }`}
              style={{ fontFamily: 'Sora, sans-serif' }}
            >
              Auto
            </button>
            <button
              onClick={() => onModeChange('manual')}
              className={`flex-1 h-8 rounded-2xl text-sm font-semibold transition-all ${mode === 'manual'
                ? 'bg-cyan-400/20 text-cyan-400'
                : 'text-cyan-400 hover:bg-cyan-400/10'
                }`}
              style={{ fontFamily: 'Sora, sans-serif' }}
            >
              Manual
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 pb-6">
          {mode === 'auto' ? (
            <div className="space-y-3">
              {/* Max Slippage Display */}
              <div className="h-16 bg-sky-900/40 rounded-lg p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-normal text-stone-50 whitespace-nowrap"
                    style={{ fontFamily: 'Sora, sans-serif' }}
                  >
                    Max Slippage
                  </span>

                  {/* Tooltip wrapper */}
                  <div className="relative group">
                    <Info className="w-4 h-4 text-cyan-400 cursor-pointer" />

                    {/* Tooltip */}
                    <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 
                      whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs 
                      text-white opacity-0 group-hover:opacity-100 
                      pointer-events-none transition-opacity duration-200">
                      Your default value is already set to 0.5%
                    </div>
                  </div>
                </div>
                <div className="w-44 h-8 bg-gray-950 rounded-3xl border border-transparent flex items-center justify-center">
                  {/* <input
                    type="text"
                    inputMode="decimal"
                    value={customSlippage || slippageValue}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || (/^\d*\.?\d*$/.test(value) && parseFloat(value) <= 2)) {
                        if (value) {
                          onSlippageChange(parseFloat(value));
                          onCustomSlippageChange(value);
                        }
                      }
                    }}
                    className="w-full h-full bg-transparent text-sm font-semibold text-stone-50 text-center outline-none"
                    style={{ fontFamily: 'Sora, sans-serif' }}
                  /> */}
                  <button className="w-full h-full bg-transparent text-sm font-semibold text-stone-50 text-center outline-none"
                    style={{ fontFamily: 'Sora, sans-serif' }}>
                    0.5%
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Warning Message */}
              <div className="flex items-start gap-2 p-3 bg-zinc-900 rounded-md">
                <Info className="w-6 h-6 text-neutral-400 flex-shrink-0" />
                <p className="text-xs font-light text-neutral-400" style={{ fontFamily: 'Sora, sans-serif' }}>
                  Only use Manual Mode if you know exactly what parameters to set for your swap transaction.
                </p>
              </div>

              {/* Max Slippage Container */}
              <div className="h-14 bg-sky-900/40 rounded-lg p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-normal text-stone-50 whitespace-nowrap" style={{ fontFamily: 'Sora, sans-serif' }}>
                    Max Slippage
                  </span>
                </div>

                {/* Three-segment pill container */}
                <div className="w-44 h-8 bg-gray-950 rounded-3xl flex items-center justify-between px-2">
                  {/* 0.5% Toggle */}
                  <button
                    onClick={() => {
                      onSlippageChange(0.5);
                      onCustomSlippageChange('');
                    }}
                    className={`h-5 px-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 ${slippageValue === 0.5 && !customSlippage
                      ? 'bg-cyan-400/20 text-cyan-400'
                      : 'text-cyan-400 hover:bg-cyan-400/10'
                      }`}
                    style={{ fontFamily: 'Sora, sans-serif' }}
                  >
                    0.5%
                  </button>

                  {/* 1% Toggle */}
                  <button
                    onClick={() => {
                      onSlippageChange(1);
                      onCustomSlippageChange('');
                    }}
                    className={`h-5 px-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 ${slippageValue === 1 && !customSlippage
                      ? 'bg-cyan-400/20 text-cyan-400'
                      : 'text-cyan-400 hover:bg-cyan-400/10'
                      }`}
                    style={{ fontFamily: 'Sora, sans-serif' }}
                  >
                    1%
                  </button>

                  {/* 0.00% Editable Input */}
                  <div className={`h-5 rounded-xl flex items-center justify-center gap-1 transition-all ${customSlippage
                    ? 'bg-neutral-500/20'
                    : ''
                    }`}
                    style={{ width: '56px', flexShrink: 0 }}>
                    <input
                      type="text"
                      placeholder="0.00"
                      inputMode="decimal"
                      value={customSlippage}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow empty, decimal point, or valid decimal numbers up to 2
                        if (value === '' || value === '.' || /^\d*\.?\d*$/.test(value)) {
                          // Check if it's a complete number and within range
                          if (value === '' || value === '.' || (parseFloat(value) >= 0 && parseFloat(value) <= 2)) {
                            onCustomSlippageChange(value);
                            // Only update slippageValue if it's a valid complete number
                            if (value && value !== '.' && !isNaN(parseFloat(value))) {
                              onSlippageChange(parseFloat(value));
                            }
                          }
                        }
                      }}
                      onFocus={(e) => {
                        // Clear if it's a preset value, otherwise keep the custom value
                        if (customSlippage === '0.5' || customSlippage === '1' || !customSlippage) {
                          onCustomSlippageChange('');
                        }
                        e.target.select();
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        // If empty or just a decimal point, reset to default
                        if (!value || value === '.') {
                          onCustomSlippageChange('');
                          onSlippageChange(0.5);
                        } else {
                          // Format the value to remove trailing decimal point
                          const numValue = parseFloat(value);
                          if (!isNaN(numValue)) {
                            onCustomSlippageChange(numValue.toString());
                            onSlippageChange(numValue);
                          }
                        }
                      }}
                      className="bg-transparent text-right text-sm font-semibold outline-none text-stone-50 w-full caret-ocean-cyan text-foreground placeholder:text-muted-foreground/50 cursor-text"
                      style={{ fontFamily: 'Sora, sans-serif' }}
                    />
                    <span className="text-xs font-semibold text-stone-50" style={{ fontFamily: 'Sora, sans-serif' }}>%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// TOKEN SELECTOR DROPDOWN (Tooltip Style)
// ============================================
interface TokenDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  tokenList: TokenInfo[];
  searchResults: TokenInfo[]; // Dynamic search results from Jupiter search API
  isSearching: boolean; // Loading state for search
  excludeToken?: string;
  modalRef?: React.RefObject<HTMLDivElement>;
  verifiedTokenMints: Set<string>;
  showVerifiedOnly: boolean;
  onToggleVerifiedOnly: () => void;
}

const TokenDropdown = ({
  isOpen,
  onClose,
  onSelect,
  searchQuery,
  onSearchChange,
  tokenList,
  searchResults,
  isSearching,
  excludeToken,
  modalRef,
  verifiedTokenMints,
  showVerifiedOnly,
  onToggleVerifiedOnly,
}: TokenDropdownProps) => {
  // Determine which token list to use:
  // - If search query >= 2 chars, use search results
  // - Otherwise, use verified token list (tokenList)
  const tokensToDisplay = searchQuery.length >= 2 ? searchResults : tokenList;

  console.log('TokenDropdown - tokensToDisplay:', tokensToDisplay);
  console.log('TokenDropdown - verifiedTokenMints:', verifiedTokenMints);

  // Filter and sort tokens:
  // 1. Filter by exclusion and verified-only toggle
  // 2. Sort: Verified tokens first, then unverified
  const filteredTokens = tokensToDisplay
    .filter((token) => {
      const notExcluded = token.symbol !== excludeToken;
      // Check verification from both Set (initial tokens) and token's isVerified property (search results)
      const isVerified = verifiedTokenMints.has(token.id) || token.isVerified === true;
      const matchesVerifiedFilter = showVerifiedOnly ? isVerified : true;
      return notExcluded && matchesVerifiedFilter;
    })
    .sort((a, b) => {
      // Check verification status for both tokens
      const aVerified = verifiedTokenMints.has(a.id) || a.isVerified === true;
      const bVerified = verifiedTokenMints.has(b.id) || b.isVerified === true;

      // If both have same verification status, maintain original order
      if (aVerified === bVerified) return 0;
      // Verified tokens come first (return -1 if a is verified, 1 if b is verified)
      return aVerified ? -1 : 1;
    });

  const handleSelectToken = (symbol: string) => {
    // Call onSelect first - this triggers the parent's callback
    // which handles both selection AND closing
    onSelect(symbol);
    // Don't call onClose here - parent's onSelect callback already handles it
    // This prevents double-closing race condition
  };

  if (!isOpen) return null;

  const tokenColorMap: Record<string, string> = {
    SOL: 'from-[#9945FF] to-[#14F195]',
    USDC: 'from-[#2775CA] to-[#2775CA]',
    USDT: 'from-[#26A17B] to-[#26A17B]',
    ETH: 'from-[#627EEA] to-[#627EEA]',
    WBTC: 'from-[#F7931A] to-[#F7931A]',
    JPYC: 'from-[#FCD34D] to-[#FCD34D]',
    JPYC_V1: 'from-[#6B21A8] to-[#6B21A8]',
    XSGD: 'from-[#3B82F6] to-[#3B82F6]',
    PEPE: 'from-[#22C55E] to-[#22C55E]',
    BRETT: 'from-[#CA8A04] to-[#CA8A04]',
    KNS: 'from-cyan-400 to-emerald-400',
  };

  // Render directly without createPortal - matches RoutingModal pattern for proper event handling
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="w-full max-w-[340px] sm:max-w-sm max-h-[70vh] bg-background rounded-xl border border-ocean-cyan/40 shadow-2xl shadow-ocean-cyan/20 overflow-hidden flex flex-col animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-border/30 flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Select a Token</h2>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 hover:bg-background/80 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-foreground pointer-events-none" />
          </button>
        </div>

        {/* Search Input and Verified Toggle */}
        <div className="p-3 border-b border-border/30 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search name or paste address"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-10 py-2 bg-background/50 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ocean-cyan/50 transition-colors"
            />
            {isSearching && searchQuery.length >= 2 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 text-ocean-cyan animate-spin" />
              </div>
            )}
            {searchQuery && !isSearching && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-background/50 rounded-full transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          {/* Verified Only Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVerifiedOnly();
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              showVerifiedOnly
                ? 'bg-green-500/20 text-green-500 border border-green-500/30'
                : 'bg-background/50 text-muted-foreground border border-border/50 hover:border-ocean-cyan/30'
            }`}
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${showVerifiedOnly ? 'text-green-500' : 'text-muted-foreground'}`} />
            Verified Only
            {showVerifiedOnly && <Check className="w-3 h-3 text-green-500" />}
          </button>
        </div>

        {/* Popular Tokens Section */}
        {!searchQuery && (
          <div className="px-4 py-3 border-b border-border/30">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Popular</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR_TOKENS.filter(symbol => {
                if (symbol === excludeToken) return false;
                if (showVerifiedOnly) {
                  const token = tokenList.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase());
                  // Check both Set and token's own isVerified property
                  return token && (verifiedTokenMints.has(token.id) || token.isVerified === true);
                }
                return true;
              }).map((symbol) => {
                const dynamicToken = tokenList.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase());
                const staticToken = TOKENS_LIST.find((t) => t.symbol === symbol);
                if (!staticToken && !dynamicToken) return null;
                const mintAddress = dynamicToken?.id || TOKEN_MINT_ADDRESSES[symbol];
                // Check verification from both Set and token's own property
                const isVerified = mintAddress
                  ? (verifiedTokenMints.has(mintAddress) || dynamicToken?.isVerified === true)
                  : false;
                return (
                  <button
                    type="button"
                    key={symbol}
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Selected token:', symbol);
                      handleSelectToken(symbol);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1.5 bg-background/70 border border-border/40 rounded-lg hover:border-ocean-cyan/50 hover:bg-ocean-cyan/10 transition-all cursor-pointer"
                  >
                    <div className="relative">
                      {dynamicToken?.icon ? (
                        <img src={dynamicToken.icon} alt={symbol} className="w-5 h-5 rounded-full" />
                      ) : (
                        <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${tokenColorMap[symbol]} flex items-center justify-center text-xs font-bold text-white`}>
                          {staticToken?.icon || symbol.charAt(0)}
                        </div>
                      )}
                      {isVerified && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full flex items-center justify-center border border-background">
                          <Check className="w-1.5 h-1.5 text-white" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-foreground">{symbol}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Token List */}
        <div className="flex-1 overflow-y-auto lg:max-h-72 lg:flex-none">
          {filteredTokens.length > 0 ? (
            <div className="divide-y divide-border/20">
              {filteredTokens.slice(0, 50).map((token) => {
                const staticToken = TOKENS_LIST.find((t) => t.symbol === token.symbol);
                const tokenColor = tokenColorMap[token.symbol] || 'from-gray-400 to-gray-600';
                const tokenIcon = staticToken?.icon || token.symbol.charAt(0);
                // Check verification from both Set and token's own isVerified property
                const isVerified = verifiedTokenMints.has(token.id) || token.isVerified === true;

                return (
                  <button
                    type="button"
                    key={token.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectToken(token.symbol);
                    }}
                    className="w-full px-4 py-3 hover:bg-ocean-cyan/5 transition-colors flex items-center gap-3 text-left cursor-pointer"
                  >
                    {/* Token Icon with Verification Badge */}
                    <div className="relative flex-shrink-0">
                      {token.icon ? (
                        <img src={token.icon} alt={token.symbol} className="w-8 h-8 rounded-full pointer-events-none" />
                      ) : (
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${tokenColor} flex items-center justify-center text-xs font-bold text-white pointer-events-none`}>
                          {tokenIcon}
                        </div>
                      )}
                      {isVerified && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center border-2 border-background">
                          <Check className="w-2 h-2 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Token Info */}
                    <div className="flex-1 min-w-0 pointer-events-none">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-foreground truncate">{token.name}</p>
                        {!isVerified && (
                          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">{token.symbol}</p>
                        <span className="text-[10px] text-muted-foreground/70">{truncateAddress(token.id)}</span>
                      </div>
                    </div>

                    {/* Verification Status */}
                    {isVerified ? (
                      <span className="text-[10px] text-green-500 font-medium px-1.5 py-0.5 bg-green-500/10 rounded flex-shrink-0">
                        Verified
                      </span>
                    ) : (
                      <span className="text-[10px] text-yellow-500 font-medium px-1.5 py-0.5 bg-yellow-500/10 rounded flex-shrink-0">
                        Unverified
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center space-y-2">
              {searchQuery.length >= 2 ? (
                <>
                  <p className="text-sm font-medium text-muted-foreground">
                    {isSearching ? 'Searching...' : 'No tokens found'}
                  </p>
                  {!isSearching && (
                    <p className="text-xs text-muted-foreground/70">
                      Try searching by symbol, name, or mint address
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No tokens available</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// TOKEN SELECTOR BUTTON (Modal is rendered at page level for proper z-index hierarchy)
// ============================================
interface TokenSelectorProps {
  symbol: string;
  disabled?: boolean;
  onToggle: () => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  tokenList: TokenInfo[];
}

const TokenSelector = ({ symbol, disabled = false, onToggle, dropdownRef, tokenList }: TokenSelectorProps) => {
  const [imageError, setImageError] = useState(false);

  const tokenColorMap: Record<string, string> = {
    SOL: 'from-[#9945FF] to-[#14F195]',
    USDC: 'from-[#2775CA] to-[#2775CA]',
    USDT: 'from-[#26A17B] to-[#26A17B]',
    ETH: 'from-[#627EEA] to-[#627EEA]',
    WBTC: 'from-[#F7931A] to-[#F7931A]',
    JPYC: 'from-[#FCD34D] to-[#FCD34D]',
    JPYC_V1: 'from-[#6B21A8] to-[#6B21A8]',
    XSGD: 'from-[#3B82F6] to-[#3B82F6]',
    PEPE: 'from-[#22C55E] to-[#22C55E]',
    BRETT: 'from-[#CA8A04] to-[#CA8A04]',
    KNS: 'from-cyan-400 to-emerald-400',
  };

  // Look up token from dynamic tokenList first, then fall back to static TOKENS_LIST
  const dynamicToken = tokenList.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase());
  const staticToken = TOKENS_LIST.find((t) => t.symbol === symbol);

  // Get token icon URL from dynamic list
  const tokenIconUrl = dynamicToken?.icon;
  // Fallback icon character from static list or first letter
  const fallbackIcon = staticToken?.icon || symbol.charAt(0);
  // Get color gradient (use hardcoded for known tokens, generate for others)
  const tokenColor = tokenColorMap[symbol] || 'from-gray-500 to-gray-600';

  // Reset image error when symbol changes
  React.useEffect(() => {
    setImageError(false);
  }, [symbol]);

  // Handle empty/unselected state
  const isEmptySelection = !symbol || symbol === '';

  return (
    <div ref={dropdownRef}>
      <button
        disabled={disabled}
        onClick={onToggle}
        className="relative flex items-center gap-2 px-3 py-2 bg-background/80 hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-border/50 hover:border-ocean-cyan/30 transition-all"
      >
        {isEmptySelection ? (
          <>
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              ?
            </div>
            <span className="font-semibold text-muted-foreground text-sm min-w-fit">Select</span>
          </>
        ) : (
          <>
            {tokenIconUrl && !imageError ? (
              <img
                src={tokenIconUrl}
                alt={symbol}
                className="w-6 h-6 rounded-full flex-shrink-0 object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${tokenColor} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
                {fallbackIcon}
              </div>
            )}
            <span className="font-semibold text-foreground text-sm min-w-fit">{symbol}</span>
          </>
        )}
        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>
    </div>
  );
};

// ============================================
// UNVERIFIED TOKEN WARNING COMPONENT
// ============================================
interface UnverifiedTokenWarningProps {
  fromToken: string;
  toToken: string;
  tokenList: TokenInfo[];
  verifiedTokenMints: Set<string>;
}

const UnverifiedTokenWarning = ({ fromToken, toToken, tokenList, verifiedTokenMints }: UnverifiedTokenWarningProps) => {
  const [showWarning, setShowWarning] = React.useState(false);

  // Get token objects and mint addresses
  const fromTokenObj = tokenList.find(t => t.symbol.toUpperCase() === fromToken.toUpperCase());
  const toTokenObj = tokenList.find(t => t.symbol.toUpperCase() === toToken.toUpperCase());
  const fromMint = fromTokenObj?.id || TOKEN_MINT_ADDRESSES[fromToken];
  const toMint = toTokenObj?.id || TOKEN_MINT_ADDRESSES[toToken];

  console.log('🚨 UnverifiedTokenWarning check:', {
    fromToken,
    toToken,
    fromTokenObj,
    toTokenObj,
    fromMint,
    toMint,
    tokenListLength: tokenList.length,
  });

  // Check if tokens are verified (check both Set and token's own isVerified property)
  const isFromVerified = fromMint
    ? (verifiedTokenMints.has(fromMint) || fromTokenObj?.isVerified === true)
    : true;
  const isToVerified = toMint
    ? (verifiedTokenMints.has(toMint) || toTokenObj?.isVerified === true)
    : true;

  console.log('✔️ Verification status:', {
    isFromVerified,
    isToVerified,
    fromInSet: fromMint ? verifiedTokenMints.has(fromMint) : 'no mint',
    toInSet: toMint ? verifiedTokenMints.has(toMint) : 'no mint',
  });

  // Determine if warning should be shown
  const shouldShowWarning = !isFromVerified || !isToVerified;
  console.log('⚠️ Should show warning?', shouldShowWarning);

  // Delay showing warning for better UX - appears 500ms after token selection
  React.useEffect(() => {
    if (shouldShowWarning) {
      const timer = setTimeout(() => {
        setShowWarning(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setShowWarning(false);
    }
  }, [shouldShowWarning, fromToken, toToken]);

  // Don't render if both tokens are verified or warning not ready to show
  if (!shouldShowWarning || !showWarning) return null;

  const unverifiedTokens = [];
  if (!isFromVerified) unverifiedTokens.push(fromToken);
  if (!isToVerified) unverifiedTokens.push(toToken);

  return (
    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-yellow-500">
            Unverified Token{unverifiedTokens.length > 1 ? 's' : ''} Warning
          </p>
          <p className="text-xs text-yellow-500/80 mt-1">
            {unverifiedTokens.join(' and ')} {unverifiedTokens.length > 1 ? 'are not verified tokens' : 'is not a verified token'}.
            Please verify the contract address before swapping.
          </p>
        </div>
      </div>
    </div>
  );
};

// ============================================
// TRANSACTION STATE CARD COMPONENT
// ============================================
const TransactionStateCard = ({
  type,
  title,
  subtitle,
  txSignature,
  onRetry,
}: {
  type: "pending" | "success" | "failed";
  title: string;
  subtitle: string;
  txSignature?: string;
  onRetry?: () => void;
}) => {
  const configs = {
    pending: {
      icon: <Loader2 className="w-8 h-8 text-ocean-cyan animate-spin" />,
      borderColor: "border-ocean-cyan/30",
      bg: "bg-ocean-cyan/5",
    },
    success: {
      icon: <Check className="w-8 h-8 text-ocean-seafoam" />,
      borderColor: "border-ocean-seafoam/30",
      bg: "bg-ocean-seafoam/5",
    },
    failed: {
      icon: <X className="w-8 h-8 text-destructive" />,
      borderColor: "border-destructive/30",
      bg: "bg-destructive/5",
    },
  };
  const config = configs[type];

  const explorerUrl = txSignature
    ? `https://solscan.io/tx/${txSignature}`
    : null;

  return (
    <div className={`glass-card p-6 text-center space-y-4 border w-[320px] h-[200px] flex flex-col items-center justify-center ${config.borderColor} ${config.bg}`}>
      <div className="w-16 h-16 rounded-full bg-background/50 flex items-center justify-center">
        {config.icon}
      </div>
      <div className="h-[52px] flex flex-col items-center justify-center">
        <h4 className="font-bold text-foreground">{title}</h4>
        {type === "success" && explorerUrl ? (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-ocean-cyan hover:text-ocean-light flex items-center gap-1 mt-1 transition-colors justify-center"
          >
            {subtitle}
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : type === "failed" ? (
          <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            {subtitle}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

// ============================================
// TRANSACTION MODAL COMPONENT
// ============================================
interface TransactionModalProps {
  isOpen: boolean;
  status: SwapStatus;
  txSignature?: string;
  onClose: () => void;
  onRetry?: () => void;
}

const TransactionModal = ({
  isOpen = true,
  status = SwapStatus.AWAITING_SIGNATURE,
  txSignature = undefined,
  onClose,
  onRetry,
}: TransactionModalProps) => {
  if (!isOpen) return null;

  const getStateConfig = () => {
    switch (status) {
      case SwapStatus.AWAITING_SIGNATURE:
        return {
          type: "pending" as const,
          title: "Awaiting Signature",
          subtitle: "Please confirm the transaction in your wallet",
        };
      case SwapStatus.BUILDING_TRANSACTION:
        return {
          type: "pending" as const,
          title: "Building Transaction",
          subtitle: "Preparing your swap transaction...",
        };
      case SwapStatus.CONFIRMING:
        return {
          type: "pending" as const,
          title: "Confirming Transaction",
          subtitle: "Waiting for blockchain confirmation...",
        };
      case SwapStatus.CONFIRMED:
        return {
          type: "success" as const,
          title: "Swap Successful!",
          subtitle: "View on Explorer",
        };
      case SwapStatus.FAILED:
        return {
          type: "failed" as const,
          title: "Transaction Failed",
          subtitle: "Try Again",
        };
      default:
        return null;
    }
  };

  const stateConfig = getStateConfig();
  if (!stateConfig) return null;

  // Allow closing modal by clicking backdrop for success/failed states
  const canClose = status === SwapStatus.CONFIRMED || status === SwapStatus.FAILED;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
        onClick={canClose ? onClose : undefined}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 pointer-events-none">
        <div className="pointer-events-auto relative">
          {/* Close button for success/failed states */}
          {canClose && (
            <button
              onClick={onClose}
              className="absolute -top-2 -right-2 z-10 p-1.5 rounded-full bg-background border border-border/50 hover:bg-background/80 transition-colors shadow-lg"
            >
              <X className="w-4 h-4 text-foreground" />
            </button>
          )}
          <TransactionStateCard
            type={stateConfig.type}
            title={stateConfig.title}
            subtitle={stateConfig.subtitle}
            txSignature={txSignature}
            onRetry={onRetry}
          />
        </div>
      </div>
    </>
  );
};

// ============================================
// SWAP CARD COMPONENT
// ============================================
interface SwapCardProps {
  isConnected: boolean;
  onConnect: () => void;
}

const SwapCard = ({ isConnected, onConnect }: SwapCardProps) => {
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [fromToken, setFromToken] = useState<string>('SOL');
  const [toToken, setToToken] = useState<string>('USDC');
  const [isLoading, setIsLoading] = useState(false);
  const [platformFeeWallet, setPlatformFeeWallet] = useState<string>(CONFIG.PLATFORM_FEE_WALLET);
  const [charityFeeWallet, setCharityFeeWallet] = useState<string>(CONFIG.CHARITY_FEE_WALLET);
  const [showFeeDetails, setShowFeeDetails] = useState(false);
  const [showRateDetails, setShowRateDetails] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<'from' | 'to' | null>(null);
  const [tokenSearchQuery, setTokenSearchQuery] = useState('');
  const [showSlippageModal, setShowSlippageModal] = useState(false);
  const [slippageMode, setSlippageMode] = useState<'auto' | 'manual'>('auto');
  const [slippageValue, setSlippageValue] = useState<number>(0.5);
  const [customSlippage, setCustomSlippage] = useState<string>('');
  const [lastEditedField, setLastEditedField] = useState<'input' | 'output'>('input');
  const [showRoutingModal, setShowRoutingModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastQuoteTime, setLastQuoteTime] = useState<number | null>(null);
  const [quoteAutoRefreshEnabled, setQuoteAutoRefreshEnabled] = useState(true);
  const [showFeeCard, setShowFeeCard] = useState(false);
  const [showTierInfoCard, setShowTierInfoCard] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTab, setIsTab] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLInputElement>(null);
  const fromDropdownRef = useRef<HTMLDivElement>(null);
  const toDropdownRef = useRef<HTMLDivElement>(null);
  const tokenDropdownModalRef = useRef<HTMLDivElement>(null);
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isProgrammaticUpdate = useRef(false);
  const swapErrorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const feeCardRef = useRef<HTMLDivElement>(null);
  const tierInfoCardRef = useRef<HTMLDivElement>(null);
  const recentTokensRef = useRef<Map<string, TokenInfo>>(new Map()); // Store recently selected tokens for immediate access

  // Derived USD display values (updated async with fallback pricing)
  const [displayInputUSD, setDisplayInputUSD] = useState<number>(0);
  const [displayOutputUSD, setDisplayOutputUSD] = useState<number>(0);

  const TRUNCATE_LEN = 120;
  const truncate = (s: string | null | undefined, n = TRUNCATE_LEN) => {
    if (!s) return "";
    return s.length > n ? s.slice(0, n - 3) + "..." : s;
  };

  // Jupiter integration state
  const [tokenList, setTokenList] = useState<TokenInfo[]>([]); // Verified tokens (initial load)
  const [searchResults, setSearchResults] = useState<TokenInfo[]>([]); // Dynamic search results
  const [isSearching, setIsSearching] = useState(false); // Search loading state
  const [verifiedTokenMints, setVerifiedTokenMints] = useState<Set<string>>(new Set());
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [tokenListError, setTokenListError] = useState<string | null>(null);
  const [currentQuote, setCurrentQuote] = useState<QuoteRoute | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const jupiterService = useRef(new JupiterAPIService());
  const jupiterSwapService = useRef<JupiterSwapService | null>(null);
  const feeCalculator = useRef<FeeCalculator | null>(null);
  const { connection } = useConnection();
  const wallet = useSolanaWallet();
  const { publicKey } = wallet;

  // Fetch platform and charity fee wallets on mount and refresh periodically
  useEffect(() => {
    async function loadFeeWallets() {
      // Clear cache to force fresh fetch
      feeWalletService.clearCache();
      const [platformWallet, charityWallet] = await Promise.all([
        feeWalletService.getPlatformWallet(),
        feeWalletService.getCharityWallet(),
      ]);
      setPlatformFeeWallet(platformWallet);
      setCharityFeeWallet(charityWallet);
      console.log('[Wallets] Loaded:', { platformWallet, charityWallet });
    }

    // Initial fetch
    loadFeeWallets();

    // Refresh every 30 seconds to pick up admin changes
    const refreshInterval = setInterval(() => {
      loadFeeWallets();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, []);

  // Initialize services when connection is available
  useEffect(() => {
    if (connection) {
      jupiterSwapService.current = new JupiterSwapService(connection);
    }
  }, [connection]);

  // Debug: Log when tokenList changes
  useEffect(() => {
    console.log('📝 TokenList updated! Length:', tokenList.length, 'Tokens:', tokenList.map(t => t.symbol));
  }, [tokenList]);

  // Mobile & tablet detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    const checkTab = () => {
      setIsTab(window.innerWidth < 1024 && window.innerWidth >= 768);
    };
    checkMobile();
    checkTab();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('resize', checkTab);
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('resize', checkTab);
    };
  }, []);

  // Close fee card when wallet disconnects (keep amounts for Jupiter-style UX)
  useEffect(() => {
    if (!publicKey) {
      setShowFeeCard(false);
    }
  }, [publicKey]);

  // Scroll fee card to top when opened
  useEffect(() => {
    if (showFeeCard && feeCardRef.current) {
      feeCardRef.current.scrollTop = 0;
    }
  }, [showFeeCard]);

  // Balance and price state
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({});
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Keep display USD values in sync with amounts/prices (uses async fallback)
  useEffect(() => {
    const update = async () => {
      const inNum = parseFloat(inputAmount || '0');
      const outNum = parseFloat(outputAmount || '0');
      if (inNum === 0 && outNum === 0) {
        setDisplayInputUSD(0);
        setDisplayOutputUSD(0);
        return;
      }
      const inputMint = getMintAddressFromList(fromToken, tokenList, recentTokensRef) || '';
      const outputMint = getMintAddressFromList(toToken, tokenList, recentTokensRef) || '';

      const inPrice = tokenPrices[fromToken] || 0;
      const outPrice = tokenPrices[toToken] || 0;
      const { inputAmountUSD, outputAmountUSD } = await deriveSwapUSD(
        inNum, outNum, inputMint, outputMint, inPrice, outPrice
      );
      setDisplayInputUSD(inputAmountUSD);
      setDisplayOutputUSD(outputAmountUSD);
    };
    update();
  }, [inputAmount, outputAmount, fromToken, toToken, tokenPrices, tokenList]);


  // Swap execution state
  const [swapStatus, setSwapStatus] = useState<SwapStatus>(SwapStatus.IDLE);
  const [swapMessage, setSwapMessage] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [estimatedGasFee, setEstimatedGasFee] = useState<number>(0.00002); // ~0.00002 SOL

  // Transaction modal state
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  // Lock scroll when any modal is open (including fee card and tier info on mobile/tablet)
  useScrollLock(showSlippageModal || showRoutingModal || showTransactionModal || activeDropdown !== null || ((isMobile || isTab) && (showFeeCard || showTierInfoCard)));

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (swapError) {
      const timer = setTimeout(() => {
        setSwapError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [swapError]);

  // ── Mobile deep link: recover swap results after Phantom redirect ──
  // When user returns from Phantom, log the swap to /api/swap/complete
  // so points are awarded (same as desktop flow).
  const logMobileSwapToBackend = async (signature: string) => {
    const ctxRaw = localStorage.getItem('phantom_mobile_swap_context');
    localStorage.removeItem('phantom_mobile_swap_context');
    if (!ctxRaw) {
      console.warn('[Swap] No mobile swap context found — cannot log to backend');
      return;
    }
    try {
      const ctx = JSON.parse(ctxRaw);
      // Derive USD values (same logic as desktop path)
      const { inputAmountUSD, outputAmountUSD } = await deriveSwapUSD(
        ctx.inputAmountNum, ctx.outputAmountNum,
        ctx.inputMint, ctx.outputMint,
        ctx.inputPrice, ctx.outputPrice,
      );
      const derivedInputPrice = ctx.inputAmountNum > 0 ? inputAmountUSD / ctx.inputAmountNum : 0;

      const swapLogPayload: SwapLogPayload = {
        wallet: ctx.wallet,
        signature,
        status: 'confirmed',
        txMode: SWAP_TX_MODE,
        inputAmountUSD,
        outputAmountUSD,
        inputMint: ctx.inputMint,
        outputMint: ctx.outputMint,
        inputAmount: ctx.inputAmountSmallest,
        outputAmount: ctx.outputAmountSmallest,
        inputDecimals: ctx.inputDecimals,
        outputDecimals: ctx.outputDecimals,
        feeTier: ctx.feeTier,
        discountPercent: ctx.discountPercent,
        effectiveFeeBps: ctx.feeCalc.effectiveFeeBps * 100,
        feeAmountUSD: ctx.feeCalc.feeAmountInInputToken * derivedInputPrice,
        charityAmountUSD: ctx.feeCalc.charityFeeAmount * derivedInputPrice,
        kindswapFeeUSD: ctx.feeCalc.platformFeeAmount * derivedInputPrice,
        slippageBps: ctx.slippageBps,
        knsBalanceAtSwap: ctx.knsBalance.toString(),
        routeData: ctx.routeData,
      };

      console.log('[Swap] Logging mobile swap to backend:', swapLogPayload);
      swapLoggingService.logSwapFireAndForget(swapLogPayload);
    } catch (err) {
      console.error('[Swap] Failed to log mobile swap:', err);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobilePhantom = isMobileWithoutPhantom() || !!getPhantomMobileSession();
    if (!isMobilePhantom) return;

    // Check if callback handler already stored a swap result
    const storedResult = localStorage.getItem('phantom_mobile_swap_result');
    if (storedResult) {
      try {
        const result = JSON.parse(storedResult);
        localStorage.removeItem('phantom_mobile_swap_result');

        if (result.signature) {
          setTxSignature(result.signature);
          setSwapStatus(SwapStatus.CONFIRMED);
          setSwapMessage(`Swap confirmed! Tx: ${result.signature.slice(0, 8)}...`);
          setShowTransactionModal(true);
          // Log to backend for points
          logMobileSwapToBackend(result.signature);
        }
      } catch {
        localStorage.removeItem('phantom_mobile_swap_result');
      }
    }

    // Also listen for the real-time event (in case the callback fires after this component mounts)
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.signature) {
        setTxSignature(detail.signature);
        setSwapStatus(SwapStatus.CONFIRMED);
        setSwapMessage(`Swap confirmed! Tx: ${detail.signature.slice(0, 8)}...`);
        setShowTransactionModal(true);
        setIsLoading(false);
        // Log to backend for points
        logMobileSwapToBackend(detail.signature);
      }
    };
    window.addEventListener('phantom-mobile-tx-result', handler);
    return () => window.removeEventListener('phantom-mobile-tx-result', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // KNS balance and fee calculation state
  // For testing different tiers, change the initial value:
  // KNS Balance state
  const [knsBalance, setKnsBalance] = useState<number>(0); // Will be fetched from wallet when connected

  // Dynamic fee configuration from API
  const [feeConfig, setFeeConfig] = useState<FeeConfiguration | null>(null);
  const [apiTiers, setApiTiers] = useState<FeeTier[]>([]);
  const [isLoadingFeeConfig, setIsLoadingFeeConfig] = useState(true);

  // Get fee config values (from API or defaults)
  const charityPortion = feeConfig?.charityPortion ?? DEFAULT_CHARITY_PORTION;
  const kindswapPortion = feeConfig?.kindswapPortion ?? DEFAULT_KINDSWAP_PORTION;
  const baseFee = feeConfig?.baseFeeBps ?? BASE_FEE_BPS;

  // Convert API tiers to display format, ALWAYS recalculating effective fees based on current baseFee
  // This ensures UI is correct even if database tiers are temporarily out of sync
  const displayTiers: DisplayTier[] = apiTiers.length > 0
    ? apiTiers.map(tier => {
        // ALWAYS recalculate effective fee from current baseFee (don't trust API value)
        const effectiveFee = baseFee * (1 - tier.discountPercent / 100);
        return {
          ...convertToDisplayTier(tier),
          effectiveFeeBps: effectiveFee,
          fee: `${(effectiveFee / 100).toFixed(3)}%` // Recalculate fee string too
        };
      })
    : DEFAULT_TIERS.map(tier => {
        // Calculate effective fee based on CURRENT baseFee config (not hardcoded 10 bps)
        const effectiveFee = baseFee * (1 - tier.discountPercent / 100);
        return {
          ...convertToDisplayTier(tier),
          effectiveFeeBps: effectiveFee,
          fee: `${(effectiveFee / 100).toFixed(3)}%` // Recalculate fee string too
        };
      });

  console.log('KNS Balance:', knsBalance);
  console.log('Fee Config:', { baseFeeBps: feeConfig?.baseFeeBps, charityPortion, kindswapPortion });
  console.log('API Tiers loaded:', apiTiers.length > 0, 'Count:', apiTiers.length);
  console.log('Display Tiers:', displayTiers);
  console.log('Is Loading Fee Config:', isLoadingFeeConfig);

  // Calculate current tier based on KNS balance
  // Use displayTiers (which have recalculated fees) instead of apiTiers
  const currentTier = displayTiers.find(t => {
    const sortedTiers = [...displayTiers].sort((a, b) => b.knsMin - a.knsMin);
    for (const tier of sortedTiers) {
      if (knsBalance >= tier.knsMin) return tier.name === t.name;
    }
    return t.knsMin === 0;
  }) || displayTiers[0];

  // Get next tier
  const currentTierIndex = displayTiers.findIndex(t => t.name === currentTier.name);
  const nextTier = currentTierIndex < displayTiers.length - 1 ? displayTiers[currentTierIndex + 1] : null;

  // Calculate tier progress
  const tierProgress = nextTier
    ? Math.min(100, Math.max(0, ((knsBalance - currentTier.knsMin) / (nextTier.knsMin - currentTier.knsMin)) * 100))
    : 100;

  // Calculate fee breakdown using the new model
  const feeBreakdown = calculateFeeBreakdown(currentTier.effectiveFeeBps, charityPortion, kindswapPortion);
  const totalFee = feeBreakdown.totalFeePercent;
  const charityFee = feeBreakdown.charityFeePercent;
  const kindswapFee = feeBreakdown.kindswapFeePercent;

  // Fetch fee configuration on mount and refresh periodically
  useEffect(() => {
    const fetchFeeConfig = async () => {
      setIsLoadingFeeConfig(true);
      try {
        const { config, tiers } = await feeConfigService.getAll();
        if (config) setFeeConfig(config);
        if (tiers.length > 0) setApiTiers(tiers);
        console.log('[FeeConfig] Loaded:', { config, tiers });
      } catch (error) {
        console.warn('[FeeConfig] Failed to load, using defaults:', error);
        Sentry.captureException(error, {
          tags: { feature: 'fee-config', action: 'load' },
          level: 'error',
        });
      } finally {
        setIsLoadingFeeConfig(false);
      }
    };

    // Initial fetch
    fetchFeeConfig();

    // Refresh every 30 seconds to pick up admin changes
    const refreshInterval = setInterval(() => {
      fetchFeeConfig();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, []);

  // Initialize FeeCalculator with dynamic fee configuration
  useEffect(() => {
    if (connection && feeConfig && platformFeeWallet && charityFeeWallet) {
      // Calculate charity fee percentage from base fee and charity portion
      const baseFeePercent = feeConfig.baseFeeBps / 100; // Convert bps to percent
      const charityFeePercent = baseFeePercent * feeConfig.charityPortion;

      feeCalculator.current = new FeeCalculator(connection, {
        baseFeePercentage: baseFeePercent,
        charityFeePercentage: charityFeePercent,
        platformWallet: platformFeeWallet,
        charityWallet: charityFeeWallet,
      });

      console.log('[FeeCalculator] Initialized with dynamic config:', {
        baseFeePercent,
        charityFeePercent,
        charityPortion: feeConfig.charityPortion,
        platformWallet: platformFeeWallet,
        charityWallet: charityFeeWallet,
      });
    }
  }, [connection, feeConfig, platformFeeWallet, charityFeeWallet]);

  useEffect(() => {
    if (isConnected && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isConnected]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeDropdown === null) return;

      const target = event.target as Node;
      const isOutsideFrom = fromDropdownRef.current && !fromDropdownRef.current.contains(target);
      const isOutsideTo = toDropdownRef.current && !toDropdownRef.current.contains(target);
      // Also check if click is inside the token dropdown modal (rendered at page level)
      const isInsideTokenModal = tokenDropdownModalRef.current && tokenDropdownModalRef.current.contains(target);

      // Only close if click is outside all token-related elements
      if (isOutsideFrom && isOutsideTo && !isInsideTokenModal) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdown]);

  // Fetch verified token list - extracted as function for retry capability
  const fetchTokens = React.useCallback(async () => {
    try {
      setIsLoadingTokens(true);
      setTokenListError(null); // Clear previous errors
      const verifiedTokens = await jupiterService.current.getTokenList();
      console.log('Fetched verified tokens:', verifiedTokens.length);

      setTokenList(verifiedTokens);
      console.log('Token list set with verified tokens. Length:', verifiedTokens.length);
      console.log('First 3 tokens:', verifiedTokens.slice(0, 3));

      // Build set of verified mint addresses for quick lookup (only tokens with isVerified === true AND id exists)
      const trulyVerifiedMints = verifiedTokens
        .filter(t => t.isVerified === true && t.id) // ✅ Also check id exists
        .map(t => t.id);

      console.log('✅ Truly verified tokens count:', trulyVerifiedMints.length);
      console.log('✅ Truly verified mints array:', trulyVerifiedMints.slice(0, 10));

      const newVerifiedSet = new Set(trulyVerifiedMints);
      console.log('✅ NEW Verified Set being set:', newVerifiedSet);
      console.log('✅ NEW Set size:', newVerifiedSet.size);

      setVerifiedTokenMints(newVerifiedSet);
    } catch (error) {
      console.error('Failed to fetch token list:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unable to load tokens. Please check your connection.';
      setTokenListError(errorMessage);
      Sentry.captureException(error, {
        tags: { feature: 'token-list', action: 'fetch' },
        level: 'error',
      });
    } finally {
      setIsLoadingTokens(false);
    }
  }, []);

  // Fetch tokens on mount
  // getTokenList() fetches only verified tokens for initial load
  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // Debounced token search function
  // Triggers when user types in search input (>= 2 characters)
  const handleTokenSearch = React.useCallback(
    debounce(async (query: string) => {
      if (!query || query.length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const results = await jupiterService.current.searchTokens(query);
        console.log(`Search results for "${query}":`, results.length);
        setSearchResults(results);
      } catch (error) {
        console.error('Token search error:', error);
        Sentry.captureException(error, {
          tags: { feature: 'token-search', action: 'search' },
          level: 'error',
        });
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    []
  );

  // Trigger search when tokenSearchQuery changes
  useEffect(() => {
    handleTokenSearch(tokenSearchQuery);
  }, [tokenSearchQuery, handleTokenSearch]);

  // Fetch token balances when wallet connects or tokens change
  useEffect(() => {
    const fetchBalances = async () => {
      if (!publicKey || !connection) {
        setTokenBalances({});
        setKnsBalance(0); // Reset KNS balance when wallet disconnected
        return;
      }

      try {
        setIsLoadingBalance(true);
        const balances: Record<string, number> = {};

        // Fetch SOL balance
        const solBalance = await connection.getBalance(publicKey);
        balances['SOL'] = solBalance / 1e9; // Convert lamports to SOL

        // Build list of tokens to fetch balances for (hardcoded + selected tokens)
        const tokensToFetch: { symbol: string; mintAddress: string }[] = [];

        // Add hardcoded tokens
        for (const [symbol, mintAddress] of Object.entries(TOKEN_MINT_ADDRESSES)) {
          if (symbol !== 'SOL') {
            tokensToFetch.push({ symbol, mintAddress });
          }
        }

        // Add currently selected tokens if not already included
        for (const selectedSymbol of [fromToken, toToken]) {
          if (selectedSymbol && selectedSymbol !== 'SOL' && !TOKEN_MINT_ADDRESSES[selectedSymbol]) {
            const mintAddress = getMintAddressFromList(selectedSymbol, tokenList, recentTokensRef);
            if (mintAddress) {
              tokensToFetch.push({ symbol: selectedSymbol, mintAddress });
            }
          }
        }

        // Fetch SPL token balances
        for (const { symbol, mintAddress } of tokensToFetch) {
          try {
            const mint = new (await import('@solana/web3.js')).PublicKey(mintAddress);
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, { mint });

            if (tokenAccounts.value.length > 0) {
              const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
              balances[symbol] = balance || 0;

              // Update KNS balance specifically for fee calculation
              if (symbol === 'KNS') {
                setKnsBalance(balance || 0);
              }
            } else {
              balances[symbol] = 0;
              if (symbol === 'KNS') {
                setKnsBalance(0);
              }
            }
          } catch (error) {
            console.error(`Failed to fetch balance for ${symbol}:`, error);
            Sentry.captureException(error, {
              tags: { feature: 'balance-fetch', action: 'fetch-single', token: symbol },
              level: 'warning',
            });
            balances[symbol] = 0;
            if (symbol === 'KNS') {
              setKnsBalance(0);
            }
          }
        }

        setTokenBalances(balances);
      } catch (error) {
        console.error('Failed to fetch balances:', error);
        Sentry.captureException(error, {
          tags: { feature: 'balance-fetch', action: 'fetch-all' },
          level: 'error',
        });
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalances();
  }, [publicKey, connection, fromToken, toToken, refreshTrigger]);

  // Fetch real-time token prices from Jupiter Price API
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        // Get all mint addresses for price lookup (hardcoded tokens)
        const mintAddresses = Object.values(TOKEN_MINT_ADDRESSES);
        const mintToSymbol = Object.entries(TOKEN_MINT_ADDRESSES).reduce(
          (acc, [symbol, mint]) => ({ ...acc, [mint]: symbol }),
          {} as Record<string, string>
        );

        // Add currently selected tokens (including unverified tokens)
        const selectedTokens = [fromToken, toToken].filter(Boolean);

        for (const symbol of selectedTokens) {
          if (!TOKEN_MINT_ADDRESSES[symbol]) {
            // Get mint address for dynamically selected token
            const mint = getMintAddressFromList(symbol, tokenList, recentTokensRef);

            if (!mint) {
              console.warn(`⚠️ [${symbol}] FAILED - No mint address found!`);
            } else if (!mintAddresses.includes(mint)) {
              mintAddresses.push(mint);
              mintToSymbol[mint] = symbol;
            }
          }
        }

        // Fetch prices from Jupiter
        const mintPrices = await jupiterService.current.getTokenPrices(mintAddresses);

        // Convert mint addresses to symbols
        const symbolPrices: Record<string, number> = {};
        for (const [mint, price] of Object.entries(mintPrices)) {
          const symbol = mintToSymbol[mint];
          if (symbol) {
            symbolPrices[symbol] = price;
          } else {
            console.warn(`⚠️ No symbol mapping for mint: ${mint}`);
          }
        }

        // Check for missing prices
        for (const symbol of selectedTokens) {
          if (symbolPrices[symbol] === undefined) {
            console.warn(`⚠️ No price found for: ${symbol}`);
          }
        }

        // Fallback prices for tokens not found
        const fallbackPrices: Record<string, number> = {
          USDC: 1,
          USDT: 1,
        };

        setTokenPrices(prev => ({
          ...fallbackPrices,
          ...prev,
          ...symbolPrices,
        }));
      } catch (error) {
        console.error('Failed to fetch token prices:', error);
        Sentry.captureException(error, {
          tags: { feature: 'price-fetch', action: 'fetch-token-prices' },
          level: 'error',
        });
      }
    };

    // Fetch immediately
    fetchPrices();

    // Refresh prices every 30 seconds
    const priceInterval = setInterval(fetchPrices, 30000);

    return () => clearInterval(priceInterval);
  }, [fromToken, toToken, tokenList]);

  // Manual refresh function
  const handleRefreshQuote = () => {
    // Reset programmatic flag since this is a user action
    isProgrammaticUpdate.current = false;
    setRefreshTrigger(prev => prev + 1);
  };

  // Fetch quote with debouncing (only when user types)
  useEffect(() => {
    const fetchQuote = async () => {
      // Skip if this is a programmatic update (result of previous quote fetch)
      if (isProgrammaticUpdate.current) {
        isProgrammaticUpdate.current = false;
        return;
      }

      // Determine which field has a value
      const hasInputAmount = inputAmount && inputAmount !== '';
      const hasOutputAmount = outputAmount && outputAmount !== '';

      // If neither field has value, clear everything
      if (!hasInputAmount && !hasOutputAmount) {
        setCurrentQuote(null);
        setLastQuoteTime(null);
        setQuoteError(null);
        // Clear auto-refresh timer
        if (autoRefreshTimerRef.current) {
          clearTimeout(autoRefreshTimerRef.current);
          autoRefreshTimerRef.current = null;
        }
        return;
      }

      // Don't fetch if tokens not selected
      if (!fromToken || !toToken) {
        return;
      }

      // Get mint addresses from token list (supports all tokens, not just hardcoded ones)
      const inputMint = getMintAddressFromList(fromToken, tokenList, recentTokensRef);
      const outputMint = getMintAddressFromList(toToken, tokenList, recentTokensRef);

      console.log('💰 Quote fetch - Mint addresses:', {
        fromToken,
        toToken,
        inputMint,
        outputMint,
        tokenListLength: tokenList.length,
        recentTokensRefSize: recentTokensRef.current.size,
      });

      if (!inputMint || !outputMint) {
        console.error('❌ Token mint address not found for', { fromToken, toToken, inputMint, outputMint });
        return;
      }

      try {
        setIsLoadingQuote(true);
        setQuoteError(null);

        // Get token decimals from token list
        const inputDecimals = getTokenDecimalsFromList(fromToken, tokenList, recentTokensRef);
        const outputDecimals = getTokenDecimalsFromList(toToken, tokenList, recentTokensRef);

        let quote: QuoteRoute;

        console.log('Fetching quote fetchQuote for', {
          inputMint,
          outputMint,
          inputAmount,
          outputAmount,
          lastEditedField,
          slippageBps: Math.floor((customSlippage ? parseFloat(customSlippage) : slippageValue) * 100),
        });

        if (lastEditedField === 'input' && hasInputAmount) {
          // User entered input amount - calculate output (ExactIn mode)
          const amountInSmallestUnit = Math.floor(parseFloat(inputAmount) * Math.pow(10, inputDecimals));

          quote = await jupiterService.current.getQuote({
            inputMint,
            outputMint,
            amount: amountInSmallestUnit.toString(),
            slippageBps: Math.floor((customSlippage ? parseFloat(customSlippage) : slippageValue) * 100),
            swapMode: 'ExactIn',
          });

          setCurrentQuote(quote);
          setLastQuoteTime(Date.now());

          // Convert output amount back to human readable
          const outputAmountDecimal = parseFloat(quote.outAmount) / Math.pow(10, outputDecimals);

          // Mark as programmatic update to prevent cascading quote fetches
          isProgrammaticUpdate.current = true;
          const outStr = outputAmountDecimal.toFixed(6);
          setOutputAmount(outStr.length > 20 ? outputAmountDecimal.toPrecision(10) : outStr);
        } else if (lastEditedField === 'output' && hasOutputAmount) {
          // User entered output amount - calculate input (ExactOut mode)
          const amountInSmallestUnit = Math.floor(parseFloat(outputAmount) * Math.pow(10, outputDecimals));

          quote = await jupiterService.current.getQuote({
            inputMint,
            outputMint,
            amount: amountInSmallestUnit.toString(),
            slippageBps: Math.floor((customSlippage ? parseFloat(customSlippage) : slippageValue) * 100),
            swapMode: 'ExactOut',
          });

          setCurrentQuote(quote);
          setLastQuoteTime(Date.now());

          // Convert input amount back to human readable
          const inputAmountDecimal = parseFloat(quote.inAmount) / Math.pow(10, inputDecimals);

          // Mark as programmatic update to prevent cascading quote fetches
          isProgrammaticUpdate.current = true;
          const inStr = inputAmountDecimal.toFixed(6);
          setInputAmount(inStr.length > 20 ? inputAmountDecimal.toPrecision(10) : inStr);
        }

        // Setup auto-refresh timer (30 seconds)
        if (quoteAutoRefreshEnabled) {
          if (autoRefreshTimerRef.current) {
            clearTimeout(autoRefreshTimerRef.current);
          }
          autoRefreshTimerRef.current = setTimeout(() => {
            handleRefreshQuote();
          }, 30000); // 30 seconds
        }
      } catch (error) {
        console.error('Failed to fetch quote:', error);
        Sentry.captureException(error, {
          tags: { feature: 'quote', action: 'fetch' },
          level: 'error',
        });
        // Mark as programmatic update when clearing on error
        isProgrammaticUpdate.current = true;
        if (lastEditedField === 'input') {
          setOutputAmount('');
        } else {
          setInputAmount('');
        }
        setCurrentQuote(null);
        setLastQuoteTime(null);
        setQuoteError('No route found for this swap');
      } finally {
        setIsLoadingQuote(false);
      }
    };

    // Debounce the quote fetching
    const timer = setTimeout(() => {
      fetchQuote();
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(timer);
      if (autoRefreshTimerRef.current) {
        clearTimeout(autoRefreshTimerRef.current);
      }
    };
  }, [inputAmount, outputAmount, lastEditedField, fromToken, toToken, customSlippage, slippageValue, refreshTrigger, quoteAutoRefreshEnabled, tokenList]);

  const handleToggleDropdown = (dropdown: 'from' | 'to') => {
    setActiveDropdown(activeDropdown === dropdown ? null : dropdown);
  };

  const handleSwapTokens = () => {
    // Reset programmatic flag since this is a user action
    isProgrammaticUpdate.current = false;

    // Swap tokens
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);

    // Swap amounts
    const tempAmount = inputAmount;
    setInputAmount(outputAmount);
    setOutputAmount(tempAmount);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      // Limit integer digits to 10 and decimal digits to 9 to prevent UI overflow
      const parts = value.split('.');
      if (parts[0] && parts[0].length > 10) return;
      if (parts[1] && parts[1].length > 9) return;

      // Reset programmatic flag since this is user input
      isProgrammaticUpdate.current = false;
      setInputAmount(value);
      setLastEditedField('input');
      if (value === '') {
        isProgrammaticUpdate.current = true;
        setOutputAmount('');
      }
    }
  };

  const handleOutputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      // Limit integer digits to 10 and decimal digits to 9 to prevent UI overflow
      const parts = value.split('.');
      if (parts[0] && parts[0].length > 10) return;
      if (parts[1] && parts[1].length > 9) return;

      // Reset programmatic flag since this is user input
      isProgrammaticUpdate.current = false;
      setOutputAmount(value);
      setLastEditedField('output');
      if (value === '') {
        isProgrammaticUpdate.current = true;
        setInputAmount('');
      }
    }
  };

  const handleMaxClick = () => {
    const balance = tokenBalances[fromToken] || 0;

    // Reset programmatic flag since this is a user action
    isProgrammaticUpdate.current = false;

    // If swapping SOL, reserve 0.01 SOL for transaction fees
    if (fromToken === 'SOL' && balance > 0.01) {
      setInputAmount((balance - 0.01).toFixed(6));
    } else if (balance > 0) {
      setInputAmount(balance.toFixed(6));
    }

    // Set last edited field to input since Max button affects the input
    setLastEditedField('input');
  };

  const handleSwap = async () => {
    if (!inputAmount || !fromToken || !toToken || !publicKey || !wallet.sendTransaction || !currentQuote) {
      setSwapError('Missing required data for swap');
      return;
    }

    if (!jupiterSwapService.current || !feeCalculator.current) {
      setSwapError('Swap service not initialized');
      return;
    }

    // Validate balance
    const inputAmountNum = parseFloat(inputAmount);
    const fromBalance = tokenBalances[fromToken] || 0;
    const solBalance = tokenBalances['SOL'] || 0;
    const isInputSol = fromToken === 'SOL';

    // Check sufficient balance
    const requiredBalance = getRequiredSwapBalance(inputAmountNum, estimatedGasFee, isInputSol);
    if (fromBalance < requiredBalance) {
      if (isInputSol) {
        setSwapError(
          `Insufficient SOL balance. SOL swaps need input + network fee + wrap reserve (~${SOL_SWAP_RESERVE.toFixed(3)} SOL). Required: ${requiredBalance.toFixed(6)}, Available: ${fromBalance.toFixed(6)}`
        );
      } else {
        setSwapError(`Insufficient ${fromToken} balance. Required: ${requiredBalance.toFixed(6)}, Available: ${fromBalance.toFixed(6)}`);
      }
      return;
    }

    // Check SOL for gas fees
    if (!isInputSol && solBalance < estimatedGasFee * SOL_GAS_BUFFER_MULTIPLIER) {
      setSwapError(`Insufficient SOL for transaction fees. Required: ~${(estimatedGasFee * SOL_GAS_BUFFER_MULTIPLIER).toFixed(6)} SOL`);
      return;
    }

    setIsLoading(true);
    setSwapError(null);
    setSwapStatus(SwapStatus.IDLE);
    setTxSignature(null);
    setShowTransactionModal(true);

    try {
      // Get token info from token list (supports all tokens)
      const inputMint = getMintAddressFromList(fromToken, tokenList, recentTokensRef);
      const outputMint = getMintAddressFromList(toToken, tokenList, recentTokensRef);
      const inputDecimals = getTokenDecimalsFromList(fromToken, tokenList, recentTokensRef);
      const outputDecimals = getTokenDecimalsFromList(toToken, tokenList, recentTokensRef);

      if (!inputMint || !outputMint) {
        setSwapError('Token not found. Please select a valid token.');
        setIsLoading(false);
        return;
      }

      // Determine swap mode based on which field user edited
      const swapMode: 'ExactIn' | 'ExactOut' = lastEditedField === 'output' ? 'ExactOut' : 'ExactIn';

      // Convert amounts to smallest units
      const inputAmountSmallest = Math.floor(inputAmountNum * Math.pow(10, inputDecimals)).toString();
      const outputAmountSmallest = outputAmount
        ? Math.floor(parseFloat(outputAmount) * Math.pow(10, outputDecimals)).toString()
        : undefined;

      // Calculate fees using the fee calculator.
      // FeeCalculator expects the input amount in human-readable units (not smallest-unit integers),
      // so pass `inputAmountNum` as a string. Using the smallest-unit value here produced inflated fees.
      const feeCalc = feeCalculator.current.calculateFeeAmounts(
        inputAmountNum.toString(),
        inputDecimals,
        knsBalance
      );

      console.log('Swap mode:', swapMode);
      console.log('Input amount (smallest):', inputAmountSmallest);
      console.log('Output amount (smallest):', outputAmountSmallest);
      console.log('Fee calculation:', feeCalc);

      // ── Mobile deep link: the page navigates away when sendTransaction fires.
      // The promise will never resolve. We race against a "page hidden" detector
      // so handleSwap doesn't hang forever and the finally{} block still runs.
      const isMobileDeepLink = isMobileWithoutPhantom() || !!getPhantomMobileSession();

      const swapParams = {
        inputMint,
        outputMint,
        inputAmount: inputAmountSmallest,
        outputAmount: outputAmountSmallest,
        inputDecimals,
        outputDecimals,
        feeCalculation: feeCalc,
        platformFeeWallet: platformFeeWallet,
        charityFeeWallet: charityFeeWallet,
        slippageBps: Math.floor((customSlippage ? parseFloat(customSlippage) : slippageValue) * 100),
        swapMode,
      };

      const swapPromise = jupiterSwapService.current.executeSwap(
        wallet,
        swapParams,
        (state: JupiterSwapState) => {
          setSwapStatus(state.status);
          setSwapMessage(state.message || null);
          console.log('Swap status update:', state);
        }
      );

      // On mobile the deep link will navigate the page away.
      // Race the swap promise against a visibility-change sentinel so we
      // don't hang forever (the finally block needs to run on mobile too).
      let result: { feeSignature?: string; swapSignature: string };
      if (isMobileDeepLink) {
        // Save swap context to localStorage BEFORE the redirect so the
        // recovery useEffect can log to /api/swap/complete when user returns.
        const inputPrice = tokenPrices[fromToken] || 0;
        const outputPrice = tokenPrices[toToken] || 0;
        const outputAmountNum = parseFloat(outputAmount) || 0;
        const slippageBpsMobile = Math.floor((customSlippage ? parseFloat(customSlippage) : slippageValue) * 100);
        try {
          localStorage.setItem('phantom_mobile_swap_context', JSON.stringify({
            wallet: publicKey.toString(),
            inputMint,
            outputMint,
            inputAmountSmallest,
            outputAmountSmallest: outputAmountSmallest || '0',
            inputDecimals,
            outputDecimals,
            inputAmountNum,
            outputAmountNum,
            inputPrice,
            outputPrice,
            feeCalc: {
              effectiveFeeBps: feeCalc.effectiveFeeBps,
              feeAmountInInputToken: feeCalc.feeAmountInInputToken,
              charityFeeAmount: feeCalc.charityFeeAmount,
              platformFeeAmount: feeCalc.platformFeeAmount,
            },
            feeTier: currentTier.name,
            discountPercent: currentTier.discountPercent,
            slippageBps: slippageBpsMobile,
            knsBalance: Math.floor(knsBalance),
            routeData: currentQuote ? { routePlan: currentQuote.routePlan } : undefined,
            timestamp: Date.now(),
          }));
        } catch {
          // localStorage full — non-critical, swap still works but won't log
        }

        const mobileExit = new Promise<never>((_, reject) => {
          const onHidden = () => {
            if (document.hidden) {
              document.removeEventListener('visibilitychange', onHidden);
              reject(new Error('__PHANTOM_MOBILE_REDIRECT__'));
            }
          };
          document.addEventListener('visibilitychange', onHidden);
          setTimeout(() => reject(new Error('__PHANTOM_MOBILE_REDIRECT__')), 60_000);
        });

        try {
          result = await Promise.race([swapPromise, mobileExit]);
        } catch (mobileErr: any) {
          if (mobileErr?.message === '__PHANTOM_MOBILE_REDIRECT__') {
            console.log('[Swap] Mobile deep link redirect detected — waiting for Phantom callback');
            return;
          }
          throw mobileErr;
        }
      } else {
        // Desktop flow — normal await
        result = await swapPromise;
      }

      // Store transaction signature for explorer link
      setTxSignature(result.swapSignature);

      // Log successful swap to backend (fire-and-forget for speed)
      const inputPrice = tokenPrices[fromToken] || 0;
      const outputPrice = tokenPrices[toToken] || 0;
      const outputAmountNum = parseFloat(outputAmount) || 0;
      const { inputAmountUSD, outputAmountUSD } = await deriveSwapUSD(
        inputAmountNum, outputAmountNum, inputMint, outputMint, inputPrice, outputPrice
      );
      // Derive per-token USD rate for fee conversion
      const derivedInputPrice = inputAmountNum > 0 ? inputAmountUSD / inputAmountNum : 0;
      const slippageBps = Math.floor((customSlippage ? parseFloat(customSlippage) : slippageValue) * 100);

      const swapLogPayload: SwapLogPayload = {
        wallet: publicKey.toString(),
        signature: result.swapSignature,
        status: 'confirmed',
        txMode: SWAP_TX_MODE,
        inputAmountUSD,
        outputAmountUSD,
        inputMint,
        outputMint,
        inputAmount: inputAmountSmallest,
        outputAmount: outputAmountSmallest || '0',
        inputDecimals,
        outputDecimals,
        feeTier: currentTier.name,
        discountPercent: currentTier.discountPercent,
        effectiveFeeBps: feeCalc.effectiveFeeBps * 100, // Convert percentage to bps
        feeAmountUSD: feeCalc.feeAmountInInputToken * derivedInputPrice,
        charityAmountUSD: feeCalc.charityFeeAmount * derivedInputPrice,
        kindswapFeeUSD: feeCalc.platformFeeAmount * derivedInputPrice,
        slippageBps,
        knsBalanceAtSwap: Math.floor(knsBalance).toString(),
        routeData: currentQuote ? { routePlan: currentQuote.routePlan } : undefined,
      };

      swapLoggingService.logSwapFireAndForget(swapLogPayload);

      // Clear inputs after successful swap
      setInputAmount('');
      setOutputAmount('');
      setCurrentQuote(null);

      // Refresh balances
      setRefreshTrigger(prev => prev + 1);

      // Show success message
      setSwapStatus(SwapStatus.CONFIRMED);
      setSwapMessage(`Swap successful! Transaction: ${result.swapSignature.slice(0, 8)}...`);

      // Keep modal open - user will close it manually

    } catch (error) {
      console.error('Swap failed:', error);
      Sentry.captureException(error, {
        tags: { feature: 'swap', action: 'execute' },
        level: 'error',
        extra: { fromToken, toToken, inputAmount, outputAmount },
      });
      const errorMsg = error instanceof Error ? error.message : 'Swap failed';
      setSwapError(errorMsg);
      setSwapStatus(SwapStatus.FAILED);
      setSwapMessage(errorMsg);

      // Log failed swap to backend (fire-and-forget)
      // Note: We may not have all data in error case, so we use safe fallbacks
      if (publicKey) {
        const composeDiagnostics = extractComposeDiagnostics(errorMsg);
        const inputPrice = tokenPrices[fromToken] || 0;
        const outputPrice = tokenPrices[toToken] || 0;
        const slippageBps = Math.floor((customSlippage ? parseFloat(customSlippage) : slippageValue) * 100);
        const inputMintAddr = getMintAddressFromList(fromToken, tokenList, recentTokensRef);
        const outputMintAddr = getMintAddressFromList(toToken, tokenList, recentTokensRef);
        const inputDec = getTokenDecimalsFromList(fromToken, tokenList, recentTokensRef);
        const outputDec = getTokenDecimalsFromList(toToken, tokenList, recentTokensRef);
        const inputAmountSmallestStr = Math.floor(parseFloat(inputAmount || '0') * Math.pow(10, inputDec)).toString();
        const failedInputNum = parseFloat(inputAmount || '0');
        const failedOutputNum = parseFloat(outputAmount || '0');
        const { inputAmountUSD: failedInputUSD } = await deriveSwapUSD(
          failedInputNum, failedOutputNum, inputMintAddr || '', outputMintAddr || '', inputPrice, outputPrice
        );

        const failedLogPayload: SwapLogPayload = {
          wallet: publicKey.toString(),
          signature: `failed_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          status: 'failed',
          txMode: SWAP_TX_MODE,
          inputAmountUSD: failedInputUSD,
          outputAmountUSD: 0,
          inputMint: inputMintAddr || '',
          outputMint: outputMintAddr || '',
          inputAmount: inputAmountSmallestStr,
          outputAmount: '0',
          inputDecimals: inputDec,
          outputDecimals: outputDec,
          feeTier: currentTier.name,
          discountPercent: currentTier.discountPercent,
          effectiveFeeBps: 0, // No fee charged on failed tx
          feeAmountUSD: 0,
          charityAmountUSD: 0,
          kindswapFeeUSD: 0,
          slippageBps,
          knsBalanceAtSwap: Math.floor(knsBalance).toString(),
          composeStage: composeDiagnostics.composeStage,
          instructionCount: composeDiagnostics.instructionCount,
          errorMessage: errorMsg,
        };

        swapLoggingService.logSwapFireAndForget(failedLogPayload);
      }

      // Keep modal open to show error - user will close or retry
    } finally {
      setIsLoading(false);
    }
  };

  // Close transaction modal and reset state
  const handleCloseTransactionModal = () => {
    setShowTransactionModal(false);
    setSwapStatus(SwapStatus.IDLE);
    setSwapMessage(null);
    setTxSignature(null);
  };

  const isReadyToSwap = inputAmount && fromToken && toToken;

  // Calculate dynamic route info for the badge
  const numRoutes = currentQuote?.routePlan?.length || 0;
  const uniqueMarkets = new Set(
    currentQuote?.routePlan
      ?.flat()
      ?.map(step => step.swapInfo.ammKey)
      ?.filter(Boolean)
  );
  const numMarkets = uniqueMarkets.size || 0;

  return (
    <div className="w-full max-w-md mx-auto relative">
      {/* Overlay to close fee card when clicking on swap card area */}
      {showFeeCard && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setShowFeeCard(false)}
        />
      )}

      <div
        className={`glass-card p-6 space-y-4 gradient-border transition-all duration-500 ease-in-out relative z-40 ${!isMobile && !isTab && (showFeeCard || showTierInfoCard) ? 'transform -translate-x-[calc(50%-12px)]' : ''
          }`}
        onClick={() => {
          if (showFeeCard) setShowFeeCard(false);
          if (showTierInfoCard) setShowTierInfoCard(false);
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-border/30">
          <div className="flex items-center gap-2">
            <KindSwapLogo className="w-7 h-7" />
            <span className="font-bold text-foreground text-lg">KindSwap</span>
          </div>
          <div className="z-10 relative flex items-center gap-2">
            <Tooltip>
              {/* <TooltipTrigger asChild>
                <button className="p-1.5 rounded-md hover:bg-ocean-cyan/10 transition-colors">
                  <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-ocean-cyan" />
                </button>
              </TooltipTrigger> */}
              <TooltipContent>
                <p>Open External Wallet</p>
              </TooltipContent>
            </Tooltip>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveDropdown(null);
                setShowFeeCard(false);
                setShowTierInfoCard(!showTierInfoCard);
              }}
              className="flex items-center gap-1.5 px-2 py-0.5 h-5 rounded-md bg-ocean-cyan/20 border border-ocean-cyan/30 hover:border-ocean-cyan/50 hover:bg-primary/30 transition-colors"
            >
              <span className="text-xs font-semibold text-ocean-cyan">Fee Discount Tiers</span>
            </button>
          </div>
        </div>

        {/* Swap Interface */}
        <div className="space-y-4">
            {/* You Pay Section */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">You Pay</label>
              <div className="bg-background/50 rounded-xl p-4 border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <TokenSelector
                    symbol={fromToken}
                    disabled={false}
                    onToggle={() => handleToggleDropdown('from')}
                    dropdownRef={fromDropdownRef as React.RefObject<HTMLDivElement>}
                    tokenList={tokenList}
                  />
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={inputAmount}
                    onChange={handleInputChange}
                    className="bg-transparent text-2xl text-right font-bold text-foreground w-full outline-none placeholder:text-muted-foreground/50 cursor-text relative"
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Balance: {isLoadingBalance ? '...' : formatUSD(tokenBalances[fromToken] || 0, 6)}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-base">
                      ≈ ${formatUSD(displayInputUSD)}
                    </span>
                    <button
                      onClick={handleMaxClick}
                      disabled={isLoadingFeeConfig || isLoadingQuote}
                      className={`text-xs font-semibold transition-colors relative ${
                        isLoadingFeeConfig || isLoadingQuote
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-ocean-cyan hover:text-ocean-light cursor-pointer'
                      }`}
                    >
                      Max
                    </button>
                    {lastEditedField === 'output' && outputAmount && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-ocean-cyan/30 text-ocean-cyan">
                        Estimated
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Swap Direction */}
            <div className="flex justify-center -my-1 relative">
              <button
                onClick={handleSwapTokens}
                className="w-10 h-10 rounded-full bg-background/80 border border-border/50 flex items-center justify-center hover:border-ocean-cyan/50 hover:bg-ocean-cyan/10 transition-all"
              >
                <ArrowUpDown className="w-4 h-4 text-muted-foreground hover:text-ocean-cyan" />
              </button>
            </div>

            {/* You Receive Section */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">You Receive</label>
              <div className="bg-background/50 rounded-xl p-4 border border-border/50">
                <div className="flex items-center justify-between mb-2">

                  <TokenSelector
                    symbol={toToken}
                    disabled={false}
                    onToggle={() => handleToggleDropdown('to')}
                    dropdownRef={toDropdownRef as React.RefObject<HTMLDivElement>}
                    tokenList={tokenList}
                  />
                  {isLoadingQuote && (lastEditedField === 'input' ? inputAmount : outputAmount) ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-ocean-cyan" />
                      <span className="text-xl text-muted-foreground text-right">Fetching quote...</span>
                    </div>
                  ) : (
                    <input
                      ref={outputRef}
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={outputAmount}
                      onChange={handleOutputChange}
                      className="bg-transparent text-right text-2xl font-bold text-foreground w-full outline-none placeholder:text-muted-foreground/50 cursor-text relative"
                    />
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Balance: {!toToken ? '-' : isLoadingBalance ? '...' : formatUSD(tokenBalances[toToken] || 0, 6)}
                  </span>
                  <div className="flex items-end gap-1 flex-col-reverse">
                    <div>
                      <span className="text-muted-foreground text-base whitespace-nowrap">
                        ≈ ${outputAmount ? formatUSD(displayOutputUSD) : '0.00'}{" "}
                      </span>
                      {/* Price Impact - Simple calculation from USD values */}
                      {outputAmount && displayInputUSD > 0 && displayOutputUSD > 0 && (() => {
                        const impact = ((displayInputUSD - displayOutputUSD) / displayInputUSD) * 100;
                        if (!isFinite(impact) || isNaN(impact) || Math.abs(impact) < 0.01) return null;
                        return (
                          <div className="relative group inline-block">
                            <span className="text-base cursor-pointer">
                              (<span className={`underline decoration-dotted decoration-1 underline-offset-2 decoration-muted-foreground/40 group-hover:decoration-muted-foreground/70 transition-all ${getPriceImpactColor(impact)}`}>
                                {impact >= 0 ? '-' : '+'}{Math.abs(impact).toFixed(2)}%
                              </span>)
                            </span>
                            <div className="absolute   -left-8 sm:left-1/10 -translate-x-1/2 top-full mt-2 z-50
                              whitespace-nowrap rounded-md bg-black/90 px-2 py-1.5 text-xs
                              text-white opacity-0 group-hover:opacity-100
                              pointer-events-none transition-opacity duration-200 shadow-lg ">
                              <p><strong>Price Impact:</strong> Estimated difference between</p>
                              <p>input and output USD values due to liquidity.</p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    {lastEditedField === 'input' && inputAmount && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-ocean-cyan/30 text-ocean-cyan">
                        Estimated
                      </Badge>
                    )}
                    {lastEditedField === 'output' && outputAmount && (
                      <button
                        onClick={() => {
                          // Similar logic to Max button but for output field
                          const balance = tokenBalances[toToken] || 0;
                          isProgrammaticUpdate.current = false;
                          setOutputAmount(balance.toFixed(6));
                          setLastEditedField('output');
                        }}
                        disabled={isLoadingFeeConfig || isLoadingQuote}
                        className={`text-xs font-semibold transition-colors relative ${
                          isLoadingFeeConfig || isLoadingQuote
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-ocean-cyan hover:text-ocean-light cursor-pointer'
                        }`}
                      >
                        Max
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Swap Status and Error Messages - Now shown in TransactionModal popup
            {swapError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                  <p className="text-sm text-destructive" title={swapError}>{truncate(swapError, TRUNCATE_LEN)}</p>
                </div>
              </div>
            )}

            {swapMessage && swapStatus !== SwapStatus.FAILED && (
              <div className={`p-3 rounded-lg border animate-in fade-in slide-in-from-top-2 ${
                swapStatus === SwapStatus.CONFIRMED
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-ocean-cyan/10 border-ocean-cyan/30'
              }`}>
                <div className="flex items-center gap-2">
                  {swapStatus === SwapStatus.CONFIRMED ? (
                    <span className="text-emerald-500">✓</span>
                  ) : (
                    <Loader2 className="w-4 h-4 text-ocean-cyan animate-spin flex-shrink-0" />
                  )}
                  <p
                    className={`text-sm font-medium ${
                      swapStatus === SwapStatus.CONFIRMED ? 'text-emerald-500' : 'text-ocean-cyan'
                    }`}
                    title={swapMessage}
                  >
                    {truncate(swapMessage, TRUNCATE_LEN)}
                  </p>
                </div>
              </div>
            )}
            */}

            {/* Unverified Token Warning - Show when tokens are selected */}
            {fromToken && toToken && (
              <UnverifiedTokenWarning
                fromToken={fromToken}
                toToken={toToken}
                tokenList={tokenList}
                verifiedTokenMints={verifiedTokenMints}
              />
            )}

            {/* Slippage, Rate, Best Route & Fee Section - Visible when quote is available */}
            {inputAmount && outputAmount && currentQuote && (
              <div className="z-1 space-y-2 pt-2 animate-in ease slide-in-from-top-2 fade-in duration-500 relative">
                {/* Slippage Row with Auto Toggle and Refresh */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Slippage</span>

                    {/* Tooltip wrapper */}
                    <div className="relative group">
                      <button
                        onClick={handleRefreshQuote}
                        disabled={isLoadingQuote}
                        className=" text-ocean-cyan transition-colors 
                 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isLoadingQuote ? 'animate-spin' : ''}`}
                        />
                      </button>

                      {/* Tooltip */}
                      <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2
                    whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs
                    text-white opacity-0 group-hover:opacity-100
                    pointer-events-none transition-opacity duration-200">
                        Refresh quote
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowSlippageModal(true)}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-ocean-cyan/20 border border-ocean-cyan/30 hover:bg-primary/30 hover:border-ocean-cyan/50 transition-colors"
                  >
                    <span className="text-xs font-semibold text-ocean-cyan">
                      {slippageMode === 'auto' ? 'Auto' : 'Manual'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({customSlippage || slippageValue}%)
                    </span>
                  </button>
                </div>

                {/* Gas Fee Display */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Est. Network Fee</span>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-medium">
                      ~  {(estimatedGasFee * SOL_GAS_BUFFER_MULTIPLIER).toFixed(6)} SOL
                    </span>
                    <div className="relative group">
                      <Info className="w-3 h-3 text-ocean-cyan cursor-pointer" />
                      <div className="absolute right-0 top-full mt-2 z-50
                        whitespace-nowrap rounded-md bg-black/90 px-2 py-1.5 text-xs
                        text-white opacity-0 group-hover:opacity-100
                        pointer-events-none transition-opacity duration-200 shadow-lg">
                        <p>Estimated transaction fees on Solana network</p>
                        <p className="mt-1 text-muted-foreground">Priority fee: 10,000 lamports</p>
                        <p className="mt-1 text-muted-foreground">SOL input swaps also need ~{SOL_SWAP_RESERVE.toFixed(3)} SOL wrap reserve</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rate Dropdown */}
                <div className="bg-background/50 rounded-lg border border-border/50 overflow-hidden">
                  <button
                    onClick={() => setShowRateDetails(!showRateDetails)}
                    className="w-full p-3 flex items-center justify-between text-sm hover:bg-background/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">Rate</span>
                      <div className="text-sm">
                        <span className="text-muted-foreground font-extrabold">1 {fromToken}</span>
                        <span className="text-muted-foreground"> = </span>
                        <span className="text-muted-foreground font-extrabold">
                          {outputAmount && inputAmount ? (parseFloat(outputAmount) / parseFloat(inputAmount)).toFixed(2) : '0.00'} {toToken}
                        </span>
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-500 ${showRateDetails ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Expanded Details - Best Route & Your Fee */}
                  <div className={`border-t border-border/50 overflow-hidden transition-all duration-300 ease-in-out ${showRateDetails ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0 border-t-0'
                    }`}>
                    <div className="p-3 space-y-2">
                      {/* Best Route */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Best Route</span>
                        <button
                          onClick={() => setShowRoutingModal(true)}
                          className="cursor-pointer"
                        >
                          <Badge className="bg-gradient-to-r from-ocean-cyan/20 to-ocean-seafoam/20 text-ocean-cyan border border-ocean-cyan/30 hover:border-ocean-cyan/50 transition-colors px-2 py-0.5 bg-primary-foreground hover:bg-primary/30">
                            <Menu className="w-3 h-3 mr-1" />
                            {currentQuote && numRoutes > 0 && numMarkets > 0
                              ? `${numRoutes} ${numRoutes === 1 ? 'Route' : 'Routes'} + ${numMarkets} ${numMarkets === 1 ? 'Market' : 'Markets'}`
                              : 'Loading...'}
                          </Badge>
                        </button>
                      </div>

                      {/* Your Fee */}
                      <div className="flex items-center justify-between text-sm">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Close any open dropdowns and tier info card when opening fee card
                            if (!showFeeCard) {
                              setActiveDropdown(null);
                              setShowTierInfoCard(false);
                            }
                            setShowFeeCard(!showFeeCard);
                          }}
                          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-ocean-cyan/20 border border-ocean-cyan/30 hover:border-ocean-cyan/50 transition-colors z-10 relative hover:bg-primary/30"
                        >
                          <span className="text-xs font-semibold text-ocean-cyan ">Your Fee</span>
                        </button>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="font-semibold text-foreground">{totalFee.toFixed(3)}%</span>
                          {/* <span className="text-[10px] text-charity-coral">({CHARITY_FEE_PERCENT.toFixed(2)}% to charity)</span> */}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Swap Button */}
            {!isConnected ? (
              <Button
                variant="hero"
                size="xl"
                className="z-1 w-full mt-4 relative"
                onClick={onConnect}
              >
                Connect Wallet
              </Button>
            ) : (() => {
              // Calculate balance checks for both disabled state and button text
              const inputAmountNum = inputAmount ? parseFloat(inputAmount) : 0;
              const fromBalance = tokenBalances[fromToken] || 0;
              const solBalance = tokenBalances['SOL'] || 0;
              const isInputSol = fromToken === 'SOL';
              const requiredBalance = getRequiredSwapBalance(inputAmountNum, estimatedGasFee, isInputSol);

              const hasInsufficientBalance = inputAmount && currentQuote && fromBalance < requiredBalance;
              const hasInsufficientGas =
                inputAmount &&
                currentQuote &&
                !isInputSol &&
                solBalance < estimatedGasFee * SOL_GAS_BUFFER_MULTIPLIER;
              const isDisabled = !isReadyToSwap || isLoading || !currentQuote || hasInsufficientBalance || hasInsufficientGas;

              // Determine button text
              let buttonText = 'Swap';
              const hasAnyAmount = inputAmount || outputAmount;
              if (isLoading || swapStatus === SwapStatus.AWAITING_SIGNATURE || swapStatus === SwapStatus.CONFIRMING) {
                buttonText = swapMessage || 'Processing...';
              } else if (!hasAnyAmount) {
                buttonText = 'Enter Amount';
              } else if (quoteError) {
                buttonText = 'No Route Found';
              } else if (isLoadingQuote || !currentQuote) {
                buttonText = 'Fetching Quote...';
              } else if (hasInsufficientBalance) {
                buttonText = `Insufficient ${fromToken} Balance`;
              } else if (hasInsufficientGas) {
                buttonText = 'Insufficient SOL for Gas';
              }

              return (
                <>
                  {quoteError && !isLoadingQuote && hasAnyAmount && (
                    <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span className="text-sm text-red-400">{quoteError}</span>
                    </div>
                  )}
                  <Button
                    variant="hero"
                    size="xl"
                    className="z-1 w-full mt-4 relative"
                    onClick={handleSwap}
                    disabled={isDisabled || !!quoteError}
                  >
                    {(isLoading || swapStatus === SwapStatus.AWAITING_SIGNATURE || swapStatus === SwapStatus.CONFIRMING) && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    {buttonText}
                  </Button>
                </>
              );
            })()}
          </div>
      </div>

      {/* Fee Display Card - Side Drawer (desktop) / Popup (mobile & tablet) */}
      {/* Mobile & Tablet backdrop */}
      {(isMobile || isTab) && showFeeCard && (
        <div
          className="fixed inset-0 z-40 backdrop-blur-sm"
          onClick={() => setShowFeeCard(false)}
        />
      )}
      {(
        <div
          className={
            (isMobile || isTab)
              ? `fixed inset-0 z-50 flex items-center justify-center p-3 transition-all duration-300 ${
                  showFeeCard
                    ? 'opacity-100 visible'
                    : 'opacity-0 invisible pointer-events-none'
                }`
              : `absolute top-0 left-[60%] h-full w-full max-w-md glass-card gradient-border transition-all duration-500 ease-in-out z-40 ${
                  showFeeCard
                    ? 'translate-x-0 opacity-100 visible'
                    : 'translate-x-[calc(100%+2rem)] opacity-0 invisible'
                }`
          }
          onClick={(e) => {
            e.stopPropagation();
            if (isMobile || isTab) setShowFeeCard(false);
          }}
        >
        {/* Card wrapper - has border/styling, no scroll */}
        <div
          className={
            (isMobile || isTab)
              ? 'w-[calc(100%-24px)] max-w-md max-h-[80vh] glass-card gradient-border mx-auto flex flex-col'
              : 'h-full flex flex-col'
          }
          onClick={(e) => e.stopPropagation()}
        >
          {/* Scrollable content area */}
          <div
            ref={feeCardRef}
            className="p-6 space-y-3 relative flex-1 overflow-y-auto scrollbar-thin"
          >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border/30 -mt-6 pt-6 -mx-6 px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFeeCard(false);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-ocean-cyan/20 border border-ocean-cyan/30 hover:border-ocean-cyan/50 transition-colors cursor-pointer"
              >
                <span className="text-sm font-semibold text-ocean-cyan">Your Fee</span>
              </button>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFeeCard(false);
              }}
              className="p-1.5 rounded-md hover:bg-background/50 transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>

          {/* Fee Display */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold gradient-text">{totalFee.toFixed(3)}%</span>
              {currentTier.discountPercent > 0 && (
                <span className="text-sm text-muted-foreground line-through">
                  {(baseFee / 100).toFixed(2)}%
                </span>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge className="bg-ocean-seafoam/20 text-ocean-seafoam border border-ocean-seafoam/30">
                {currentTier.name === 'No Tier' ? 'No Tier' : `${currentTier.name} KNS Holder`}
              </Badge>
              {currentTier.discountPercent > 0 && (
                <p className="text-sm text-ocean-seafoam font-medium">{currentTier.discountPercent}% Discount Applied</p>
              )}
              <p className="text-xs text-muted-foreground">{(charityPortion * 100).toFixed(0)}% to charity</p>
            </div>
          </div>

          {/* Fee Breakdown - New Model */}
          <div className="bg-background/30 rounded-lg p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">KindSwap Fee ({(kindswapPortion * 100).toFixed(0)}%):</span>
              <span className="text-foreground font-medium">{kindswapFee.toFixed(4)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Charity Fee ({(charityPortion * 100).toFixed(0)}%):</span>
              <span className="text-charity-coral font-medium">{charityFee.toFixed(4)}%</span>
            </div>
            <div className="border-t border-border/30 pt-2 flex justify-between">
              <span className="text-foreground font-semibold">Total Fee:</span>
              <span className="text-foreground font-semibold">{totalFee.toFixed(3)}%</span>
            </div>
            {currentTier.discountPercent > 0 && (
              <p className="text-xs text-ocean-seafoam pt-1">
                Base fee {(baseFee / 100).toFixed(2)}% - {currentTier.discountPercent}% tier discount applied
              </p>
            )}
          </div>

          {/* All Tiers Table */}
          <div className="bg-background/50 rounded-lg overflow-x-auto border border-border/50">
            <table className="w-full text-xs sm:text-sm min-w-[320px]">
              <thead>
                <tr className="border-b border-border/30 bg-background/30">
                  <th className="text-left p-2 sm:p-3 text-muted-foreground font-medium whitespace-nowrap">Tier</th>
                  <th className="text-left p-2 sm:p-3 text-muted-foreground font-medium whitespace-nowrap">KNS Balance</th>
                  <th className="text-right p-2 sm:p-3 text-muted-foreground font-medium whitespace-nowrap">Discount</th>
                  <th className="text-right p-2 sm:p-3 text-muted-foreground font-medium whitespace-nowrap">Fee</th>
                </tr>
              </thead>
              <tbody>
                {displayTiers.map((tier, index) => {
                  const isCurrentTier = tier.name === currentTier.name;
                  const isMaxTier = index === displayTiers.length - 1;

                  return (
                    <tr
                      key={tier.name}
                      className={`border-b border-border/20 last:border-0 transition-colors ${
                        isCurrentTier
                          ? 'bg-ocean-cyan/10 hover:bg-ocean-cyan/15'
                          : 'hover:bg-ocean-cyan/5'
                      }`}
                    >
                      <td className="p-2 sm:p-3">
                        <div className="flex items-center gap-1 sm:gap-2">
                          {isCurrentTier && (
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-ocean-cyan animate-pulse flex-shrink-0" />
                          )}
                          <span
                            className={
                              isCurrentTier
                                ? 'text-ocean-cyan font-semibold whitespace-nowrap'
                                : 'text-foreground whitespace-nowrap'
                            }
                          >
                            {tier.name}
                          </span>
                          {isMaxTier && (
                            <Badge variant="outline" className="text-[8px] sm:text-[10px] ml-0.5 sm:ml-1 py-0 px-1 h-3.5 sm:h-4">
                              Max
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-2 sm:p-3 text-muted-foreground whitespace-nowrap">{tier.kns}</td>
                      <td className="p-2 sm:p-3 text-right text-ocean-seafoam whitespace-nowrap">{tier.discount}</td>
                      <td className="p-2 sm:p-3 text-right font-semibold text-foreground whitespace-nowrap">{tier.fee}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Current User Stats & Progress */}
          <div className="bg-background/50 rounded-lg p-4 border border-border/50 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your KNS Balance</span>
              <span className="text-foreground font-semibold">{knsBalance.toLocaleString()} KNS</span>
            </div>
            {nextTier ? (
              <>
                <div className="h-2 bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-ocean-cyan to-ocean-seafoam rounded-full transition-all duration-500"
                    style={{ width: `${tierProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progress to {nextTier.name}</span>
                  <span className="text-foreground">
                    {knsBalance.toLocaleString()} / {nextTier.knsMin.toLocaleString()} KNS
                  </span>
                </div>
                <p className="text-xs text-ocean-cyan">
                  {(nextTier.knsMin - knsBalance).toLocaleString()} more KNS to reach {nextTier.name} ({nextTier.fee} fee)
                </p>
              </>
            ) : (
              <div className="flex items-center justify-center py-2">
                <Badge className="bg-gradient-to-r from-ocean-cyan to-ocean-seafoam text-white border-none">
                  🎉 Maximum Tier Reached!
                </Badge>
              </div>
            )}
          </div>

          {/* Charity Note */}
          <div className="flex items-center gap-2 p-3 bg-charity-coral/10 rounded-lg border border-charity-coral/20">
            <p className="text-sm text-charity-coral">
              {charityFee.toFixed(4)}% of every swap goes to verified charitable causes ({(charityPortion * 100).toFixed(0)}% of total fee)
            </p>
          </div>
        </div>
        </div>
      </div>
      )}

      {/* Tier Info Card - Informational popup for all users */}
      {/* Mobile & Tablet backdrop */}
      {(isMobile || isTab) && showTierInfoCard && (
        <div
          className="fixed inset-0 z-40 backdrop-blur-sm"
          onClick={() => setShowTierInfoCard(false)}
        />
      )}
      {(
        <div
          className={
            (isMobile || isTab)
              ? `fixed inset-0 z-50 flex items-center justify-center p-3 transition-all duration-300 ${
                  showTierInfoCard
                    ? 'opacity-100 visible'
                    : 'opacity-0 invisible pointer-events-none'
                }`
              : `absolute top-0 left-[60%] h-full w-full max-w-md glass-card gradient-border transition-all duration-500 ease-in-out z-40 ${
                  showTierInfoCard
                    ? 'translate-x-0 opacity-100 visible'
                    : 'translate-x-[calc(100%+2rem)] opacity-0 invisible'
                }`
          }
          onClick={(e) => {
            e.stopPropagation();
            if (isMobile || isTab) setShowTierInfoCard(false);
          }}
        >
        {/* Card wrapper - has border/styling, no scroll */}
        <div
          className={
            (isMobile || isTab)
              ? 'w-[calc(100%-24px)] max-w-md max-h-[80vh] glass-card gradient-border mx-auto flex flex-col'
              : 'h-full flex flex-col'
          }
          onClick={(e) => e.stopPropagation()}
        >
          {/* Scrollable content area */}
          <div
            ref={tierInfoCardRef}
            className="p-6 space-y-4 relative flex-1 overflow-y-auto scrollbar-thin"
          >
          {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/30 -mt-6 pt-6 -mx-6 px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTierInfoCard(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-ocean-cyan/20 border border-ocean-cyan/30 hover:border-ocean-cyan/50 transition-colors cursor-pointer"
            >
              <span className="text-xs font-semibold text-ocean-cyan">Fee Discount Tiers</span>
            </button>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowTierInfoCard(false);
            }}
            className="p-1.5 rounded-md hover:bg-background/50 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>

        {/* Description */}
        <div className="bg-background/30 rounded-lg p-3 text-sm">
          <p className="text-muted-foreground">
            Hold <span className="text-ocean-cyan font-semibold">KNS tokens</span> in your wallet to unlock fee discounts. The more KNS you hold, the lower your trading fees!
          </p>
        </div>

        {/* All Tiers Table */}
        <div className="bg-background/50 rounded-lg border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm table-fixed min-w-[320px]">
            <colgroup>
              <col className="w-[33%]" />
              <col className="w-[22%]" />
              <col className="w-[22%]" />
              <col className="w-[23%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border/30 bg-background/30">
                <th className="text-left p-2 sm:p-3 text-muted-foreground font-medium">Tier</th>
                <th className="text-left p-2 sm:p-3 text-muted-foreground font-medium">KNS Required</th>
                <th className="text-right p-2 sm:p-3 text-muted-foreground font-medium">Discount</th>
                <th className="text-right p-2 sm:p-3 text-muted-foreground font-medium">Fee</th>
              </tr>
            </thead>
            <tbody>
              {displayTiers.map((tier, index) => {
                const isMaxTier = index === displayTiers.length - 1;

                return (
                  <tr
                    key={tier.name}
                    className="border-b border-border/20 last:border-0 hover:bg-ocean-cyan/5 transition-colors"
                  >
                    <td className="p-2 sm:p-3">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <span className="text-foreground whitespace-nowrap">{tier.name}</span>
                        {isMaxTier && (
                          <Badge variant="outline" className="text-[8px] sm:text-[10px] ml-0.5 sm:ml-1 py-0 px-1 h-3.5 sm:h-4 border-ocean-cyan/30 text-ocean-cyan">
                            Best
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-2 sm:p-3 text-muted-foreground whitespace-nowrap">{tier.kns}</td>
                    <td className="p-2 sm:p-3 text-right text-ocean-seafoam whitespace-nowrap">{tier.discount}</td>
                    <td className="p-2 sm:p-3 text-right font-semibold text-foreground whitespace-nowrap">{tier.fee}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>

        {/* Base Fee Info */}
        <div className="bg-background/30 rounded-lg p-3 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Base Fee (No KNS):</span>
            <span className="text-foreground font-medium">{(baseFee / 100).toFixed(2)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Maximum Discount:</span>
            <span className="text-ocean-seafoam font-medium">{displayTiers[displayTiers.length - 1]?.discount || '15%'}</span>
          </div>
        </div>

          {/* Charity Note */}
          <div className="flex items-center gap-2 p-3 bg-charity-coral/10 rounded-lg border border-charity-coral/20">
            <p className="text-sm text-charity-coral">
              {(charityPortion * 100).toFixed(0)}% of all fees go directly to verified charitable causes
            </p>
          </div>
          </div>
        </div>
      </div>
      )}

      {/* Slippage Settings Modal */}
      <SlippageModal
        isOpen={showSlippageModal}
        onClose={() => setShowSlippageModal(false)}
        mode={slippageMode}
        onModeChange={setSlippageMode}
        slippageValue={slippageValue}
        onSlippageChange={setSlippageValue}
        customSlippage={customSlippage}
        onCustomSlippageChange={setCustomSlippage}
      />

      {/* Routing Modal */}
      <RoutingModal
        isOpen={showRoutingModal}
        onClose={() => setShowRoutingModal(false)}
        inputToken={fromToken}
        outputToken={toToken}
        inputAmount={inputAmount}
        outputAmount={outputAmount}
        currentQuote={currentQuote}
        tokenList={tokenList}
      />

      {/* Token Selection Modal - Rendered at page level for proper z-index hierarchy */}
      <TokenDropdown
        isOpen={activeDropdown !== null}
        onClose={() => {
          setActiveDropdown(null);
          setTokenSearchQuery('');
          setSearchResults([]); // Clear search results on close
        }}
        onSelect={(selectedSymbol) => {
          console.log('🔵 Token selection:', selectedSymbol, 'for', activeDropdown);

          // Find the selected token in search results or token list
          console.log('🔍 Searching for token in searchResults and tokenList...', searchResults);
          const selectedToken = searchResults.find(t => t.symbol === selectedSymbol)
            || tokenList.find(t => t.symbol === selectedSymbol);

          console.log('🔍 Selected token object:', selectedToken);
          console.log('📋 Current tokenList length:', tokenList.length);
          console.log('🔎 Token already in list?', !!tokenList.find(t => t.symbol === selectedSymbol));

          // Store in recentTokensRef for immediate access (bypasses React state batching)
          if (selectedToken) {
            recentTokensRef.current.set(selectedSymbol.toUpperCase(), selectedToken);
            console.log('💾 Stored in recentTokensRef:', selectedSymbol, selectedToken);
          }

          // If token is found in search results but not in token list, add it to token list
          // This preserves the token's full information (mint address, decimals, isVerified)
          if (selectedToken && !tokenList.find(t => t.symbol === selectedSymbol)) {
            console.log('✅ Adding token to tokenList:', selectedToken);
            setTokenList(prev => [...prev, selectedToken]);
          } else if (!selectedToken) {
            console.warn('⚠️ Selected token not found in search results or token list!');
          }

          if (activeDropdown === 'from') {
            setFromToken(selectedSymbol);
          } else if (activeDropdown === 'to') {
            setToToken(selectedSymbol);
          }
          setActiveDropdown(null);
          setTokenSearchQuery('');
          setSearchResults([]); // Clear search results on selection
        }}
        searchQuery={tokenSearchQuery}
        onSearchChange={setTokenSearchQuery}
        tokenList={tokenList}
        searchResults={searchResults}
        isSearching={isSearching}
        excludeToken={activeDropdown === 'from' ? toToken : fromToken}
        modalRef={tokenDropdownModalRef}
        verifiedTokenMints={verifiedTokenMints}
        showVerifiedOnly={showVerifiedOnly}
        onToggleVerifiedOnly={() => setShowVerifiedOnly(!showVerifiedOnly)}
      />

      {/* Transaction Progress Modal */}
      <TransactionModal
        isOpen={showTransactionModal}
        status={swapStatus}
        txSignature={txSignature || undefined}
        onClose={handleCloseTransactionModal}
        onRetry={handleSwap}
      />
    </div>
  );
};

// ============================================
// PRICE TICKER CARDS COMPONENT
// ============================================
interface TokenPriceData {
  symbol: string;
  name: string;
  mint: string;
  price: number;
  priceChange24h: number;
  logo?: string;
}

const PriceTickerCards = () => {
  const [tokenPrices, setTokenPrices] = useState<TokenPriceData[]>([
    { symbol: 'KNS', name: 'KindSwap', mint: TOKEN_MINT_ADDRESSES.KNS, price: 0, priceChange24h: 0 },
    { symbol: 'SOL', name: 'Solana', mint: TOKEN_MINT_ADDRESSES.SOL, price: 0, priceChange24h: 0 },
  ]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch prices using CoinGecko API with key rotation support
  const fetchPrices = async () => {
    try {
      const prices: Record<string, { price: number; change24h: number }> = {};

      // Fetch SOL price with 24h change from CoinGecko
      const solData = await coinGeckoService.getSimplePrice('solana', 'usd', true, 30000);
      if (solData?.solana?.usd) {
        prices[TOKEN_MINT_ADDRESSES.SOL] = {
          price: solData.solana.usd,
          change24h: solData.solana.usd_24h_change || 0,
        };
      }

      // Fetch KNS price with 24h change from CoinGecko using contract address
      try {
        const knsData = await coinGeckoService.getTokenPrice(
          'solana',
          TOKEN_MINT_ADDRESSES.KNS,
          'usd',
          true,
          30000
        );
        const knsKey = TOKEN_MINT_ADDRESSES.KNS.toLowerCase();
        const knsTokenData = knsData?.[knsKey] || knsData?.[TOKEN_MINT_ADDRESSES.KNS];
        if (knsTokenData?.usd) {
          prices[TOKEN_MINT_ADDRESSES.KNS] = {
            price: knsTokenData.usd,
            change24h: knsTokenData.usd_24h_change || 0,
          };
        }
      } catch (knsErr) {
        console.warn('[PriceTickerCards] KNS price not available on CoinGecko');
        // Don't log to Sentry - KNS might not be listed on CoinGecko yet
      }

      console.log('[PriceTickerCards] CoinGecko prices:', prices);

      setTokenPrices(prev => prev.map(token => {
        const data = prices[token.mint];
        if (data) {
          return {
            ...token,
            price: data.price,
            priceChange24h: data.change24h,
          };
        }
        return token;
      }));
      setIsLoading(false);
    } catch (error) {
      console.error('[PriceTickerCards] Error fetching prices:', error);
      // Don't log to Sentry - CoinGecko already has retry logic and error handling
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    // Refresh prices every 30 seconds
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number) => {
    if (price === 0) return '$0.00';
    if (price < 0.00001) {
      // Format very small numbers with subscript notation
      const str = price.toFixed(10);
      const match = str.match(/^0\.(0+)(\d+)/);
      if (match) {
        const zeros = match[1].length;
        const digits = match[2].substring(0, 4);
        return `$0.0₍${zeros}₎${digits}`;
      }
    }
    if (price < 1) return `$${price.toFixed(6)}`;
    return `$${price.toFixed(2)}`;
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div className="flex gap-3 mt-4 justify-center">
      {tokenPrices.map((token) => (
        <div
          key={token.symbol}
          className="flex-1 max-w-[224px] h-16 bg-[#111827] rounded-lg border border-ocean-cyan overflow-hidden flex items-center px-2 gap-2"
        >
          {/* Token Logo */}
          <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center overflow-hidden flex-shrink-0">
            {token.symbol === 'KNS' ? (
              <img src="/Kindsoul-logo.JPEG" alt="KNS" className="w-8 h-8 rounded-full object-cover" />
            ) : token.symbol === 'SOL' ? (
              <img src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" alt="SOL" className="w-8 h-8 rounded-full object-cover" />
            ) : null}
          </div>

          {/* Token Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">{token.symbol}</span>
              <span className="text-sm text-white">
                {isLoading ? '...' : formatPrice(token.price)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-neutral-500">{truncateAddress(token.mint)}</span>
              <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${token.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {isLoading ? '...' : (
                  <>
                    {token.priceChange24h >= 0 ? (
                      <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M5 2L9 8H1L5 2Z" />
                      </svg>
                    ) : (
                      <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M5 8L1 2H9L5 8Z" />
                      </svg>
                    )}
                    {`${token.priceChange24h >= 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%`}
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================
// MAIN SWAP PAGE COMPONENT
// ============================================
export default function SwapPage() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();

  // Check if wallet is connected
  const isConnected = !!publicKey && connected;

  const handleConnect = () => {
    if (isMobileWithoutPhantom()) {
      localStorage.setItem("phantom_mobile_connect_intent", "1");
    }
    setVisible(true);
  };

  return (
    <div className="min-h-[90vh] bg-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-ocean-cyan/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-ocean-seafoam/10 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="relative z-10 min-h-[calc(100vh-6rem)] flex items-center justify-center pt-28 md:pb-0 mb-4 md:mb-12">
        <div className="container max-w-md mx-auto px-4 mb-16 md:mb-0">
          <SwapCard isConnected={isConnected} onConnect={handleConnect} />
          {/* Price Ticker Cards */}
          <PriceTickerCards />
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

          </div>
  );
}
