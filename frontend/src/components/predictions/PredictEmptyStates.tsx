import { Button } from "@/components/ui/button";
import { Search, Wallet, Clock, AlertCircle, CheckCircle, DollarSign } from "lucide-react";

interface PredictEmptyStatesProps {
  type: "no-markets" | "not-connected" | "no-positions" | "resolved" | "paused" | "insufficient-balance";
  onConnect?: () => void;
  onAction?: () => void;
}

export const PredictEmptyStates = ({ type, onConnect, onAction }: PredictEmptyStatesProps) => {
  const states = {
    "no-markets": {
      icon: Search,
      title: "No markets found",
      description: "Try adjusting your filters or search query to find more markets.",
      action: null
    },
    "not-connected": {
      icon: Wallet,
      title: "Connect Wallet to View",
      description: "Connect your wallet to view your positions and participation history.",
      action: { label: "Connect Wallet", onClick: onConnect }
    },
    "no-positions": {
      icon: Clock,
      title: "No Active Positions",
      description: "You haven't participated in any markets yet. Browse available markets to get started.",
      action: { label: "Browse Markets", onClick: onAction }
    },
    "resolved": {
      icon: CheckCircle,
      title: "Market Resolved",
      description: "This market has been resolved. View the final outcome and settlement details below.",
      action: null
    },
    "paused": {
      icon: AlertCircle,
      title: "Trading Temporarily Paused",
      description: "Trading on this market is temporarily paused for review. Please check back soon.",
      action: null
    },
    "insufficient-balance": {
      icon: DollarSign,
      title: "Insufficient Balance",
      description: "Add USDC to your wallet to participate in this market.",
      action: { label: "Add Funds", onClick: onAction }
    }
  };

  const state = states[type];
  const Icon = state.icon;

  return (
    <div className="glass-card rounded-xl p-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      
      <h3 className="text-lg font-semibold mb-2">{state.title}</h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">{state.description}</p>
      
      {state.action && (
        <Button 
          onClick={state.action.onClick}
          className="bg-ocean-cyan hover:bg-ocean-cyan/90"
        >
          {state.action.label}
        </Button>
      )}
    </div>
  );
};
