import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface NFTsTabProps { privacyMode: boolean; }

export const NFTsTab = ({ privacyMode }: NFTsTabProps) => {
  const collections = [
    { name: "Mad Lads", count: 2, floor: 145, total: 290 },
    { name: "Tensorians", count: 5, floor: 12, total: 60 },
    { name: "Famous Fox", count: 1, floor: 85, total: 85 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="glass-card border-border/50"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground mb-1">Total NFT Value</p><p className={`text-2xl font-bold gradient-text ${privacyMode ? 'blur-md' : ''}`}>$435 SOL</p></CardContent></Card>
        <Card className="glass-card border-border/50"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground mb-1">Collections</p><p className="text-2xl font-bold">3</p></CardContent></Card>
        <Card className="glass-card border-border/50"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground mb-1">Total NFTs</p><p className="text-2xl font-bold">8</p></CardContent></Card>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {collections.map((col) => (
          <Card key={col.name} className="glass-card border-border/50 overflow-hidden hover:shadow-[0_0_30px_hsl(185_80%_55%/0.1)] transition-all">
            <div className="aspect-square bg-gradient-to-br from-ocean-cyan/20 to-ocean-seafoam/20 flex items-center justify-center"><span className="text-4xl font-bold text-ocean-cyan/50">{col.name[0]}</span></div>
            <CardContent className="p-4"><div className="flex items-center justify-between mb-2"><h3 className="font-semibold">{col.name}</h3><Badge variant="secondary">{col.count} NFTs</Badge></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Floor: {col.floor} SOL</span><span className={`font-medium ${privacyMode ? 'blur-md' : ''}`}>{col.total} SOL</span></div></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
