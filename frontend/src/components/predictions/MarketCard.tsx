import { Market } from "@/pages/PredictionMarkets";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Clock, CheckCircle } from "lucide-react";

interface MarketCardProps {
  market: Market;
  onClick: () => void;
}

const formatVolume = (volume: number) => {
  if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
  if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}K`;
  return `$${volume}`;
};

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    Crypto: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    Politics: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    Economics: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Sports: "bg-green-500/10 text-green-400 border-green-500/20",
    Culture: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    Tech: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
  };
  return colors[category] || "bg-muted text-muted-foreground";
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "Live":
      return <span className="w-2 h-2 rounded-full bg-ocean-cyan animate-pulse" />;
    case "Resolved":
      return <CheckCircle className="w-3 h-3 text-muted-foreground" />;
    case "Upcoming":
      return <Clock className="w-3 h-3 text-blue-400" />;
    default:
      return null;
  }
};

export const MarketCard = ({ market, onClick }: MarketCardProps) => {
  const mainOutcome = market.outcomes[0];

  return (
    <button
      onClick={onClick}
      className="glass-card p-5 rounded-xl text-left transition-all hover:border-ocean-cyan/40 hover:shadow-lg hover:shadow-ocean-cyan/5 group w-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <Badge variant="outline" className={`text-xs ${getCategoryColor(market.category)}`}>
          {market.category}
        </Badge>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {getStatusIcon(market.status)}
          <span>{market.status}</span>
        </div>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-foreground mb-4 line-clamp-2 group-hover:text-ocean-cyan transition-colors">
        {market.title}
      </h3>

      {/* Main Probability */}
      {market.status !== "Upcoming" && mainOutcome && (
        <div className="mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-ocean-cyan">{mainOutcome.probability}%</span>
            <span className="text-sm text-muted-foreground">chance</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 truncate">{mainOutcome.name}</p>
        </div>
      )}

      {/* Outcome Buttons */}
      <div className="flex gap-2 mb-4">
        <button className="flex-1 py-2 px-3 rounded-lg bg-ocean-seafoam/10 border border-ocean-seafoam/20 text-ocean-seafoam text-sm font-medium hover:bg-ocean-seafoam/20 transition-colors">
          Yes {mainOutcome ? `${Math.round(mainOutcome.yesPrice * 100)}¢` : ""}
        </button>
        <button className="flex-1 py-2 px-3 rounded-lg bg-ocean-light/10 border border-ocean-light/20 text-ocean-light text-sm font-medium hover:bg-ocean-light/20 transition-colors">
          No {mainOutcome ? `${Math.round(mainOutcome.noPrice * 100)}¢` : ""}
        </button>
      </div>

      {/* Volume */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/50">
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          <span>{formatVolume(market.volume)} volume</span>
        </div>
        <span className="text-ocean-cyan group-hover:underline">View Market →</span>
      </div>
    </button>
  );
};
