/**
 * PhantomMobileAdapter
 *
 * A Solana Wallet Adapter that uses Phantom's deep link protocol for mobile
 * browsers where the Phantom browser extension is not available.
 *
 * On mobile Chrome (iOS/Android), window.phantom.solana doesn't exist.
 * This adapter redirects the user to the Phantom app via universal links
 * for connect, sign, and send operations. After the user approves in Phantom,
 * they are redirected back to the browser with the result in URL parameters.
 *
 * Key differences from the desktop adapter:
 * - connect() may redirect away (page navigates; promise never resolves)
 * - sendTransaction() always redirects to Phantom (page navigates)
 * - Session is persisted in localStorage to survive page reloads
 * - A callback handler component processes the redirect response on page load
 */
import {
  BaseMessageSignerWalletAdapter,
  type SendTransactionOptions,
  WalletReadyState,
  WalletConnectionError,
  WalletSendTransactionError,
  WalletSignTransactionError,
  WalletName,
} from "@solana/wallet-adapter-base";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  getSession,
  clearSession,
  buildConnectUrl,
  buildSignTransactionUrl,
  buildSignMessageUrl,
  setPendingOperation,
  isMobileWithoutPhantom,
  openPhantomDeepLink,
} from "./phantomMobile";

export class PhantomMobileAdapter extends BaseMessageSignerWalletAdapter {
  name = "Phantom" as WalletName<"Phantom">;
  url = "https://phantom.app";
  icon =
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDgiIGhlaWdodD0iMTA4IiB2aWV3Qm94PSIwIDAgMTA4IDEwOCIgZmlsbD0ibm9uZSI+CjxyZWN0IHdpZHRoPSIxMDgiIGhlaWdodD0iMTA4IiByeD0iMjYiIGZpbGw9IiNBQjlGRjIiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik00Ni41MjY3IDY5LjkyMjlDNDIuMDA1NCA3Ni44NTA5IDM0LjQyOTIgODUuNjE4MiAyNC4zNDggODUuNjE4MkMxOS41ODI0IDg1LjYxODIgMTUgODMuNjU2MyAxNSA3NS4xMzQyQzE1IDUzLjQzMDUgNDQuNjMyNiAxOS44MzI3IDcyLjEyNjggMTkuODMyN0M4Ny43NjggMTkuODMyNyA5NCAzMC42ODQ2IDk0IDQzLjAwNzlDOTQgNTguODI1OCA4My43MzU1IDc2LjkxMjIgNzMuNTMyMSA3Ni45MTIyQzcwLjI5MzkgNzYuOTEyMiA2OC43MDUzIDc1LjEzNDIgNjguNzA1MyA3Mi4zMTRDNjguNzA1MyA3MS41NzgzIDY4LjgyNzUgNzAuNzgxMiA2OS4wNzE5IDY5LjkyMjlDNjUuNTg5MyA3NS44Njk5IDU4Ljg2ODUgODEuMzg3OCA1Mi41NzU0IDgxLjM4NzhDNDcuOTkzIDgxLjM4NzggNDUuNjcxMyA3OC41MDYzIDQ1LjY3MTMgNzQuNDU5OEM0NS42NzEzIDcyLjk4ODQgNDUuOTc2OCA3MS40NTU2IDQ2LjUyNjcgNjkuOTIyOVpNODMuNjc2MSA0Mi41Nzk0QzgzLjY3NjEgNDYuMTcwNCA4MS41NTc1IDQ3Ljk2NTggNzkuMTg3NSA0Ny45NjU4Qzc2Ljc4MTYgNDcuOTY1OCA3NC42OTg5IDQ2LjE3MDQgNzQuNjk4OSA0Mi41Nzk0Qzc0LjY5ODkgMzguOTg4NSA3Ni43ODE2IDM3LjE5MzEgNzkuMTg3NSAzNy4xOTMxQzgxLjU1NzUgMzcuMTkzMSA4My42NzYxIDM4Ljk4ODUgODMuNjc2MSA0Mi41Nzk0Wk03MC4yMTAzIDQyLjU3OTVDNzAuMjEwMyA0Ni4xNzA0IDY4LjA5MTYgNDcuOTY1OCA2NS43MjE2IDQ3Ljk2NThDNjMuMzE1NyA0Ny45NjU4IDYxLjIzMyA0Ni4xNzA0IDYxLjIzMyA0Mi41Nzk1QzYxLjIzMyAzOC45ODg1IDYzLjMxNTcgMzcuMTkzMSA2NS43MjE2IDM3LjE5MzFDNjguMDkxNiAzNy4xOTMxIDcwLjIxMDMgMzguOTg4NSA3MC4yMTAzIDQyLjU3OTVaIiBmaWxsPSIjRkZGREY4Ii8+Cjwvc3ZnPg==";
  supportedTransactionVersions = new Set(["legacy", 0] as const);

  private _connecting = false;

  get publicKey(): PublicKey | null {
    const session = getSession();
    if (!session?.publicKey) return null;
    try {
      return new PublicKey(session.publicKey);
    } catch {
      return null;
    }
  }

  get connecting(): boolean {
    return this._connecting;
  }

  get connected(): boolean {
    return !!getSession()?.publicKey;
  }

