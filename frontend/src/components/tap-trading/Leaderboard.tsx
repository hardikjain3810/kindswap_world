import { Trophy, Medal, Award, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Trader {
  rank: number;
  address: string;
  volume: number;
  pnl: number;
  winRate: number;
}

const mockTraders: Trader[] = [
  { rank: 1, address: '0x7a3f...4f2b', volume: 124500, pnl: 12340, winRate: 78.5 },
  { rank: 2, address: '0x3c8d...9b1a', volume: 98200, pnl: 8920, winRate: 72.3 },
  { rank: 3, address: '0x5d2e...2e8f', volume: 87600, pnl: 7150, winRate: 69.8 },
  { rank: 4, address: '0x9f1a...1a3c', volume: 76400, pnl: 5890, winRate: 67.2 },
  { rank: 5, address: '0x2b8c...8c7d', volume: 65200, pnl: 4320, winRate: 65.1 },
];

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Trophy className="w-5 h-5 text-yellow-400" />;
    case 2:
      return <Medal className="w-5 h-5 text-gray-400" />;
    case 3:
      return <Award className="w-5 h-5 text-amber-600" />;
    default:
      return <span className="w-5 text-center text-muted-foreground">{rank}</span>;
  }
};

const formatCurrency = (amount: number) => {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount.toLocaleString()}`;
};

const Leaderboard = () => {
  return (
    <section className="mt-16">
      <div className="text-center mb-8">
        <Badge variant="outline" className="mb-4 bg-ocean-cyan/10 text-ocean-cyan border-ocean-cyan/30">
          Demo Data
        </Badge>
        <h2 className="text-2xl lg:text-3xl font-bold gradient-text mb-3">
          Top Traders This Week
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Community leaderboard showcasing top performers
        </p>
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="glass-card rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="w-16 text-center">#</TableHead>
                <TableHead>Trader</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-right">PnL</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockTraders.map((trader) => (
                <TableRow 
                  key={trader.rank} 
                  className="border-border/30 hover:bg-ocean-cyan/5 transition-colors"
                >
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center">
                      {getRankIcon(trader.rank)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-foreground">{trader.address}</span>
                      <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium text-foreground">
                    {formatCurrency(trader.volume)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-green-500 font-medium">
                      +{formatCurrency(trader.pnl)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    {trader.winRate}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* View Full Leaderboard Button */}
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            className="glass-card hover:border-ocean-cyan/30"
            disabled
          >
            View Full Leaderboard
            <span className="ml-2 text-xs text-muted-foreground">(Coming Soon)</span>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Leaderboard;
