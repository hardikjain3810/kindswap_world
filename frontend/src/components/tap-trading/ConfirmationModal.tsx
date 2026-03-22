import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  asset: string;
  direction: "long" | "short";
  positionSize: number;
  leverage: number;
}

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  asset,
  direction,
  positionSize,
  leverage,
}: ConfirmationModalProps) => {
  const isLong = direction === "long";
  const maxExposure = positionSize * leverage;
  const estimatedLiquidation = isLong
    ? (178.45 * (1 - 0.9 / leverage)).toFixed(2)
    : (178.45 * (1 + 0.9 / leverage)).toFixed(2);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="glass-card border-border/50 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            Confirm Trade
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Review your trade details before confirming
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Trade Details */}
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border/30">
              <span className="text-muted-foreground">Asset</span>
              <span className="font-medium text-foreground">{asset}-PERP</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-border/30">
              <span className="text-muted-foreground">Direction</span>
              <span
                className={cn(
                  "flex items-center gap-1 font-medium",
                  isLong ? "text-green-400" : "text-red-400"
                )}
              >
                {isLong ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {isLong ? "LONG" : "SHORT"}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-border/30">
              <span className="text-muted-foreground">Position Size</span>
              <span className="font-medium text-foreground">
                ${positionSize.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-border/30">
              <span className="text-muted-foreground">Leverage</span>
              <span className="font-medium text-foreground">{leverage}×</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-border/30">
              <span className="text-muted-foreground">Max Exposure</span>
              <span className="font-medium text-foreground">
                ~${maxExposure.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Est. Liquidation</span>
              <span className="font-medium text-foreground">
                ${estimatedLiquidation}
              </span>
            </div>
          </div>

          {/* Risk Warning */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
            <AlertTriangle className="w-4 h-4 text-yellow-500/70 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-500/70 leading-relaxed">
              Perpetual trading involves risk. Leverage amplifies gains and losses.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 bg-background/50"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className={cn(
              "flex-1 font-semibold",
              isLong
                ? "bg-gradient-to-r from-green-500/30 to-green-500/20 text-green-400 border border-green-500/30 hover:border-green-500/50"
                : "bg-gradient-to-r from-red-500/30 to-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50"
            )}
          >
            Confirm Trade
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmationModal;
