// INTEGRATED WITH JUPITER API AND FEE DISCOUNT LOGIC
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUpDown, Info, Wallet, Check, X, Loader2, ChevronDown, Sparkles, Zap, ExternalLink, ArrowRight, Settings2, Menu } from "lucide-react";
import KindSwapLogo from "@/components/KindSwapLogo";
import { useState, useEffect, useMemo } from "react";
import PinProtection from "@/components/PinProtection";
import Header from "@/components/Header";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSwap } from "@/hooks/useSwap";
import { TokenInfo } from "@/lib/api/jupiter";
import { formatFeeForDisplay, getTierLabel, calculateTierProgress, getAllFeeTiers } from "@/lib/business-logic/feeDiscountAndPoints";

// Tier data for KNS staking - correct tiers
const tiers = [{
  name: "No Tier",
  kns: "< 5,000",
  knsMin: 0,
  discount: "0%",
  fee: "0.10%"
}, {
  name: "Tier 1",
  kns: "≥ 5,000",
  knsMin: 5000,
  discount: "5%",
  fee: "0.095%"
}, {
  name: "Tier 2",
  kns: "≥ 25,000",
  knsMin: 25000,
  discount: "10%",
  fee: "0.09%"
}, {
  name: "Tier 3",
  kns: "≥ 100,000",
  knsMin: 100000,
  discount: "15%",
  fee: "0.085%"
}, {
  name: "Tier 4",
  kns: "≥ 500,000",
  knsMin: 500000,
  discount: "20%",
  fee: "0.08%"
}];
const SwapSpec = () => {
  // Add noindex meta tag to prevent search engine indexing
  useEffect(() => {
    const metaRobots = document.createElement('meta');
    metaRobots.name = 'robots';
    metaRobots.content = 'noindex, nofollow';
    document.head.appendChild(metaRobots);
    
    return () => {
      document.head.removeChild(metaRobots);
    };
  }, []);

  return (
    <PinProtection>
      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-ocean-cyan/10 blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-ocean-seafoam/10 blur-[100px]" />
          <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: "60px 60px"
        }} />
        </div>

        {/* Internal Label - Top Right */}
        {/* <div className="absolute top-4 right-4 z-50">
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
            Internal UI Spec – Not Public
          </Badge>
        </div> */}

        <div className="container mx-auto px-4 py-28 relative z-10">
          {/* Hero + Swap Card Section */}
          <div className="grid lg:grid-cols-2 gap-12 items-start mb-20">
            {/* Left - Context */}
            <div className="space-y-6 pt-8">
              <Badge variant="gradient" className="mb-4">
                <Zap className="w-3 h-3 mr-1" />
                DEX Aggregator
              </Badge>

              <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                <span className="text-foreground">Swap Tokens at the</span>
                <br />
                <span className="gradient-text">Best Rates</span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-md">
                This is the reference UI for the KindSwap swap interface. Developers should replicate this layout,
                spacing, labels, and states exactly.
              </p>

              {/* <div className="glass-card p-4 border border-ocean-cyan/20 max-w-md">
                <p className="text-sm text-muted-foreground">
                  <span className="text-ocean-cyan font-semibold">Note:</span> This page is UI/UX only. No real wallet
                  logic, no API calls, no blockchain execution. Everything shown is visual and illustrative only.
                </p>
              </div> */}
            </div>

            {/* Right - PRIMARY Swap Card */}
            <div className="w-full max-w-md mx-auto lg:mx-0">
              <SwapCard />
            </div>
          </div>

          {/* Button States Section */}
          <section className="mb-20">
            <h2 className="text-2xl font-bold mb-6 gradient-text">Button States</h2>
            <p className="text-muted-foreground mb-8">All CTA button states that must be implemented:</p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ButtonStateCard label="Default (Active)" description="User can execute swap">
                <Button variant="hero" size="lg" className="w-full">
                  Swap
                </Button>
              </ButtonStateCard>

              <ButtonStateCard label="Not Connected" description="Wallet not connected">
                <Button variant="glass" size="lg" className="w-full opacity-80" disabled>
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet
                </Button>
              </ButtonStateCard>

              <ButtonStateCard label="No Amount" description="Amount field is empty">
                <Button variant="outline" size="lg" className="w-full opacity-50" disabled>
                  Enter Amount
                </Button>
              </ButtonStateCard>

              <ButtonStateCard label="Insufficient Balance" description="User lacks funds">
                <Button variant="outline" size="lg" className="w-full text-destructive border-destructive/30 opacity-70" disabled>
                  Insufficient Balance
                </Button>
              </ButtonStateCard>
            </div>
          </section>

          {/* Route Visualization Section */}
          <section className="mb-20">
            <h2 className="text-2xl font-bold mb-6 gradient-text">Route Visualization</h2>
            <p className="text-muted-foreground mb-8">Clickable route display showing DEX splits and token flow:</p>

            <div className="max-w-md mx-auto">
              <RouteVisualizationCard />
            </div>
          </section>

          {/* Fee Display Card Section */}
          <section className="mb-20">
            <h2 className="text-2xl font-bold mb-6 gradient-text">Fee Display Card</h2>
            <p className="text-muted-foreground mb-8">UI showing discounted fees for KNS holders:</p>

            <div className="max-w-md mx-auto">
              <FeeDisplayCard />
            </div>
          </section>

          {/* Transaction States */}
          <section className="mb-20">
            <h2 className="text-2xl font-bold mb-6 gradient-text">Transaction States</h2>
            <p className="text-muted-foreground mb-8">Visual feedback during and after transaction:</p>

            <div className="grid sm:grid-cols-3 gap-6">
              <TransactionStateCard type="pending" title="Transaction Pending..." subtitle="Waiting for confirmation" />
              <TransactionStateCard type="success" title="Swap Successful!" subtitle="View on Explorer" />
              <TransactionStateCard type="failed" title="Transaction Failed" subtitle="Try Again" />
            </div>
          </section>

          {/* Developer Implementation Notes */}
          <section className="mb-20">
            <div className="glass-card p-8 border-2 border-ocean-cyan/30 bg-ocean-deep/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-ocean-cyan/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-ocean-cyan" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Developer Implementation Notes</h2>
              </div>

              <div className="space-y-4 text-muted-foreground">
                <p className="text-lg">
                  This page is the <span className="text-ocean-cyan font-semibold">single source of truth</span> for the
                  KindSwap swap UI.
                </p>
                <p>
                  All spacing, labels, hierarchy, and states must be implemented exactly. Any deviation requires explicit
                  approval.
                </p>

                <div className="grid md:grid-cols-2 gap-4 mt-6">
                  <div className="p-4 rounded-lg bg-background/50 border border-border/50">
                    <h4 className="font-semibold text-foreground mb-2">Must Match</h4>
                    <ul className="text-sm space-y-1">
                      <li>• Card dimensions & padding</li>
                      <li>• Typography hierarchy</li>
                      <li>• Color tokens & gradients</li>
                      <li>• Icon sizes & placement</li>
                      <li>• Button states & transitions</li>
                    </ul>
                  </div>
                  <div className="p-4 rounded-lg bg-background/50 border border-border/50">
                    <h4 className="font-semibold text-foreground mb-2">Not Included Here</h4>
                    <ul className="text-sm space-y-1">
                      <li>• Wallet connection logic</li>
                      <li>• Real price fetching</li>
                      <li>• Blockchain interactions</li>
                      <li>• Token list API</li>
                      <li>• Route optimization</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Limit Order Card Section */}
          <section className="mb-20">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl font-bold gradient-text">Limit Order Card</h2>
              <Badge variant="outline" className="border-yellow-500/30 text-yellow-500 bg-yellow-500/10">
                Coming Later
              </Badge>
            </div>
            <p className="text-muted-foreground mb-8 max-w-2xl">
              This UI will be developed in a later phase. Developers should reference this specification when building the
              limit order functionality.
            </p>

            <div className="grid lg:grid-cols-2 gap-12 items-start">
              {/* Left - Context */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-4">Key Features</h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-ocean-cyan" />
                      Set custom trigger prices
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-ocean-cyan" />
                      Percentage-based price targets (-10%, -20%)
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-ocean-cyan" />
                      Take Profit / Stop Loss options
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-ocean-cyan" />
                      Configurable expiry (7 days, 30 days, etc.)
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-ocean-cyan" />
                      Auto slippage management
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-ocean-cyan" />
                      Vault activation for order execution
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-4">Implementation Notes</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Tab bar switches between Market, Limit, and Recurring</li>
                    <li>• Price input shows market comparison percentage</li>
                    <li>• Collapsible summary panel at bottom</li>
                    <li>• Vault must be activated before first limit order</li>
                  </ul>
                </div>
              </div>

              {/* Right - Limit Order Card */}
              <div className="w-full max-w-md mx-auto lg:mx-0">
                <LimitOrderCard />
              </div>
            </div>
          </section>
        </div>
      </div>
    </PinProtection>
  );
};

