import { useMemo } from "react";

interface DataPoint {
  date: string;
  value: number;
}

interface ProbabilityChartProps {
  data: DataPoint[];
}

export const ProbabilityChart = ({ data }: ProbabilityChartProps) => {
  const { path, points, minY, maxY } = useMemo(() => {
    if (data.length === 0) return { path: "", points: [], minY: 0, maxY: 100 };

    const padding = 10;
    const minY = Math.max(0, Math.min(...data.map((d) => d.value)) - padding);
    const maxY = Math.min(100, Math.max(...data.map((d) => d.value)) + padding);
    const range = maxY - minY;

    const width = 100;
    const height = 50;

    const points = data.map((d, i) => ({
      x: (i / (data.length - 1)) * width,
      y: height - ((d.value - minY) / range) * height,
      ...d
    }));

    const path = points.reduce((acc, point, i) => {
      if (i === 0) return `M ${point.x} ${point.y}`;
      
      // Smooth curve using bezier
      const prev = points[i - 1];
      const cp1x = prev.x + (point.x - prev.x) / 3;
      const cp1y = prev.y;
      const cp2x = prev.x + 2 * (point.x - prev.x) / 3;
      const cp2y = point.y;
      
      return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${point.x} ${point.y}`;
    }, "");

    return { path, points, minY, maxY };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
        No historical data available
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Y-Axis Labels */}
      <div className="absolute left-0 top-0 bottom-6 w-10 flex flex-col justify-between text-xs text-muted-foreground">
        <span>{maxY}%</span>
        <span>{Math.round((maxY + minY) / 2)}%</span>
        <span>{minY}%</span>
      </div>

      {/* Chart Area */}
      <div className="ml-12 relative">
        <svg
          viewBox="0 0 100 50"
          className="w-full h-48"
          preserveAspectRatio="none"
        >
          {/* Grid Lines */}
          <defs>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--ocean-cyan))" stopOpacity="0.5" />
              <stop offset="100%" stopColor="hsl(var(--ocean-cyan))" stopOpacity="1" />
            </linearGradient>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--ocean-cyan))" stopOpacity="0.2" />
              <stop offset="100%" stopColor="hsl(var(--ocean-cyan))" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Lines */}
          {[0, 25, 50].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="hsl(var(--border))"
              strokeWidth="0.2"
              strokeOpacity="0.5"
            />
          ))}

          {/* Area Fill */}
          <path
            d={`${path} L 100 50 L 0 50 Z`}
            fill="url(#areaGradient)"
          />

          {/* Main Line */}
          <path
            d={path}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {points.map((point, i) => (
            <circle
              key={i}
              cx={point.x}
              cy={point.y}
              r="1"
              fill="hsl(var(--ocean-cyan))"
              className="opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            />
          ))}
        </svg>

        {/* X-Axis Labels */}
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          {data.map((d, i) => (
            <span key={i} className={i === 0 || i === data.length - 1 ? "" : "hidden md:inline"}>
              {d.date}
            </span>
          ))}
        </div>
      </div>

      {/* Current Value */}
      <div className="absolute top-2 right-2 bg-ocean-cyan/10 border border-ocean-cyan/30 rounded-lg px-3 py-1.5">
        <span className="text-lg font-bold text-ocean-cyan">{data[data.length - 1]?.value}%</span>
      </div>
    </div>
  );
};
