import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown } from "lucide-react";

interface AssetsTabProps { privacyMode: boolean; }

export const AssetsTab = ({ privacyMode }: AssetsTabProps) => {
  const tokens = [
    { symbol: "SOL", name: "Solana", amount: 245.5, price: 185.42, value: 45520.91, change: 3.24, allocation: 35.7 },
    { symbol: "USDC", name: "USD Coin", amount: 25000, price: 1.00, value: 25000, change: 0.01, allocation: 19.6 },
    { symbol: "JUP", name: "Jupiter", amount: 12500, price: 0.92, value: 11500, change: -2.14, allocation: 9.0 },
    { symbol: "BONK", name: "Bonk", amount: 125000000, price: 0.000023, value: 2875, change: 12.5, allocation: 2.3 },
    { symbol: "RAY", name: "Raydium", amount: 850, price: 4.82, value: 4097, change: 5.67, allocation: 3.2 },
  ];

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card className="glass-card border-border/50">
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div className="flex items-center gap-4">
                <Badge variant="secondary">Solana</Badge>
                <div className="flex items-center gap-2 text-sm">
                  <Switch id="stables" /> <label htmlFor="stables" className="text-muted-foreground">Stablecoins</label>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Switch id="dust" /> <label htmlFor="dust" className="text-muted-foreground">Hide dust</label>
                </div>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Token</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Value</TableHead><TableHead className="text-right">24h</TableHead><TableHead className="text-right">%</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => (
                  <TableRow key={token.symbol} className="hover:bg-muted/30">
                    <TableCell><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-ocean-cyan/20 flex items-center justify-center text-xs font-bold">{token.symbol[0]}</div><div><p className="font-medium">{token.symbol}</p><p className="text-xs text-muted-foreground">{token.name}</p></div></div></TableCell>
                    <TableCell className={`text-right font-mono ${privacyMode ? 'blur-md' : ''}`}>{token.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">${token.price.toLocaleString()}</TableCell>
                    <TableCell className={`text-right font-mono font-medium ${privacyMode ? 'blur-md' : ''}`}>${token.value.toLocaleString()}</TableCell>
                    <TableCell className="text-right"><span className={`flex items-center justify-end gap-1 ${token.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>{token.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{token.change}%</span></TableCell>
                    <TableCell className="text-right text-muted-foreground">{token.allocation}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <div>
        <Card className="glass-card border-border/50"><CardContent className="p-4"><h3 className="font-semibold mb-4">Portfolio Allocation</h3><div className="space-y-3">{tokens.slice(0, 4).map((token) => (<div key={token.symbol} className="space-y-1"><div className="flex justify-between text-sm"><span>{token.symbol}</span><span className={privacyMode ? 'blur-md' : ''}>{token.allocation}%</span></div><div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-ocean-cyan to-ocean-seafoam" style={{ width: `${token.allocation}%` }} /></div></div>))}</div></CardContent></Card>
      </div>
    </div>
  );
};
