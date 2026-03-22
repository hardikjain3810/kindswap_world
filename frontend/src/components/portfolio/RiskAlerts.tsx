import { useState } from "react";
import { AlertTriangle, X, Shield, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Alert {
  id: string;
  type: "concentration" | "approval" | "protocol";
  message: string;
  severity: "warning" | "danger";
}

export const RiskAlerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>([
    {
      id: "1",
      type: "concentration",
      message: "High exposure to one asset (45% in SOL)",
      severity: "warning",
    },
    {
      id: "2",
      type: "approval",
      message: "3 token approvals detected with high-risk permissions",
      severity: "danger",
    },
  ]);

  const dismissAlert = (id: string) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  if (alerts.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case "concentration": return <PieChart className="w-4 h-4" />;
      case "approval": return <Shield className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-2 mb-6">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
            alert.severity === "danger"
              ? "bg-red-500/10 border-red-500/30 text-red-400"
              : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
          }`}
        >
          {getIcon(alert.type)}
          <span className="flex-1 text-sm font-medium">{alert.message}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-transparent"
            onClick={() => dismissAlert(alert.id)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ))}
    </div>
  );
};
