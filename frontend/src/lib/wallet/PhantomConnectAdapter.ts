import {
  BaseMessageSignerWalletAdapter,
  type SendTransactionOptions,
  WalletReadyState,
  WalletConnectionError,
  WalletSendTransactionError,
  WalletSignTransactionError,
  WalletName,
} from "@solana/wallet-adapter-base";
import { Connection, PublicKey, Transaction, TransactionSignature, VersionedTransaction } from "@solana/web3.js";

interface PhantomSendResult {
  signature: string;
}

interface PhantomSolanaProvider {
  isPhantom?: boolean;
  signTransaction: <T extends Transaction | VersionedTransaction>(transaction: T) => Promise<T>;
  signAllTransactions: <T extends Transaction | VersionedTransaction>(transactions: T[]) => Promise<T[]>;
  signMessage: (message: Uint8Array, display?: string) => Promise<{ signature: Uint8Array }>;
  signAndSendTransaction?: (
    transaction: Transaction | VersionedTransaction,
    options?: Omit<SendTransactionOptions, "signers">
  ) => Promise<PhantomSendResult | string>;
}

/**
 * Configuration interface for PhantomConnectAdapter
 * Bridges Phantom Connect SDK to Solana Wallet Adapter interface
 */
export interface PhantomConnectConfig {
  getUser: () => any | null; // PhantomUser from @phantom/react-sdk
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

/**
 * Custom wallet adapter that bridges Phantom Connect SDK to Solana Wallet Adapter
 *
 * This adapter allows seamless integration between the Phantom Connect SDK
 * and the existing Solana Wallet Adapter infrastructure, eliminating the
 * "malicious dApp" security warning in Phantom wallet.
 *
 * Usage:
 * ```typescript
 * const { user, connect, disconnect } = usePhantom();
 * const adapter = new PhantomConnectAdapter({
 *   getUser: () => user,
 *   connect,
 *   disconnect,
 * });
 * ```
 */
export class PhantomConnectAdapter extends BaseMessageSignerWalletAdapter {
  name = "Phantom" as WalletName<"Phantom">;
  url = "https://phantom.app";
  icon =
    "data:image/svg+xml;base64,PHN2ZyBmaWxsPSJub25lIiBoZWlnaHQ9IjM0IiB3aWR0aD0iMzQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGxpbmVhckdyYWRpZW50IGlkPSJhIiB4MT0iLjUiIHgyPSIuNSIgeTE9IjAiIHkyPSIxIj48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiM1MzRiYjEiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM1NTFiZjkiLz48L2xpbmVhckdyYWRpZW50PjxsaW5lYXJHcmFkaWVudCBpZD0iYiIgeDE9Ii41IiB4Mj0iLjUiIHkxPSIwIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZmZmIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjZmZmIiBzdG9wLW9wYWNpdHk9Ii44MiIvPjwvbGluZWFyR3JhZGllbnQ+PGNpcmNsZSBjeD0iMTciIGN5PSIxNyIgZmlsbD0idXJsKCNhKSIgcj0iMTciLz48cGF0aCBkPSJtMjkuMTcwMiAxNy4yMDcxYzAgMi4zODg1LTEuODMzMiAzLjk2MTQtNC40NTgyIDMuOTYxNC0yLjE2OTkgMC0zLjg1MzMtMS4zODI5LTMuODUzMy0zLjMxNTIgMC0yLjA3OTMgMS45OTYxLTMuMTIxNSAzLjQ0MTYtMy4xMjE1IDEuNjM1Ny4wNjIyIDMuMjE4NCAuNDM1NiA0LjY5ODEgMS4xMDU2LjMyMDcuMTcyMi42NTM4LjI0MDEuOTE3Mi4yNDAxem0tMjQuOTMyMyAzLjI5OThjLjQxNzggMCAuNzU2LS4xNzI0Ljk4NDMtLjUyNTUuMjI4My0uMzUyMi4yOTYyLS43ODA4LjE5MjgtMS4xNjk0bC0uOTU4Ny0zLjc1MDYgMS40Njg4LTQuMjk5NGMuMDY4Ny0uMjExNC4xMDMxLS40NjQ0LjEwMzEtLjcxNDUgMC0uNTE4LjI5OTYtLjk4MzIuNzIzNS0uOTgzMi42Nzg2IDAgMSAxLjExOTcgMSAyLjI5MjUgMCAuNDUxMy4wNDEzLjg0NjYuMTMxMiAxLjIxNDRsMS4wMzYxIDQuNDc1M2MuMjA2NS43NTc4LjI2MjEgMS4zMzk1LjI2MjEgMS44ODE0IDAgLjkyMTUtLjcyMzYgMS40NDk0LTEuNjg0IDE0NDk0LS45MTI0IDAtMS40NjE5LS41OTQ3LTEuNzgyNS0xLjg5MzRsLS41MDk3LTIuMjQ0Mi0uOTUwMy0yLjk3NDctLjk0MzYgMi45NzQ3LS41MjQ0IDIuMjMyYy0uMjg5MyAxLjI0NDYtLjg4MTEgMS45MDg5LTEuNzgyNiAxLjkwODktLjk0NyAwLTEuNjYxMi0uNTM5OC0xLjY2MTItMS40NDk0IDAtLjU0MTkuMDU1Ni0xLjExMzUuMjY4Ny0xLjgzODJsMS4wMjk0LTQuNDM1OWMuMTAzMS0uNDIyOC4xNDQzLS44Njc3LjE0NDMtMS4yODQyIDAtMS4yMTc4LjMyMjItMi4yOTk0IDEuMDAwNy0yLjI5OTQuNDU4NiAwIC43NzI5LjQ2NDQuNzcyOS45ODMyIDAgLjI1MTIuMDQxMi41MTM2LjExODguNzE0NWwxLjQzNDQgNC4zMDgzLS45MjMyIDMuNzQ5N2MtLjEwMzEuMzg5NS0uMDM0NC44MTcyLjE5MjggMS4xNjk0LjIyODMuMzUzMS41NjY0LjUyNTUuOTg0My41MjU1em03LjU3MzQtLjExNjVjLS41MTEyIDAtLjkyMDItLjQwODgtLjkyMDItLjkxODEgMC0uNTEuNDA4OS0uOTE4OS45MjAyLS45MTg5czI5LjEyNSAwIDI5LjEyNSAwYy41MTA1IDAgLjkyMDEuNDA4OS45MjAxLjkxODkgMCAuNTA5My0uNDA5Ni45MTgxLS45MjAxLjkxODFzLTI5LjEyNSAwLTI5LjEyNSAwem0zLjY5NDEtOC41OTExYy0uNTMyMS4xMzY0LS44MzE3LjY3OTUtLjY5OTggMS4yMTc5bC43NjA2IDMuMTI5NGMuMTMxMi41Mzc0LjY3MTIuODQ2IDEuMjAyNS43MDk2LjUzMjEtLjEzNjQuODMxNy0uNjc5NS42OTk4LTEuMjE3OWwtLjc2MDYtMy4xMjk0Yy0uMTMxMi0uNTM3NC0uNjcxMi0uODQ2LTEuMjAyNS0uNzA5NnptNC45JM0tLjQ4MTNjLS41MzIxLjEzNjQtLjgzMTcuNjc5NS0uNjk5OCAxLjIxNzlsLjc2MDYgMy4xMjk0Yy4xMzEyLjUzNzQuNjcxMi44NDYgMS4yMDI1LjcwOTYuNTMyMS0uMTM2NC44MzE3LS42Nzk1LjY5OTgtMS4yMTc5bC0uNzYwNi0zLjEyOTRjLS4xMzEyLS41Mzc0LS42NzEyLS44NDYtMS4yMDI1LS43MDk2eiIgZmlsbD0idXJsKCNiKSIvPjwvc3ZnPg==";
  supportedTransactionVersions = new Set(["legacy", 0] as const);

