import { Trophy, TrendingUp, Target } from "lucide-react";

interface Forecaster {
  rank: number;
  wallet: string;
  accuracy: number;
  marketsParticipated: number;
  points: number;
}

const mockForecasters: Forecaster[] = [
  { rank: 1, wallet: "8xK4...mN9p", accuracy: 78.5, marketsParticipated: 142, points: 15420 },
  { rank: 2, wallet: "3jF7...qR2s", accuracy: 75.2, marketsParticipated: 198, points: 14890 },
  { rank: 3, wallet: "9nL2...wX5t", accuracy: 73.8, marketsParticipated: 156, points: 13650 },
  { rank: 4, wallet: "2kM8...pY3u", accuracy: 71.4, marketsParticipated: 203, points: 12340 },
  { rank: 5, wallet: "6hQ1...vZ7w", accuracy: 70.9, marketsParticipated: 167, points: 11890 },
  { rank: 6, wallet: "5gP4...nA8x", accuracy: 69.2, marketsParticipated: 145, points: 10560 },
  { rank: 7, wallet: "1fN6...mB9y", accuracy: 68.7, marketsParticipated: 189, points: 9870 },
  { rank: 8, wallet: "7eM9...kC2z", accuracy: 67.3, marketsParticipated: 134, points: 9120 },
  { rank: 9, wallet: "4dL3...jD5a", accuracy: 66.1, marketsParticipated: 178, points: 8450 },
  { rank: 10, wallet: "0cK7...iE8b", accuracy: 65.4, marketsParticipated: 156, points: 7890 }
];

const getRankStyle = (rank: number) => {
  switch (rank) {
    case 1:
      return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
    case 2:
      return "bg-gray-400/10 text-gray-300 border-gray-400/30";
    case 3:
      return "bg-orange-500/10 text-orange-400 border-orange-500/30";
    default:
      return "bg-muted/50 text-muted-foreground border-transparent";
  }
};

export const PredictLeaderboard = () => {
  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-6 h-6 text-ocean-cyan" />
        <h2 className="text-xl font-semibold">Top Forecasters</h2>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-5 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-ocean-cyan/10 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-ocean-cyan" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Forecasters</p>
              <p className="text-xl font-bold">2,847</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-5 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-ocean-seafoam/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-ocean-seafoam" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg. Accuracy</p>
              <p className="text-xl font-bold">64.2%</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-5 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-ocean-light/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-ocean-light" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Markets Resolved</p>
              <p className="text-xl font-bold">1,234</p>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-4 px-5 text-sm font-medium text-muted-foreground">Rank</th>
                <th className="text-left py-4 px-5 text-sm font-medium text-muted-foreground">Wallet</th>
                <th className="text-left py-4 px-5 text-sm font-medium text-muted-foreground">Accuracy</th>
                <th className="text-left py-4 px-5 text-sm font-medium text-muted-foreground hidden md:table-cell">Markets</th>
                <th className="text-right py-4 px-5 text-sm font-medium text-muted-foreground">Points</th>
              </tr>
            </thead>
            <tbody>
              {mockForecasters.map((forecaster) => (
                <tr 
                  key={forecaster.rank} 
                  className="border-b border-border/30 last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-4 px-5">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold border ${getRankStyle(forecaster.rank)}`}>
                      {forecaster.rank}
                    </span>
                  </td>
                  <td className="py-4 px-5">
                    <span className="font-mono text-sm">{forecaster.wallet}</span>
                  </td>
                  <td className="py-4 px-5">
                    <span className="text-ocean-cyan font-semibold">{forecaster.accuracy}%</span>
                  </td>
                  <td className="py-4 px-5 text-muted-foreground hidden md:table-cell">
                    {forecaster.marketsParticipated}
                  </td>
                  <td className="py-4 px-5 text-right">
                    <span className="font-semibold">{forecaster.points.toLocaleString()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Note */}
      <p className="text-xs text-muted-foreground text-center mt-4">
        Rankings update every 24 hours based on forecasting accuracy and participation.
      </p>
    </div>
  );
};
