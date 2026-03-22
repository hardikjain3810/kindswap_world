import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Download, Wallet } from "lucide-react";
import KindSwapLogo from "@/components/KindSwapLogo";
import { Link } from "react-router-dom";
import { SelectedBundle } from "@/pages/Portfolio";

interface PortfolioHeaderProps {
  onCreateBundle: () => void;
  selectedBundle: SelectedBundle;
}

export const PortfolioHeader = ({ onCreateBundle, selectedBundle }: PortfolioHeaderProps) => {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <KindSwapLogo className="w-8 h-8" />
            <span className="text-lg font-bold text-foreground hidden sm:block">KindSwap</span>
          </Link>

          {/* Title */}
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">Portfolio</h1>
            {selectedBundle.type === "bundle" && (
              <span className="text-sm text-muted-foreground">/ {selectedBundle.name}</span>
            )}
          </div>

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search tokens, NFTs, protocols..." 
                className="pl-10 bg-muted/50 border-border/50"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="hidden sm:flex gap-2"
              onClick={onCreateBundle}
            >
              <Plus className="w-4 h-4" />
              Create Bundle
            </Button>
            <Button variant="outline" size="sm" className="hidden sm:flex gap-2">
              <Wallet className="w-4 h-4" />
              Add Wallet
            </Button>
            <Button variant="ghost" size="icon" className="hidden sm:flex">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="md:hidden pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search..." 
              className="pl-10 bg-muted/50 border-border/50"
            />
          </div>
        </div>
      </div>
    </header>
  );
};
