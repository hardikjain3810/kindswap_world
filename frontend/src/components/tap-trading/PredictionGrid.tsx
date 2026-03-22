import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface PlacedBet {
  row: number;
  col: number;
  amount: number;
  multiplier: number;
}

interface PredictionGridProps {
  placedBets: PlacedBet[];
  onCellClick: (row: number, col: number, multiplier: number) => void;
  betAmount: number;
  isRoundActive: boolean;
  priceLinePosition: number;
  winningCells: { row: number; col: number }[];
}

const ROWS = 5;
const COLS = 8;

// Generate consistent multipliers for the grid
const generateMultipliers = (): number[][] => {
  const multipliers: number[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < COLS; c++) {
      // Higher multipliers at edges, lower in middle
      const distFromCenter = Math.abs(r - 2);
      const base = 1.5 + distFromCenter * 0.5;
      const variation = (Math.sin(r * 3 + c * 7) + 1) * 0.8;
      row.push(Math.round((base + variation) * 10) / 10);
    }
    multipliers.push(row);
  }
  return multipliers;
};

const MULTIPLIERS = generateMultipliers();

const SolanaLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <div className={`${className} rounded-full bg-gradient-to-br from-ocean-cyan to-ocean-seafoam p-0.5`}>
    <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
      <svg viewBox="0 0 128 128" className="w-3/4 h-3/4">
        <defs>
          <linearGradient id="solana-grid-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--ocean-cyan))" />
            <stop offset="100%" stopColor="hsl(var(--ocean-seafoam))" />
          </linearGradient>
        </defs>
        <path fill="url(#solana-grid-grad)" d="M93.5 42.1c-.8-.8-1.8-1.2-2.9-1.2H25.9c-1.8 0-2.7 2.2-1.4 3.5l14.7 14.7c.8.8 1.8 1.2 2.9 1.2h64.7c1.8 0 2.7-2.2 1.4-3.5L93.5 42.1z"/>
        <path fill="url(#solana-grid-grad)" d="M93.5 85.4c-.8-.8-1.8-1.2-2.9-1.2H25.9c-1.8 0-2.7 2.2-1.4 3.5l14.7 14.7c.8.8 1.8 1.2 2.9 1.2h64.7c1.8 0 2.7-2.2 1.4-3.5L93.5 85.4z"/>
        <path fill="url(#solana-grid-grad)" d="M39.2 70.5c.8.8 1.8 1.2 2.9 1.2h64.7c1.8 0 2.7-2.2 1.4-3.5L93.5 53.5c-.8-.8-1.8-1.2-2.9-1.2H25.9c-1.8 0-2.7 2.2-1.4 3.5l14.7 14.7z"/>
      </svg>
    </div>
  </div>
);

