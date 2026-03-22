import React, { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { type Adapter } from "@solana/wallet-adapter-base";
import { CONFIG } from "./jupiter/constants";
import { PhantomConnectAdapter } from "@/lib/wallet/PhantomConnectAdapter";
import { PhantomMobileAdapter } from "@/lib/wallet/PhantomMobileAdapter";
import { isMobileWithoutPhantom } from "@/lib/wallet/phantomMobile";

import "@solana/wallet-adapter-react-ui/styles.css";

// @ts-ignore - React 18 vs 19 peer dependency mismatch, works at runtime
import { usePhantom } from "@phantom/react-sdk";

interface WalletContextProviderProps {
  children: ReactNode;
}

// ── Detect mobile once at module level (never changes during session) ──
const IS_MOBILE_WITHOUT_PHANTOM = typeof window !== "undefined" && isMobileWithoutPhantom();

export const WalletContextProvider: FC<WalletContextProviderProps> = ({
  children,
}) => {
  const endpoint = useMemo(() => CONFIG.SOLANA_RPC, []);

  // @ts-ignore
  const phantomContext = usePhantom();

  // ── Mobile wallets: created once, never recreated ──
  // No dependency on phantomContext → no adapter churn → no address flickering.
  const mobileWallets = useMemo(() => {
    console.log("📱 Mobile browser detected — using Phantom deep link adapter");
    return [
      new PhantomMobileAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
    ] as Adapter[];
  }, []);

  // ── Desktop wallets: depend on phantomContext (only evaluated on desktop) ──
  const desktopWallets = useMemo(() => {
    const walletList: Adapter[] = [];

    if (phantomContext && phantomContext.sdk && typeof window !== "undefined") {
      console.log("✅ Using Phantom Connect SDK (whitelisted, no security warning)");
      walletList.push(
        new PhantomConnectAdapter({
          getUser: () => phantomContext.user,
          connect: async () => {
            if (phantomContext.sdk) {
              await phantomContext.sdk.connect({ provider: "injected" });
            }
          },
          disconnect: async () => {
            if (phantomContext.sdk) {
              await phantomContext.sdk.disconnect();
            }
          },
        })
      );
    } else {
      console.log("⚠️  Using standard Phantom adapter (may show security warning)");
      walletList.push(new PhantomWalletAdapter());
    }

    walletList.push(new SolflareWalletAdapter(), new TorusWalletAdapter());
    return walletList;
  }, [phantomContext]);

  // Pick the right wallet list — mobile never changes, desktop may update.
  const wallets = IS_MOBILE_WITHOUT_PHANTOM ? mobileWallets : desktopWallets;

  if (endpoint.includes("devnet")) {
    console.error("❌ ERROR: Still connected to DEVNET!");
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
