import { Wallet, AlertCircle, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  type: "not-connected" | "unavailable" | "no-positions";
  onConnect?: () => void;
}

const EmptyStates = ({ type, onConnect }: EmptyStateProps) => {
  if (type === "not-connected") {
    return (
      <div className="glass-card p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Wallet className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Connect Wallet
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Connect your wallet to start trading perpetuals
        </p>
        <Button
          onClick={onConnect}
          className="bg-gradient-to-r from-primary/20 to-primary/10 text-primary border border-primary/30 hover:border-primary/50"
        >
          Connect Wallet
        </Button>
      </div>
    );
  }

  if (type === "unavailable") {
    return (
      <div className="glass-card p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6 text-yellow-500" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Trading Temporarily Unavailable
        </h3>
        <p className="text-sm text-muted-foreground">
          Market conditions have paused trading. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 text-center">
      <div className="w-10 h-10 rounded-full bg-muted/20 flex items-center justify-center mx-auto mb-3">
        <BarChart3 className="w-5 h-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium text-foreground mb-1">
        No Open Positions
      </h3>
      <p className="text-xs text-muted-foreground">
        Select a leverage level and tap to open your first position
      </p>
    </div>
  );
};

export default EmptyStates;
