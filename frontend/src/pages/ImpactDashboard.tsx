import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PinProtection from "@/components/PinProtection";
import { 
  TrendingUp, 
  Heart, 
  Share2, 
  Sparkles, 
  Utensils, 
  GraduationCap, 
  Home, 
  Stethoscope, 
  TreePine, 
  Users,
  Brain,
  Target,
  Zap,
  ArrowUpRight,
  Flame,
  Trophy,
  BarChart3,
  Wallet,
  X,
  Instagram,
  Download,
  Activity,
  Award,
  Clock,
  Coins
} from "lucide-react";

const ImpactDashboard = () => {
  const [causeAllocations, setCauseAllocations] = useState({
    foodSecurity: 25,
    education: 20,
    homelessness: 15,
    healthcare: 15,
    environment: 15,
    communityCare: 10,
  });

  const [selectedCardStyle, setSelectedCardStyle] = useState<'minimalist' | 'detailed' | 'social' | 'dark'>('minimalist');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Prevent indexing
  useEffect(() => {
    const metaRobots = document.createElement('meta');
    metaRobots.name = 'robots';
    metaRobots.content = 'noindex, nofollow';
    document.head.appendChild(metaRobots);
    return () => {
      document.head.removeChild(metaRobots);
    };
  }, []);

  const causes = [
    { key: 'foodSecurity', name: 'Food Security', icon: Utensils, color: 'from-amber-400 to-orange-500' },
    { key: 'education', name: 'Education', icon: GraduationCap, color: 'from-ocean-light to-ocean-cyan' },
    { key: 'homelessness', name: 'Homelessness', icon: Home, color: 'from-ocean-cyan to-ocean-seafoam' },
    { key: 'healthcare', name: 'Healthcare', icon: Stethoscope, color: 'from-emerald-400 to-teal-500' },
    { key: 'environment', name: 'Environment', icon: TreePine, color: 'from-green-400 to-emerald-500' },
    { key: 'communityCare', name: 'Community Care', icon: Users, color: 'from-rose-400 to-pink-500' },
  ];

  const impactMetrics = [
    { title: 'Meals Supported', value: '1,247', icon: Utensils, description: 'Nutritious meals provided', gradient: 'from-amber-400 to-orange-500' },
    { title: 'Education Hours', value: '89', icon: GraduationCap, description: 'Hours of learning funded', gradient: 'from-ocean-light to-ocean-cyan' },
    { title: 'Shelter Nights', value: '34', icon: Home, description: 'Safe nights enabled', gradient: 'from-ocean-cyan to-ocean-seafoam' },
    { title: 'Healthcare Visits', value: '12', icon: Stethoscope, description: 'Medical visits supported', gradient: 'from-emerald-400 to-teal-500' },
    { title: 'CO₂ Offset', value: '2.4t', icon: TreePine, description: 'Tons of carbon offset', gradient: 'from-green-400 to-emerald-500' },
    { title: 'Community Aid', value: '156', icon: Users, description: 'People directly helped', gradient: 'from-rose-400 to-pink-500' },
  ];

  const tradingMilestones = [
    { title: 'First Trade', achieved: true, icon: Zap },
    { title: '100 Trades', achieved: true, icon: Activity },
    { title: '$1K Impact', achieved: true, icon: Heart },
    { title: '$5K Impact', achieved: false, icon: Trophy },
    { title: 'Top 10%', achieved: false, icon: Award },
  ];

  const handleAllocationChange = (key: string, value: number[]) => {
    const newValue = value[0];
    setCauseAllocations(prev => ({
      ...prev,
      [key]: newValue,
    }));
  };

  // Animated mini chart component
  const MiniChart = ({ className = "" }: { className?: string }) => (
    <svg viewBox="0 0 200 60" className={`w-full h-16 ${className}`}>
      <defs>
        <linearGradient id="chartGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(185 80% 55%)" />
          <stop offset="50%" stopColor="hsl(195 90% 60%)" />
          <stop offset="100%" stopColor="hsl(165 70% 45%)" />
        </linearGradient>
        <linearGradient id="chartFill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(185 80% 55% / 0.3)" />
          <stop offset="100%" stopColor="hsl(185 80% 55% / 0)" />
        </linearGradient>
      </defs>
      <path
        d="M0,45 Q20,40 40,35 T80,30 T120,25 T160,15 T200,10"
        fill="none"
        stroke="url(#chartGradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M0,45 Q20,40 40,35 T80,30 T120,25 T160,15 T200,10 L200,60 L0,60 Z"
        fill="url(#chartFill)"
        className="opacity-50"
      />
    </svg>
  );

  // Trading Activity Chart
  const TradingChart = () => (
    <svg viewBox="0 0 300 80" className="w-full h-20">
      <defs>
        <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(185 80% 55%)" />
          <stop offset="100%" stopColor="hsl(165 70% 45%)" />
        </linearGradient>
      </defs>
      {[35, 45, 30, 55, 40, 65, 50, 70, 45, 60, 75, 55].map((height, i) => (
        <rect
          key={i}
          x={i * 24 + 6}
          y={80 - height}
          width="16"
          height={height}
          rx="4"
          fill="url(#barGradient)"
          className="opacity-80 hover:opacity-100 transition-opacity"
        />
      ))}
    </svg>
  );

  // Premium Shareable Card Variants
  const ShareableCardMinimalist = () => (
    <div className="relative w-full aspect-[1.91/1] bg-gradient-to-br from-background via-card to-background rounded-2xl p-6 border border-border/50 overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-ocean-cyan/10 rounded-full blur-3xl" />
      <div className="relative z-10 h-full flex flex-col justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ocean-cyan to-ocean-seafoam flex items-center justify-center">
            <Heart className="w-4 h-4 text-background" />
          </div>
          <span className="font-semibold text-foreground">KindSwap</span>
        </div>
        <div>
          <p className="text-muted-foreground text-sm mb-1">Total Impact Generated</p>
          <p className="text-4xl font-bold gradient-text">$2,847.50</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">December 2025</span>
          <Badge variant="outline" className="text-xs border-ocean-cyan/30 text-ocean-cyan">
            #SwapForGood
          </Badge>
        </div>
      </div>
    </div>
  );

  const ShareableCardDetailed = () => (
    <div className="relative w-full aspect-[1.91/1] bg-gradient-to-br from-card via-background to-card rounded-2xl p-6 border border-border/50 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
        backgroundSize: '20px 20px'
      }} />
      <div className="absolute top-0 right-0 w-40 h-40 bg-ocean-cyan/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-ocean-seafoam/10 rounded-full blur-3xl" />
      <div className="relative z-10 h-full flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ocean-cyan to-ocean-seafoam flex items-center justify-center">
              <Heart className="w-4 h-4 text-background" />
            </div>
            <span className="font-semibold text-foreground">KindSwap</span>
          </div>
          <Badge className="bg-ocean-cyan/20 text-ocean-cyan border-ocean-cyan/30">
            Verified Impact
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-muted-foreground text-xs mb-1">Total Impact</p>
            <p className="text-2xl font-bold gradient-text">$2,847</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Trades</p>
            <p className="text-2xl font-bold text-foreground">127</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Top Cause</p>
            <p className="text-lg font-bold text-ocean-cyan">🍽️ Food</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">December 2025</span>
          <span className="text-xs text-ocean-cyan">#SwapForGood</span>
        </div>
      </div>
    </div>
  );

  const ShareableCardSocial = () => (
    <div className="relative w-full aspect-[4/5] bg-gradient-to-br from-ocean-deep via-background to-ocean-deep rounded-2xl p-8 border border-ocean-cyan/20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-ocean-cyan/5 to-ocean-seafoam/5" />
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-ocean-cyan/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-ocean-seafoam/20 rounded-full blur-[80px]" />
      <div className="relative z-10 h-full flex flex-col items-center justify-between text-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ocean-cyan to-ocean-seafoam flex items-center justify-center">
            <Heart className="w-5 h-5 text-background" />
          </div>
          <span className="text-xl font-bold text-foreground">KindSwap</span>
        </div>
        <div className="space-y-4">
          <p className="text-muted-foreground">My trading generated</p>
          <p className="text-6xl font-bold gradient-text">$2,847</p>
          <p className="text-xl text-foreground">in real-world impact</p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <span>🍽️ 1,247 meals</span>
            <span>📚 89 hours</span>
          </div>
          <Badge className="bg-gradient-to-r from-ocean-cyan to-ocean-seafoam text-background border-0 px-4 py-1">
            #SwapForGood
          </Badge>
        </div>
      </div>
    </div>
  );

  const ShareableCardDark = () => (
    <div className="relative w-full aspect-[1.91/1] bg-[hsl(210_50%_3%)] rounded-2xl p-6 border border-ocean-cyan/30 overflow-hidden">
      {/* Holographic border effect */}
      <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-r from-ocean-cyan via-ocean-light to-ocean-seafoam opacity-30" style={{
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
      }} />
      {/* Glowing orbs */}
      <div className="absolute top-0 left-1/4 w-48 h-48 bg-ocean-cyan/20 rounded-full blur-[80px]" />
      <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-ocean-seafoam/15 rounded-full blur-[60px]" />
      {/* Stars effect */}
      <div className="absolute inset-0 opacity-30">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-0.5 h-0.5 bg-ocean-light rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>
      <div className="relative z-10 h-full flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ocean-cyan to-ocean-seafoam flex items-center justify-center glow-cyan">
              <Heart className="w-4 h-4 text-background" />
            </div>
            <span className="font-bold text-foreground">KindSwap</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-ocean-cyan/10 border border-ocean-cyan/30">
            <div className="w-1.5 h-1.5 rounded-full bg-ocean-cyan animate-pulse" />
            <span className="text-[10px] text-ocean-cyan font-medium">VERIFIED</span>
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-muted-foreground text-xs mb-1">Impact Generated</p>
            <p className="text-5xl font-bold gradient-text tracking-tight">$2,847</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-ocean-cyan">127</p>
            <p className="text-xs text-muted-foreground">trades</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">December 2025</span>
          <Badge variant="outline" className="text-xs border-ocean-cyan/50 text-ocean-light bg-ocean-cyan/5">
            #SwapForGood
          </Badge>
        </div>
      </div>
    </div>
  );

  const cardVariants = {
    minimalist: { component: ShareableCardMinimalist, name: 'Minimalist' },
    detailed: { component: ShareableCardDetailed, name: 'Detailed' },
    social: { component: ShareableCardSocial, name: 'Story' },
    dark: { component: ShareableCardDark, name: 'Premium' },
  };

  return (
    <PinProtection correctPin="9125">
      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Animated Background - Matching HeroSection */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-ocean-cyan/15 blur-[120px] animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-ocean-seafoam/15 blur-[100px] animate-float" style={{ animationDelay: "-3s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-ocean-deep/20 blur-[150px]" />
          {/* Grid Pattern */}
          <div className="absolute inset-0 opacity-[0.02]" style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }} />
        </div>

        {/* Internal Badge */}
        <div className="fixed top-4 right-4 z-50">
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
            Internal Preview
          </Badge>
        </div>

        {/* Main Content */}
        <div className="relative z-10 container mx-auto px-4 py-8 pt-20">
          {/* Hero Summary Section */}
          <div className="mb-12">
            <div className="glass-card p-8 md:p-12 relative overflow-hidden group hover:shadow-[0_0_60px_hsl(185_80%_55%/0.15)] transition-all duration-500">
              {/* Gradient accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-ocean-cyan via-ocean-light to-ocean-seafoam" />
              
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
                <div className="space-y-4">
                  <Badge variant="gradient" className="mb-2">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Example Preview
                  </Badge>
                  <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold">
                    <span className="text-foreground">Your </span>
                    <span className="gradient-text">Real-World Impact</span>
                  </h1>
                  <p className="text-muted-foreground text-lg max-w-xl">
                    Generated through your trading activity on KindSwap. Every swap contributes to causes you care about.
                  </p>
                </div>
                <div className="text-right space-y-2">
                  <p className="text-muted-foreground text-sm">Total Contributed</p>
                  <p className="text-5xl md:text-7xl font-bold gradient-text tracking-tight">
                    $2,847
                  </p>
                  <div className="flex items-center justify-end gap-2 text-ocean-cyan">
                    <ArrowUpRight className="w-4 h-4" />
                    <span className="text-sm font-medium">+18% this month</span>
                  </div>
                </div>
              </div>
              
              {/* Mini Chart */}
              <div className="mt-8 pt-6 border-t border-border/50">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">Impact over time</span>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Last 30 days</span>
                  </div>
                </div>
                <MiniChart />
              </div>
            </div>
          </div>

          {/* Main Grid Layout */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Trading Insights Section */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ocean-cyan/20 to-ocean-seafoam/20 flex items-center justify-center border border-ocean-cyan/20">
                    <BarChart3 className="w-5 h-5 text-ocean-cyan" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Trading Insights</h2>
                    <p className="text-sm text-muted-foreground">Your trading activity overview</p>
                  </div>
                </div>

                {/* Trading Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Total Volume', value: '$45,230', icon: Coins, trend: '+12%' },
                    { label: 'Trades', value: '127', icon: Activity, trend: '+8' },
                    { label: 'Avg Impact/Trade', value: '$22.42', icon: Heart, trend: '+$2.10' },
                    { label: 'Trading Streak', value: '7 days', icon: Flame, trend: '🔥' },
                  ].map((stat, index) => (
                    <div key={index} className="glass-card p-4 group hover:shadow-[0_0_40px_hsl(185_80%_55%/0.1)] transition-all duration-300">
                      <div className="flex items-center justify-between mb-2">
                        <stat.icon className="w-4 h-4 text-ocean-cyan" />
                        <span className="text-xs text-ocean-seafoam">{stat.trend}</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Trading Activity Chart */}
                <div className="glass-card p-6 hover:shadow-[0_0_40px_hsl(185_80%_55%/0.1)] transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-foreground">Trade Volume (Last 12 Months)</span>
                    <Badge variant="outline" className="text-xs border-ocean-cyan/30 text-ocean-cyan">
                      Live
                    </Badge>
                  </div>
                  <TradingChart />
                  <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
                    <span>Jan</span>
                    <span>Dec</span>
                  </div>
                </div>

                {/* Milestones */}
                <div className="glass-card p-6 hover:shadow-[0_0_40px_hsl(185_80%_55%/0.1)] transition-all duration-300">
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-4 h-4 text-ocean-cyan" />
                    <span className="text-sm font-medium text-foreground">Trading Milestones</span>
                  </div>
                  <div className="flex items-center gap-3 overflow-x-auto pb-2">
                    {tradingMilestones.map((milestone, index) => (
                      <div
                        key={index}
                        className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border ${
                          milestone.achieved
                            ? 'bg-ocean-cyan/10 border-ocean-cyan/30 text-ocean-cyan'
                            : 'bg-muted/30 border-border text-muted-foreground'
                        }`}
                      >
                        <milestone.icon className="w-4 h-4" />
                        <span className="text-xs font-medium whitespace-nowrap">{milestone.title}</span>
                        {milestone.achieved && <span className="text-xs">✓</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Cause Allocation Section */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ocean-cyan/20 to-ocean-seafoam/20 flex items-center justify-center border border-ocean-cyan/20">
                    <Target className="w-5 h-5 text-ocean-cyan" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Your Cause Allocation</h2>
                    <p className="text-sm text-muted-foreground">How your impact is distributed</p>
                  </div>
                </div>

                <div className="glass-card p-6 hover:shadow-[0_0_40px_hsl(185_80%_55%/0.1)] transition-all duration-300">
                  {/* Stacked Bar Visualization */}
                  <div className="h-4 rounded-full overflow-hidden flex mb-6">
                    {causes.map((cause) => (
                      <div
                        key={cause.key}
                        className={`bg-gradient-to-r ${cause.color} transition-all duration-300`}
                        style={{ width: `${causeAllocations[cause.key as keyof typeof causeAllocations]}%` }}
                        title={`${cause.name}: ${causeAllocations[cause.key as keyof typeof causeAllocations]}%`}
                      />
                    ))}
                  </div>

                  {/* Cause Sliders */}
                  <div className="space-y-5">
                    {causes.map((cause) => (
                      <div key={cause.key} className="group">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${cause.color} flex items-center justify-center`}>
                              <cause.icon className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm font-medium text-foreground">{cause.name}</span>
                          </div>
                          <span className="text-sm font-bold text-ocean-cyan">
                            {causeAllocations[cause.key as keyof typeof causeAllocations]}%
                          </span>
                        </div>
                        <Slider
                          value={[causeAllocations[cause.key as keyof typeof causeAllocations]]}
                          onValueChange={(value) => handleAllocationChange(cause.key, value)}
                          max={100}
                          step={5}
                          className="cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Impact Metrics Grid */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ocean-cyan/20 to-ocean-seafoam/20 flex items-center justify-center border border-ocean-cyan/20">
                    <Heart className="w-5 h-5 text-ocean-cyan" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Impact Breakdown</h2>
                    <p className="text-sm text-muted-foreground">Real-world outcomes from your trades</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {impactMetrics.map((metric, index) => (
                    <div
                      key={index}
                      className="glass-card p-5 group hover:shadow-[0_0_40px_hsl(185_80%_55%/0.1)] transition-all duration-300 cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${metric.gradient} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                          <metric.icon className="w-5 h-5 text-white" />
                        </div>
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-muted/50">
                          <Share2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                      <p className="text-3xl font-bold gradient-text mb-1">{metric.value}</p>
                      <p className="text-sm font-medium text-foreground">{metric.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Shareable Impact Cards Section */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ocean-cyan/20 to-ocean-seafoam/20 flex items-center justify-center border border-ocean-cyan/20">
                      <Share2 className="w-5 h-5 text-ocean-cyan" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-foreground">Share Your Impact</h2>
                      <p className="text-sm text-muted-foreground">Beautiful cards ready for social media</p>
                    </div>
                  </div>
                  <Dialog open={isShareModalOpen} onOpenChange={setIsShareModalOpen}>
                    <DialogTrigger asChild>
                      <Button variant="hero" className="gap-2">
                        <Share2 className="w-4 h-4" />
                        Create Card
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl bg-background/95 backdrop-blur-xl border-border/50">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Share Your Impact</DialogTitle>
                      </DialogHeader>
                      
                      <Tabs defaultValue="minimalist" className="mt-4">
                        <TabsList className="grid grid-cols-4 mb-6 bg-muted/30">
                          {Object.entries(cardVariants).map(([key, variant]) => (
                            <TabsTrigger
                              key={key}
                              value={key}
                              onClick={() => setSelectedCardStyle(key as typeof selectedCardStyle)}
                              className="text-xs"
                            >
                              {variant.name}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                        
                        {Object.entries(cardVariants).map(([key, variant]) => (
                          <TabsContent key={key} value={key} className="mt-0">
                            <div className="flex justify-center mb-6">
                              <div className="w-full max-w-md">
                                <variant.component />
                              </div>
                            </div>
                          </TabsContent>
                        ))}
                      </Tabs>

                      <div className="flex flex-col sm:flex-row gap-3 mt-4">
                        <Button variant="outline" className="flex-1 gap-2">
                          <X className="w-4 h-4" />
                          Share to X
                        </Button>
                        <Button variant="outline" className="flex-1 gap-2">
                          <Instagram className="w-4 h-4" />
                          Share to Instagram
                        </Button>
                        <Button variant="hero" className="flex-1 gap-2">
                          <Download className="w-4 h-4" />
                          Download
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Card Preview Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div 
                    className="cursor-pointer transition-all hover:scale-[1.02]"
                    onClick={() => { setSelectedCardStyle('minimalist'); setIsShareModalOpen(true); }}
                  >
                    <ShareableCardMinimalist />
                    <p className="text-center text-xs text-muted-foreground mt-2">Minimalist</p>
                  </div>
                  <div 
                    className="cursor-pointer transition-all hover:scale-[1.02]"
                    onClick={() => { setSelectedCardStyle('dark'); setIsShareModalOpen(true); }}
                  >
                    <ShareableCardDark />
                    <p className="text-center text-xs text-muted-foreground mt-2">Premium Dark</p>
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column - AI Insights Panel */}
            <aside className="space-y-6">
              <div className="sticky top-24 space-y-6">
                {/* AI Insights Header */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ocean-cyan to-ocean-seafoam flex items-center justify-center glow-cyan">
                    <Brain className="w-5 h-5 text-background" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">AI Insights</h2>
                    <p className="text-xs text-muted-foreground">Personalized analysis</p>
                  </div>
                </div>

                {/* Behavior Insight */}
                <Card className="glass-card border-ocean-cyan/20 hover:shadow-[0_0_40px_hsl(185_80%_55%/0.1)] transition-all duration-300 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-ocean-cyan to-ocean-seafoam" />
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-ocean-cyan" />
                      <CardTitle className="text-sm font-medium">Behavior Pattern</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Your trading activity consistently supports <span className="text-ocean-cyan font-medium">food security</span> initiatives. This aligns with your allocation preferences.
                    </p>
                  </CardContent>
                </Card>

                {/* Trend Insight */}
                <Card className="glass-card border-ocean-seafoam/20 hover:shadow-[0_0_40px_hsl(165_70%_45%/0.1)] transition-all duration-300 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-ocean-seafoam to-emerald-400" />
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-ocean-seafoam" />
                      <CardTitle className="text-sm font-medium">Trend Analysis</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Your impact contribution has increased <span className="text-ocean-seafoam font-medium">18% month-over-month</span>. Great momentum!
                    </p>
                  </CardContent>
                </Card>

                {/* Predictive Insight */}
                <Card className="glass-card border-ocean-light/20 hover:shadow-[0_0_40px_hsl(195_90%_60%/0.1)] transition-all duration-300 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-ocean-light to-ocean-cyan" />
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-ocean-light" />
                      <CardTitle className="text-sm font-medium">Projection</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      At your current activity level, you're projected to support <span className="text-ocean-light font-medium">$3,200</span> in impact this month.
                    </p>
                  </CardContent>
                </Card>

                {/* Recommendations */}
                <Card className="glass-card border-border hover:shadow-[0_0_40px_hsl(185_80%_55%/0.1)] transition-all duration-300">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-medium">Suggestions</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="w-6 h-6 rounded-full bg-ocean-cyan/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <GraduationCap className="w-3 h-3 text-ocean-cyan" />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Consider increasing allocation to <span className="text-foreground">Education</span> to balance your impact profile
                      </p>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="w-6 h-6 rounded-full bg-ocean-seafoam/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Trophy className="w-3 h-3 text-ocean-seafoam" />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        You're <span className="text-foreground">$153 away</span> from your next impact milestone
                      </p>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="w-6 h-6 rounded-full bg-rose-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Share2 className="w-3 h-3 text-rose-400" />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Share your impact card to inspire others in the community
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Connect Wallet CTA */}
                <Card className="glass-card border-dashed border-border/50 bg-transparent">
                  <CardContent className="p-6 text-center">
                    <Wallet className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-3">
                      Connect your wallet to see personalized insights
                    </p>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Wallet className="w-4 h-4" />
                      Connect Wallet
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </PinProtection>
  );
};

export default ImpactDashboard;
