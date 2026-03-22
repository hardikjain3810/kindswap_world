import { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const DEMO_ROWS = 4;
const DEMO_COLS = 6;

interface DemoBet {
  row: number;
  col: number;
  amount: number;
  multiplier: number;
}

// Generate demo multipliers
const generateDemoMultipliers = (): number[][] => {
  const multipliers: number[][] = [];
  for (let r = 0; r < DEMO_ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < DEMO_COLS; c++) {
      const distFromCenter = Math.abs(r - 1.5);
      const base = 1.5 + distFromCenter * 0.6;
      const variation = (Math.sin(r * 5 + c * 11) + 1) * 0.5;
      row.push(Math.round((base + variation) * 10) / 10);
    }
    multipliers.push(row);
  }
  return multipliers;
};

const DEMO_MULTIPLIERS = generateDemoMultipliers();

const SolanaLogo = ({ className = "w-5 h-5" }: { className?: string }) => (
  <div className={`${className} rounded-full bg-gradient-to-br from-ocean-cyan to-ocean-seafoam p-0.5`}>
    <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
      <svg viewBox="0 0 128 128" className="w-3/4 h-3/4">
        <defs>
          <linearGradient id="solana-demo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--ocean-cyan))" />
            <stop offset="100%" stopColor="hsl(var(--ocean-seafoam))" />
          </linearGradient>
        </defs>
        <path fill="url(#solana-demo-grad)" d="M93.5 42.1c-.8-.8-1.8-1.2-2.9-1.2H25.9c-1.8 0-2.7 2.2-1.4 3.5l14.7 14.7c.8.8 1.8 1.2 2.9 1.2h64.7c1.8 0 2.7-2.2 1.4-3.5L93.5 42.1z"/>
        <path fill="url(#solana-demo-grad)" d="M93.5 85.4c-.8-.8-1.8-1.2-2.9-1.2H25.9c-1.8 0-2.7 2.2-1.4 3.5l14.7 14.7c.8.8 1.8 1.2 2.9 1.2h64.7c1.8 0 2.7-2.2 1.4-3.5L93.5 85.4z"/>
        <path fill="url(#solana-demo-grad)" d="M39.2 70.5c.8.8 1.8 1.2 2.9 1.2h64.7c1.8 0 2.7-2.2 1.4-3.5L93.5 53.5c-.8-.8-1.8-1.2-2.9-1.2H25.9c-1.8 0-2.7 2.2-1.4 3.5l14.7 14.7z"/>
      </svg>
    </div>
  </div>
);

