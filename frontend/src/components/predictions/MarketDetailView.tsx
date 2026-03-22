import { useState } from "react";
import { Market } from "@/pages/PredictionMarkets";
import { ProbabilityChart } from "./ProbabilityChart";
import { ParticipationPanel } from "./ParticipationPanel";
import { RulesSection } from "./RulesSection";
import { OutcomeRow } from "./OutcomeRow";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Calendar } from "lucide-react";

interface MarketDetailViewProps {
  market: Market;
  onBack: () => void;
  isWalletConnected: boolean;
  onWalletConnect: () => void;
}

const formatVolume = (volume: number) => {
  if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
  if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}K`;
  return `$${volume}`;
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

export const MarketDetailView = ({ market, onBack, isWalletConnected, onWalletConnect }: MarketDetailViewProps) => {
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);

  const handleOutcomeSelect = (outcomeName: string, action: "yes" | "no") => {
    setSelectedOutcome(`${action}-${outcomeName}`);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Browse</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Market Context */}
        <div className="lg:col-span-2 space-y-6">
          {/* Market Header */}
          <div className="glass-card p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <Badge variant="outline" className="text-xs bg-ocean-cyan/10 text-ocean-cyan border-ocean-cyan/30">
                {market.category}
              </Badge>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-ocean-cyan animate-pulse" />
                <span className="text-ocean-cyan">{market.status}</span>
              </div>
            </div>

            <h1 className="text-2xl font-bold mb-3">{market.title}</h1>
            <p className="text-muted-foreground">{market.description}</p>

            {/* Stats Row */}
            <div className="flex flex-wrap items-center gap-6 mt-6 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Volume:</span>
                <span className="font-medium">{formatVolume(market.volume)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Ends:</span>
                <span className="font-medium">{formatDate(market.endDate)}</span>
              </div>
            </div>
          </div>

          {/* Probability Chart */}
          {market.probabilityHistory.length > 0 && (
            <div className="glass-card p-6 rounded-xl">
              <h2 className="text-lg font-semibold mb-4">Probability Over Time</h2>
              <ProbabilityChart data={market.probabilityHistory} />
            </div>
          )}

          {/* Outcomes */}
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4">Outcomes</h2>
            <div className="space-y-3">
              {market.outcomes.map((outcome) => (
                <OutcomeRow
                  key={outcome.name}
                  outcome={outcome}
                  isSelected={selectedOutcome?.includes(outcome.name) || false}
                  onSelect={handleOutcomeSelect}
                />
              ))}
            </div>
          </div>

          {/* Rules Section */}
          <RulesSection market={market} />
        </div>

        {/* Right Column - Participation Panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <ParticipationPanel
              market={market}
              selectedOutcome={selectedOutcome}
              isWalletConnected={isWalletConnected}
              onWalletConnect={onWalletConnect}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