/* ============================================
   SWAP CARD COMPONENT
   ============================================ */
const SwapCard = () => {
  const [showFeeDetails, setShowFeeDetails] = useState(false);
  return <div className="glass-card p-6 space-y-4 gradient-border">
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
                onClick={() => window.open('https://phantom.app/', '_blank')}
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
          <Badge variant="outline" className="text-[10px] py-0 px-2 h-5 border-ocean-cyan/30 text-ocean-cyan bg-ocean-cyan/10">
            DEX Aggregator
          </Badge>
        </div>
      </div>

      {/* You Pay Section */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">You Pay</label>
        <div className="bg-background/50 rounded-xl p-4 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <input type="text" placeholder="0.00" defaultValue="1.5" className="bg-transparent text-2xl font-bold text-foreground w-full outline-none placeholder:text-muted-foreground/50" readOnly />
            <TokenSelector symbol="SOL" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">≈ $225.00</span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Balance: 42.5</span>
              <button className="text-ocean-cyan hover:text-ocean-light text-xs font-semibold transition-colors">
                Max
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Swap Direction Control */}
      <div className="flex justify-center -my-1">
        <button className="w-10 h-10 rounded-full bg-background/80 border border-border/50 flex items-center justify-center hover:border-ocean-cyan/50 hover:bg-ocean-cyan/10 transition-all group">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground group-hover:text-ocean-cyan transition-colors" />
        </button>
      </div>

      {/* You Receive Section */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">You Receive</label>
        <div className="bg-background/50 rounded-xl p-4 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <input type="text" placeholder="0.00" defaultValue="223.45" className="bg-transparent text-2xl font-bold text-foreground w-full outline-none" readOnly />
            <TokenSelector symbol="USDC" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">≈ $223.45</span>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-ocean-cyan/30 text-ocean-cyan">
                Estimated
              </Badge>
            </div>
            <span className="text-muted-foreground">Balance: 1,250</span>
          </div>
        </div>
      </div>

      {/* Info Row */}
      <div className="space-y-2 pt-2">
        {/* Slippage Row with Auto Toggle */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Slippage</span>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-ocean-cyan/20 border border-ocean-cyan/30">
              <span className="text-xs font-semibold text-ocean-cyan">Auto</span>
              <span className="text-xs text-muted-foreground">(0.5%)</span>
            </button>
            <button className="text-muted-foreground hover:text-ocean-cyan transition-colors">
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Best Route Box - Clickable like Slippage */}
        <div className="bg-background/50 rounded-lg p-3 border border-border/50">
          <button className="w-full flex items-center justify-between text-sm group">
            <span className="text-muted-foreground">Best Route</span>
            <Badge className="bg-gradient-to-r from-ocean-cyan/20 to-ocean-seafoam/20 text-ocean-cyan border border-ocean-cyan/30 hover:border-ocean-cyan/50 transition-colors px-2 py-0.5 bg-primary-foreground">
              <Menu className="w-3 h-3 mr-1" />2 Routes+3 Markets
            </Badge>
          </button>
        </div>

        {/* Clickable Fee Display */}
        <div className="bg-background/50 rounded-lg border border-border/50 overflow-hidden">
          <div className="p-3 flex items-center justify-between text-sm">
              <button onClick={() => setShowFeeDetails(!showFeeDetails)} className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-ocean-cyan/20 border border-ocean-cyan/30 hover:border-ocean-cyan/50 transition-colors">
                <span className="text-xs font-semibold text-ocean-cyan">Your Fee</span>
              </button>
            <div className="flex flex-col items-end gap-0.5">
              <span className="font-semibold text-foreground">0.085%</span>
              <span className="text-[10px] text-charity-coral text-secondary">(0.05% to charity)</span>
            </div>
          </div>

          {/* Expanded Fee Details */}
          {showFeeDetails && <div className="border-t border-border/50 p-3 space-y-3">
              {/* Current Tier Badge */}
              <div className="flex items-center justify-between">
                <Badge className="bg-ocean-seafoam/20 text-ocean-seafoam border border-ocean-seafoam/30">
                  Tier 3 KNS Holder
                </Badge>
                <span className="text-xs text-muted-foreground">150,000 KNS staked</span>
              </div>

              {/* Tier Table */}
              <div className="bg-background/30 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left p-2 text-muted-foreground font-medium">Tier</th>
                      <th className="text-left p-2 text-muted-foreground font-medium">KNS Balance</th>
                      <th className="text-right p-2 text-muted-foreground font-medium">Discount</th>
                      <th className="text-right p-2 text-muted-foreground font-medium">Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map(tier => <tr key={tier.name} className={`border-b border-border/20 last:border-0 ${tier.name === "Tier 3" ? "bg-ocean-cyan/10" : ""}`}>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            {tier.name === "Tier 3" && <div className="w-1.5 h-1.5 rounded-full bg-ocean-cyan" />}
                            <span className={tier.name === "Tier 3" ? "text-ocean-cyan font-medium" : "text-foreground"}>
                              {tier.name}
                            </span>
                          </div>
                        </td>
                        <td className="p-2 text-muted-foreground">{tier.kns}</td>
                        <td className="p-2 text-right text-ocean-seafoam">{tier.discount}</td>
                        <td className="p-2 text-right font-medium text-foreground">{tier.fee}</td>
                      </tr>)}
                  </tbody>
                </table>
              </div>

              {/* Progress to Next Tier */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progress to Tier 4</span>
                  <span className="text-foreground">150,000 / 500,000 KNS</span>
                </div>
                <div className="h-1.5 bg-background rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-ocean-cyan to-ocean-seafoam rounded-full" style={{
                width: "30%"
              }} />
                </div>
                <p className="text-xs text-muted-foreground">350,000 more KNS to reach Tier 4 (0.08% fee)</p>
              </div>
            </div>}
        </div>
      </div>

      {/* Primary CTA */}
      <Button variant="hero" size="xl" className="w-full mt-2">
        Swap
      </Button>
    </div>;
};

/* ============================================
   LIMIT ORDER CARD COMPONENT
   ============================================ */
const LimitOrderCard = () => {
  return <div className="glass-card p-6 space-y-4 gradient-border">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 p-1 bg-background/50 rounded-lg border border-border/50">
        <button className="flex-1 py-2 px-3 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md">
          Market
        </button>
        <button className="flex-1 py-2 px-3 text-sm font-semibold text-foreground bg-ocean-cyan/20 rounded-md flex items-center justify-center gap-1.5">
          Limit
          <Badge variant="outline" className="text-[9px] py-0 px-1 h-4 border-ocean-cyan/50 text-ocean-cyan">
            V2
          </Badge>
        </button>
        <button className="flex-1 py-2 px-3 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md">
          Recurring
        </button>
      </div>

      {/* I Want to Allocate Section */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">I Want to Allocate</label>
        <div className="bg-background/50 rounded-xl p-4 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <input type="text" placeholder="0.00" defaultValue="0.5" className="bg-transparent text-2xl font-bold text-foreground w-full outline-none placeholder:text-muted-foreground/50" readOnly />
            <TokenSelector symbol="SOL" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">≈ $75.00</span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Balance: 42.5</span>
              <button className="text-ocean-cyan hover:text-ocean-light text-xs font-semibold transition-colors">
                HALF
              </button>
              <button className="text-ocean-cyan hover:text-ocean-light text-xs font-semibold transition-colors">
                MAX
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* To Buy Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-muted-foreground">To Buy</label>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-yellow-500/30 text-yellow-500">
            2 Warnings
          </Badge>
        </div>
        <div className="bg-background/50 rounded-xl p-4 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <input type="text" placeholder="0.00" defaultValue="2,806.12" className="bg-transparent text-2xl font-bold text-foreground w-full outline-none" readOnly />
            <TokenSelector symbol="KNS" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Est. Received</span>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-ocean-cyan/30 text-ocean-cyan">
                ~$74.85
              </Badge>
            </div>
            <span className="text-muted-foreground">Balance: 15,420</span>
          </div>
        </div>
      </div>

      {/* Price Configuration */}
      <div className="space-y-3 bg-background/30 rounded-xl p-4 border border-border/50">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Buy Below when KNS</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Market</span>
            <span className="text-xs text-ocean-cyan">$0.0₅1979</span>
          </div>
        </div>

        {/* Price Input */}
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-background/50 rounded-lg p-3 border border-border/50">
            <input type="text" defaultValue="$0.0₅17811" className="bg-transparent text-lg font-bold text-foreground w-full outline-none" readOnly />
          </div>
          <Badge variant="outline" className="text-[10px] py-1 px-2 border-ocean-seafoam/30 text-ocean-seafoam">
            -10%
          </Badge>
        </div>

        {/* Quick Percentage Buttons */}
        <div className="flex items-center gap-2">
          <button className="flex-1 py-1.5 text-xs text-muted-foreground bg-background/50 rounded-lg border border-border/50 hover:border-ocean-cyan/30 hover:text-ocean-cyan transition-colors">
            -10%
          </button>
          <button className="flex-1 py-1.5 text-xs text-muted-foreground bg-background/50 rounded-lg border border-border/50 hover:border-ocean-cyan/30 hover:text-ocean-cyan transition-colors">
            -20%
          </button>
          <button className="flex-1 py-1.5 text-xs text-muted-foreground bg-background/50 rounded-lg border border-border/50 hover:border-ocean-cyan/30 hover:text-ocean-cyan transition-colors">
            -30%
          </button>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Slippage:</span>
            <span className="text-ocean-cyan">Auto</span>
          </div>
        </div>
      </div>

      {/* TP/SL Options */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <div className="w-4 h-4 rounded border border-border/50 bg-background/50" />
          <span className="text-sm text-muted-foreground">Add TP</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <div className="w-4 h-4 rounded border border-border/50 bg-background/50" />
          <span className="text-sm text-muted-foreground">Add SL</span>
        </label>
      </div>

      {/* Expiry Selector */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Expiry</span>
        <button className="flex items-center gap-2 bg-background/50 rounded-lg px-3 py-1.5 border border-border/50 hover:border-ocean-cyan/30 transition-colors">
          <span className="text-sm text-foreground">7 Days</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Order Summary Text */}
      <div className="bg-ocean-deep/30 rounded-lg p-3 border border-ocean-cyan/10 space-y-1">
        <p className="text-sm text-foreground">
          Buy <span className="text-ocean-cyan font-semibold">KNS</span> with{" "}
          <span className="font-semibold">0.5 SOL</span> when price goes below{" "}
          <span className="text-ocean-seafoam font-semibold">$0.0₅17811</span> (-10% from market)
        </p>
        <p className="text-xs text-muted-foreground">
          Your set slippage applies. KNS returned may differ from estimates.
        </p>
      </div>

      {/* Primary CTA */}
      <Button variant="hero" size="xl" className="w-full">
        Activate Vault
      </Button>

      {/* Help Link */}
      <div className="flex justify-center">
        <button className="flex items-center gap-1 text-xs text-ocean-cyan hover:text-ocean-light transition-colors">
          <Info className="w-3 h-3" />
          What is a Vault?
        </button>
      </div>

      {/* Collapsible Limit Summary */}
      <div className="bg-background/30 rounded-lg border border-border/50">
        <button className="w-full flex items-center justify-between p-3">
          <span className="text-sm font-medium text-foreground">Limit Summary</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Trigger Price (KNS)</span>
            <span className="text-foreground">$0.0₅17811</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">You Sell</span>
            <span className="text-foreground">0.5 SOL</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">To Buy (est.)</span>
            <span className="text-foreground">~2,806 KNS</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Expiry</span>
            <span className="text-foreground">7 Days</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Platform Fee</span>
            <div className="flex items-center gap-2">
              <span className="text-foreground">0.1%</span>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-ocean-seafoam/30 text-ocean-seafoam">
                0.05% to charity
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>;
};

/* ============================================
   TOKEN SELECTOR MODAL COMPONENT
   ============================================ */
interface Token {
  symbol: string;
  name: string;
  color: string;
  icon: string;
}

const TOKENS: Token[] = [
  { symbol: "DAI", name: "DAI", color: "bg-yellow-500", icon: "🟡" },
  { symbol: "ETH", name: "ETH", color: "bg-blue-600", icon: "◉" },
  { symbol: "USDC", name: "USDC", color: "bg-blue-500", icon: "🔵" },
  { symbol: "USDT", name: "USDT", color: "bg-green-600", icon: "💚" },
  { symbol: "CROTCH", name: "CROTCH", color: "bg-green-500", icon: "🟢" },
  { symbol: "WBTC", name: "WBTC", color: "bg-orange-500", icon: "⚪" },
  { symbol: "JPY", name: "JPY Coin", color: "bg-yellow-400", icon: "🟡" },
  { symbol: "JPY_V1", name: "JPY Coin v1", color: "bg-purple-600", icon: "🟣" },
  { symbol: "XSGD", name: "XSGD", color: "bg-blue-400", icon: "🔷" },
  { symbol: "PEPE", name: "Pepe 2nd Chance", color: "bg-green-400", icon: "🟢" },
  { symbol: "BRETT", name: "Brett ETH", color: "bg-yellow-600", icon: "⚡" }
];

const POPULAR_TOKENS = ["DAI", "ETH", "USDC", "USDT", "CROTCH", "WBTC", "ETH"];

const TokenSelectorModal = ({
  isOpen,
  onClose,
  onSelect
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTokens = TOKENS.filter(
    token =>
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm z-50">
        <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/30">
            <h2 className="text-lg font-bold text-foreground">Select a Token</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-background/50 rounded-md transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search name or paste Address"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-ocean-cyan/50 transition-colors"
            />

            {/* Popular Tokens - Quick Select */}
            {!searchQuery && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {POPULAR_TOKENS.map((symbol) => {
                    const token = TOKENS.find(t => t.symbol === symbol);
                    return token ? (
                      <button
                        key={symbol}
                        onClick={() => {
                          onSelect(token);
                          onClose();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-background/50 border border-border/50 rounded-lg hover:border-ocean-cyan/50 hover:bg-ocean-cyan/5 transition-all text-sm"
                      >
                        <div className={`w-5 h-5 rounded-full ${token.color} flex items-center justify-center text-xs`}>
                          {token.icon}
                        </div>
                        <span className="text-foreground font-medium">{token.symbol}</span>
                      </button>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Token List */}
            <div className="space-y-1">
              {filteredTokens.length > 0 ? (
                filteredTokens.map((token) => (
                  <button
                    key={token.symbol}
                    onClick={() => {
                      onSelect(token);
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-ocean-cyan/10 transition-colors text-left group"
                  >
                    <div className={`w-8 h-8 rounded-full ${token.color} flex items-center justify-center flex-shrink-0 text-lg`}>
                      {token.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{token.name}</p>
                      <p className="text-xs text-muted-foreground">{token.symbol}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No tokens found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

/* ============================================
   TOKEN SELECTOR COMPONENT
   ============================================ */
const TokenSelector = ({
  symbol
}: {
  symbol: string;
}) => {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [selectedToken, setSelectedToken] = useState(symbol);

  const tokenColors: Record<string, string> = {
    SOL: "bg-gradient-to-br from-[#9945FF] to-[#14F195]",
    USDC: "bg-gradient-to-br from-[#2775CA] to-[#2775CA]",
    KNS: "bg-gradient-to-br from-ocean-cyan to-ocean-seafoam"
  };

  const handleTokenSelect = (token: Token) => {
    setSelectedToken(token.symbol);
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 bg-background/80 hover:bg-background rounded-lg px-3 py-2 border border-border/50 hover:border-ocean-cyan/30 transition-all"
      >
        <div className={`w-6 h-6 rounded-full ${tokenColors[selectedToken] || "bg-muted"} flex items-center justify-center`}>
          <span className="text-[10px] font-bold text-white">{selectedToken[0]}</span>
        </div>
        <span className="font-semibold text-foreground">{selectedToken}</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>

      <TokenSelectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleTokenSelect}
      />
    </>
  );
};

/* ============================================
   INFO ROW COMPONENT
   ============================================ */
const InfoRow = ({
  label,
  value
}: {
  label: string;
  value: string;
}) => <div className="flex items-center justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground">{value}</span>
  </div>;

/* ============================================
   BUTTON STATE CARD COMPONENT
   ============================================ */
const ButtonStateCard = ({
  label,
  description,
  children
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) => <div className="glass-card p-4 space-y-3">
    <div>
      <h4 className="font-semibold text-foreground text-sm">{label}</h4>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    {children}
  </div>;

/* ============================================
   ROUTE VISUALIZATION CARD COMPONENT
   ============================================ */
const RouteVisualizationCard = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  return <div className="glass-card p-6 space-y-4 gradient-border">
      {/* Clickable Best Route Box */}
      <div className="bg-background/50 rounded-lg p-3 border border-border/50">
        <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex items-center justify-between text-sm group">
          <span className="text-muted-foreground">Best Route</span>
          <Badge className="bg-gradient-to-r from-ocean-cyan/20 to-ocean-seafoam/20 text-ocean-cyan border border-ocean-cyan/30 hover:border-ocean-cyan/50 transition-colors px-2 py-0.5">
            <Menu className="w-3 h-3 mr-1" />2 Routes+3 Markets
          </Badge>
        </button>
      </div>

      {/* Expanded Route Visualization */}
      {isExpanded && <div className="bg-ocean-deep/40 rounded-lg p-4 border border-ocean-cyan/20 space-y-4 shadow-[0_0_20px_hsl(185_80%_55%/0.1)]">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Routing</span>
            <button onClick={() => setIsExpanded(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Visual Route Flow */}
          <div className="relative py-6">
            {/* Token Pills */}
            <div className="flex items-center justify-between">
              {/* Source Token */}
              <div className="flex items-center gap-2 bg-ocean-deep/60 rounded-lg px-3 py-2 border border-ocean-cyan/30">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#2775CA] to-[#2775CA] flex items-center justify-center">
                  <span className="text-[8px] font-bold text-white">U</span>
                </div>
                <span className="text-sm font-medium text-foreground">100 USDC</span>
              </div>

              {/* Destination Token */}
              <div className="flex items-center gap-2 bg-ocean-deep/60 rounded-lg px-3 py-2 border border-ocean-cyan/30">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
                  <span className="text-[8px] font-bold text-white">S</span>
                </div>
                <span className="text-sm font-medium text-foreground">0.82 SOL</span>
              </div>
            </div>

            {/* Curved Path SVG */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
              {/* Main curved path */}
              <path d="M 100 50 Q 180 20, 260 50" stroke="hsl(185 80% 55%)" strokeWidth="2" fill="none" strokeDasharray="4 2" />
              {/* Secondary path */}
              <path d="M 100 50 Q 180 80, 260 50" stroke="hsl(165 70% 45%)" strokeWidth="2" fill="none" strokeDasharray="4 2" opacity="0.6" />
            </svg>

            {/* 100% Badge on Path */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <Badge className="bg-ocean-cyan/20 text-ocean-cyan border border-ocean-cyan/30 text-[10px] px-2 py-0.5">
                100%
              </Badge>
            </div>
          </div>

          {/* DEX Breakdown */}
          <div className="flex items-start gap-3 pt-2 border-t border-ocean-cyan/10">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center flex-shrink-0">
              <span className="text-[8px] font-bold text-white">S</span>
            </div>
            <div className="space-y-0.5 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-ocean-cyan font-medium">1%</span>
                <span className="text-muted-foreground">TesseraV</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-ocean-cyan font-medium">32%</span>
                <span className="text-muted-foreground">GoonFi</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-ocean-cyan font-medium">67%</span>
                <span className="text-muted-foreground">GoonFi</span>
              </div>
            </div>
          </div>
        </div>}
    </div>;
};

/* ============================================
   FEE DISPLAY CARD COMPONENT
   ============================================ */
const FeeDisplayCard = () => {
  return <div className="glass-card p-6 space-y-4 gradient-border">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Clickable "Your Fee" pill button - matches SwapCard styling */}
          <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-ocean-cyan/20 border border-ocean-cyan/30 hover:border-ocean-cyan/50 transition-colors cursor-pointer">
            <span className="text-sm font-semibold text-ocean-cyan">Your Fee</span>
          </button>
          <span className="text-xs text-muted-foreground">← Clickable, expands fee tier card</span>
        </div>
        <Badge className="bg-ocean-seafoam/20 text-ocean-seafoam border border-ocean-seafoam/30">
          Tier 3 KNS Holder
        </Badge>
      </div>

      {/* Fee Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold gradient-text">0.085%</span>
          <span className="text-sm text-muted-foreground line-through">0.10%</span>
        </div>
        <div className="text-right">
          <p className="text-sm text-ocean-seafoam font-medium">15% Discount Applied</p>
          <p className="text-xs text-muted-foreground"> 0.05% to charity</p>
        </div>
      </div>

      {/* All Tiers Table */}
      <div className="bg-background/50 rounded-lg overflow-hidden border border-border/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30 bg-background/30">
              <th className="text-left p-3 text-muted-foreground font-medium">Tier</th>
              <th className="text-left p-3 text-muted-foreground font-medium">KNS Balance</th>
              <th className="text-right p-3 text-muted-foreground font-medium">Discount</th>
              <th className="text-right p-3 text-muted-foreground font-medium">Effective Fee</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map(tier => <tr key={tier.name} className={`border-b border-border/20 last:border-0 ${tier.name === "Tier 3" ? "bg-ocean-cyan/10" : ""}`}>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {tier.name === "Tier 3" && <div className="w-2 h-2 rounded-full bg-ocean-cyan animate-pulse" />}
                    <span className={tier.name === "Tier 3" ? "text-ocean-cyan font-semibold" : "text-foreground"}>
                      {tier.name}
                    </span>
                    {tier.name === "Tier 4" && <Badge variant="outline" className="text-[10px] ml-1 py-0 px-1 h-4">
                        Max
                      </Badge>}
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">{tier.kns}</td>
                <td className="p-3 text-right text-ocean-seafoam">{tier.discount}</td>
                <td className="p-3 text-right font-semibold text-foreground">{tier.fee}</td>
              </tr>)}
          </tbody>
        </table>
      </div>

      {/* Current User Stats & Progress */}
      <div className="bg-background/50 rounded-lg p-4 border border-border/50 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Your KNS Balance</span>
          <span className="text-foreground font-semibold">150,000 KNS</span>
        </div>
        <div className="h-2 bg-background rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-ocean-cyan to-ocean-seafoam rounded-full" style={{
          width: "30%"
        }} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress to Tier 4</span>
          <span className="text-foreground">150,000 / 500,000 KNS</span>
        </div>
        <p className="text-xs text-ocean-cyan">350,000 more KNS to reach Tier 4 (0.08% fee)</p>
      </div>

      {/* Charity Note */}
      <div className="flex items-center gap-2 p-3 bg-charity-coral/10 rounded-lg border border-charity-coral/20">
        <span className="text-lg"></span>
        <p className="text-sm text-charity-coral">  0.05% of every swap goes to verified charitable causes</p>
      </div>
    </div>;
};

/* ============================================
   TRANSACTION STATE CARD COMPONENT
   ============================================ */
const TransactionStateCard = ({
  type,
  title,
  subtitle
}: {
  type: "pending" | "success" | "failed";
  title: string;
  subtitle: string;
}) => {
  const configs = {
    pending: {
      icon: <Loader2 className="w-8 h-8 text-ocean-cyan animate-spin" />,
      borderColor: "border-ocean-cyan/30",
      bg: "bg-ocean-cyan/5"
    },
    success: {
      icon: <Check className="w-8 h-8 text-ocean-seafoam" />,
      borderColor: "border-ocean-seafoam/30",
      bg: "bg-ocean-seafoam/5"
    },
    failed: {
      icon: <X className="w-8 h-8 text-destructive" />,
      borderColor: "border-destructive/30",
      bg: "bg-destructive/5"
    }
  };
  const config = configs[type];
  return <div className={`glass-card p-6 text-center space-y-4 border ${config.borderColor} ${config.bg}`}>
      <div className="w-16 h-16 rounded-full bg-background/50 mx-auto flex items-center justify-center">
        {config.icon}
      </div>
      <div>
        <h4 className="font-bold text-foreground">{title}</h4>
        {type === "success" ? <button className="text-sm text-ocean-cyan hover:text-ocean-light flex items-center gap-1 mx-auto mt-1 transition-colors">
            {subtitle}
            <ExternalLink className="w-3 h-3" />
          </button> : type === "failed" ? <Button variant="outline" size="sm" className="mt-2">
            {subtitle}
          </Button> : <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>;
};
export default SwapSpec;