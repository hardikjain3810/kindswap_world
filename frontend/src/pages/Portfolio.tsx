import { useEffect, useState } from "react";
import PinProtection from "@/components/PinProtection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortfolioHeader } from "@/components/portfolio/PortfolioHeader";
import { HeroSummaryCard } from "@/components/portfolio/HeroSummaryCard";
import { BundleSelector } from "@/components/portfolio/BundleSelector";
import { CreateBundleModal } from "@/components/portfolio/CreateBundleModal";
import { RiskAlerts } from "@/components/portfolio/RiskAlerts";
import { AlphaFeedPanel } from "@/components/portfolio/AlphaFeedPanel";
import { SnapshotWidget } from "@/components/portfolio/SnapshotWidget";
import { AssetsTab } from "@/components/portfolio/tabs/AssetsTab";
import { DeFiTab } from "@/components/portfolio/tabs/DeFiTab";
import { PnLTab } from "@/components/portfolio/tabs/PnLTab";
import { NFTsTab } from "@/components/portfolio/tabs/NFTsTab";
import { ActivityTab } from "@/components/portfolio/tabs/ActivityTab";
import { ApprovalsTab } from "@/components/portfolio/tabs/ApprovalsTab";
import { WatchlistTab } from "@/components/portfolio/tabs/WatchlistTab";
import { ReportsTab } from "@/components/portfolio/tabs/ReportsTab";
import { MobileBottomNav } from "@/components/portfolio/MobileBottomNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, Eye, EyeOff } from "lucide-react";

export type ConnectionState = "connected" | "not-connected" | "empty";
export type SelectedBundle = { type: "wallet" } | { type: "bundle"; id: string; name: string };

