import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Clock } from "lucide-react";

export const SnapshotWidget = () => {
  const snapshots = [
    { id: "1", date: "Dec 27, 2024", netWorth: "$125,230" },
    { id: "2", date: "Dec 20, 2024", netWorth: "$118,450" },
    { id: "3", date: "Dec 13, 2024", netWorth: "$112,800" },
  ];

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Camera className="w-4 h-4 text-ocean-seafoam" />
            Snapshots
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="outline" size="sm" className="w-full gap-2">
          <Camera className="w-4 h-4" />
          Save Portfolio Snapshot
        </Button>

        <div className="space-y-2">
          {snapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{snapshot.date}</span>
              </div>
              <span className="text-xs font-medium text-foreground">{snapshot.netWorth}</span>
            </div>
          ))}
        </div>

        <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
          Compare Snapshots →
        </Button>
      </CardContent>
    </Card>
  );
};
