/**
 * PhantomMobileCallbackHandler
 *
 * Runs on every page load. If the URL contains Phantom deep link callback
 * parameters, it processes them (connect / signAndSend / error) and
 * updates app state.
 *
 * Must be rendered inside WalletProvider.
 */
import { useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { toast } from "sonner";
import {
  processDeepLinkCallback,
  getPendingOperation,
  clearPendingOperation,
  getSession,
  isMobileWithoutPhantom,
} from "@/lib/wallet/phantomMobile";

export function PhantomMobileCallbackHandler() {
  const { select, wallets, connected } = useWallet();
  const { connection } = useConnection();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    if (!isMobileWithoutPhantom() && !getSession()) return;

    const searchParams = new URLSearchParams(window.location.search);
    const result = processDeepLinkCallback(searchParams);

    if (!result) return;
    processed.current = true;

    // Clean callback params from the URL immediately
    window.history.replaceState({}, document.title, window.location.pathname);

    switch (result.type) {
      case "connect": {
        console.log("[PhantomMobile] Connect callback — wallet:", result.data.publicKey);
        localStorage.removeItem("phantom_mobile_connect_intent");

        // Session is already stored in localStorage by processDeepLinkCallback.
        // We only need to call select() so WalletProvider knows which adapter
        // to use. WalletProvider's autoConnect will then call adapter.connect(),
        // which reads the session from localStorage — one single connect cycle.
        if (!connected) {
          const phantomWallet = wallets.find((w) => w.adapter.name === "Phantom");
          if (phantomWallet) {
            select(phantomWallet.adapter.name);
          }
        }

        toast.success("Phantom wallet connected!", {
          description: `${(result.data.publicKey as string).slice(0, 8)}...${(result.data.publicKey as string).slice(-6)}`,
          duration: 4000,
        });
        break;
      }

      case "signAndSend": {
        const signature = result.data.signature as string;
        console.log("[PhantomMobile] SignAndSend callback — signature:", signature);

        const pending = getPendingOperation();
        clearPendingOperation();

        // Persist the result so the swap page can pick it up after reload
        try {
          localStorage.setItem(
            "phantom_mobile_swap_result",
            JSON.stringify({ signature, pending, timestamp: Date.now() })
          );
        } catch {
          // localStorage might be full; non-critical
        }

        toast.success("Transaction confirmed!", {
          description: `Signature: ${signature.slice(0, 12)}...`,
          duration: 6000,
          action: {
            label: "View",
            onClick: () => {
              window.open(
                `https://solscan.io/tx/${signature}`,
                "_blank",
                "noopener,noreferrer"
              );
            },
          },
        });

        // Dispatch after a short delay so the swap page's listener is registered
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("phantom-mobile-tx-result", {
              detail: { signature, pending },
            })
          );
        }, 100);
        break;
      }

      case "signTransaction": {
        console.log("[PhantomMobile] SignTransaction callback received");

        const pending = getPendingOperation();
        clearPendingOperation();

        // Phantom returns the signed transaction as a base58-encoded string.
        // We submit it ourselves via RPC since signAndSendTransaction deep link
        // is not supported on all Phantom Android versions (-32601).
        const signedTxBase58 = result.data.transaction as string;
        if (signedTxBase58 && connection) {
          (async () => {
            try {
              const txBytes = bs58.decode(signedTxBase58);

              // Try as VersionedTransaction first, fall back to legacy
              let rawTx: Uint8Array;
              try {
                const vtx = VersionedTransaction.deserialize(txBytes);
                rawTx = vtx.serialize();
              } catch {
                const ltx = Transaction.from(txBytes);
                rawTx = ltx.serialize();
              }

              console.log("[PhantomMobile] Submitting signed transaction via RPC...");
              const signature = await connection.sendRawTransaction(rawTx, {
                skipPreflight: false,
                maxRetries: 3,
                preflightCommitment: "confirmed",
              });
              console.log("[PhantomMobile] Transaction submitted:", signature);

              // Persist so the swap page picks it up after reload
              try {
                localStorage.setItem(
                  "phantom_mobile_swap_result",
                  JSON.stringify({ signature, pending, timestamp: Date.now() })
                );
              } catch {
                // non-critical
              }

              toast.success("Transaction confirmed!", {
                description: `Signature: ${signature.slice(0, 12)}...`,
                duration: 6000,
                action: {
                  label: "View",
                  onClick: () => {
                    window.open(
                      `https://solscan.io/tx/${signature}`,
                      "_blank",
                      "noopener,noreferrer"
                    );
                  },
                },
              });

              setTimeout(() => {
                window.dispatchEvent(
                  new CustomEvent("phantom-mobile-tx-result", {
                    detail: { signature, pending },
                  })
                );
              }, 100);
            } catch (submitErr: any) {
              console.error("[PhantomMobile] Failed to submit signed tx:", submitErr);
              toast.error("Failed to submit transaction", {
                description: submitErr?.message || String(submitErr),
                duration: 6000,
              });

            }
          })();
        } else {
          // Fallback: dispatch the raw event for any other listener
          window.dispatchEvent(
            new CustomEvent("phantom-mobile-signed-tx", {
              detail: { transaction: result.data.transaction },
            })
          );
        }
        break;
      }

      case "signMessage": {
        console.log("[PhantomMobile] SignMessage callback received");
        clearPendingOperation();
        window.dispatchEvent(
          new CustomEvent("phantom-mobile-signed-message", {
            detail: { signature: result.data.signature },
          })
        );
        break;
      }

      case "error": {
        const errorCode = result.data.errorCode as string;
        const errorMessage = result.data.errorMessage as string;
        console.error("[PhantomMobile] Error callback:", errorCode, errorMessage);
        localStorage.removeItem("phantom_mobile_connect_intent");
        clearPendingOperation();

        if (errorCode === "4001" || errorMessage?.includes("User rejected")) {
          toast.info("Transaction cancelled", { duration: 3000 });
        } else {
          toast.error("Phantom wallet error", {
            description: errorMessage || `Error code: ${errorCode}`,
            duration: 6000,
          });

        }
        break;
      }

      default:
        break;
    }
    // Run only once: deps are stable references from the wallet context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