const Portfolio = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>("connected");
  const [selectedBundle, setSelectedBundle] = useState<SelectedBundle>({ type: "wallet" });
  const [isCreateBundleOpen, setIsCreateBundleOpen] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [activeTab, setActiveTab] = useState("assets");

  // Set noindex for this page
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    document.title = "Portfolio | KindSwap";
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  // Mock bundles data
  const bundles = [
    { id: "1", name: "Main Wallets", walletCount: 3, netWorth: 127450, change24h: 2.34 },
    { id: "2", name: "Team Treasury", walletCount: 5, netWorth: 892100, change24h: -0.87 },
    { id: "3", name: "Whale Watch", walletCount: 12, netWorth: 4521000, change24h: 5.21 },
  ];

  return (
    <PinProtection correctPin="9125">
      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Animated Background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-ocean-cyan/15 rounded-full blur-[120px] animate-float" />
          <div className="absolute top-2/3 -right-32 w-80 h-80 bg-ocean-seafoam/15 rounded-full blur-[100px] animate-float" style={{ animationDelay: "-3s" }} />
          <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-ocean-deep/20 rounded-full blur-[90px] animate-float" style={{ animationDelay: "-5s" }} />
          {/* Grid pattern */}
          <div 
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                               linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
              backgroundSize: "60px 60px"
            }}
          />
        </div>

        {/* Internal Preview Badge */}
        <Badge className="fixed top-4 right-4 z-50 bg-ocean-cyan/20 text-ocean-light border-ocean-cyan/30">
          Internal Preview
        </Badge>

        {/* Privacy Mode Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 right-40 z-50"
          onClick={() => setPrivacyMode(!privacyMode)}
        >
          {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>

        {/* Main Content */}
        <div className="relative z-10">
          {/* Header */}
          <PortfolioHeader 
            onCreateBundle={() => setIsCreateBundleOpen(true)}
            selectedBundle={selectedBundle}
          />

          <main className="container mx-auto px-4 py-6 pb-24 lg:pb-8">
            {/* Not Connected State */}
            {connectionState === "not-connected" && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="glass-card p-12 rounded-2xl max-w-md">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-ocean-cyan/20 flex items-center justify-center">
                    <Wallet className="w-10 h-10 text-ocean-cyan" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-3">Connect Your Wallet</h2>
                  <p className="text-muted-foreground mb-6">
                    Connect your wallet to view your portfolio, track positions, and manage bundles.
                  </p>
                  <Button variant="hero" size="lg" onClick={() => setConnectionState("connected")}>
                    Connect Wallet
                  </Button>
                  <p className="text-sm text-muted-foreground mt-4">
                    Or <button className="text-ocean-cyan hover:underline" onClick={() => setConnectionState("empty")}>track as guest</button> by adding a wallet address
                  </p>
                </div>
              </div>
            )}

            {/* Connected/Empty State Content */}
            {connectionState !== "not-connected" && (
              <>
                {/* Bundle Selector Row */}
                <div className="mb-6">
                  <BundleSelector
                    bundles={bundles}
                    selectedBundle={selectedBundle}
                    onSelectBundle={setSelectedBundle}
                    onCreateBundle={() => setIsCreateBundleOpen(true)}
                    privacyMode={privacyMode}
                  />
                </div>

                {/* Risk Alerts */}
                <RiskAlerts />

                {/* Hero Summary Card */}
                <HeroSummaryCard 
                  privacyMode={privacyMode} 
                  selectedBundle={selectedBundle}
                  bundles={bundles}
                />

                {/* Main Content Grid */}
                <div className="grid lg:grid-cols-4 gap-6 mt-8">
                  {/* Main Content - 3 columns */}
                  <div className="lg:col-span-3">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1.5 rounded-xl mb-6">
                        <TabsTrigger value="assets" className="text-xs sm:text-sm">Assets</TabsTrigger>
                        <TabsTrigger value="defi" className="text-xs sm:text-sm">DeFi</TabsTrigger>
                        <TabsTrigger value="pnl" className="text-xs sm:text-sm">PnL</TabsTrigger>
                        <TabsTrigger value="nfts" className="text-xs sm:text-sm">NFTs</TabsTrigger>
                        <TabsTrigger value="activity" className="text-xs sm:text-sm">Activity</TabsTrigger>
                        <TabsTrigger value="approvals" className="text-xs sm:text-sm">Approvals</TabsTrigger>
                        <TabsTrigger value="watchlist" className="text-xs sm:text-sm">Watchlist</TabsTrigger>
                        <TabsTrigger value="reports" className="text-xs sm:text-sm">Reports</TabsTrigger>
                      </TabsList>

                      <TabsContent value="assets">
                        <AssetsTab privacyMode={privacyMode} />
                      </TabsContent>
                      <TabsContent value="defi">
                        <DeFiTab privacyMode={privacyMode} />
                      </TabsContent>
                      <TabsContent value="pnl">
                        <PnLTab privacyMode={privacyMode} />
                      </TabsContent>
                      <TabsContent value="nfts">
                        <NFTsTab privacyMode={privacyMode} />
                      </TabsContent>
                      <TabsContent value="activity">
                        <ActivityTab privacyMode={privacyMode} />
                      </TabsContent>
                      <TabsContent value="approvals">
                        <ApprovalsTab />
                      </TabsContent>
                      <TabsContent value="watchlist">
                        <WatchlistTab privacyMode={privacyMode} />
                      </TabsContent>
                      <TabsContent value="reports">
                        <ReportsTab privacyMode={privacyMode} />
                      </TabsContent>
                    </Tabs>
                  </div>

                  {/* Right Sidebar - 1 column */}
                  <aside className="hidden lg:block space-y-6">
                    <AlphaFeedPanel />
                    <SnapshotWidget />
                  </aside>
                </div>
              </>
            )}
          </main>

          {/* Mobile Bottom Nav */}
          <MobileBottomNav activeTab={activeTab} />
        </div>

        {/* Create Bundle Modal */}
        <CreateBundleModal 
          open={isCreateBundleOpen} 
          onOpenChange={setIsCreateBundleOpen} 
        />
      </div>
    </PinProtection>
  );
};

export default Portfolio;
