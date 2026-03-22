export interface TokenInfo {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  icon?: string;
  tags?: string[];
  isVerified?: boolean;
}

export interface SwapInfo {
  ammKey: string;
  label?: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  feeAmount: string;
  feeMint: string;
}

export interface RoutePlanStep {
  swapInfo: SwapInfo;
  percent: number;
}

export interface QuoteRoute {
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: RoutePlanStep[][];
  slippageBps: number;
  otherAmountThreshold: string;
  swapMode: "ExactIn" | "ExactOut";
  platformFee?: {
    amount: string;
    feeBps: number;
  };
}

export interface SwapRequest {
  quoteResponse: QuoteRoute;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  feeAccount?: string;
  dynamicComputeUnitLimit?: boolean;
  prioritizationFeeLamports?: number;
  /** Request a legacy transaction instead of VersionedTransaction (for Phantom mobile deep links) */
  asLegacyTransaction?: boolean;
}

export interface SwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
}

export interface FeeConfig {
  baseFeePercentage: number;
  charityFeePercentage: number;
  platformWallet: string;
  charityWallet: string;
}

export interface FeeCalculation {
  effectiveFeeBps: number;
  charityFeeBps: number;
  totalFeeBps: number;
  feeAmountInInputToken: number;
  platformFeeAmount: number;
  charityFeeAmount: number;
}

export interface SwapInstructionsResponse {
  computeBudgetInstructions: Instruction[];
  setupInstructions: Instruction[];
  swapInstruction: Instruction;
  cleanupInstruction?: Instruction;
  otherInstructions: Instruction[];
  addressLookupTableAddresses: string[];
}

export interface Instruction {
  programId: string;
  accounts: AccountMeta[];
  data: string;
}

export interface AccountMeta {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}
