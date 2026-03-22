// jupiterSwapService.ts
import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionExpiredBlockheightExceededError,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import BN from "bn.js";
import { JupiterAPIService } from "./jupiterService";
import {
  FeeCalculation,
  Instruction as JupiterInstruction,
  QuoteRoute,
  SwapInstructionsResponse,
  SwapRequest,
} from "./jupiter";
import { isMobileWithoutPhantom, getSession as getPhantomMobileSession } from "@/lib/wallet/phantomMobile";

/**
 * Maximum number of retry attempts for sending transactions with fresh blockhash
 */
const MAX_BLOCKHASH_RETRIES = 2;

/**
 * FIX FRONTEND-25: Maximum slippage retry attempts after on-chain SlippageToleranceExceeded
 */
const MAX_SLIPPAGE_RETRIES = 2;

/**
 * FIX FRONTEND-25: How many basis points to add to slippage on each retry
 */
const SLIPPAGE_ESCALATION_STEP_BPS = 50;

/**
 * Blockhash age threshold in milliseconds (50 seconds)
 * Solana blockhashes are valid for ~60 seconds, we refresh at 50s to be safe
 */
const BLOCKHASH_REFRESH_THRESHOLD = 50000;

/**
 * Solana packet size limit for serialized transactions.
 * Used to fail fast with a user-friendly error before wallet prompt.
 */
const SINGLE_TX_SIZE_LIMIT_BYTES = 1232;

const SINGLE_TX_ROUTE_TOO_LARGE_ERROR =
  "This route requires more accounts than a single transaction can support. Try a smaller amount or another pair.";

type TxMode = "single_tx" | "legacy_two_tx";

const parseBooleanEnv = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
};

const configuredSingleTxMode = parseBooleanEnv(
  import.meta.env.VITE_SINGLE_TX_SWAP_ENABLED
);
// Default to TWO-TRANSACTION mode for safety (fee tx first, then swap tx)
// Only use single-tx if explicitly enabled via env variable
const SINGLE_TX_SWAP_ENABLED = configuredSingleTxMode ?? false;

export enum SwapStatus {
  IDLE = "IDLE",
  GETTING_QUOTE = "GETTING_QUOTE",
  BUILDING_TRANSACTION = "BUILDING_TRANSACTION",
  AWAITING_SIGNATURE = "AWAITING_SIGNATURE",
  CONFIRMING = "CONFIRMING",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
}

export interface SwapState {
  status: SwapStatus;
  quote?: QuoteRoute;
  feeTransferSignature?: string;
  swapSignature?: string;
  error?: string;
  message?: string;
}

export interface SwapParams {
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount?: string; // Required for ExactOut mode
  inputDecimals: number;
  outputDecimals: number;
  feeCalculation: FeeCalculation;
  platformFeeWallet: string;
  charityFeeWallet: string;
  slippageBps: number;
  swapMode: "ExactIn" | "ExactOut";
}

interface QuoteComputation {
  isInputSol: boolean;
  quoteAmount: string;
}

interface ComposeDiagnostics {
  composeStage: string;
  instructionCount: number;
  txSizeBytes: number;
}

interface FeeSmallestAmounts {
  platformFeeSmallest: number;
  charityFeeSmallest: number;
  totalFeeSmallest: number;
}

export class JupiterSwapService {
  private jupiterService: JupiterAPIService;
  private connection: Connection;
  private static readonly SOL_MINT =
    "So11111111111111111111111111111111111111112";
  private lastBlockhash: { blockhash: string; timestamp: number } | null = null;
  private readonly singleTxEnabled: boolean;

  constructor(connection: Connection) {
    this.connection = connection;
    this.jupiterService = new JupiterAPIService();
    this.singleTxEnabled = SINGLE_TX_SWAP_ENABLED;
    console.log(
      `[JupiterSwap] Single transaction mode: ${
        this.singleTxEnabled ? "enabled" : "disabled"
      }`
    );
  }

  /**
   * FIX FRONTEND-25: Detects Jupiter's on-chain SlippageToleranceExceeded error.
   * Custom:6001 in an InstructionError means the price moved outside the agreed
   * slippage band after the transaction was broadcast. This is a post-broadcast,
   * on-chain rejection — distinct from preflight simulation failures (FRONTEND-11).
   */
  private isSlippageExceeded(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const instructionErr = (err as any)["InstructionError"];
    if (!Array.isArray(instructionErr) || instructionErr.length < 2) return false;
    return (
      typeof instructionErr[1] === "object" &&
      instructionErr[1]?.["Custom"] === 6001
    );
  }

  /**
   * Gets a fresh blockhash, using cached value if recent enough
   */
  private async getFreshBlockhash(): Promise<string> {
    const now = Date.now();

    // Use cached blockhash if it's fresh (less than 50 seconds old)
    if (
      this.lastBlockhash &&
      now - this.lastBlockhash.timestamp < BLOCKHASH_REFRESH_THRESHOLD
    ) {
      return this.lastBlockhash.blockhash;
    }

    // Fetch new blockhash
    const { blockhash } = await this.connection.getLatestBlockhash("finalized");
    this.lastBlockhash = { blockhash, timestamp: now };

    console.log(
      `[JupiterSwap] Fetched fresh blockhash: ${blockhash.substring(0, 8)}...`
    );
    return blockhash;
  }