  get readyState(): WalletReadyState {
    // Loadable means "can be used but requires an action" (deep link redirect)
    if (isMobileWithoutPhantom()) return WalletReadyState.Loadable;
    return WalletReadyState.NotDetected;
  }

  async connect(): Promise<void> {
    try {
      this._connecting = true;

      // If already connected from a previous session (survived page reload), just emit
      const session = getSession();
      if (session?.publicKey) {
        console.log("[PhantomMobile] Reconnecting from stored session:", session.publicKey);
        this.emit("connect", new PublicKey(session.publicKey));
        return;
      }

      // Only redirect to Phantom if the user explicitly clicked "Connect Wallet".
      // autoConnect fires connect() on every page load when walletName is stored,
      // which would redirect to Phantom in an infinite loop if the user cancels.
      const intent = localStorage.getItem("phantom_mobile_connect_intent");
      if (!intent) {
        console.log("[PhantomMobile] No connect intent — skipping redirect (likely autoConnect)");
        this._connecting = false;
        throw new WalletConnectionError("No active session");
      }
      localStorage.removeItem("phantom_mobile_connect_intent");

      // Redirect to Phantom app for connection approval
      console.log("[PhantomMobile] Redirecting to Phantom app for connect...");
      const url = buildConnectUrl();
      openPhantomDeepLink(url);

      // The page will navigate away. Return a promise that never resolves.
      // When the user comes back, the callback handler will process the result
      // and the adapter will pick up the session from localStorage.
      return new Promise<void>(() => {});
    } catch (error) {
      this._connecting = false;
      throw new WalletConnectionError((error as Error).message);
    }
  }

  async disconnect(): Promise<void> {
    // Clear session locally only — no redirect to Phantom.
    // The user stays on KindSwap and can reconnect via "Connect Wallet".
    clearSession();
    this.emit("disconnect");
  }

  async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    _connection: Connection,
    options: SendTransactionOptions = {}
  ): Promise<TransactionSignature> {
    const session = getSession();
    if (!session) throw new WalletSendTransactionError("Wallet not connected");

    const { signers } = options;
    if (signers?.length) {
      throw new WalletSendTransactionError(
        "Multi-signer send is not supported via Phantom mobile deep link"
      );
    }

    // Serialize the transaction
    let serialized: Uint8Array;
    try {
      if (transaction instanceof VersionedTransaction) {
        serialized = transaction.serialize();
      } else {
        serialized = transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        });
      }
    } catch (serializeErr) {
      console.error("[PhantomMobile] Failed to serialize transaction:", serializeErr);
      throw new WalletSendTransactionError(
        `Failed to serialize transaction: ${(serializeErr as Error).message}`
      );
    }

    console.log(
      `[PhantomMobile] Transaction serialized: ${serialized.length} bytes, ` +
      `isVersioned=${transaction instanceof VersionedTransaction}`
    );

    // Use signTransaction instead of signAndSendTransaction.
    // Phantom on some Android versions returns -32601 (method not found) for
    // signAndSendTransaction deep links. signTransaction is more widely supported.
    // The PhantomMobileCallbackHandler will submit the signed tx via RPC on return.
    setPendingOperation({
      type: "signTransaction",
      returnPath: window.location.pathname,
      meta: {
        timestamp: Date.now(),
        txSize: serialized.length,
      },
      timestamp: Date.now(),
    });

    const url = buildSignTransactionUrl(serialized);
    console.log(`[PhantomMobile] Deep link URL length: ${url.length} chars`);
    console.log("[PhantomMobile] Redirecting to Phantom app for signTransaction...");
    openPhantomDeepLink(url);

    // Page navigates away; promise never resolves.
    // The callback handler will submit the signed tx and store the signature on return.
    return new Promise<TransactionSignature>(() => {});
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<T> {
    const session = getSession();
    if (!session) throw new WalletSignTransactionError("Wallet not connected");

    let serialized: Uint8Array;
    if (transaction instanceof VersionedTransaction) {
      serialized = transaction.serialize();
    } else {
      serialized = (transaction as Transaction).serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
    }

    setPendingOperation({
      type: "signTransaction",
      returnPath: window.location.pathname,
      timestamp: Date.now(),
    });

    console.log("[PhantomMobile] Redirecting to Phantom app for signTransaction...");
    const url = buildSignTransactionUrl(serialized);
    openPhantomDeepLink(url);

    return new Promise<T>(() => {});
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    _transactions: T[]
  ): Promise<T[]> {
    // Phantom deep link protocol doesn't support batch signing.
    // Each transaction would need a separate redirect.
    throw new WalletSignTransactionError(
      "signAllTransactions is not supported via Phantom mobile deep link. " +
      "Transactions must be signed individually."
    );
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    const session = getSession();
    if (!session) throw new Error("Wallet not connected");

    setPendingOperation({
      type: "signMessage",
      returnPath: window.location.pathname,
      timestamp: Date.now(),
    });

    console.log("[PhantomMobile] Redirecting to Phantom app for signMessage...");
    const url = buildSignMessageUrl(message);
    openPhantomDeepLink(url);

    return new Promise<Uint8Array>(() => {});
  }
}
