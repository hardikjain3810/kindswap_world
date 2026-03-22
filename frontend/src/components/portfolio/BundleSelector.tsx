import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Wallet, FolderOpen, Plus, Users } from "lucide-react";
import { SelectedBundle } from "@/pages/Portfolio";

interface BundleSelectorProps {
  bundles: Array<{ id: string; name: string; walletCount: number; netWorth: number; change24h: number }>;
  selectedBundle: SelectedBundle;
  onSelectBundle: (bundle: SelectedBundle) => void;
  onCreateBundle: () => void;
  privacyMode: boolean;
}

export const BundleSelector = ({ 
  bundles, 
  selectedBundle, 
  onSelectBundle, 
  onCreateBundle,
  privacyMode 
}: BundleSelectorProps) => {
  const getDisplayName = () => {
    if (selectedBundle.type === "wallet") return "Connected Wallet";
    return selectedBundle.name;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 bg-muted/50 border-border/50 hover:bg-muted">
          {selectedBundle.type === "wallet" ? (
            <Wallet className="w-4 h-4 text-ocean-cyan" />
          ) : (
            <FolderOpen className="w-4 h-4 text-ocean-seafoam" />
          )}
          <span className="font-medium">{getDisplayName()}</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 glass-card border-border/50">
        <DropdownMenuLabel className="text-muted-foreground text-xs uppercase tracking-wide">
          Select View
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Connected Wallet */}
        <DropdownMenuItem 
          onClick={() => onSelectBundle({ type: "wallet" })}
          className="flex items-center gap-3 py-3 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-ocean-cyan/20 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-ocean-cyan" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Connected Wallet</p>
            <p className={`text-xs text-muted-foreground ${privacyMode ? 'blur-sm' : ''}`}>
              $127,450.00 • <span className="text-green-400">+1.87%</span>
            </p>
          </div>
          {selectedBundle.type === "wallet" && (
            <div className="w-2 h-2 rounded-full bg-ocean-cyan" />
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground text-xs uppercase tracking-wide">
          My Bundles
        </DropdownMenuLabel>

        {bundles.map((bundle) => (
          <DropdownMenuItem
            key={bundle.id}
            onClick={() => onSelectBundle({ type: "bundle", id: bundle.id, name: bundle.name })}
            className="flex items-center gap-3 py-3 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-ocean-seafoam/20 flex items-center justify-center relative">
              <FolderOpen className="w-4 h-4 text-ocean-seafoam" />
              <span className="absolute -bottom-1 -right-1 text-[10px] bg-muted rounded-full px-1 border border-border">
                {bundle.walletCount}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{bundle.name}</p>
              <p className={`text-xs text-muted-foreground ${privacyMode ? 'blur-sm' : ''}`}>
                ${bundle.netWorth.toLocaleString()} • 
                <span className={bundle.change24h >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {' '}{bundle.change24h >= 0 ? '+' : ''}{bundle.change24h}%
                </span>
              </p>
            </div>
            {selectedBundle.type === "bundle" && selectedBundle.id === bundle.id && (
              <div className="w-2 h-2 rounded-full bg-ocean-seafoam" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={onCreateBundle}
          className="flex items-center gap-3 py-3 cursor-pointer text-ocean-cyan"
        >
          <div className="w-8 h-8 rounded-full bg-ocean-cyan/10 flex items-center justify-center">
            <Plus className="w-4 h-4" />
          </div>
          <span className="font-medium">Create New Bundle</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