  /**
   * Simulates a transaction before signing to catch errors early
   * Uses sigVerify: false to skip signature verification (as recommended by Phantom)
   */
  private async simulateTransaction(
    transaction: Transaction | VersionedTransaction,
    description: string = "transaction"
  ): Promise<void> {
    try {
      console.log(`[JupiterSwap] Simulating ${description}...`);

      // Skip simulation for legacy Transaction objects (fee transactions)
      // These are simple SPL token transfers that are unlikely to fail
      if (transaction instanceof Transaction) {
        console.log(
          `[JupiterSwap] Skipping simulation for legacy transaction (${description})`
        );
        console.log(
          `[JupiterSwap] Legacy transactions (SPL transfers) are validated during signing`
        );
        return;
      }

      const simulation = await this.connection.simulateTransaction(transaction, {
        sigVerify: false, // Critical: skip signature verification during simulation
        replaceRecentBlockhash: true, // Use latest blockhash for simulation
      });

      if (simulation.value.err) {
        const errorMsg = JSON.stringify(simulation.value.err);
        console.error(`[JupiterSwap] ${description} simulation failed:`, {
          error: simulation.value.err,
          logs: simulation.value.logs,
        });
        if (simulation.value.logs?.length) {
          console.error(
            `[JupiterSwap] ${description} simulation logs:\n${simulation.value.logs.join(
              "\n"
            )}`
          );
        }
        throw new Error(`Transaction will fail: ${errorMsg}`);
      }

      console.log(`[JupiterSwap] ${description} simulation successful:`, {
        unitsConsumed: simulation.value.unitsConsumed,
        logsCount: simulation.value.logs?.length || 0,
      });
    } catch (error: any) {
      console.error(`[JupiterSwap] ${description} simulation error:`, error);
      throw new Error(
        `Transaction simulation failed: ${
          error.message || "Unknown error"
        }. The transaction would likely fail onchain.`
      );
    }
  }

  /**
   * Sends a transaction with automatic retry on blockhash expiry.
   * Rebuilds the transaction for each retry so blockhashes are always fresh.
   */
  private async sendTransactionWithRetry(
    wallet: WalletContextState,
    buildTransaction: () => Promise<Transaction | VersionedTransaction>,
    options: {
      skipPreflight?: boolean;
      maxRetries?: number;
      description?: string;
      isInputSol?: boolean;
    } = {}
  ): Promise<string> {
    const {
      skipPreflight = false,
      maxRetries = 3,
      description = "transaction",
      isInputSol = false,
    } = options;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_BLOCKHASH_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(
            `[JupiterSwap] Retry attempt ${attempt}/${MAX_BLOCKHASH_RETRIES} - fetching fresh blockhash`
          );
          // Force blockhash refresh for builders that use cached blockhashes.
          this.lastBlockhash = null;
        }

        const transaction = await buildTransaction();
        const signature = await wallet.sendTransaction(transaction, this.connection, {
          skipPreflight,
          maxRetries,
          preflightCommitment: "confirmed",
        });

