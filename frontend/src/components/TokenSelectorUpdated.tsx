/**
 * Updated Token Selector Component
 * Uses Jupiter token list with proper colors and metadata
 */

import { useState, useMemo } from "react";
import { ChevronDown, X } from "lucide-react";
import { TokenInfo } from "@/lib/api/jupiter";
import { useScrollLock } from "@/hooks/useScrollLock";

interface TokenSelectorUpdatedProps {
  token: TokenInfo | null;
  onSelect: (token: TokenInfo) => void;
  tokenList: TokenInfo[];
}

/**
 * Generate a color for a token based on its symbol
 */
function getTokenColor(token: TokenInfo): string {
  const colorMap: Record<string, string> = {
    SOL: "bg-gradient-to-br from-[#9945FF] to-[#14F195]",
    USDC: "bg-gradient-to-br from-[#2775CA] to-[#2775CA]",
    USDT: "bg-gradient-to-br from-[#26A17B] to-[#26A17B]",
    ETH: "bg-gradient-to-br from-[#627EEA] to-[#627EEA]",
    BTC: "bg-gradient-to-br from-[#F7931A] to-[#F7931A]",
    KNS: "bg-gradient-to-br from-ocean-cyan to-ocean-seafoam",
    DAI: "bg-gradient-to-br from-[#F5AF37] to-[#F5AF37]",
  };

  // Check if symbol matches a known token
  for (const [key, color] of Object.entries(colorMap)) {
    if (token.symbol.toUpperCase().includes(key)) {
      return color;
    }
  }

  // Generate a consistent color based on symbol hash
  const hash = token.symbol
    .split("")
    .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
  const hue = Math.abs(hash) % 360;
  const saturation = 70;
  const lightness = 55;

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Get initials from token symbol/name
 */
function getTokenInitials(token: TokenInfo): string {
  return token.symbol.substring(0, 2).toUpperCase();
}

export const TokenSelectorModal = ({
  isOpen,
  onClose,
  onSelect,
  tokenList,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: TokenInfo) => void;
  tokenList: TokenInfo[];
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  // Lock scroll when modal is open
  useScrollLock(isOpen);

  // Filter tokens based on search
  const filteredTokens = useMemo(() => {
    return tokenList.filter(
      token =>
        token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, tokenList]);

  // Popular tokens (most traded)
  const popularTokens = useMemo(() => {
    const popular = ["SOL", "USDC", "USDT", "ETH", "BTC"];
    return tokenList.filter(t => popular.some(p => t.symbol.toUpperCase().includes(p))).slice(0, 6);
  }, [tokenList]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-[9998] backdrop-blur-sm" onClick={onClose} />

      {/* Modal - Centered on all devices including mobile */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div
          className="glass-card rounded-2xl border border-border/50 overflow-hidden max-h-[80vh] w-full max-w-sm flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border/30 flex-shrink-0">
            <h2 className="text-base sm:text-lg font-bold text-foreground">Select a Token</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-background/50 rounded-md transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search name, symbol or address"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full bg-background/50 border border-border/50 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-ocean-cyan/50 transition-colors"
            />

            {/* Popular Tokens - Quick Select */}
            {!searchQuery && popularTokens.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground px-1">Popular</p>
                <div className="flex flex-wrap gap-2">
                  {popularTokens.map(token => (
                    <button
                      key={token.address}
                      onClick={() => {
                        onSelect(token);
                        onClose();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-background/50 border border-border/50 rounded-lg hover:border-ocean-cyan/50 hover:bg-ocean-cyan/5 transition-all text-sm"
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white`}
                        style={{ background: getTokenColor(token) }}
                      >
                        {getTokenInitials(token)}
                      </div>
                      <span className="text-foreground font-medium">{token.symbol}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Token List */}
            <div className="space-y-1">
              {filteredTokens.length > 0 ? (
                filteredTokens.slice(0, 50).map(token => (
                  <button
                    key={token.address}
                    onClick={() => {
                      onSelect(token);
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-ocean-cyan/10 transition-colors text-left group"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-lg text-white font-bold`}
                      style={{ background: getTokenColor(token) }}
                    >
                      {getTokenInitials(token)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{token.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{token.symbol}</p>
                    </div>
                    {token.logoURI && (
                      <img
                        src={token.logoURI}
                        alt={token.symbol}
                        className="w-6 h-6 rounded-full"
                        onError={e => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                  </button>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No tokens found</p>
                  {searchQuery && (
                    <p className="text-xs text-muted-foreground mt-2">Try a different search term</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export const TokenSelectorUpdated = ({ token, onSelect, tokenList }: TokenSelectorUpdatedProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(token);

  const handleSelect = (newToken: TokenInfo) => {
    setSelectedToken(newToken);
    onSelect(newToken);
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 bg-background/80 hover:bg-background rounded-lg px-3 py-2 border border-border/50 hover:border-ocean-cyan/30 transition-all"
      >
        {selectedToken && (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ background: getTokenColor(selectedToken) }}
          >
            {getTokenInitials(selectedToken)}
          </div>
        )}
        <span className="font-semibold text-foreground">
          {selectedToken ? selectedToken.symbol : "Select"}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>

      <TokenSelectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleSelect}
        tokenList={tokenList}
      />
    </>
  );
};
