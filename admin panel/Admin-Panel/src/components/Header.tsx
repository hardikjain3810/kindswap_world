import { ExternalLink, Menu, Wallet, X, Copy, LogOut, Eye } from "lucide-react";
import KindSwapLogo from "./KindSwapLogo";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "./ui/button";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

// Navigation link type
interface NavLinkItem {
  label: string;
  href: string;
  isRoute?: boolean;
  isExternal?: boolean;
}

// Reusable NavLink component - eliminates duplicate navigation rendering
const NavLink = ({
  link,
  className,
  onClick,
  isActive,
}: {
  link: NavLinkItem;
  className: string;
  onClick?: () => void;
  isActive?: boolean;
}) => {
  const activeClass = isActive ? "text-ocean-cyan" : "";

  if (link.isRoute) {
    return (
      <Link to={link.href} className={`${className} ${activeClass}`} onClick={onClick}>
        {link.label}
      </Link>
    );
  }

  if (link.isExternal) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} ${activeClass} flex items-center gap-1`}
        onClick={onClick}
      >
        {link.label}
        <ExternalLink className="w-3 h-3" />
      </a>
    );
  }

  return (
    <a href={link.href} className={`${className} ${activeClass}`} onClick={onClick}>
      {link.label}
    </a>
  );
};

// Reusable WalletDropdown component - eliminates duplicate dropdown menu
const WalletDropdown = ({
  trigger,
  onCopyAddress,
  onViewExplorer,
  onDisconnect,
}: {
  trigger: React.ReactNode;
  onCopyAddress: () => void;
  onViewExplorer: () => void;
  onDisconnect: () => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-56">
      <DropdownMenuItem onClick={onCopyAddress}>
        <Copy className="w-4 h-4 mr-2" />
        Copy Address
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onViewExplorer}>
        <Eye className="w-4 h-4 mr-2" />
        View on Explorer
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={onDisconnect}
        className="text-destructive focus:text-destructive"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Disconnect
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const NAV_LINKS: NavLinkItem[] = [
  { label: "Home", href: "https://home.kindswap.world", isRoute: false, isExternal: true },
  { label: "Admin", href: "/admin", isRoute: true },
  { label: "Docs", href: "https://docs.kindswap.world/", isRoute: false, isExternal: true },
];

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const location = useLocation();

  const formatAddress = (address: string) =>
    `${address.slice(0, 4)}...${address.slice(-4)}`;

  const handleDisconnect = async () => await disconnect();

  const handleCopyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
    }
  };

  const handleViewOnExplorer = () => {
    if (publicKey) {
      window.open(`https://solscan.io/account/${publicKey.toBase58()}`, "_blank");
    }
  };

  const walletAddress = publicKey?.toBase58() ?? "";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo + Mobile Menu Toggle */}
          <div className="flex items-center">
            <a href="https://kindswap.world/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 md:gap-3">
              <KindSwapLogo className="w-8 h-8 md:w-10 md:h-10" />
              <span className="hidden md:block text-xl font-bold text-foreground">
                KindSwap
              </span>
            </a>
            <button
              className="md:hidden text-ocean-cyan p-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.label}
                link={link}
                className="text-muted-foreground hover:text-foreground transition-colors duration-300 text-sm font-medium"
                isActive={link.isRoute && location.pathname === link.href}
              />
            ))}
          </nav>

          {/* Desktop Wallet Button */}
          <div className="hidden md:flex items-center gap-4">
            {publicKey ? (
              <WalletDropdown
                trigger={
                  <Button
                    variant="outline"
                    className="border-ocean-cyan/30 text-ocean-cyan hover:bg-ocean-cyan/10"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    {formatAddress(walletAddress)}
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                }
                onCopyAddress={handleCopyAddress}
                onViewExplorer={handleViewOnExplorer}
                onDisconnect={handleDisconnect}
              />
            ) : (
              <Button
                variant="outline"
                className="border-ocean-cyan/30 text-ocean-cyan hover:bg-ocean-cyan/10"
                onClick={() => setVisible(true)}
                disabled={connecting}
              >
                <Wallet className="w-4 h-4 mr-2" />
                {connecting ? "Connecting..." : "Connect Wallet"}
              </Button>
            )}
          </div>

          {/* Mobile Wallet Button */}
          <div className="md:hidden">
            {publicKey ? (
              <WalletDropdown
                trigger={
                  <Button
                    size="sm"
                    className="bg-ocean-cyan text-black hover:bg-ocean-cyan/90 rounded-full px-3 py-1 text-xs font-semibold"
                  >
                    {formatAddress(walletAddress)}
                  </Button>
                }
                onCopyAddress={handleCopyAddress}
                onViewExplorer={handleViewOnExplorer}
                onDisconnect={handleDisconnect}
              />
            ) : (
              <Button
                size="sm"
                className="bg-ocean-cyan text-black hover:bg-ocean-cyan/90 rounded-full px-3 py-1 text-xs font-semibold"
                onClick={() => setVisible(true)}
                disabled={connecting}
              >
                {connecting ? "Connecting..." : "Connect Wallet"}
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border animate-fade-in">
            <nav className="flex flex-col gap-2">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.label}
                  link={link}
                  className="text-muted-foreground hover:text-foreground hover:bg-ocean-cyan/10 transition-colors duration-300 text-sm font-medium py-3 px-2 rounded-lg"
                  onClick={() => setIsMenuOpen(false)}
                  isActive={link.isRoute && location.pathname === link.href}
                />
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
