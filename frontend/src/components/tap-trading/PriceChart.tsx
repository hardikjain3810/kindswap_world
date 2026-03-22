import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const assets = [
  { symbol: "SOL", name: "Solana", price: 178.45, change: 2.34 },
  { symbol: "BTC", name: "Bitcoin", price: 42350.0, change: -0.87 },
  { symbol: "ETH", name: "Ethereum", price: 2650.75, change: 1.56 },
];

// Mock price data
const generateChartData = (basePrice: number) => {
  const data = [];
  let price = basePrice * 0.95;
  for (let i = 0; i < 48; i++) {
    price = price + (Math.random() - 0.48) * (basePrice * 0.01);
    data.push({
      time: `${Math.floor(i / 2)}:${i % 2 === 0 ? "00" : "30"}`,
      price: Math.max(price, basePrice * 0.9),
    });
  }
  return data;
};

const timeframes = ["1m", "5m", "15m", "1h", "4h"];

const PriceChart = () => {
  const [selectedAsset, setSelectedAsset] = useState(assets[0]);
  const [chartType, setChartType] = useState<"line" | "candle">("line");
  const [selectedTimeframe, setSelectedTimeframe] = useState("15m");

  const chartData = generateChartData(selectedAsset.price);
  const isPositive = selectedAsset.change >= 0;

  return (
    <div className="glass-card p-6 h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* Asset Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 bg-background/50">
                <span className="font-semibold">{selectedAsset.symbol}-PERP</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="glass-card border-border/50">
              {assets.map((asset) => (
                <DropdownMenuItem
                  key={asset.symbol}
                  onClick={() => setSelectedAsset(asset)}
                  className="cursor-pointer"
                >
                  <span className="font-medium">{asset.symbol}-PERP</span>
                  <span className="ml-2 text-muted-foreground">{asset.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Price Display */}
          <div>
            <div className="text-2xl font-bold text-foreground">
              ${selectedAsset.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className={`flex items-center gap-1 text-sm ${isPositive ? "text-green-400" : "text-red-400"}`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{isPositive ? "+" : ""}{selectedAsset.change.toFixed(2)}%</span>
              <span className="text-muted-foreground ml-1">24h</span>
            </div>
          </div>
        </div>

        {/* Chart Controls */}
        <div className="flex items-center gap-2">
          {/* Chart Type Toggle */}
          <div className="flex bg-background/50 rounded-lg p-1">
            <button
              onClick={() => setChartType("line")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                chartType === "line"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Line
            </button>
            <button
              onClick={() => setChartType("candle")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                chartType === "candle"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Candle
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[300px] lg:h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--ocean-cyan))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--ocean-cyan))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={["auto", "auto"]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
              width={80}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              }}
              labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              formatter={(value: number) => [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, "Price"]}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke="hsl(var(--ocean-cyan))"
              strokeWidth={2}
              fill="url(#priceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Timeframe Selector */}
      <div className="flex items-center justify-center gap-1 mt-4">
        {timeframes.map((tf) => (
          <button
            key={tf}
            onClick={() => setSelectedTimeframe(tf)}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              selectedTimeframe === tf
                ? "bg-primary/20 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PriceChart;
