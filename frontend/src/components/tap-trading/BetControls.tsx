import { useState } from 'react';
import { Trash2, Play, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BetControlsProps {
  betAmount: number;
  onBetAmountChange: (amount: number) => void;
  totalBets: number;
  totalStaked: number;
  potentialWinnings: number;
  onClearBets: () => void;
  onStartRound: () => void;
  onNewRound: () => void;
  roundPhase: 'placing' | 'watching' | 'result';
  walletBalance: number;
}

const presetAmounts = [1, 5, 10, 25];

const BetControls = ({
  betAmount,
  onBetAmountChange,
  totalBets,
  totalStaked,
  potentialWinnings,
  onClearBets,
  onStartRound,
  onNewRound,
  roundPhase,
  walletBalance,
}: BetControlsProps) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const handlePresetClick = (amount: number) => {
    onBetAmountChange(amount);
    setShowCustom(false);
  };

  const handleCustomChange = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      setCustomValue(value);
      onBetAmountChange(numValue);
    } else if (value === '') {
      setCustomValue('');
    }
  };

  return (
    <div className="glass-card p-4 rounded-2xl space-y-4">
      {/* Wallet Balance */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Wallet Balance</span>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-ocean-seafoam animate-pulse" />
          <span className="font-semibold text-foreground">${walletBalance.toFixed(2)}</span>
        </div>
      </div>

      {/* Bet Amount Selector */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Bet Amount per Cell</p>
        <div className="flex gap-2">
          {presetAmounts.map((amount) => (
            <button
              key={amount}
              onClick={() => handlePresetClick(amount)}
              disabled={roundPhase !== 'placing'}
              className={cn(
                "flex-1 py-2 rounded-lg font-medium transition-all duration-200",
                betAmount === amount && !showCustom
                  ? "bg-ocean-cyan text-background"
                  : "glass-card hover:border-ocean-cyan/30 text-foreground",
                roundPhase !== 'placing' && "opacity-50 cursor-not-allowed"
              )}
            >
              ${amount}
            </button>
          ))}
          <button
            onClick={() => setShowCustom(true)}
            disabled={roundPhase !== 'placing'}
            className={cn(
              "flex-1 py-2 rounded-lg font-medium transition-all duration-200",
              showCustom
                ? "bg-ocean-cyan text-background"
                : "glass-card hover:border-ocean-cyan/30 text-foreground",
              roundPhase !== 'placing' && "opacity-50 cursor-not-allowed"
            )}
          >
            Custom
          </button>
        </div>
        
        {showCustom && (
          <input
            type="number"
            value={customValue}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder="Enter amount"
            className="w-full mt-2 px-3 py-2 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ocean-cyan/50"
          />
        )}
      </div>

      {/* Bet Summary */}
      <div className="glass-card rounded-xl p-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Bets</span>
          <span className="text-foreground">{totalBets}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Staked</span>
          <span className="text-foreground">${totalStaked.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm border-t border-border/50 pt-2">
          <span className="text-muted-foreground">Potential Win</span>
          <span className="text-ocean-cyan font-semibold">${potentialWinnings.toFixed(2)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {roundPhase === 'placing' && (
          <>
            <Button
              variant="outline"
              onClick={onClearBets}
              disabled={totalBets === 0}
              className="flex-1"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
            <Button
              onClick={onStartRound}
              disabled={totalBets === 0 || totalStaked > walletBalance}
              className="flex-1 bg-gradient-to-r from-ocean-cyan to-ocean-seafoam text-background hover:opacity-90"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Round
            </Button>
          </>
        )}

        {roundPhase === 'watching' && (
          <Button
            disabled
            className="w-full bg-muted text-muted-foreground"
          >
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Watching Price...
          </Button>
        )}

        {roundPhase === 'result' && (
          <Button
            onClick={onNewRound}
            className="w-full bg-gradient-to-r from-ocean-cyan to-ocean-seafoam text-background hover:opacity-90"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            New Round
          </Button>
        )}
      </div>

      {/* Risk Warning */}
      <p className="text-[10px] text-muted-foreground/70 text-center">
        Demo mode - no real funds at risk
      </p>
    </div>
  );
};

export default BetControls;
