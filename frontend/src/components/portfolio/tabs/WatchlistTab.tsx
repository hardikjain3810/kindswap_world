import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Bell, Plus, TrendingUp, TrendingDown } from "lucide-react";

interface WatchlistTabProps { privacyMode: boolean; }

export const WatchlistTab = ({ privacyMode }: WatchlistTabProps) => {
  const items = [
    { type: "token", name: "JUP", price: "$0.92", change: -2.14, alert: true },
    { type: "token", name: "WIF", price: "$2.45", change: 8.32, alert: false },
    { type: "wallet", name: "Whale #1", price: "$4.2M", change: 1.2, alert: true },
    { type: "protocol", name: "Kamino", price: "TVL $120M", change: 5.4, alert: false },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="font-semibold">Watchlist</h3><Button variant="outline" size="sm" className="gap-2"><Plus className="w-4 h-4" />Add Item</Button></div>
      {items.map((item, i) => (
        <Card key={i} className="glass-card border-border/50 hover:bg-muted/30 transition-colors"><CardContent className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-ocean-cyan/20 flex items-center justify-center"><Star className="w-4 h-4 text-ocean-cyan" /></div>
          <div className="flex-1"><div className="flex items-center gap-2"><p className="font-medium">{item.name}</p><Badge variant="secondary" className="text-xs">{item.type}</Badge></div><p className={`text-sm text-muted-foreground ${privacyMode ? 'blur-sm' : ''}`}>{item.price}</p></div>
          <div className="flex items-center gap-3"><span className={`flex items-center gap-1 ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>{item.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{item.change}%</span><Button variant="ghost" size="icon" className={item.alert ? 'text-yellow-400' : 'text-muted-foreground'}><Bell className="w-4 h-4" /></Button></div>
        </CardContent></Card>
      ))}
    </div>
  );
};
