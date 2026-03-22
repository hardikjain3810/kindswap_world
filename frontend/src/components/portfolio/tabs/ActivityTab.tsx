import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft, ArrowUpRight, ArrowDownLeft, Coins, Image } from "lucide-react";

interface ActivityTabProps { privacyMode: boolean; }

export const ActivityTab = ({ privacyMode }: ActivityTabProps) => {
  const activities = [
    { type: "swap", title: "Swapped SOL → USDC", desc: "10 SOL for 1,850 USDC", time: "2h ago", value: "$1,850" },
    { type: "receive", title: "Received SOL", desc: "From 5Tz...xK9", time: "5h ago", value: "+5 SOL" },
    { type: "defi", title: "LP Deposit", desc: "Added to Raydium SOL-USDC", time: "1d ago", value: "$5,000" },
    { type: "nft", title: "NFT Purchase", desc: "Mad Lads #1234", time: "2d ago", value: "145 SOL" },
    { type: "send", title: "Sent USDC", desc: "To 8Hd...pL2", time: "3d ago", value: "-500 USDC" },
  ];
  const getIcon = (type: string) => {
    switch(type) { case "swap": return <ArrowRightLeft className="w-4 h-4" />; case "receive": return <ArrowDownLeft className="w-4 h-4" />; case "send": return <ArrowUpRight className="w-4 h-4" />; case "defi": return <Coins className="w-4 h-4" />; case "nft": return <Image className="w-4 h-4" />; default: return <ArrowRightLeft className="w-4 h-4" />; }
  };
  const getColor = (type: string) => { switch(type) { case "swap": return "bg-ocean-cyan/20 text-ocean-cyan"; case "receive": return "bg-green-500/20 text-green-400"; case "send": return "bg-red-500/20 text-red-400"; case "defi": return "bg-purple-500/20 text-purple-400"; case "nft": return "bg-yellow-500/20 text-yellow-400"; default: return "bg-muted text-muted-foreground"; } };

  return (
    <div className="space-y-3">
      {activities.map((activity, i) => (
        <Card key={i} className="glass-card border-border/50 hover:bg-muted/30 transition-colors"><CardContent className="p-4 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getColor(activity.type)}`}>{getIcon(activity.type)}</div>
          <div className="flex-1"><p className="font-medium">{activity.title}</p><p className={`text-sm text-muted-foreground ${privacyMode ? 'blur-sm' : ''}`}>{activity.desc}</p></div>
          <div className="text-right"><p className={`font-medium ${privacyMode ? 'blur-md' : ''}`}>{activity.value}</p><p className="text-xs text-muted-foreground">{activity.time}</p></div>
        </CardContent></Card>
      ))}
    </div>
  );
};