        console.log(`[JupiterSwap] ${description} sent successfully: ${signature}`);
        return signature;
      } catch (error: any) {
        lastError = error;

        const errorMessage = error.message || String(error);
        const isBlockhashError =
          errorMessage.includes("Blockhash not found") ||
          errorMessage.includes("block height exceeded") ||
          error instanceof TransactionExpiredBlockheightExceededError;

        const isInvalidAccountError =
          errorMessage.includes("invalid account data for instruction") ||
          errorMessage.includes("InvalidAccountData");
        const isPreflightSimulationError =
          errorMessage.includes("Transaction simulation failed") ||
          errorMessage.includes("InstructionError") ||
          errorMessage.includes("custom program error") ||
          errorMessage.includes("SendTransactionError");

        console.error(
          `[JupiterSwap] ${description} send failed (attempt ${attempt + 1}):`,
          {
            error: errorMessage,
            isBlockhashError,
            isInvalidAccountError,
            isPreflightSimulationError,
          }
        );

        // If it's a blockhash error and we haven't exhausted retries, continue loop
        if (isBlockhashError && attempt < MAX_BLOCKHASH_RETRIES) {
          console.log(
            `[JupiterSwap] Blockhash expired, will retry with fresh blockhash`
          );
          this.lastBlockhash = null;
          continue;
        }

        // If it's an invalid account error after a blockhash retry,
        // the account state changed - this is unrecoverable
        if (isInvalidAccountError && attempt > 0) {
          throw new Error(
            "Transaction failed: Account state changed during retry. Please try the swap again."
          );
        }

        // Preflight simulation failures are not retried with the same payload.
        // The caller may choose to refresh quote/route and retry once.
        if (isPreflightSimulationError) {
          const isCustomOneError =
            errorMessage.includes('"Custom":1') ||
            errorMessage.includes("custom program error: 0x1");
          const hint =
            isInputSol && isCustomOneError
              ? "Likely insufficient SOL for swap amount + WSOL rent + network fees. Keep ~0.003 SOL extra and retry."
              : "Route/account state likely changed. Refresh quote and retry.";
          throw new Error(
            `${description} preflight simulation failed. ${hint} Raw error: ${errorMessage}`
          );
        }

        // For any other error or if we've exhausted retries, throw
        throw error;
      }
    }

    // Should never reach here, but throw the last error if we do
    throw lastError || new Error("Transaction failed after maximum retry attempts");
  }

  async executeSwap(
    wallet: WalletContextState,
    params: SwapParams,
    onStateChange: (state: SwapState) => void
  ): Promise<{ feeSignature?: string; swapSignature: string }> {
    if (!wallet.publicKey || !wallet.sendTransaction) {
      throw new Error(
        "Wallet not connected or doesn't support transaction sending"
      );
    }

    const state: SwapState = {
      status: SwapStatus.IDLE,
      message: "Initializing swap...",
    };
    onStateChange(state);

    try {
      // Phantom deep links don't support VersionedTransaction (V0).
      // On mobile, force legacy two-tx mode with asLegacyTransaction so
      // Jupiter returns a legacy transaction that Phantom can parse.
      const isMobileDeepLink = isMobileWithoutPhantom() || !!getPhantomMobileSession();
      const txMode: TxMode = isMobileDeepLink
        ? "legacy_two_tx"
        : this.singleTxEnabled
          ? "single_tx"
          : "legacy_two_tx";
      console.log(
        `[JupiterSwap] Using transaction mode: ${txMode}` +
        (isMobileDeepLink ? " (mobile deep link — forced legacy)" : "")
      );

      if (txMode === "single_tx") {
        return await this.executeSwapSingleTx(wallet, params, state, onStateChange);
      }

      return await this.executeSwapLegacyTwoTx(wallet, params, state, onStateChange, isMobileDeepLink);
    } catch (error: any) {
      console.error("Swap error:", error);
      state.status = SwapStatus.FAILED;
      state.error = error.message || "Unknown error during swap";
      state.message = `Swap failed: ${state.error}`;
      onStateChange(state);
      throw error;
    }
  }

  private async executeSwapSingleTx(
    wallet: WalletContextState,
    params: SwapParams,
    state: SwapState,
    onStateChange: (state: SwapState) => void
  ): Promise<{ feeSignature?: string; swapSignature: string }> {
    const { isInputSol, quoteAmount } = this.computeQuoteAmount(params);

    state.status = SwapStatus.GETTING_QUOTE;
    state.message = "Getting best swap route...";
    onStateChange(state);

    let quote = await this.jupiterService.getQuote({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: quoteAmount,
      slippageBps: params.slippageBps,
      swapMode: params.swapMode,
    });

    state.quote = quote;
    state.message = `Quote received: ${(
      parseFloat(quote.outAmount) / Math.pow(10, params.outputDecimals)
    ).toFixed(6)}`;
    onStateChange(state);

    state.status = SwapStatus.BUILDING_TRANSACTION;
    state.message = "Building single transaction...";
    onStateChange(state);

    const swapRequestBase: Omit<SwapRequest, "quoteResponse"> = {
      userPublicKey: wallet.publicKey!.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 10000,
    };

    const composeDiagnostics: ComposeDiagnostics = {
      composeStage: "init",
      instructionCount: 0,
      txSizeBytes: 0,
    };

    const buildComposedTransaction = async (): Promise<VersionedTransaction> => {
      try {
        composeDiagnostics.composeStage = "fetch_swap_instructions";
        const instructionsResponse = await this.jupiterService.getSwapInstructions({
          ...swapRequestBase,
          quoteResponse: quote,
        });

        composeDiagnostics.composeStage = "decode_jupiter_instructions";
        const jupiterInstructions = this.decodeSwapInstructions(instructionsResponse);

        composeDiagnostics.composeStage = "build_fee_instructions";
        // Always use input fee instructions (fees deducted from input token before swap)
        const inputFeeInstructions = await this.buildInputFeeInstructions(wallet, params);

        const orderedInstructions: TransactionInstruction[] = [
          ...jupiterInstructions.computeBudgetInstructions,
          ...jupiterInstructions.setupInstructions,
          ...inputFeeInstructions,
          ...jupiterInstructions.otherInstructions,
          jupiterInstructions.swapInstruction,
        ];
        if (jupiterInstructions.cleanupInstruction) {
          orderedInstructions.push(jupiterInstructions.cleanupInstruction);
        }

        composeDiagnostics.instructionCount = orderedInstructions.length;
        if (orderedInstructions.length === 0) {
          throw new Error("Composed transaction has no instructions");
        }

        composeDiagnostics.composeStage = "load_lookup_tables";
        const lookupTableAccounts = await this.getLookupTableAccounts(
          instructionsResponse.addressLookupTableAddresses
        );

        composeDiagnostics.composeStage = "compile_transaction";
        const blockhash = await this.getFreshBlockhash();
        const messageV0 = new TransactionMessage({
          payerKey: wallet.publicKey!,
          recentBlockhash: blockhash,
          instructions: orderedInstructions,
        }).compileToV0Message(lookupTableAccounts);

        const transaction = new VersionedTransaction(messageV0);
        composeDiagnostics.composeStage = "measure_transaction";
        composeDiagnostics.txSizeBytes = transaction.serialize().length;

        if (composeDiagnostics.txSizeBytes > SINGLE_TX_SIZE_LIMIT_BYTES) {
          throw new Error(SINGLE_TX_ROUTE_TOO_LARGE_ERROR);
        }

        composeDiagnostics.composeStage = "done";
        return transaction;
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        const isCapacityError =
          errorMessage.includes(SINGLE_TX_ROUTE_TOO_LARGE_ERROR) ||
          errorMessage.includes("Transaction too large") ||
          errorMessage.includes("encoding overruns Uint8Array") ||
          errorMessage.includes("too many account");

        if (isCapacityError) {
          throw new Error(
            `${SINGLE_TX_ROUTE_TOO_LARGE_ERROR} composeStage=${composeDiagnostics.composeStage}; instructionCount=${composeDiagnostics.instructionCount}; txSize=${composeDiagnostics.txSizeBytes}.`
          );
        }

        throw new Error(
          `Failed to compose single transaction: ${errorMessage}. composeStage=${composeDiagnostics.composeStage}; instructionCount=${composeDiagnostics.instructionCount}; txSize=${composeDiagnostics.txSizeBytes}.`
        );
      }
    };

    // Build once for simulation before prompting wallet.
    const composedTransaction = await buildComposedTransaction();

    state.status = SwapStatus.BUILDING_TRANSACTION;
    state.message = "Simulating transaction to verify it will succeed...";
    onStateChange(state);

    let simulationWarning: string | null = null;
    try {
      await this.simulateTransaction(composedTransaction, "composed swap transaction");
      console.log("[JupiterSwap] Composed transaction simulation passed");
    } catch (simulationError: any) {
      simulationWarning = simulationError?.message || String(simulationError);
      console.warn(
        "[JupiterSwap] Simulation warning for composed transaction (continuing):",
        simulationWarning
      );
    }

    state.status = SwapStatus.AWAITING_SIGNATURE;
    state.message = simulationWarning
      ? "Simulation warning detected. Please review details in wallet before approving."
      : "Please approve transaction in your wallet...";
    onStateChange(state);

    state.status = SwapStatus.CONFIRMING;
    state.message = "Sending transaction...";
    onStateChange(state);

    let swapSignature: string;
    try {
      swapSignature = await this.sendTransactionWithRetry(wallet, buildComposedTransaction, {
        skipPreflight: false,
        maxRetries: 3,
        description: "composed swap+fee transaction",
        isInputSol,
      });
    } catch (swapSendError: any) {
      const sendErrorMessage = swapSendError?.message || String(swapSendError);
      const shouldRetryWithFreshQuote =
        sendErrorMessage.includes("preflight simulation failed") ||
        sendErrorMessage.includes("Transaction simulation failed") ||
        sendErrorMessage.includes("InstructionError");

      if (!shouldRetryWithFreshQuote) {
        throw swapSendError;
      }

      console.warn(
        "[JupiterSwap] Composed transaction preflight failed, refreshing quote and retrying once"
      );
      state.message = "Route changed during preflight. Refreshing quote and retrying once...";
      onStateChange(state);

      quote = await this.jupiterService.getQuote({
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: quoteAmount,
        slippageBps: params.slippageBps,
        swapMode: params.swapMode,
      });
      state.quote = quote;
      onStateChange(state);

      swapSignature = await this.sendTransactionWithRetry(
        wallet,
        buildComposedTransaction,
        {
          skipPreflight: false,
          maxRetries: 3,
          description: "composed swap+fee transaction (requoted)",
          isInputSol,
        }
      );
    }

    state.swapSignature = swapSignature;
    state.message = "Transaction sent, confirming...";
    onStateChange(state);

    // FIX FRONTEND-24 + FRONTEND-25: Use blockhash-aware confirmTransaction overload.
    // Passing {signature, blockhash, lastValidBlockHeight} gives Solana a defined
    // expiry window, preventing TransactionExpiredTimeoutError (FRONTEND-24).
    // isSlippageExceeded() then detects Custom:6001 for a user-friendly message (FRONTEND-25).
    const latestBlockhashSingle = await this.connection.getLatestBlockhash();
    const confirmation = await this.connection.confirmTransaction(
      { signature: swapSignature, ...latestBlockhashSingle },
      "confirmed"
    );

    if (confirmation.value.err) {
      console.error("[JupiterSwap] On-chain swap error:", JSON.stringify(confirmation.value.err));
      if (this.isSlippageExceeded(confirmation.value.err)) {
        throw new Error(
          "Swap failed: price moved too fast during execution. Try increasing slippage tolerance."
        );
      }
      throw new Error("Swap failed. Please try again.");
    }

    state.status = SwapStatus.CONFIRMED;
    state.message = "Swap completed successfully!";
    onStateChange(state);

    // Single-transaction mode: one signature settles both swap + fee transfers.
    return { swapSignature };
  }

  private async executeSwapLegacyTwoTx(
    wallet: WalletContextState,
    params: SwapParams,
    state: SwapState,
    onStateChange: (state: SwapState) => void,
    useLegacyTransaction = false
  ): Promise<{ feeSignature?: string; swapSignature: string }> {
    const { isInputSol, quoteAmount } = this.computeQuoteAmount(params);

    state.status = SwapStatus.GETTING_QUOTE;
    state.message = "Getting best swap route...";
    onStateChange(state);

    let quote = await this.jupiterService.getQuote({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: quoteAmount,
      slippageBps: params.slippageBps,
      swapMode: params.swapMode,
    });

    state.quote = quote;
    state.message = `Quote received: ${(
      parseFloat(quote.outAmount) / Math.pow(10, params.outputDecimals)
    ).toFixed(6)}`;

    onStateChange(state);

    state.status = SwapStatus.BUILDING_TRANSACTION;
    state.message = "Building transactions...";
    onStateChange(state);

    const swapRequest: SwapRequest = {
      quoteResponse: quote,
      userPublicKey: wallet.publicKey!.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 10000,
      ...(useLegacyTransaction ? { asLegacyTransaction: true } : {}),
    };

    if (useLegacyTransaction) {
      console.log("[JupiterSwap] Requesting legacy transaction for mobile deep link");
    }

    // For mobile deep links, we must combine fee + swap into a single legacy
    // transaction because only one Phantom redirect is possible. We use
    // getSwapInstructions to get individual instructions and inject fee transfers.
    const buildMobileCombinedTransaction = async (): Promise<Transaction> => {
      const instructionsResponse = await this.jupiterService.getSwapInstructions({
        ...swapRequest,
        quoteResponse: quote,
      });
      const jupiterInstructions = this.decodeSwapInstructions(instructionsResponse);
      const inputFeeInstructions = await this.buildInputFeeInstructions(wallet, params);

      const transaction = new Transaction();
      const blockhash = await this.getFreshBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey!;

      // Compute budget first
      jupiterInstructions.computeBudgetInstructions.forEach(ix => transaction.add(ix));
      // Setup (e.g. WSOL account creation)
      jupiterInstructions.setupInstructions.forEach(ix => transaction.add(ix));
      // Fee transfers (deducted from input before swap)
      inputFeeInstructions.forEach(ix => transaction.add(ix));
      // Other Jupiter instructions
      jupiterInstructions.otherInstructions.forEach(ix => transaction.add(ix));
      // The actual swap
      transaction.add(jupiterInstructions.swapInstruction);
      // Cleanup (e.g. close WSOL account)
      if (jupiterInstructions.cleanupInstruction) {
        transaction.add(jupiterInstructions.cleanupInstruction);
      }

      console.log(
        `[JupiterSwap] Mobile combined tx: ${transaction.instructions.length} instructions ` +
        `(${inputFeeInstructions.length} fee + ${jupiterInstructions.computeBudgetInstructions.length + jupiterInstructions.setupInstructions.length + jupiterInstructions.otherInstructions.length + 1} swap)`
      );

      return transaction;
    };

    const buildSwapTransaction = async (): Promise<Transaction | VersionedTransaction> => {
      if (useLegacyTransaction) {
        // Mobile: build combined fee+swap legacy transaction
        return buildMobileCombinedTransaction();
      }
      const swapResponse = await this.jupiterService.getSwapTransaction({
        ...swapRequest,
        quoteResponse: quote,
      });
      const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, "base64");
      return VersionedTransaction.deserialize(swapTransactionBuf);
    };

    // Always use input fee transaction (fees deducted from input token before swap)
    // On mobile, fees are already embedded in the combined transaction above.
    const buildFeeTransaction = async (): Promise<Transaction | null> =>
      useLegacyTransaction ? null : this.buildInputFeeTransaction(wallet, params);

    // Build once for simulation before prompting wallet.
    const swapTransaction = await buildSwapTransaction();
    const feeTransaction = await buildFeeTransaction();

    if (useLegacyTransaction) {
      console.log("[JupiterSwap] Mobile deep link — fee instructions embedded in swap transaction");
    }

    state.status = SwapStatus.BUILDING_TRANSACTION;
    state.message = "Simulating transactions to verify they will succeed...";
    onStateChange(state);

    let simulationWarning: string | null = null;
    try {
      await this.simulateTransaction(swapTransaction, "swap transaction");

      if (feeTransaction) {
        await this.simulateTransaction(
          feeTransaction,
          "input fee transaction"
        );
      }

      console.log("[JupiterSwap] All transaction simulations passed");
    } catch (simulationError: any) {
      simulationWarning = simulationError?.message || String(simulationError);
      console.warn("[JupiterSwap] Simulation warning (continuing):", simulationWarning);
    }

    state.status = SwapStatus.AWAITING_SIGNATURE;
    state.message = simulationWarning
      ? "Simulation warning detected. Please review details in wallet before approving."
      : useLegacyTransaction
        ? "Opening Phantom to approve swap..."
        : feeTransaction
          ? "Please approve transactions in your wallet..."
          : "Please approve the transaction in your wallet...";
    onStateChange(state);

    state.status = SwapStatus.CONFIRMING;
    state.message = "Sending transactions...";
    onStateChange(state);

    let feeSignature: string | undefined;

    // Send input fee transaction first (fees always deducted from input token)
    if (feeTransaction) {
      feeSignature = await this.sendTransactionWithRetry(
        wallet,
        async () => {
          const tx = await this.buildInputFeeTransaction(wallet, params);
          if (!tx) {
            throw new Error("Failed to rebuild input fee transaction");
          }
          return tx;
        },
        {
          skipPreflight: false,
          maxRetries: 3,
          description: "input fee transaction",
        }
      );

      state.feeTransferSignature = feeSignature;
      state.message = "Fee transfer sent, confirming...";
      onStateChange(state);

      const feeConfirmation = await this.connection.confirmTransaction(
        feeSignature,
        "confirmed"
      );

      if (feeConfirmation.value.err) {
        throw new Error(
          `Fee transaction failed: ${JSON.stringify(feeConfirmation.value.err)}`
        );
      }

      state.message = "Fee transfer confirmed, sending swap...";
      onStateChange(state);
    }

    // Send swap transaction with retry mechanism
    let swapSignature: string;
    try {
      swapSignature = await this.sendTransactionWithRetry(wallet, buildSwapTransaction, {
        skipPreflight: false,
        maxRetries: 3,
        description: "swap transaction",
        isInputSol,
      });
    } catch (swapSendError: any) {
      const sendErrorMessage = swapSendError?.message || String(swapSendError);
      const shouldRetryWithFreshQuote =
        sendErrorMessage.includes("preflight simulation failed") ||
        sendErrorMessage.includes("Transaction simulation failed") ||
        sendErrorMessage.includes("InstructionError");

      if (!shouldRetryWithFreshQuote) {
        throw swapSendError;
      }

      console.warn("[JupiterSwap] Swap preflight failed, refreshing quote and retrying once");
      state.message = "Route changed during preflight. Refreshing quote and retrying once...";
      onStateChange(state);

      quote = await this.jupiterService.getQuote({
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: quoteAmount,
        slippageBps: params.slippageBps,
        swapMode: params.swapMode,
      });
      state.quote = quote;
      onStateChange(state);

      swapSignature = await this.sendTransactionWithRetry(wallet, buildSwapTransaction, {
        skipPreflight: false,
        maxRetries: 3,
        description: "swap transaction (requoted)",
        isInputSol,
      });
    }

    state.swapSignature = swapSignature;
    state.message = "Swap transaction sent, confirming...";
    onStateChange(state);

    // FIX FRONTEND-24 + FRONTEND-25: Use blockhash-aware confirmTransaction overload.
    // Passing {signature, blockhash, lastValidBlockHeight} gives Solana a defined
    // expiry window, preventing TransactionExpiredTimeoutError (FRONTEND-24).
    // isSlippageExceeded() then detects Custom:6001 for a user-friendly message (FRONTEND-25).
    const latestBlockhashLegacy = await this.connection.getLatestBlockhash();
    const confirmation = await this.connection.confirmTransaction(
      { signature: swapSignature, ...latestBlockhashLegacy },
      "confirmed"
    );

    if (confirmation.value.err) {
      console.error("[JupiterSwap] On-chain swap error:", JSON.stringify(confirmation.value.err));
      if (this.isSlippageExceeded(confirmation.value.err)) {
        throw new Error(
          "Swap failed: price moved too fast during execution. Try increasing slippage tolerance."
        );
      }
      throw new Error("Swap failed. Please try again.");
    }

    state.status = SwapStatus.CONFIRMED;
    state.message = "Swap completed successfully!";
    onStateChange(state);

    return { feeSignature, swapSignature };
  }

  private computeQuoteAmount(params: SwapParams): QuoteComputation {
    const isInputSol = params.inputMint === JupiterSwapService.SOL_MINT;
    const isExactOut = params.swapMode === "ExactOut";
    const { totalFeeSmallest } = this.calculateInputFeeSmallestAmounts(params);

    if (isExactOut) {
      if (!params.outputAmount) {
        throw new Error("outputAmount is required for ExactOut mode");
      }
      return {
        isInputSol,
        quoteAmount: params.outputAmount,
      };
    }

    // ExactIn: Always deduct fees from input amount before getting quote
    const quoteAmount = new BN(params.inputAmount)
      .sub(new BN(totalFeeSmallest))
      .toString();

    if (new BN(quoteAmount).lte(new BN(0))) {
      throw new Error(
        "Input amount is too small after fee deduction. Increase amount and retry."
      );
    }

    return {
      isInputSol,
      quoteAmount,
    };
  }

  private decodeSwapInstructions(
    response: SwapInstructionsResponse
  ): {
    computeBudgetInstructions: TransactionInstruction[];
    setupInstructions: TransactionInstruction[];
    swapInstruction: TransactionInstruction;
    cleanupInstruction?: TransactionInstruction;
    otherInstructions: TransactionInstruction[];
  } {
    return {
      computeBudgetInstructions: response.computeBudgetInstructions.map(
        (instruction, index) =>
          this.decodeJupiterInstruction(instruction, `computeBudget[${index}]`)
      ),
      setupInstructions: response.setupInstructions.map((instruction, index) =>
        this.decodeJupiterInstruction(instruction, `setup[${index}]`)
      ),
      swapInstruction: this.decodeJupiterInstruction(
        response.swapInstruction,
        "swap"
      ),
      cleanupInstruction: response.cleanupInstruction
        ? this.decodeJupiterInstruction(response.cleanupInstruction, "cleanup")
        : undefined,
      otherInstructions: response.otherInstructions.map((instruction, index) =>
        this.decodeJupiterInstruction(instruction, `other[${index}]`)
      ),
    };
  }

  private decodeJupiterInstruction(
    instruction: JupiterInstruction,
    label: string
  ): TransactionInstruction {
    try {
      return new TransactionInstruction({
        programId: new PublicKey(instruction.programId),
        keys: instruction.accounts.map((account) => ({
          pubkey: new PublicKey(account.pubkey),
          isSigner: account.isSigner,
          isWritable: account.isWritable,
        })),
        data: Buffer.from(instruction.data, "base64"),
      });
    } catch (error: any) {
      throw new Error(
        `Invalid Jupiter instruction (${label}): ${
          error?.message || String(error)
        }`
      );
    }
  }

  private async getLookupTableAccounts(
    addressLookupTableAddresses: string[]
  ): Promise<AddressLookupTableAccount[]> {
    const addresses = [...new Set(addressLookupTableAddresses || [])].filter(Boolean);
    if (!addresses.length) {
      return [];
    }

    const pubkeys = addresses.map((address) => new PublicKey(address));
    const accountInfos = await this.connection.getMultipleAccountsInfo(pubkeys);

    const lookupTableAccounts: AddressLookupTableAccount[] = [];
    for (let index = 0; index < pubkeys.length; index++) {
      const accountInfo = accountInfos[index];
      if (!accountInfo) {
        console.warn(
          `[JupiterSwap] Missing lookup table account for ${pubkeys[index].toBase58()}`
        );
        continue;
      }

      try {
        lookupTableAccounts.push(
          new AddressLookupTableAccount({
            key: pubkeys[index],
            state: AddressLookupTableAccount.deserialize(accountInfo.data),
          })
        );
      } catch (error: any) {
        throw new Error(
          `Failed to deserialize lookup table ${pubkeys[index].toBase58()}: ${
            error?.message || String(error)
          }`
        );
      }
    }

    return lookupTableAccounts;
  }

  private calculateInputFeeSmallestAmounts(params: SwapParams): FeeSmallestAmounts {
    const platformFeeSmallest = Math.floor(
      params.feeCalculation.platformFeeAmount * Math.pow(10, params.inputDecimals)
    );
    const charityFeeSmallest = Math.floor(
      params.feeCalculation.charityFeeAmount * Math.pow(10, params.inputDecimals)
    );
    return {
      platformFeeSmallest,
      charityFeeSmallest,
      totalFeeSmallest: platformFeeSmallest + charityFeeSmallest,
    };
  }

  private isOnCurve(pubkey: PublicKey): boolean {
    try {
      return PublicKey.isOnCurve(pubkey.toBytes());
    } catch {
      return false;
    }
  }

  private async buildFeeTransferInstructionsForRecipient(params: {
    walletPublicKey: PublicKey;
    sourceAta: PublicKey;
    mint: PublicKey;
    tokenProgram: PublicKey;
    recipientWallet: PublicKey;
    amountBN: BN;
    decimals: number;
  }): Promise<TransactionInstruction[]> {
    const {
      walletPublicKey,
      sourceAta,
      mint,
      tokenProgram,
      recipientWallet,
      amountBN,
      decimals,
    } = params;

    if (amountBN.isZero()) {
      return [];
    }

    const recipientAta = await getAssociatedTokenAddress(
      mint,
      recipientWallet,
      !this.isOnCurve(recipientWallet),
      tokenProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const instructions: TransactionInstruction[] = [];
    try {
      await getAccount(this.connection, recipientAta, undefined, tokenProgram);
    } catch {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          walletPublicKey,
          recipientAta,
          recipientWallet,
          mint,
          tokenProgram,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    instructions.push(
      createTransferCheckedInstruction(
        sourceAta,
        mint,
        recipientAta,
        walletPublicKey,
        BigInt(amountBN.toString()),
        decimals,
        [],
        tokenProgram
      )
    );

    return instructions;
  }

  private async buildInputFeeInstructions(
    wallet: WalletContextState,
    params: SwapParams
  ): Promise<TransactionInstruction[]> {
    const { platformFeeSmallest, charityFeeSmallest } =
      this.calculateInputFeeSmallestAmounts(params);
    const platformFeeBN = new BN(platformFeeSmallest);
    const charityFeeBN = new BN(charityFeeSmallest);

    const isInputSol = params.inputMint === JupiterSwapService.SOL_MINT;

    if (platformFeeBN.isZero() && charityFeeBN.isZero()) {
      return [];
    }

    // For SOL input, use native SOL transfers (SystemProgram.transfer)
    // On Solana, transferring to a non-existent account below rent-exempt
    // minimum (~0.00089 SOL) will fail. Skip those transfers gracefully.
    if (isInputSol) {
      const instructions: TransactionInstruction[] = [];
      const RENT_EXEMPT_MINIMUM = new BN(890880);

      const feeTransfers = [
        { address: params.platformFeeWallet, amount: platformFeeBN },
        { address: params.charityFeeWallet, amount: charityFeeBN },
      ];

      const recipientPubkeys = feeTransfers.map(ft => new PublicKey(ft.address));
      const accountInfos = await this.connection.getMultipleAccountsInfo(recipientPubkeys);

      for (let i = 0; i < feeTransfers.length; i++) {
        const { address, amount } = feeTransfers[i];
        if (amount.isZero()) {
          continue;
        }

        // Skip if recipient doesn't exist on-chain and amount < rent-exempt minimum
        const accountExists = accountInfos[i] !== null;
        if (!accountExists && amount.lt(RENT_EXEMPT_MINIMUM)) {
          continue;
        }

        instructions.push(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey!,
            toPubkey: new PublicKey(address),
            lamports: amount.toNumber(),
          })
        );
      }

      return instructions;
    }

    // For SPL tokens, use SPL token transfers
    const mint = new PublicKey(params.inputMint);
    const mintInfo = await this.connection.getAccountInfo(mint);
    const tokenProgram = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID;
    const sourceAta = await getAssociatedTokenAddress(
      mint,
      wallet.publicKey!,
      false,
      tokenProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const platformInstructions = await this.buildFeeTransferInstructionsForRecipient({
      walletPublicKey: wallet.publicKey!,
      sourceAta,
      mint,
      tokenProgram,
      recipientWallet: new PublicKey(params.platformFeeWallet),
      amountBN: platformFeeBN,
      decimals: params.inputDecimals,
    });
    const charityInstructions = await this.buildFeeTransferInstructionsForRecipient({
      walletPublicKey: wallet.publicKey!,
      sourceAta,
      mint,
      tokenProgram,
      recipientWallet: new PublicKey(params.charityFeeWallet),
      amountBN: charityFeeBN,
      decimals: params.inputDecimals,
    });

    return [...platformInstructions, ...charityInstructions];
  }

  private async buildInputFeeTransaction(
    wallet: WalletContextState,
    params: SwapParams
  ): Promise<Transaction | null> {
    const instructions = await this.buildInputFeeInstructions(wallet, params);
    if (!instructions.length) {
      return null;
    }

    const transaction = new Transaction();
    const blockhash = await this.getFreshBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey!;
    instructions.forEach((instruction) => transaction.add(instruction));

    return transaction;
  }

  async getQuote(
    inputMint: string,
    outputMint: string,
    inputAmount: string,
    inputDecimals: number,
    feeCalculation: FeeCalculation,
    slippageBps: number = 50
  ): Promise<QuoteRoute> {
    try {
      // Always deduct fees from input amount before getting quote
      const platformFeeSmallest = Math.floor(
        feeCalculation.platformFeeAmount * Math.pow(10, inputDecimals)
      );
      const charityFeeSmallest = Math.floor(
        feeCalculation.charityFeeAmount * Math.pow(10, inputDecimals)
      );

      const quoteAmount = new BN(inputAmount)
        .sub(new BN(platformFeeSmallest))
        .sub(new BN(charityFeeSmallest))
        .toString();

      const quote = await this.jupiterService.getQuote({
        inputMint,
        outputMint,
        amount: quoteAmount,
        slippageBps,
      });

      return quote;
    } catch (error: any) {
      console.error("Failed to get quote:", error);
      throw new Error(`Quote unavailable: ${error.message}`);
    }
  }
}