const GridPredictionDemo = () => {
  const [phase, setPhase] = useState<'placing' | 'watching' | 'result'>('placing');
  const [placedBets, setPlacedBets] = useState<DemoBet[]>([]);
  const [betAmount, setBetAmount] = useState(5);
  const [priceLineProgress, setPriceLineProgress] = useState(0);
  const [winningCells, setWinningCells] = useState<{ row: number; col: number }[]>([]);
  const [totalWinnings, setTotalWinnings] = useState(0);

  const handleCellClick = (row: number, col: number) => {
    if (phase !== 'placing') return;
    if (placedBets.length >= 6) {
      toast({
        title: "Maximum Bets Reached",
        description: "You Can Place Up To 6 Bets Per Round In The Demo",
      });
      return;
    }

    const exists = placedBets.some((b) => b.row === row && b.col === col);
    if (exists) {
      setPlacedBets(placedBets.filter((b) => !(b.row === row && b.col === col)));
    } else {
      setPlacedBets([...placedBets, {
        row,
        col,
        amount: betAmount,
        multiplier: DEMO_MULTIPLIERS[row][col],
      }]);
    }
  };

  const getPriceLineRow = useCallback((progress: number) => {
    // Simulate price movement through rows
    const positions = [2, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1];
    const index = Math.floor((progress / 100) * (positions.length - 1));
    return positions[Math.min(index, positions.length - 1)];
  }, []);

  const startRound = () => {
    if (placedBets.length === 0) return;
    setPhase('watching');
    setPriceLineProgress(0);
    setWinningCells([]);
    setTotalWinnings(0);
  };

  useEffect(() => {
    if (phase !== 'watching') return;

    const interval = setInterval(() => {
      setPriceLineProgress((prev) => {
        const next = prev + 2;
        
        // Check for wins as price line moves
        const currentCol = Math.floor((next / 100) * DEMO_COLS);
        const currentRow = getPriceLineRow(next);
        
        placedBets.forEach((bet) => {
          if (bet.col === currentCol && bet.row === currentRow) {
            if (!winningCells.some((w) => w.row === bet.row && w.col === bet.col)) {
              setWinningCells((prev) => [...prev, { row: bet.row, col: bet.col }]);
              setTotalWinnings((prev) => prev + bet.amount * bet.multiplier);
              toast({
                title: `You Won $${(bet.amount * bet.multiplier).toFixed(2)}!`,
                description: `${bet.multiplier}X Multiplier Hit`,
              });
            }
          }
        });

        if (next >= 100) {
          setPhase('result');
          return 100;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [phase, placedBets, getPriceLineRow, winningCells]);

  const resetDemo = () => {
    setPhase('placing');
    setPlacedBets([]);
    setPriceLineProgress(0);
    setWinningCells([]);
    setTotalWinnings(0);
  };

  const totalStaked = placedBets.reduce((sum, b) => sum + b.amount, 0);
  const potentialWinnings = placedBets.reduce((sum, b) => sum + b.amount * b.multiplier, 0);

  return (
    <section className="mt-16">
      <div className="text-center mb-8">
        <Badge variant="outline" className="mb-4 bg-ocean-cyan/10 text-ocean-cyan border-ocean-cyan/30">
          Interactive Demo
        </Badge>
        <h2 className="text-2xl lg:text-3xl font-bold gradient-text mb-3">
          Try Grid Prediction
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Tap cells to place bets, then watch the price line move. Win when it crosses your blocks!
        </p>
      </div>

      <div className="glass-card rounded-2xl p-4 lg:p-6 max-w-4xl mx-auto">
        {/* Demo Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <SolanaLogo />
            <span className="font-medium text-foreground">SOL-PERP</span>
            <span className="text-sm text-muted-foreground">$178.45</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs px-2 py-1 rounded-full",
              phase === 'placing' && "bg-ocean-cyan/20 text-ocean-cyan",
              phase === 'watching' && "bg-amber-500/20 text-amber-500",
              phase === 'result' && "bg-ocean-seafoam/20 text-ocean-seafoam"
            )}>
              {phase === 'placing' && "Place Bets"}
              {phase === 'watching' && "Watching..."}
              {phase === 'result' && "Complete"}
            </span>
          </div>
        </div>

        {/* Demo Grid */}
        <div className="relative aspect-[3/2] bg-gradient-to-br from-background via-background to-ocean-cyan/5 rounded-xl border border-border/50 overflow-hidden mb-4">
          {/* Grid Lines */}
          <div 
            className="absolute inset-0" 
            style={{
              backgroundImage: `
                linear-gradient(to right, hsl(var(--ocean-cyan) / 0.15) 1px, transparent 1px),
                linear-gradient(to bottom, hsl(var(--ocean-cyan) / 0.15) 1px, transparent 1px)
              `,
              backgroundSize: `${100 / DEMO_COLS}% ${100 / DEMO_ROWS}%`
            }} 
          />

          {/* Clickable Cells */}
          <div 
            className="absolute inset-0 grid p-2"
            style={{ 
              gridTemplateColumns: `repeat(${DEMO_COLS}, 1fr)`,
              gridTemplateRows: `repeat(${DEMO_ROWS}, 1fr)`,
            }}
          >
            {Array.from({ length: DEMO_ROWS }).map((_, row) =>
              Array.from({ length: DEMO_COLS }).map((_, col) => {
                const multiplier = DEMO_MULTIPLIERS[row][col];
                const hasBet = placedBets.some((b) => b.row === row && b.col === col);
                const isWin = winningCells.some((w) => w.row === row && w.col === col);

                return (
                  <button
                    key={`${row}-${col}`}
                    onClick={() => handleCellClick(row, col)}
                    disabled={phase !== 'placing'}
                    className={cn(
                      "relative flex flex-col items-center justify-center rounded-lg transition-all duration-200 m-0.5",
                      phase === 'placing' && "hover:bg-ocean-cyan/10 hover:scale-105 cursor-pointer",
                      phase !== 'placing' && "cursor-default"
                    )}
                  >
                    {hasBet ? (
                      <div 
                        className={cn(
                          "absolute inset-0.5 flex flex-col items-center justify-center rounded-lg",
                          isWin 
                            ? "bg-gradient-to-br from-amber-400 to-amber-500 shadow-lg animate-block-win" 
                            : "bg-gradient-to-br from-ocean-seafoam to-ocean-cyan/80 shadow-lg shadow-ocean-cyan/30",
                          "border border-white/20"
                        )}
                      >
                        <span className="text-[9px] font-bold text-background">{multiplier}X</span>
                        <span className="text-[10px] font-bold text-background">${betAmount}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-ocean-cyan/50 font-medium">{multiplier}X</span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Animated Price Line */}
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none" 
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            <defs>
              <filter id="demo-glow">
                <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {phase !== 'placing' && (
              <path 
                d={`M 0 ${25 + getPriceLineRow(0) * 12.5} ${Array.from({ length: 50 }).map((_, i) => {
                  const progress = (i / 50) * 100;
                  if (progress > priceLineProgress) return '';
                  const x = (i / 50) * 100;
                  const row = getPriceLineRow(progress);
                  const y = 12.5 + row * 18.75;
                  return `L ${x} ${y}`;
                }).join(' ')}`}
                fill="none" 
                stroke="hsl(var(--ocean-cyan))" 
                strokeWidth="1.2"
                strokeLinecap="round"
                filter="url(#demo-glow)"
                className="animate-price-line-glow"
              />
            )}
          </svg>

          {/* Win Floaters */}
          {winningCells.map((cell, i) => {
            const bet = placedBets.find((b) => b.row === cell.row && b.col === cell.col);
            if (!bet) return null;
            return (
              <div
                key={i}
                className="absolute animate-win-float pointer-events-none"
                style={{
                  left: `${(cell.col / DEMO_COLS) * 100 + 8}%`,
                  top: `${(cell.row / DEMO_ROWS) * 100 + 5}%`,
                }}
              >
                <span className="bg-ocean-seafoam text-background text-xs font-bold px-2 py-0.5 rounded-full">
                  +${(bet.amount * bet.multiplier).toFixed(0)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 gap-4">
          {/* Bet Amount */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Bet Amount</p>
            <div className="flex gap-1">
              {[1, 5, 10].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setBetAmount(amt)}
                  disabled={phase !== 'placing'}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-sm font-medium transition-all",
                    betAmount === amt
                      ? "bg-ocean-cyan text-background"
                      : "glass-card text-foreground",
                    phase !== 'placing' && "opacity-50"
                  )}
                >
                  ${amt}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-1">
              {phase === 'result' ? 'Won' : 'Potential'}
            </p>
            <p className="text-lg font-bold text-ocean-cyan">
              ${phase === 'result' ? totalWinnings.toFixed(2) : potentialWinnings.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              Staked: ${totalStaked.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-4">
          {phase === 'placing' && (
            <Button
              onClick={startRound}
              disabled={placedBets.length === 0}
              className="w-full bg-gradient-to-r from-ocean-cyan to-ocean-seafoam text-background"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Round ({placedBets.length} bet{placedBets.length !== 1 ? 's' : ''})
            </Button>
          )}
          {phase === 'watching' && (
            <Button disabled className="w-full bg-muted text-muted-foreground">
              <Pause className="w-4 h-4 mr-2 animate-pulse" />
              Watching Price...
            </Button>
          )}
          {phase === 'result' && (
            <Button
              onClick={resetDemo}
              className="w-full bg-gradient-to-r from-ocean-cyan to-ocean-seafoam text-background"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};

export default GridPredictionDemo;
