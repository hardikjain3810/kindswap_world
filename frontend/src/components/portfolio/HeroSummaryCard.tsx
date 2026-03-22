import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, AlertTriangle, Info, Clock } from "lucide-react";
import { SelectedBundle } from "@/pages/Portfolio";

interface HeroSummaryCardProps {
  privacyMode: boolean;
  selectedBundle: SelectedBundle;
  bundles: Array<{ id: string; name: string; walletCount: number; netWorth: number; change24h: number }>;
}

export const HeroSummaryCard = ({ privacyMode, selectedBundle, bundles }: HeroSummaryCardProps) => {
  const [timeRange, setTimeRange] = useState<"24H" | "7D" | "30D" | "ALL">("24H");
  const [chartMode, setChartMode] = useState<"networth" | "pnl">("networth");

  const netWorth = selectedBundle.type === "wallet" ? 127450.00 : 
    bundles.find(b => b.id === selectedBundle.id)?.netWorth || 0;
  
  const pnlData = {
    "24H": { value: 2340.50, percent: 1.87 },
    "7D": { value: 8920.30, percent: 7.52 },
    "30D": { value: -3450.20, percent: -2.64 },
    "ALL": { value: 45230.00, percent: 55.12 },
  };

  const currentPnl = pnlData[timeRange];
  const isPositive = currentPnl.value >= 0;

  // Generate mock chart data points
  const chartPoints = Array.from({ length: 30 }, (_, i) => ({
    x: i,
    y: 100000 + Math.sin(i * 0.5) * 20000 + Math.random() * 5000 + i * 1000
  }));

  const minY = Math.min(...chartPoints.map(p => p.y));
  const maxY = Math.max(...chartPoints.map(p => p.y));
  const range = maxY - minY;

  const pathD = chartPoints.map((point, i) => {
    const x = (point.x / 29) * 100;
    const y = 100 - ((point.y - minY) / range) * 100;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const areaD = pathD + ` L 100 100 L 0 100 Z`;

  return (
    <Card className="glass-card border-border/50 overflow-hidden hover:shadow-[0_0_40px_hsl(185_80%_55%/0.1)] transition-all duration-500">
      {/* Gradient accent bar */}
      <div className="h-1 bg-gradient-to-r from-ocean-cyan via-ocean-light to-ocean-seafoam" />
      
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          {/* Left - Summary */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Total Net Worth</h2>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-xs gap-1 border-ocean-cyan/30 text-ocean-cyan">
                    <AlertTriangle className="w-3 h-3" />
                    Low Risk
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-sm">
                    Risk level based on portfolio diversification, protocol exposure, and approval risks.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="space-y-2">
              <p className={`text-4xl md:text-5xl font-bold ${privacyMode ? 'blur-md select-none' : ''}`}>
                <span className="gradient-text">${netWorth.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </p>
              
              <div className="flex items-center gap-4 flex-wrap">
                <div className={`flex items-center gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className={`font-semibold ${privacyMode ? 'blur-md select-none' : ''}`}>
                    {isPositive ? '+' : ''}${currentPnl.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className={`text-sm ${privacyMode ? 'blur-md select-none' : ''}`}>
                    ({isPositive ? '+' : ''}{currentPnl.percent}%)
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  Last updated: 2 min ago
                </div>
              </div>
            </div>

            {/* Time Range Toggle */}
            <div className="flex items-center gap-2">
              {(["24H", "7D", "30D", "ALL"] as const).map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                  className="text-xs px-3"
                >
                  {range}
                </Button>
              ))}
            </div>
          </div>

          {/* Right - Chart */}
          <div className="flex-1 min-w-0 lg:max-w-md">
            {/* Chart Mode Toggle */}
            <div className="flex items-center justify-end gap-2 mb-3">
              <Button
                variant={chartMode === "networth" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setChartMode("networth")}
                className="text-xs"
              >
                Net Worth
              </Button>
              <Button
                variant={chartMode === "pnl" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setChartMode("pnl")}
                className="text-xs"
              >
                PnL
              </Button>
            </div>

            {/* SVG Chart */}
            <div className="relative h-32 w-full">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                <defs>
                  <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="hsl(185, 80%, 55%)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="hsl(185, 80%, 55%)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={areaD} fill="url(#chartGradient)" />
                <path d={pathD} fill="none" stroke="hsl(185, 80%, 55%)" strokeWidth="0.5" />
              </svg>
            </div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border/50">
          {[
            { label: "24H PnL", value: "+$2,340.50", change: "+1.87%", positive: true },
            { label: "7D PnL", value: "+$8,920.30", change: "+7.52%", positive: true },
            { label: "30D PnL", value: "-$3,450.20", change: "-2.64%", positive: false },
            { label: "All-Time", value: "+$45,230.00", change: "+55.12%", positive: true },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
              <p className={`font-semibold ${stat.positive ? 'text-green-400' : 'text-red-400'} ${privacyMode ? 'blur-md select-none' : ''}`}>
                {stat.value}
              </p>
              <p className={`text-xs ${stat.positive ? 'text-green-400/70' : 'text-red-400/70'} ${privacyMode ? 'blur-md select-none' : ''}`}>
                {stat.change}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
