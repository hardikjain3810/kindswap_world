import { type FC, type ReactNode, useMemo } from "react";
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
import { WalletAdapterNetwork, type Adapter } from "@solana/wallet-adapter-base";
// import { clusterApiUrl } from "@solana/web3.js";
import { CONFIG } from "./jupiter/constants.ts";
import { PhantomConnectAdapter } from "../lib/wallet/PhantomConnectAdapter.ts";

import "@solana/wallet-adapter-react-ui/styles.css";

// Import Phantom Connect SDK hooks (types may show errors but will work at runtime)
// @ts-ignore - React 18 vs 19 peer dependency mismatch, works at runtime
import { usePhantom } from "@phantom/react-sdk";

interface WalletContextProviderProps {
  children: ReactNode;
}

export const WalletContextProvider: FC<WalletContextProviderProps> = ({
  children,
}) => {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => {
    return CONFIG.SOLANA_RPC;
  }, []);

  // Get Phantom Connect SDK instance (if available)
  // @ts-ignore - React version mismatch, works at runtime
  const phantomContext = usePhantom();

  const wallets = useMemo(() => {
    const walletList: Adapter[] = [];

    // Use Phantom Connect SDK adapter when available (removes security warning)
    // Check if SDK is initialized (isClient) and not loading
    if (phantomContext && phantomContext.sdk && typeof window !== 'undefined') {
      console.log("✅ Using Phantom Connect SDK (whitelisted, no security warning)");
      walletList.push(
        new PhantomConnectAdapter({
          getUser: () => phantomContext.user,
          connect: async () => {
            // Use the SDK's connect method with required authOptions
            if (phantomContext.sdk) {
              await phantomContext.sdk.connect({
                provider: "injected", // Use injected Phantom wallet
              });
            }
          },
          disconnect: async () => {
            // Use the SDK's disconnect method directly
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

    // Add other wallet adapters
    walletList.push(
      new SolflareWalletAdapter(),
      new TorusWalletAdapter()
    );

    return walletList;
  }, [phantomContext]);

  console.log("🔧 Wallet Configuration:");
  console.log("Network:", network);
  console.log("RPC Endpoint:", endpoint);
  console.log("Expected KNS Mint:", CONFIG.KNS_TOKEN_MINT);

  // Warning if somehow still on devnet
  if (endpoint.includes("devnet")) {
    console.error("❌ ERROR: Still connected to DEVNET!");
    console.error("KNS token will not be found on devnet.");
    console.error("Update CONFIG.SOLANA_RPC to mainnet-beta");
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
