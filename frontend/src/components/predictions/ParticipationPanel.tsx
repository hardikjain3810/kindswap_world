import { useState } from "react";
import { Market } from "@/pages/PredictionMarkets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, Info } from "lucide-react";

interface ParticipationPanelProps {
  market: Market;
  selectedOutcome: string | null;
  isWalletConnected: boolean;
  onWalletConnect: () => void;
}

export const ParticipationPanel = ({
  market,
  selectedOutcome,
  isWalletConnected,
  onWalletConnect
}: ParticipationPanelProps) => {
  const [amount, setAmount] = useState("");
  const presetAmounts = [5, 10, 25];
  const balance = 1250.00;

  // Parse selected outcome
  const parsedOutcome = selectedOutcome ? {
    action: selectedOutcome.split("-")[0] as "yes" | "no",
    name: selectedOutcome.split("-").slice(1).join("-")
  } : null;

  const outcomeData = parsedOutcome 
    ? market.outcomes.find((o) => o.name === parsedOutcome.name)
    : market.outcomes[0];

  const probability = parsedOutcome?.action === "yes" 
    ? outcomeData?.probability 
    : 100 - (outcomeData?.probability || 0);

  if (!isWalletConnected) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-2">Connect Wallet to Participate</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Connect your wallet to forecast and participate in prediction markets.
          </p>
          <Button onClick={onWalletConnect} className="bg-ocean-cyan hover:bg-ocean-cyan/90 w-full">
            <Wallet className="w-4 h-4 mr-2" />
            Connect Wallet
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-xl space-y-6">
      {/* Selected Outcome Header */}
      <div className="pb-4 border-b border-border/50">
        <p className="text-sm text-muted-foreground mb-1">Your Position</p>
        {parsedOutcome ? (
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              parsedOutcome.action === "yes" 
                ? "bg-ocean-seafoam/20 text-ocean-seafoam" 
                : "bg-ocean-light/20 text-ocean-light"
            }`}>
              {parsedOutcome.action.toUpperCase()}
            </span>
            <span className="font-medium truncate">{parsedOutcome.name}</span>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Select an outcome below</p>
        )}
      </div>

      {/* Amount Input */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">You're paying</span>
          <span className="text-muted-foreground">Balance: ${balance.toLocaleString()}</span>
        </div>

        <div className="relative">
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-2xl font-bold h-14 pr-20 bg-muted/30 border-border/50 focus:border-ocean-cyan/50"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <span className="text-sm font-medium">USDC</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setAmount((balance / 2).toFixed(2))}
            className="px-3 py-1.5 text-xs rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            HALF
          </button>
          <button
            onClick={() => setAmount(balance.toFixed(2))}
            className="px-3 py-1.5 text-xs rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            MAX
          </button>
        </div>
      </div>

      {/* Probability Display */}
      {outcomeData && (
        <div className="bg-muted/30 rounded-lg p-4 text-center">
          <p className="text-4xl font-bold text-ocean-cyan mb-1">{probability}%</p>
          <p className="text-sm text-muted-foreground">chance</p>
        </div>
      )}

      {/* Preset Amounts */}
      <div className="grid grid-cols-3 gap-2">
        {presetAmounts.map((preset) => (
          <button
            key={preset}
            onClick={() => setAmount(preset.toString())}
            className={`py-2 rounded-lg text-sm font-medium transition-colors ${
              amount === preset.toString()
                ? "bg-ocean-cyan/20 text-ocean-cyan border border-ocean-cyan/30"
                : "bg-muted/50 hover:bg-muted text-muted-foreground"
            }`}
          >
            ${preset}
          </button>
        ))}
      </div>

      {/* Submit Button */}
      <Button
        className="w-full h-12 bg-ocean-cyan hover:bg-ocean-cyan/90 text-background font-semibold"
        disabled={!amount || !parsedOutcome}
      >
        {amount && parsedOutcome ? `Confirm Position` : "Enter Amount"}
      </Button>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>Probability reflects market consensus, not certainty. Past performance does not indicate future results.</p>
      </div>
    </div>
  );
};