  private _config: PhantomConnectConfig;
  private _connecting = false;
  private _readyState: WalletReadyState = WalletReadyState.Installed;

  constructor(config: PhantomConnectConfig) {
    super();
    this._config = config;
  }

  get publicKey(): PublicKey | null {
    const user = this._config.getUser();
    if (!user?.solanaAddress) return null;
    try {
      return new PublicKey(user.solanaAddress);
    } catch {
      return null;
    }
  }

  get connecting(): boolean {
    return this._connecting;
  }

  get connected(): boolean {
    return !!this._config.getUser()?.solanaAddress;
  }

  get readyState(): WalletReadyState {
    return this._readyState;
  }

  async connect(): Promise<void> {
    try {
      this._connecting = true;
      await this._config.connect();
      this.emit("connect", this.publicKey!);
    } catch (error) {
      throw new WalletConnectionError((error as Error).message);
    } finally {
      this._connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    await this._config.disconnect();
    this.emit("disconnect");
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<T> {
    try {
      const user = this._config.getUser();
      if (!user) throw new Error("Wallet not connected");

      // Use Phantom Connect SDK via window.phantom.solana
      // This is the official Phantom API that removes security warnings
      const phantom = (window as any).phantom?.solana as PhantomSolanaProvider | undefined;
      if (!phantom) {
        throw new Error("Phantom wallet not found");
      }

      const signedTx = await phantom.signTransaction(transaction);
      return signedTx as T;
    } catch (error) {
      throw new WalletSignTransactionError((error as Error).message);
    }
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    transactions: T[]
  ): Promise<T[]> {
    try {
      const user = this._config.getUser();
      if (!user) throw new Error("Wallet not connected");

      // Use Phantom Connect SDK via window.phantom.solana
      const phantom = (window as any).phantom?.solana as PhantomSolanaProvider | undefined;
      if (!phantom) {
        throw new Error("Phantom wallet not found");
      }

      const signedTxs = await phantom.signAllTransactions(transactions);
      return signedTxs as T[];
    } catch (error) {
      throw new WalletSignTransactionError((error as Error).message);
    }
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    try {
      const user = this._config.getUser();
      if (!user) throw new Error("Wallet not connected");

      // Use Phantom Connect SDK via window.phantom.solana
      const phantom = (window as any).phantom?.solana as PhantomSolanaProvider | undefined;
      if (!phantom) {
        throw new Error("Phantom wallet not found");
      }

      const { signature } = await phantom.signMessage(message, "utf8");
      return signature;
    } catch (error) {
      throw new Error((error as Error).message);
    }
  }

  async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    _connection: Connection,
    options: SendTransactionOptions = {}
  ): Promise<TransactionSignature> {
    try {
      const user = this._config.getUser();
      if (!user) throw new Error("Wallet not connected");

      const phantom = (window as any).phantom?.solana as PhantomSolanaProvider | undefined;
      if (!phantom?.signAndSendTransaction) {
        throw new Error("Phantom signAndSendTransaction not available");
      }

      const { signers, ...sendOptions } = options;
      if (signers?.length) {
        // Multi-signer transactions must be handled in an explicit multi-signer flow.
        throw new Error("Multi-signer send is not supported in PhantomConnectAdapter.sendTransaction");
      }

      const result = await phantom.signAndSendTransaction(transaction, sendOptions);
      const signature = typeof result === "string" ? result : result.signature;

      if (!signature) {
        throw new Error("No signature returned from Phantom");
      }

      return signature;
    } catch (error) {
      throw new WalletSendTransactionError((error as Error).message);
    }
  }
}
