/**
 * Fee Details Modal Component
 * Shows tier information with proper scroll lock on mobile
 */

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useScrollLock } from "@/hooks/useScrollLock";
import { formatFeeForDisplay, getTierLabel, calculateTierProgress, getAllFeeTiers, FeeCalculation } from "@/lib/business-logic/feeDiscountAndPoints";

interface FeeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  feeDiscount: FeeCalculation;
  knsBalance: number | bigint;
}

export const FeeDetailsModal = ({
  isOpen,
  onClose,
  feeDiscount,
  knsBalance,
}: FeeDetailsModalProps) => {
  // Lock scroll when modal is open
  useScrollLock(isOpen);

  const allTiers = getAllFeeTiers();
  const balanceNum = typeof knsBalance === "bigint" ? Number(knsBalance) / 1e6 : knsBalance;
  const tierProgress = calculateTierProgress(balanceNum);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[9998] backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - Centered on all devices */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div
          className="glass-card rounded-2xl border border-border/50 overflow-hidden w-full max-w-sm max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border/30 flex-shrink-0">
            <h2 className="text-base sm:text-lg font-bold text-foreground">Fee Tiers</h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-background/50 rounded-md transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="p-3 sm:p-4 space-y-3 overflow-y-auto flex-1">
            {/* Current Tier Badge */}
            <div className="flex items-center justify-between">
              <Badge className="bg-ocean-seafoam/20 text-ocean-seafoam border border-ocean-seafoam/30 text-xs sm:text-sm">
                {getTierLabel(feeDiscount.tier)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {balanceNum > 0 ? `${balanceNum.toLocaleString()} KNS` : "No KNS"}
              </span>
            </div>

            {/* Your Current Fee */}
            <div className="bg-ocean-cyan/10 rounded-lg p-2.5 sm:p-3 border border-ocean-cyan/30">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">Your Current Fee</span>
                <span className="font-bold text-ocean-cyan text-sm sm:text-base">
                  {formatFeeForDisplay(feeDiscount.effectiveFeeBps)}
                </span>
              </div>
              {feeDiscount.discountPercent > 0 && (
                <p className="text-[10px] sm:text-xs text-ocean-seafoam mt-1">
                  Saving {feeDiscount.discountPercent}% with KNS
                </p>
              )}
            </div>

            {/* Tier Table */}
            <div className="bg-background/30 rounded-lg overflow-hidden">
              <table className="w-full text-[10px] sm:text-xs">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left p-1.5 sm:p-2 text-muted-foreground font-medium">Tier</th>
                    <th className="text-left p-1.5 sm:p-2 text-muted-foreground font-medium">KNS Required</th>
                    <th className="text-right p-1.5 sm:p-2 text-muted-foreground font-medium">Discount</th>
                    <th className="text-right p-1.5 sm:p-2 text-muted-foreground font-medium">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {allTiers.map(tier => (
                    <tr
                      key={tier.name}
                      className={`border-b border-border/20 last:border-0 ${
                        tier.name === feeDiscount.tier.name ? "bg-ocean-cyan/10" : ""
                      }`}
                    >
                      <td className="p-1.5 sm:p-2">
                        <div className="flex items-center gap-1">
                          {tier.name === feeDiscount.tier.name && (
                            <div className="w-1.5 h-1.5 rounded-full bg-ocean-cyan flex-shrink-0" />
                          )}
                          <span
                            className={`truncate ${
                              tier.name === feeDiscount.tier.name
                                ? "text-ocean-cyan font-medium"
                                : "text-foreground"
                            }`}
                          >
                            {tier.name}
                          </span>
                        </div>
                      </td>
                      <td className="p-1.5 sm:p-2 text-muted-foreground">
                        {tier.knsMin > 0 ? `≥${tier.knsMin >= 1000 ? `${tier.knsMin / 1000}k` : tier.knsMin}` : "0"}
                      </td>
                      <td className="p-1.5 sm:p-2 text-right text-ocean-seafoam">{tier.discount}%</td>
                      <td className="p-1.5 sm:p-2 text-right font-medium text-foreground">
                        {formatFeeForDisplay(tier.effectiveFeeBps)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Progress to Next Tier */}
            {tierProgress.nextTier && (
              <div className="space-y-1.5 bg-background/30 rounded-lg p-2.5 sm:p-3">
                <div className="flex items-center justify-between text-[10px] sm:text-xs">
                  <span className="text-muted-foreground">Progress to {tierProgress.nextTier.name}</span>
                  <span className="text-foreground font-medium">
                    {Math.min(100, (tierProgress.currentProgress * 100)).toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 sm:h-2 bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-ocean-cyan to-ocean-seafoam rounded-full transition-all"
                    style={{ width: `${Math.min(100, tierProgress.currentProgress * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  {tierProgress.knsNeeded >= 1000
                    ? `${(tierProgress.knsNeeded / 1000).toFixed(1)}k`
                    : tierProgress.knsNeeded.toLocaleString()
                  } more KNS needed
                </p>
              </div>
            )}

            {/* Charity Info */}
            <div className="text-center text-[10px] sm:text-xs text-muted-foreground pt-1">
              <span className="text-charity-coral">0.05%</span> of every swap goes to charity
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
