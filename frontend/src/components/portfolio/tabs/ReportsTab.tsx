import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Calendar } from "lucide-react";

interface ReportsTabProps { privacyMode: boolean; }

export const ReportsTab = ({ privacyMode }: ReportsTabProps) => {
  return (
    <div className="space-y-6">
      <Card className="glass-card border-border/50"><div className="h-1 bg-gradient-to-r from-ocean-cyan to-ocean-seafoam" />
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-ocean-cyan" />December 2024 Report</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/30"><p className="text-xs text-muted-foreground">Net Worth Change</p><p className={`text-lg font-bold text-green-400 ${privacyMode ? 'blur-md' : ''}`}>+$8,450</p></div>
            <div className="text-center p-3 rounded-lg bg-muted/30"><p className="text-xs text-muted-foreground">Realized PnL</p><p className={`text-lg font-bold ${privacyMode ? 'blur-md' : ''}`}>+$2,340</p></div>
            <div className="text-center p-3 rounded-lg bg-muted/30"><p className="text-xs text-muted-foreground">Fees Paid</p><p className={`text-lg font-bold ${privacyMode ? 'blur-md' : ''}`}>$45</p></div>
            <div className="text-center p-3 rounded-lg bg-muted/30"><p className="text-xs text-muted-foreground">Top Protocol</p><p className="text-lg font-bold">Raydium</p></div>
          </div>
          <div className="flex gap-2"><Button variant="outline" className="gap-2"><Download className="w-4 h-4" />Export PDF</Button><Button variant="outline" className="gap-2"><Download className="w-4 h-4" />Export CSV</Button></div>
        </CardContent>
      </Card>
      <Card className="glass-card border-border/50 border-dashed"><CardContent className="p-8 text-center"><Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><h3 className="font-semibold mb-2">Tax Report</h3><p className="text-sm text-muted-foreground mb-4">Coming soon - Generate tax-ready reports for your crypto activity.</p><Badge variant="secondary">Coming Soon</Badge></CardContent></Card>
    </div>
  );
};
