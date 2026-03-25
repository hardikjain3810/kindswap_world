import { Link } from "react-router-dom";
import {
  ArrowUpDown,
  TrendingUp,
  Wallet,
  LineChart,
  PieChart,
  ArrowLeft,
  Zap,
  Clock,
  RefreshCw,
  Shield,
  Percent,
  Target,
  Users,
  BarChart3,
  Heart,
} from "lucide-react";
import Header from "../components/Header";
const ExamplePreviewBadge = () => (
  <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 backdrop-blur-sm">
    <span className="text-xs font-medium text-primary">Example Preview</span>
  </div>
);
const WhatToExpect = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden pt-20">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-ocean-cyan/20 blur-[120px] animate-float" />
          <div
            className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-ocean-seafoam/20 blur-[100px] animate-float"
            style={{
              animationDelay: "-3s",
            }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-ocean-deep/30 blur-[150px]" />

          {/* Grid Pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight animate-fade-in">
              <span className="gradient-text">What to Expect</span>
            </h1>

            <p
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in"
              style={{
                animationDelay: "0.2s",
              }}
            >
              A glimpse into the future of charitable DeFi on Solana. Every feature designed to maximize your trading
              potential while funding real-world impact.
            </p>
          </div>
        </div>
      </section>

      {/* Section 1: Token Swap / DEX Aggregator */}
      <section className="py-20 md:py-32 relative">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
                <ArrowUpDown className="w-4 h-4" />
                DEX Aggregator
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
                Swap Tokens at the <span className="gradient-text">Best Rates</span>
              </h2>
              <p className="text-muted-foreground mb-8 text-lg">
                Our intelligent routing engine scans all major Solana DEXs to find you the optimal swap path, saving you
                money on every trade while directing fees to charitable causes.
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="glass-card p-4 text-center">
                  <Zap className="w-6 h-6 text-primary mx-auto mb-2" />
                  <span className="text-sm font-medium text-foreground">Market Orders</span>
                </div>
                <div className="glass-card p-4 text-center">
                  <Clock className="w-6 h-6 text-ocean-seafoam mx-auto mb-2" />
                  <span className="text-sm font-medium text-foreground">Limit Orders</span>
                </div>
                <div className="glass-card p-4 text-center">
                  <RefreshCw className="w-6 h-6 text-ocean-light mx-auto mb-2" />
                  <span className="text-sm font-medium text-foreground">DCA</span>
                </div>
              </div>
            </div>

            {/* Swap UI Mockup */}
            <div
              className="order-1 lg:order-2 animate-fade-in"
              style={{
                animationDelay: "0.2s",
              }}
            >
              <div className="glass-card p-6 relative">
                <ExamplePreviewBadge />

                <div className="space-y-4 pt-6">
                  {/* From Token */}
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-muted-foreground">You're selling</span>
                      <span className="text-sm text-muted-foreground">Balance: 42.5</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value="10.0"
                        readOnly
                        className="bg-transparent text-3xl font-bold text-foreground w-1/2 outline-none"
                      />
                      <div className="flex items-center gap-2 bg-card px-3 py-2 rounded-lg">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-blue-500" />
                        <span className="font-semibold text-foreground">SOL</span>
                      </div>
                    </div>
                  </div>

                  {/* Swap Arrow */}
                  <div className="flex justify-center">
                    <div className="p-2 rounded-full bg-primary/20 border border-primary/30">
                      <ArrowUpDown className="w-5 h-5 text-primary" />
                    </div>
                  </div>

                  {/* To Token */}
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-muted-foreground">You're buying</span>
                      <span className="text-sm text-muted-foreground">Balance: 1,250</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value="2,450.00"
                        readOnly
                        className="bg-transparent text-3xl font-bold text-foreground w-1/2 outline-none"
                      />
                      <div className="flex items-center gap-2 bg-card px-3 py-2 rounded-lg">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-green-400 to-blue-500" />
                        <span className="font-semibold text-foreground">USDC</span>
                      </div>
                    </div>
                  </div>

                  {/* Route Info */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
                    <span>Best route via 3 DEXs</span>
                    <span className="text-ocean-seafoam">0.05% to charity</span>
                  </div>

                  {/* Swap Button */}
                  <button className="w-full py-4 rounded-xl bg-gradient-to-r from-ocean-cyan via-ocean-light to-ocean-seafoam text-primary-foreground font-semibold text-lg">
                    Swap
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Perpetuals Trading */}
      <section className="py-20 md:py-32 relative bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Perps UI Mockup */}
            <div className="animate-fade-in">
              <div className="glass-card p-6 relative">
                <ExamplePreviewBadge />

                <div className="space-y-4 pt-6">
                  {/* Chart Area */}
                  <div className="bg-muted/30 rounded-xl p-4 h-48 relative overflow-hidden">
                    {/* Fake candlestick chart */}
                    <div className="absolute bottom-0 left-0 right-0 flex items-end justify-around h-32 px-4">
                      {[40, 55, 45, 70, 60, 85, 75, 90, 80, 95, 88, 92].map((height, i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <div
                            className={`w-2 ${i % 2 === 0 ? "bg-ocean-seafoam" : "bg-destructive"} rounded-sm`}
                            style={{
                              height: `${height}%`,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="absolute top-4 left-4">
                      <span className="text-2xl font-bold text-foreground">$245.67</span>
                      <span className="ml-2 text-ocean-seafoam text-sm">+5.23%</span>
                    </div>
                  </div>

                  {/* Long/Short Toggle */}
                  <div className="grid grid-cols-2 gap-2">
                    <button className="py-3 rounded-xl bg-ocean-seafoam/20 border border-ocean-seafoam/50 text-ocean-seafoam font-semibold">
                      Long
                    </button>
                    <button className="py-3 rounded-xl bg-muted/50 border border-border text-muted-foreground font-semibold">
                      Short
                    </button>
                  </div>

                  {/* Leverage Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Leverage</span>
                      <span className="text-primary font-semibold">10x</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full w-1/4 bg-gradient-to-r from-ocean-cyan to-ocean-seafoam rounded-full" />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1x</span>
                      <span>100x</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="bg-muted/30 rounded-lg p-2">
                      <div className="text-muted-foreground">24H Vol</div>
                      <div className="text-foreground font-semibold">$2.4B</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2">
                      <div className="text-muted-foreground">Open Interest</div>
                      <div className="text-foreground font-semibold">$890M</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2">
                      <div className="text-muted-foreground">Funding</div>
                      <div className="text-ocean-seafoam font-semibold">0.01%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="animate-fade-in"
              style={{
                animationDelay: "0.2s",
              }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ocean-seafoam/10 border border-ocean-seafoam/20 text-ocean-seafoam text-sm font-medium mb-6">
                <TrendingUp className="w-4 h-4" />
                Perpetuals Trading
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
                Trade Perpetuals, <span className="gradient-text">Fund Causes</span>
              </h2>
              <p className="text-muted-foreground mb-8 text-lg">
                Access leveraged trading on your favorite assets with up to 100x leverage. Every trade generates fees
                that directly support charitable organizations worldwide.
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="glass-card p-4 text-center">
                  <TrendingUp className="w-6 h-6 text-primary mx-auto mb-2" />
                  <span className="text-sm font-medium text-foreground">Up to 100x</span>
                </div>
                <div className="glass-card p-4 text-center">
                  <Shield className="w-6 h-6 text-ocean-seafoam mx-auto mb-2" />
                  <span className="text-sm font-medium text-foreground">Cross Margin</span>
                </div>
                <div className="glass-card p-4 text-center">
                  <LineChart className="w-6 h-6 text-ocean-light mx-auto mb-2" />
                  <span className="text-sm font-medium text-foreground">Real-time PnL</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Lending & Earn */}
      <section className="py-20 md:py-32 relative">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ocean-light/10 border border-ocean-light/20 text-ocean-light text-sm font-medium mb-6">
                <Wallet className="w-4 h-4" />
                Lending & Earn
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
                Earn Passive Income, <span className="gradient-text">Power Passive Impact</span>
              </h2>
              <p className="text-muted-foreground mb-8 text-lg">
                Deposit your assets into our yield vaults and earn competitive APY. Your earnings grow while a portion
                of protocol revenue supports global causes.
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="glass-card p-4 text-center">
                  <Percent className="w-6 h-6 text-primary mx-auto mb-2" />
                  <span className="text-sm font-medium text-foreground">High APY</span>
                </div>
                <div className="glass-card p-4 text-center">
                  <RefreshCw className="w-6 h-6 text-ocean-seafoam mx-auto mb-2" />
                  <span className="text-sm font-medium text-foreground">Auto-compound</span>
                </div>
                <div className="glass-card p-4 text-center">
                  <Clock className="w-6 h-6 text-ocean-light mx-auto mb-2" />
                  <span className="text-sm font-medium text-foreground">Flexible</span>
                </div>
              </div>
            </div>

            {/* Lending UI Mockup */}
            <div
              className="order-1 lg:order-2 animate-fade-in"
              style={{
                animationDelay: "0.2s",
              }}
            >
              <div className="glass-card p-6 relative">
                <ExamplePreviewBadge />

                <div className="space-y-4 pt-6">
                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-muted/30 rounded-xl p-3 text-center">
                      <div className="text-xs text-muted-foreground mb-1">Total Supply</div>
                      <div className="text-lg font-bold text-foreground">$124M</div>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-3 text-center">
                      <div className="text-xs text-muted-foreground mb-1">Available</div>
                      <div className="text-lg font-bold text-foreground">$45M</div>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-3 text-center">
                      <div className="text-xs text-muted-foreground mb-1">Your Earnings</div>
                      <div className="text-lg font-bold text-ocean-seafoam">$1,234</div>
                    </div>
                  </div>

                  {/* Token List */}
                  <div className="space-y-2">
                    {[
                      {
                        token: "SOL",
                        apy: "8.5%",
                        color: "from-purple-500 to-blue-500",
                      },
                      {
                        token: "USDC",
                        apy: "12.3%",
                        color: "from-green-400 to-blue-500",
                      },
                      {
                        token: "USDT",
                        apy: "11.8%",
                        color: "from-green-500 to-teal-500",
                      },
                      {
                        token: "ETH",
                        apy: "6.2%",
                        color: "from-blue-400 to-purple-500",
                      },
                    ].map((item) => (
                      <div key={item.token} className="flex items-center justify-between bg-muted/20 rounded-xl p-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${item.color}`} />
                          <span className="font-semibold text-foreground">{item.token}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-ocean-seafoam font-semibold">{item.apy} APY</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Deposit Button */}
                  <button className="w-full py-4 rounded-xl bg-gradient-to-r from-ocean-cyan via-ocean-light to-ocean-seafoam text-primary-foreground font-semibold text-lg">
                    Deposit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Prediction Markets */}
      <section className="py-20 md:py-32 relative bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Prediction UI Mockup */}
            <div className="animate-fade-in">
              <div className="glass-card p-6 relative">
                <ExamplePreviewBadge />

                <div className="space-y-4 pt-6">
                  {/* Category Tabs */}
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {["All", "Crypto", "Sports", "Politics"].map((cat, i) => (
                      <button
                        key={cat}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${i === 0 ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Prediction Cards */}
                  <div className="space-y-3">
                    {[
                      {
                        question: "Will SOL reach $500 by Q4 2026?",
                        yes: 65,
                        vol: "$2.4M",
                      },
                      {
                        question: "Will Bitcoin ETF hit $100B AUM?",
                        yes: 78,
                        vol: "$5.1M",
                      },
                      {
                        question: "Will Ethereum 3.0 launch in 2026?",
                        yes: 42,
                        vol: "$890K",
                      },
                    ].map((pred, i) => (
                      <div key={i} className="bg-muted/30 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-3">
                          <p className="text-sm font-medium text-foreground pr-4">{pred.question}</p>
                          <div className="flex items-center gap-1 text-xs text-ocean-seafoam">
                            <div className="w-2 h-2 rounded-full bg-ocean-seafoam animate-pulse" />
                            Live
                          </div>
                        </div>
                        <div className="flex gap-2 mb-2">
                          <button className="flex-1 py-2 rounded-lg bg-ocean-seafoam/20 border border-ocean-seafoam/30 text-ocean-seafoam text-sm font-medium">
                            Yes {pred.yes}%
                          </button>
                          <button className="flex-1 py-2 rounded-lg bg-destructive/20 border border-destructive/30 text-destructive text-sm font-medium">
                            No {100 - pred.yes}%
                          </button>
                        </div>
                        <div className="text-xs text-muted-foreground">Volume: {pred.vol}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div
              className="animate-fade-in"
              style={{
                animationDelay: "0.2s",
              }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm font-medium mb-6">
                <Target className="w-4 h-4" />
                Prediction Markets
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
                Predict Outcomes, <span className="gradient-text">Shape the Future</span>
              </h2>
              <p className="text-muted-foreground mb-8 text-lg">
                Put your insights to work on real-world events. Trade on crypto prices, global events, and more while
                contributing to causes that matter.
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="glass-card p-4 text-center">
                  <BarChart3 className="w-6 h-6 text-primary mx-auto mb-2" />
                  <span className="text-sm font-medium text-foreground">Real-time Odds</span>
                </div>
                <div className="glass-card p-4 text-center">
                  <Users className="w-6 h-6 text-ocean-seafoam mx-auto mb-2" />
                  <span className="text-sm font-medium text-foreground">Community</span>
                </div>
                <div className="glass-card p-4 text-center">
                  <PieChart className="w-6 h-6 text-ocean-light mx-auto mb-2" />
                  <span className="text-sm font-medium text-foreground">Multi-category</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: AI Impact Dashboard Preview */}
      <section className="py-20 md:py-32 relative">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
              <PieChart className="w-4 h-4" />
              Impact Dashboard
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
              Track Your <span className="gradient-text">Charitable Impact</span>
            </h2>
            <p className="text-muted-foreground mb-12 text-lg max-w-2xl mx-auto">
              Our Impact dashboard tracks every fee from your trades and shows you exactly how your activity contributes
              to real-world causes.
            </p>

            {/* Dashboard Preview Card */}
            <div className="glass-card p-8 relative max-w-3xl mx-auto">
              <ExamplePreviewBadge />

              <div className="grid md:grid-cols-3 gap-6 pt-4">
                <div className="text-center">
                  <div className="text-4xl font-bold gradient-text mb-2">$12,450</div>
                  <div className="text-muted-foreground">Total Impact Generated</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-ocean-seafoam mb-2">6</div>
                  <div className="text-muted-foreground">Causes Supported</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-ocean-light mb-2">1,247</div>
                  <div className="text-muted-foreground">Trades Contributing</div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-border">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Heart className="w-5 h-5 text-primary" />
                  <span>Every trade makes a difference</span>
                </div>
              </div>
            </div>

            <Link
              to="/#ai-dashboard"
              className="inline-flex items-center gap-2 mt-8 text-primary hover:text-primary/80 transition-colors font-medium"
            >
              Learn more about AI Impact Tracking
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-20 relative">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-2xl md:text-3xl font-bold mb-6 text-foreground">
            Ready to trade with <span className="gradient-text">purpose</span>?
          </h3>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join the waitlist to be the first to experience KindSwap when we launch in Q4 2026.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/#newsletter"
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-ocean-cyan via-ocean-light to-ocean-seafoam text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
            >
              Get Updates
            </Link>
            <Link
              to="/"
              className="px-8 py-4 rounded-xl bg-muted/50 border border-border text-foreground font-semibold hover:bg-muted transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
export default WhatToExpect;
