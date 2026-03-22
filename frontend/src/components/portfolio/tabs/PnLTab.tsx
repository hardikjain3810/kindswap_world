import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Calendar } from "lucide-react";

interface PnLTabProps { privacyMode: boolean; }

export const PnLTab = ({ privacyMode }: PnLTabProps) => {
  const stats = [
    { label: "Realized PnL", value: "+$12,450", positive: true },
    { label: "Unrealized PnL", value: "+$8,230", positive: true },
    { label: "Fees Paid", value: "$342", positive: false },
    { label: "Best Day", value: "+$2,840", positive: true },
  ];
  const transactions = [
    { date: "Dec 27", action: "Swap", tokenIn: "10 SOL", tokenOut: "1,850 USDC", value: "$1,850", pnl: "+$124" },
    { date: "Dec 26", action: "LP Deposit", tokenIn: "5,000 USDC", tokenOut: "-", value: "$5,000", pnl: "-" },
    { date: "Dec 25", action: "Swap", tokenIn: "50,000 BONK", tokenOut: "2.1 SOL", value: "$389", pnl: "+$45" },
  ];
  const heatmap = Array.from({ length: 30 }, () => Math.random());

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="glass-card border-border/50"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground mb-1">{stat.label}</p><p className={`text-xl font-bold ${stat.positive ? 'text-green-400' : 'text-foreground'} ${privacyMode ? 'blur-md' : ''}`}>{stat.value}</p></CardContent></Card>
        ))}
      </div>
      <Card className="glass-card border-border/50"><CardContent className="p-4"><div className="flex items-center gap-2 mb-4"><Calendar className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">Daily PnL Heatmap</span></div><div className="grid grid-cols-10 gap-1">{heatmap.map((v, i) => (<div key={i} className="aspect-square rounded" style={{ backgroundColor: v > 0.5 ? `rgba(74, 222, 128, ${v})` : `rgba(248, 113, 113, ${1-v})` }} />))}</div></CardContent></Card>
      <Card className="glass-card border-border/50"><CardContent className="p-0">
        <div className="flex items-center gap-2 p-4 border-b border-border/50"><span className="text-sm font-medium">Transaction History</span><Badge variant="secondary">Swaps</Badge><Badge variant="outline">DeFi</Badge><Badge variant="outline">NFTs</Badge></div>
        <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Action</TableHead><TableHead>In</TableHead><TableHead>Out</TableHead><TableHead className="text-right">Value</TableHead><TableHead className="text-right">PnL</TableHead></TableRow></TableHeader>
          <TableBody>{transactions.map((tx, i) => (<TableRow key={i}><TableCell className="text-muted-foreground">{tx.date}</TableCell><TableCell><Badge variant="secondary" className="text-xs">{tx.action}</Badge></TableCell><TableCell className={`font-mono text-sm ${privacyMode ? 'blur-md' : ''}`}>{tx.tokenIn}</TableCell><TableCell className={`font-mono text-sm ${privacyMode ? 'blur-md' : ''}`}>{tx.tokenOut}</TableCell><TableCell className={`text-right ${privacyMode ? 'blur-md' : ''}`}>{tx.value}</TableCell><TableCell className={`text-right text-green-400 ${privacyMode ? 'blur-md' : ''}`}>{tx.pnl}</TableCell></TableRow>))}</TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
};
