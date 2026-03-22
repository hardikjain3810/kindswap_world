import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface DeFiTabProps { privacyMode: boolean; }

export const DeFiTab = ({ privacyMode }: DeFiTabProps) => {
  const protocols = [
    { name: "Raydium", tvl: 15420, apy: 24.5, positions: [{ name: "SOL-USDC LP", deposited: 8500, pnl: 420, rewards: 125 }, { name: "RAY Staking", deposited: 6920, pnl: 180, rewards: 45 }] },
    { name: "Marinade", tvl: 12800, apy: 7.2, positions: [{ name: "mSOL Staking", deposited: 12800, pnl: 340, rewards: 0 }] },
    { name: "Kamino", tvl: 8500, apy: 18.3, positions: [{ name: "USDC Vault", deposited: 8500, pnl: 95, rewards: 32, health: 85 }] },
  ];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="glass-card border-border/50"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground mb-1">Total DeFi Value</p><p className={`text-2xl font-bold gradient-text ${privacyMode ? 'blur-md' : ''}`}>$36,720</p></CardContent></Card>
        <Card className="glass-card border-border/50"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground mb-1">Avg APY</p><p className="text-2xl font-bold text-ocean-cyan">16.7%</p></CardContent></Card>
        <Card className="glass-card border-border/50"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground mb-1">Claimable</p><p className={`text-2xl font-bold text-green-400 ${privacyMode ? 'blur-md' : ''}`}>$202</p></CardContent></Card>
      </div>
      {protocols.map((protocol) => (
        <Card key={protocol.name} className="glass-card border-border/50 overflow-hidden"><div className="h-1 bg-gradient-to-r from-ocean-cyan to-ocean-seafoam" />
          <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-ocean-cyan/20 flex items-center justify-center font-bold">{protocol.name[0]}</div>{protocol.name}</CardTitle><div className="text-right"><p className={`font-semibold ${privacyMode ? 'blur-md' : ''}`}>${protocol.tvl.toLocaleString()}</p><Badge variant="secondary" className="text-xs">{protocol.apy}% APY</Badge></div></div></CardHeader>
          <CardContent className="space-y-3">{protocol.positions.map((pos, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div><p className="font-medium text-sm">{pos.name}</p><p className={`text-xs text-muted-foreground ${privacyMode ? 'blur-md' : ''}`}>Deposited: ${pos.deposited.toLocaleString()}</p>{pos.health && <div className="flex items-center gap-2 mt-1"><span className="text-xs text-muted-foreground">Health:</span><Progress value={pos.health} className="w-16 h-1.5" /></div>}</div>
              <div className="text-right"><p className={`text-sm font-medium text-green-400 ${privacyMode ? 'blur-md' : ''}`}>+${pos.pnl}</p>{pos.rewards > 0 && <p className={`text-xs text-ocean-cyan ${privacyMode ? 'blur-md' : ''}`}>${pos.rewards} rewards</p>}</div>
            </div>
          ))}</CardContent>
        </Card>
      ))}
    </div>
  );
};
