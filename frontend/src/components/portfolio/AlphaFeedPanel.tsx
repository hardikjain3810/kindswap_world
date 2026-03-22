import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, ArrowRightLeft, Coins } from "lucide-react";

interface FeedItem {
  id: string;
  type: "position" | "swap" | "exposure";
  title: string;
  description: string;
  time: string;
}

export const AlphaFeedPanel = () => {
  const feedItems: FeedItem[] = [
    {
      id: "1",
      type: "position",
      title: "New position opened",
      description: "Added 500 USDC to Raydium LP",
      time: "2m ago",
    },
    {
      id: "2",
      type: "swap",
      title: "Large swap detected",
      description: "Swapped 10 SOL → BONK",
      time: "15m ago",
    },
    {
      id: "3",
      type: "exposure",
      title: "Token exposure increased",
      description: "JUP allocation now 12%",
      time: "1h ago",
    },
    {
      id: "4",
      type: "swap",
      title: "Swap completed",
      description: "Received 2,340 USDC",
      time: "3h ago",
    },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case "position": return <TrendingUp className="w-4 h-4" />;
      case "swap": return <ArrowRightLeft className="w-4 h-4" />;
      case "exposure": return <Coins className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case "position": return "text-green-400 bg-green-400/10";
      case "swap": return "text-ocean-cyan bg-ocean-cyan/10";
      case "exposure": return "text-yellow-400 bg-yellow-400/10";
      default: return "text-muted-foreground bg-muted";
    }
  };

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-ocean-cyan" />
            Alpha Feed
          </CardTitle>
          <Badge variant="secondary" className="text-xs">Live</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {feedItems.map((item) => (
          <div
            key={item.id}
            className="flex gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${getColor(item.type)}`}>
              {getIcon(item.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground truncate">{item.description}</p>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{item.time}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
