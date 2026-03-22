import { Link } from "react-router-dom";
import KindSwapLogo from "@/components/KindSwapLogo";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";

interface PredictHeaderProps {
  activeTab: string;
  onTabChange: (tab: "browse" | "categories" | "my-predictions" | "leaderboard") => void;
  isWalletConnected: boolean;
  onWalletConnect: () => void;
}

export const PredictHeader = ({ activeTab, onTabChange, isWalletConnected, onWalletConnect }: PredictHeaderProps) => {
  const tabs = [
    { id: "browse", label: "Browse" },
    { id: "categories", label: "Categories" },
    { id: "my-predictions", label: "My Predictions" },
    { id: "leaderboard", label: "Leaderboard" }
  ] as const;

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-4">
        {/* Main Header */}
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-3">
              <KindSwapLogo className="h-8 w-auto" />
              <span className="text-xl font-bold text-foreground">KindSwap</span>
            </Link>
            <div className="hidden md:flex items-center gap-1 text-sm">
              <Link to="/" className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                Swap
              </Link>
              <span className="px-3 py-1.5 rounded-lg bg-ocean-cyan/10 text-ocean-cyan font-medium">
                Predict
              </span>
              <Link to="/perps" className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                Perps
              </Link>
            </div>
          </div>

          <Button
            variant={isWalletConnected ? "outline" : "default"}
            size="sm"
            onClick={onWalletConnect}
            className={isWalletConnected ? "border-ocean-cyan/30 text-ocean-cyan" : "bg-ocean-cyan hover:bg-ocean-cyan/90"}
          >
            <Wallet className="w-4 h-4 mr-2" />
            {isWalletConnected ? "8xK4...mN9p" : "Connect Wallet"}
          </Button>
        </div>

        {/* Sub Navigation */}
        <div className="flex items-center gap-1 pb-3 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-ocean-cyan/10 text-ocean-cyan"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};
