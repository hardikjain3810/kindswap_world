/**
 * Integrated SwapCard Component
 * Uses real Jupiter quotes, KNS fee discounts, and points system
 */

import { useState, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, Settings2, ChevronDown, Menu, Info } from "lucide-react";
import KindSwapLogo from "@/components/KindSwapLogo";
import { useSwap } from "@/hooks/useSwap";
import { formatFeeForDisplay } from "@/lib/business-logic/feeDiscountAndPoints";
import { TokenSelectorUpdated } from "@/components/TokenSelectorUpdated";
import { FeeDetailsModal } from "@/components/FeeDetailsModal";

const CHARITY_ADDRESS = "HKXmYs7ZatE1kFfDZuKWTTC9w1isti5bKAzmaj85CpJz";

export const SwapCardIntegrated = ({ knsBalance = 0 }: { knsBalance?: number }) => {
  const { publicKey } = useWallet();
  const [showFeeDetails, setShowFeeDetails] = useState(false);

  // Use the comprehensive swap hook
  const {
    inputs,
    setFromToken,
    setToToken,
    setInputAmount,
    outputAmount,
    loading,
    error,
    swapping,
    swapError,
    feeDiscount,
    swapUsdValue,
    outputUsdValue,
    pointsEarned,
    executeSwap,
    isReady,
    tokenList,
    quote,
    routeBreakdown,
  } = useSwap(knsBalance);


  // Handler for swap button
  const handleSwap = async () => {
    const result = await executeSwap();
    if (result) {
      // Show success toast or notification
      console.log("Swap successful:", result);
    }
  };

  // Determine button state
  const buttonState = useMemo(() => {
    if (!publicKey) {
      return { disabled: true, text: "Connect Wallet", loading: false };
    }
    if (!inputs.fromToken || !inputs.toToken) {
      return { disabled: true, text: "Select Tokens", loading: false };
    }
    if (!inputs.inputAmount || parseFloat(inputs.inputAmount) === 0) {
      return { disabled: true, text: "Enter Amount", loading: false };
    }
    if (parseFloat(inputs.inputAmount) < 5) {
      return { disabled: true, text: "Minimum $5", loading: false };
    }
    if (loading || swapping) {
      return { disabled: true, text: swapping ? "Swapping..." : "Loading...", loading: true };
    }
    return { disabled: false, text: "Swap", loading: false };
  }, [publicKey, inputs.fromToken, inputs.toToken, inputs.inputAmount, loading, swapping]);

  return (
    <div className="glass-card p-6 space-y-4 gradient-border">
      {/* Header with KindSwap Branding */}
      <div className="flex items-center justify-between pb-2 border-b border-border/30">
        <div className="flex items-center gap-2">
          <KindSwapLogo className="w-7 h-7" />
          <span className="font-bold text-foreground text-lg">KindSwap</span>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => window.open("https://phantom.app/", "_blank")}
                className="p-1.5 rounded-md hover:bg-ocean-cyan/10 transition-colors group"
                aria-label="Open External Wallet"
              >
                <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-ocean-cyan transition-colors" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Open External Wallet</p>
            </TooltipContent>
          </Tooltip>
          <Badge
            variant="outline"
            className="text-[10px] py-0 px-2 h-5 border-ocean-cyan/30 text-ocean-cyan bg-ocean-cyan/10"
          >
            DEX Aggregator
          </Badge>
        </div>
      </div>

      {/* Error Display */}
      {(error || swapError) && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="text-sm text-destructive">{error || swapError}</p>
        </div>
      )}

      {/* You Pay Section */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">You Pay</label>
        <div className="bg-background/50 rounded-xl p-4 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <input
              type="text"
              placeholder="0.00"
              value={inputs.inputAmount}
              onChange={e => setInputAmount(e.target.value)}
              className="bg-transparent text-2xl font-bold text-foreground w-full outline-none placeholder:text-muted-foreground/50"
            />
            {inputs.fromToken && <TokenSelectorUpdated token={inputs.fromToken} onSelect={setFromToken} tokenList={tokenList} />}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground whitespace-nowrap">≈ ${swapUsdValue.toFixed(2)}</span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Balance: -</span>
              <button className="text-ocean-cyan hover:text-ocean-light text-xs font-semibold transition-colors">Max</button>
            </div>
          </div>
        </div>
      </div>

      {/* Swap Direction Control */}
      <div className="flex justify-center -my-1">
        <button className="w-10 h-10 rounded-full bg-background/80 border border-border/50 flex items-center justify-center hover:border-ocean-cyan/50 hover:bg-ocean-cyan/10 transition-all group">
          {/* <ArrowUpDown className="w-4 h-4 text-muted-foreground group-hover:text-ocean-cyan transition-colors" /> */}
        </button>
      </div>

      {/* You Receive Section */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">You Receive</label>
        <div className="bg-background/50 rounded-xl p-4 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <input
              type="text"
              placeholder="0.00"
              value={outputAmount}
              className="bg-transparent text-2xl font-bold text-foreground w-full outline-none"
              readOnly
            />
            {inputs.toToken && <TokenSelectorUpdated token={inputs.toToken} onSelect={setToToken} tokenList={tokenList} />}
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground whitespace-nowrap">≈ ${outputUsdValue.toFixed(2)}</span>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-ocean-cyan/30 text-ocean-cyan">
                Estimated
              </Badge>
            </div>
            <span className="text-muted-foreground">Balance: -</span>
          </div>
        </div>
      </div>

      {/* Info Row */}
      <div className="space-y-2 pt-2">
        {/* Slippage Row */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Slippage</span>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-ocean-cyan/20 border border-ocean-cyan/30">
              <span className="text-xs font-semibold text-ocean-cyan">Auto</span>
              <span className="text-xs text-muted-foreground">({(inputs.slippageBps / 100).toFixed(2)}%)</span>
            </button>
            <button className="text-muted-foreground hover:text-ocean-cyan transition-colors">
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Best Route Box */}
        {routeBreakdown && (
          <div className="bg-background/50 rounded-lg p-3 border border-border/50">
            <button className="w-full flex items-center justify-between text-sm group">
              <span className="text-muted-foreground">Best Route</span>
              <Badge className="bg-gradient-to-r from-ocean-cyan/20 to-ocean-seafoam/20 text-ocean-cyan border border-ocean-cyan/30 hover:border-ocean-cyan/50 transition-colors px-2 py-0.5 bg-primary-foreground">
                <Menu className="w-3 h-3 mr-1" />
                {routeBreakdown.routes.length} Routes
              </Badge>
            </button>
          </div>
        )}

        {/* Fee Display */}
        <div className="bg-background/50 rounded-lg border border-border/50 overflow-hidden">
          <div className="p-3 flex items-center justify-between text-sm">
            <button
              onClick={() => setShowFeeDetails(true)}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-ocean-cyan/20 border border-ocean-cyan/30 hover:border-ocean-cyan/50 transition-colors"
            >
              <span className="text-xs font-semibold text-ocean-cyan">Your Fee</span>
              <ChevronDown className="w-3 h-3 text-ocean-cyan" />
            </button>
            <div className="flex flex-col items-end gap-0.5">
              <span className="font-semibold text-foreground">
                {formatFeeForDisplay(feeDiscount.effectiveFeeBps)}
                {feeDiscount.discountPercent > 0 ? " (KNS)" : ""}
              </span>
              <span className="text-[10px] text-charity-coral">(0.05% to charity)</span>
            </div>
          </div>
        </div>

        {/* Fee Details Modal */}
        <FeeDetailsModal
          isOpen={showFeeDetails}
          onClose={() => setShowFeeDetails(false)}
          feeDiscount={feeDiscount}
          knsBalance={knsBalance}
        />

        {/* Points Earned Display */}
        {swapUsdValue > 0 && (
          <div className="p-3 rounded-lg bg-ocean-cyan/10 border border-ocean-cyan/20">
            <p className="text-sm">
              <span className="text-foreground">Earn</span>{" "}
              <span className="font-bold text-ocean-cyan">+{pointsEarned} points</span>{" "}
              <span className="text-muted-foreground">from this swap</span>
            </p>
          </div>
        )}
      </div>

      {/* Primary CTA */}
      <Button
        variant="hero"
        size="xl"
        className="w-full mt-2"
        disabled={buttonState.disabled}
        onClick={handleSwap}
      >
        {buttonState.loading && <span className="animate-spin mr-2">⟳</span>}
        {buttonState.text}
      </Button>

      {/* Fee Tooltip Info */}
      <div className="text-xs text-muted-foreground text-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="inline-flex items-center gap-1 hover:text-ocean-cyan transition-colors">
              <Info className="w-3 h-3" />
              Fee discount based on KNS balance
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Your KindSwap platform fee may be reduced based on your KNS balance at swap time.</p>
            <p className="text-xs mt-1">DEX liquidity fees are unchanged.</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
