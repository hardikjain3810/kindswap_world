import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Upload, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";

interface CreateBundleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface WalletEntry {
  address: string;
  label: string;
  isValid: boolean;
  isDuplicate?: boolean;
}

const WALLET_LABELS = ["Main", "Trading", "Treasury", "Cold", "Team", "Whale Watch"];

export const CreateBundleModal = ({ open, onOpenChange }: CreateBundleModalProps) => {
  const [bundleName, setBundleName] = useState("");
  const [description, setDescription] = useState("");
  const [wallets, setWallets] = useState<WalletEntry[]>([
    { address: "5TzP...xK9m", label: "Main", isValid: true },
    { address: "8HdQ...pL2v", label: "Trading", isValid: true },
    { address: "invalid-address", label: "Main", isValid: false },
  ]);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const validWallets = wallets.filter(w => w.isValid);
  const invalidWallets = wallets.filter(w => !w.isValid);
  const isAtLimit = wallets.length >= 50;

  const addWallet = (address: string) => {
    if (wallets.length >= 50) return;
    const isValid = address.length > 20 && !address.includes("invalid");
    const isDuplicate = wallets.some(w => w.address === address);
    setWallets([...wallets, { address, label: "Main", isValid, isDuplicate }]);
  };

  const removeWallet = (index: number) => {
    setWallets(wallets.filter((_, i) => i !== index));
  };

  const updateLabel = (index: number, label: string) => {
    const updated = [...wallets];
    updated[index].label = label;
    setWallets(updated);
  };

  const handlePaste = () => {
    const lines = pasteText.split('\n').filter(l => l.trim());
    lines.forEach(line => {
      if (wallets.length < 50) {
        addWallet(line.trim());
      }
    });
    setPasteText("");
    setPasteMode(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl glass-card border-border/50 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Create New Bundle</DialogTitle>
          <DialogDescription>
            Group multiple wallet addresses to track their combined portfolio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Bundle Name */}
          <div className="space-y-2">
            <Label htmlFor="bundle-name">Bundle Name *</Label>
            <Input
              id="bundle-name"
              placeholder="e.g., My Trading Wallets"
              value={bundleName}
              onChange={(e) => setBundleName(e.target.value)}
              className="bg-muted/50"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Add notes about this bundle..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-muted/50 resize-none"
              rows={2}
            />
          </div>

          {/* Wallet Counter */}
          <div className="flex items-center justify-between">
            <Label>Wallet Addresses</Label>
            <Badge 
              variant={isAtLimit ? "destructive" : "secondary"}
              className="font-mono"
            >
              {wallets.length} / 50 wallets
            </Badge>
          </div>

          {/* Import Options */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => setPasteMode(!pasteMode)}
            >
              Paste List
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Upload className="w-4 h-4" />
              Import CSV
            </Button>
          </div>

          {/* Paste Mode */}
          {pasteMode && (
            <div className="space-y-2 p-4 rounded-lg bg-muted/50 border border-border/50">
              <Label>Paste wallet addresses (one per line)</Label>
              <Textarea
                placeholder="5TzP...xK9m&#10;8HdQ...pL2v&#10;..."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="bg-background font-mono text-sm"
                rows={4}
              />
              <Button size="sm" onClick={handlePaste}>Add Wallets</Button>
            </div>
          )}

          {/* Add Single Wallet */}
          <div className="space-y-2">
            <Input
              placeholder="Enter wallet address..."
              className="bg-muted/50 font-mono text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addWallet((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
          </div>

          {/* Wallet List */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {wallets.map((wallet, index) => (
              <div 
                key={index}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  wallet.isValid 
                    ? 'bg-muted/30 border-border/50' 
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {wallet.isValid ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span className="font-mono text-sm truncate">{wallet.address}</span>
                  </div>
                  {!wallet.isValid && (
                    <p className="text-xs text-red-400 mt-1 ml-6">Invalid wallet address</p>
                  )}
                  {wallet.isDuplicate && (
                    <p className="text-xs text-yellow-400 mt-1 ml-6">Duplicate address</p>
                  )}
                </div>

                <Select
                  value={wallet.label}
                  onValueChange={(value) => updateLabel(index, value)}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WALLET_LABELS.map((label) => (
                      <SelectItem key={label} value={label} className="text-xs">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-red-400"
                  onClick={() => removeWallet(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Validation Summary */}
          {invalidWallets.length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-400">
                {invalidWallets.length} invalid address{invalidWallets.length > 1 ? 'es' : ''} detected
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            variant="hero"
            disabled={!bundleName.trim() || validWallets.length === 0}
          >
            Create Bundle
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
