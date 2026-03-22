import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Eye, Code } from "lucide-react";
import PinProtection from "@/components/PinProtection";
import PredictionGrid from "@/components/tap-trading/PredictionGrid";
import BetControls from "@/components/tap-trading/BetControls";
import PredictionResult from "@/components/tap-trading/PredictionResult";
import EmptyStates from "@/components/tap-trading/EmptyStates";
import GridPredictionDemo from "@/components/tap-trading/GridPredictionDemo";
import TradingStats from "@/components/tap-trading/TradingStats";
import Leaderboard from "@/components/tap-trading/Leaderboard";
import KindSwapLogo from "@/components/KindSwapLogo";
import TapTradingShowcase from "@/components/tap-trading/TapTradingShowcase";
import { toast } from "@/hooks/use-toast";

interface PlacedBet {
  row: number;
  col: number;
  amount: number;
  multiplier: number;
}

interface BetResult extends PlacedBet {
  won: boolean;
}

const TapTrading = () => {
  const [placedBets, setPlacedBets] = useState<PlacedBet[]>([]);
  const [betAmount, setBetAmount] = useState(5);
  const [roundPhase, setRoundPhase] = useState<'placing' | 'watching' | 'result'>('placing');
  const [priceLinePosition, setPriceLinePosition] = useState(0);
  const [winningCells, setWinningCells] = useState<{ row: number; col: number }[]>([]);
  const [results, setResults] = useState<BetResult[]>([]);
  const [walletBalance, setWalletBalance] = useState(100);
  const [isWalletConnected, setIsWalletConnected] = useState(true);

  useEffect(() => {
    const metaRobots = document.createElement("meta");
    metaRobots.name = "robots";
    metaRobots.content = "noindex, nofollow";
    document.head.appendChild(metaRobots);
    return () => { document.head.removeChild(metaRobots); };
  }, []);

  const handleCellClick = (row: number, col: number, multiplier: number) => {
    if (roundPhase !== 'placing') return;
    
    const exists = placedBets.some((b) => b.row === row && b.col === col);
    if (exists) {
      setPlacedBets(placedBets.filter((b) => !(b.row === row && b.col === col)));
    } else {
      if (placedBets.length >= 10) {
        toast({ title: "Maximum 10 Bets Per Round" });
        return;
      }
      setPlacedBets([...placedBets, { row, col, amount: betAmount, multiplier }]);
    }
  };

  // Natural price line row calculation matching the grid's wave pattern
  const getPriceLineRow = useCallback((progress: number) => {
    const x = progress;
    const baseY = 50;
    const wave1 = Math.sin(x * 0.08) * 25;
    const wave2 = Math.sin(x * 0.15 + 1.5) * 12;
    const wave3 = Math.sin(x * 0.25 + 0.7) * 6;
    const y = baseY + wave1 + wave2 + wave3;
    // Map y (20-80 range) to row (0-4)
    const row = Math.round(((y - 20) / 60) * 4);
    return Math.max(0, Math.min(4, row));
  }, []);

  const startRound = () => {
    const totalStaked = placedBets.reduce((sum, b) => sum + b.amount, 0);
    if (totalStaked > walletBalance) {
      toast({ title: "Insufficient Balance", variant: "destructive" });
      return;
    }
    setWalletBalance((prev) => prev - totalStaked);
    setRoundPhase('watching');
    setPriceLinePosition(0);
    setWinningCells([]);
  };

  useEffect(() => {
    if (roundPhase !== 'watching') return;

    // 10-12 second duration: 100 progress / 0.85 increment * 100ms = ~11.7 seconds
    const interval = setInterval(() => {
      setPriceLinePosition((prev) => {
        const next = prev + 0.85;
        const currentCol = Math.floor((next / 100) * 8);
        const currentRow = getPriceLineRow(next);

        placedBets.forEach((bet) => {
          if (bet.col === currentCol && bet.row === currentRow) {
            if (!winningCells.some((w) => w.row === bet.row && w.col === bet.col)) {
              setWinningCells((prev) => [...prev, { row: bet.row, col: bet.col }]);
              const winAmount = bet.amount * bet.multiplier;
              setWalletBalance((prev) => prev + winAmount);
              toast({ title: `Won $${winAmount.toFixed(2)}!` });
            }
          }
        });

        if (next >= 100) {
          const finalResults: BetResult[] = placedBets.map((bet) => ({
            ...bet,
            won: winningCells.some((w) => w.row === bet.row && w.col === bet.col) ||
                 (bet.col === Math.floor((100 / 100) * 8) && bet.row === getPriceLineRow(100))
          }));
          setResults(finalResults);
          setRoundPhase('result');
          return 100;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [roundPhase, placedBets, getPriceLineRow, winningCells]);

  const newRound = () => {
    setRoundPhase('placing');
    setPlacedBets([]);
    setPriceLinePosition(0);
    setWinningCells([]);
    setResults([]);
  };

  const totalStaked = placedBets.reduce((sum, b) => sum + b.amount, 0);
  const potentialWinnings = placedBets.reduce((sum, b) => sum + b.amount * b.multiplier, 0);
  const totalWinnings = results.filter((r) => r.won).reduce((sum, r) => sum + r.amount * r.multiplier, 0);

  return (
    <PinProtection correctPin="9125">
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-ocean-cyan/15 blur-[120px] animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-ocean-seafoam/15 blur-[100px] animate-float" style={{ animationDelay: "-3s" }} />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`, backgroundSize: "60px 60px" }} />
        </div>

        <div className="fixed top-4 right-4 z-50">
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
            <Eye className="w-3 h-3 mr-1" />Internal Preview
          </Badge>
        </div>

        <header className="relative z-10 border-b border-border/30 bg-background/50 backdrop-blur-xl">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <KindSwapLogo className="w-8 h-8" />
              <span className="font-semibold text-foreground">KindSwap</span>
              <span className="text-muted-foreground">|</span>
              <span className="gradient-text font-medium">Grid Prediction</span>
            </div>
          </div>
        </header>

        <main className="relative z-10 container mx-auto px-4 py-6 lg:py-8">
          {!isWalletConnected ? (
            <EmptyStates type="not-connected" onConnect={() => setIsWalletConnected(true)} />
          ) : (
            <>
              <div className="grid lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3">
                  <PredictionGrid
                    placedBets={placedBets}
                    onCellClick={handleCellClick}
                    betAmount={betAmount}
                    isRoundActive={roundPhase !== 'placing'}
                    priceLinePosition={priceLinePosition}
                    winningCells={winningCells}
                  />
                </div>
                <div className="lg:col-span-2">
                  <BetControls
                    betAmount={betAmount}
                    onBetAmountChange={setBetAmount}
                    totalBets={placedBets.length}
                    totalStaked={totalStaked}
                    potentialWinnings={potentialWinnings}
                    onClearBets={() => setPlacedBets([])}
                    onStartRound={startRound}
                    onNewRound={newRound}
                    roundPhase={roundPhase}
                    walletBalance={walletBalance}
                  />
                </div>
              </div>

              {roundPhase === 'result' && (
                <PredictionResult results={results} totalWinnings={totalWinnings} totalStaked={totalStaked} />
              )}

              <GridPredictionDemo />
              <TapTradingShowcase />
              <TradingStats />
              <Leaderboard />

              <div className="mt-12 glass-card p-6 border-dashed border-2 border-border/50">
                <div className="flex items-center gap-2 mb-4">
                  <Code className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Developer Notes</h3>
                </div>
                <p className="text-sm text-muted-foreground">Grid-based prediction trading interface. Demo mode only.</p>
              </div>
            </>
          )}
        </main>
      </div>
    </PinProtection>
  );
};

export default TapTrading;