const PredictionGrid = ({
  placedBets,
  onCellClick,
  betAmount,
  isRoundActive,
  priceLinePosition,
  winningCells,
}: PredictionGridProps) => {
  const [currentPrice] = useState(178.45);

  const isBetPlaced = (row: number, col: number) => {
    return placedBets.some((bet) => bet.row === row && bet.col === col);
  };

  const isWinningCell = (row: number, col: number) => {
    return winningCells.some((cell) => cell.row === row && cell.col === col);
  };

  const getBetAtCell = (row: number, col: number) => {
    return placedBets.find((bet) => bet.row === row && bet.col === col);
  };

  // Calculate price line Y position with natural movement using multiple sine waves
  const getPriceLineY = useCallback((x: number) => {
    const baseY = 50;
    // Combine multiple frequencies for organic movement
    const wave1 = Math.sin(x * 0.08) * 25; // slow primary wave
    const wave2 = Math.sin(x * 0.15 + 1.5) * 12; // medium secondary wave
    const wave3 = Math.sin(x * 0.25 + 0.7) * 6; // fast detail wave
    return baseY + wave1 + wave2 + wave3;
  }, []);

  return (
    <div className="glass-card p-4 rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-ocean-cyan/30">
          <SolanaLogo className="w-5 h-5" />
          <span className="text-xs font-medium text-ocean-cyan">SOL-PERP</span>
          <span className="text-sm font-bold text-foreground">${currentPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isRoundActive ? "bg-ocean-cyan animate-pulse" : "bg-muted-foreground"
          )} />
          <span className="text-xs text-muted-foreground">
            {isRoundActive ? "LIVE" : "READY"}
          </span>
        </div>
      </div>

      {/* Grid Container */}
      <div className="relative aspect-[16/9] bg-gradient-to-br from-background via-background to-ocean-cyan/5 rounded-xl border border-border/50 overflow-hidden">
        {/* Grid Lines */}
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: `
              linear-gradient(to right, hsl(var(--ocean-cyan) / 0.1) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(var(--ocean-cyan) / 0.1) 1px, transparent 1px)
            `,
            backgroundSize: `${100 / COLS}% ${100 / ROWS}%`
          }} 
        />

        {/* Price Scale */}
        <div className="absolute right-2 top-2 bottom-2 flex flex-col justify-between text-[9px] text-muted-foreground/60">
          {['$190', '$185', '$180', '$175', '$170'].map((price, i) => (
            <span key={i}>{price}</span>
          ))}
        </div>

        {/* Clickable Grid Cells */}
        <div 
          className="absolute inset-0 grid"
          style={{ 
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridTemplateRows: `repeat(${ROWS}, 1fr)`,
            padding: '8px',
            paddingRight: '32px'
          }}
        >
          {Array.from({ length: ROWS }).map((_, row) =>
            Array.from({ length: COLS }).map((_, col) => {
              const multiplier = MULTIPLIERS[row][col];
              const hasBet = isBetPlaced(row, col);
              const isWin = isWinningCell(row, col);
              const bet = getBetAtCell(row, col);

              return (
                <button
                  key={`${row}-${col}`}
                  onClick={() => !isRoundActive && onCellClick(row, col, multiplier)}
                  disabled={isRoundActive}
                  className={cn(
                    "relative flex flex-col items-center justify-center rounded-lg transition-all duration-200",
                    "hover:bg-ocean-cyan/10 hover:scale-105",
                    !hasBet && "border border-transparent hover:border-ocean-cyan/30",
                    isRoundActive && "cursor-not-allowed opacity-70"
                  )}
                >
                  {hasBet ? (
                    <div 
                      className={cn(
                        "absolute inset-1 flex flex-col items-center justify-center rounded-lg animate-block-place",
                        isWin 
                          ? "bg-gradient-to-br from-amber-400 to-amber-500 shadow-lg animate-block-win" 
                          : "bg-gradient-to-br from-ocean-seafoam to-ocean-cyan/80 shadow-lg shadow-ocean-cyan/30",
                        "border border-white/20"
                      )}
                    >
                      <span className="text-[10px] font-bold text-background">{multiplier}X</span>
                      <span className="text-xs font-bold text-background">${bet?.amount}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-ocean-cyan/40 font-medium">{multiplier}X</span>
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
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          {isRoundActive && (
            <path 
              d={`M 0 ${getPriceLineY(0)} ${Array.from({ length: 50 }).map((_, i) => {
                const x = (i + 1) * 2;
                if (x > priceLinePosition) return '';
                return `L ${x} ${getPriceLineY(x)}`;
              }).filter(Boolean).join(' ')}`}
              fill="none" 
              stroke="hsl(var(--ocean-cyan))" 
              strokeWidth="0.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#glow)"
            />
          )}
        </svg>

        {/* Win Indicators */}
        {winningCells.map((cell, index) => {
          const bet = getBetAtCell(cell.row, cell.col);
          if (!bet) return null;
          const winAmount = (bet.amount * bet.multiplier).toFixed(2);
          
          return (
            <div
              key={index}
              className="absolute animate-win-float"
              style={{
                left: `${(cell.col / COLS) * 100 + 5}%`,
                top: `${(cell.row / ROWS) * 100}%`,
              }}
            >
              <div className="flex items-center gap-1 bg-ocean-seafoam/90 backdrop-blur-sm rounded-full px-2 py-0.5">
                <span className="text-xs font-bold text-background">+${winAmount}</span>
              </div>
            </div>
          );
        })}

        {/* Time Markers */}
        <div className="absolute bottom-1 left-2 right-10 flex justify-between text-[8px] text-muted-foreground/40">
          {['12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45'].map((time, i) => (
            <span key={i}>{time}</span>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
        <span>Tap cells to place ${betAmount} bets</span>
        <span>{placedBets.length} bet{placedBets.length !== 1 ? 's' : ''} placed</span>
      </div>
    </div>
  );
};

export default PredictionGrid;
