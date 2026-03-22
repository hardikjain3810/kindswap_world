import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Shield, AlertTriangle, Info, ExternalLink } from "lucide-react";

export const ApprovalsTab = () => {
  const approvals = [
    { protocol: "Raydium", type: "Token Approval", token: "USDC", amount: "Unlimited", risk: "medium", date: "Dec 15" },
    { protocol: "Jupiter", type: "Token Approval", token: "All Tokens", amount: "Unlimited", risk: "low", date: "Dec 10" },
    { protocol: "Unknown dApp", type: "Token Approval", token: "SOL", amount: "Unlimited", risk: "high", date: "Nov 28" },
  ];
  const getRiskBadge = (risk: string) => {
    switch(risk) { case "low": return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Low</Badge>; case "medium": return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Medium</Badge>; case "high": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">High</Badge>; default: return null; }
  };

  return (
    <div className="space-y-6">
      <Card className="glass-card border-yellow-500/30 bg-yellow-500/5"><CardContent className="p-4 flex items-center gap-3"><Shield className="w-5 h-5 text-yellow-400" /><p className="text-sm">Review token approvals regularly to reduce wallet risk. Revoke unused permissions.</p></CardContent></Card>
      <Card className="glass-card border-border/50"><CardContent className="p-0">
        <Table><TableHeader><TableRow><TableHead>Protocol</TableHead><TableHead>Type</TableHead><TableHead>Token</TableHead><TableHead>Amount</TableHead><TableHead>Risk</TableHead><TableHead>Date</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>{approvals.map((approval, i) => (
            <TableRow key={i} className={approval.risk === "high" ? "bg-red-500/5" : ""}>
              <TableCell><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">{approval.protocol[0]}</div>{approval.protocol}</div></TableCell>
              <TableCell className="text-muted-foreground">{approval.type}</TableCell>
              <TableCell className="font-medium">{approval.token}</TableCell>
              <TableCell className="text-muted-foreground">{approval.amount}</TableCell>
              <TableCell><div className="flex items-center gap-2">{getRiskBadge(approval.risk)}<Tooltip><TooltipTrigger><Info className="w-3 h-3 text-muted-foreground" /></TooltipTrigger><TooltipContent><p className="max-w-xs text-sm">{approval.risk === "high" ? "Unknown protocol with unlimited access. Consider revoking." : "Verified protocol with standard permissions."}</p></TooltipContent></Tooltip></div></TableCell>
              <TableCell className="text-muted-foreground">{approval.date}</TableCell>
              <TableCell><Button variant="outline" size="sm" className="text-red-400 border-red-400/30 hover:bg-red-400/10">Revoke</Button></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
};
