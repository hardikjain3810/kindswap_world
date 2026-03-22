import { CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BetResult {
  row: number;
  col: number;
  amount: number;
  multiplier: number;
  won: boolean;
}

interface PredictionResultProps {
  results: BetResult[];
  totalWinnings: number;
  totalStaked: number;
}

const PredictionResult = ({ results, totalWinnings, totalStaked }: PredictionResultProps) => {
  const wins = results.filter((r) => r.won);
  const losses = results.filter((r) => !r.won);
  const netProfit = totalWinnings - totalStaked;
  const isProfit = netProfit > 0;

  return (
    <div className="glass-card p-4 rounded-2xl mt-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Round Results</h3>
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
          isProfit 
            ? "bg-ocean-seafoam/20 text-ocean-seafoam" 
            : netProfit < 0 
              ? "bg-destructive/20 text-destructive" 
              : "bg-muted text-muted-foreground"
        )}>
          <TrendingUp className={cn("w-3 h-3", !isProfit && netProfit < 0 && "rotate-180")} />
          {isProfit ? '+' : ''}{netProfit.toFixed(2)}
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Wins */}
        <div className="glass-card rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-ocean-seafoam" />
            <span className="text-sm font-medium text-foreground">Wins ({wins.length})</span>
          </div>
          <div className="space-y-1">
            {wins.length > 0 ? wins.map((result, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{result.multiplier}X</span>
                <span className="text-ocean-seafoam">+${(result.amount * result.multiplier).toFixed(2)}</span>
              </div>
            )) : (
              <p className="text-xs text-muted-foreground">No wins this round</p>
            )}
          </div>
        </div>

        {/* Losses */}
        <div className="glass-card rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-destructive" />
            <span className="text-sm font-medium text-foreground">Losses ({losses.length})</span>
          </div>
          <div className="space-y-1">
            {losses.length > 0 ? losses.map((result, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{result.multiplier}X</span>
                <span className="text-destructive">-${result.amount.toFixed(2)}</span>
              </div>
            )) : (
              <p className="text-xs text-muted-foreground">No losses!</p>
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="border-t border-border/50 pt-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Staked</span>
          <span className="text-foreground">${totalStaked.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Winnings</span>
          <span className="text-ocean-cyan">${totalWinnings.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm font-semibold">
          <span className="text-foreground">Net Profit</span>
          <span className={isProfit ? "text-ocean-seafoam" : netProfit < 0 ? "text-destructive" : "text-foreground"}>
            {isProfit ? '+' : ''}{netProfit.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PredictionResult;
