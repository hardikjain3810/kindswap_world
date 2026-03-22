/**
 * DTO for logging a swap transaction
 * Received from frontend after swap execution (success or failure)
 */
export class LogSwapDto {
  /**
   * Solana wallet address
   */
  wallet: string;

  /**
   * Transaction signature
   */
  signature: string;

  /**
   * Transaction status: 'confirmed', 'failed', 'pending', 'cancelled'
   * Defaults to 'confirmed' if not provided
   */
  status?: 'pending' | 'confirmed' | 'failed' | 'cancelled';

  /**
   * Error message if transaction failed (optional)
   */
  errorMessage?: string;

  /**
   * USD value of input amount
   */
  inputAmountUSD: number;

  /**
   * USD value of output amount
   */
  outputAmountUSD: number;

  /**
   * Input token mint address
   */
  inputMint: string;

  /**
   * Output token mint address
   */
  outputMint: string;

  /**
   * Raw input amount (smallest units)
   */
  inputAmount: string;

  /**
   * Raw output amount (smallest units)
   */
  outputAmount: string;

  /**
   * Input token decimals
   */
  inputDecimals: number;

  /**
   * Output token decimals
   */
  outputDecimals: number;

  /**
   * Applied fee tier name
   */
  feeTier: string;

  /**
   * KNS discount percentage (0-20)
   */
  discountPercent: number;

  /**
   * Effective fee in basis points
   */
  effectiveFeeBps: number;

  /**
   * Fee amount in USD
   */
  feeAmountUSD: number;

  /**
   * Charity portion of fee
   */
  charityAmountUSD: number;

  /**
   * KindSwap portion of fee
   */
  kindswapFeeUSD: number;

  /**
   * Jupiter route data (optional)
   */
  routeData?: Record<string, any>;

  /**
   * Slippage used (basis points)
   */
  slippageBps: number;

  /**
   * KNS balance at time of swap
   */
  knsBalanceAtSwap: string;

  /**
   * User agent for analytics
   */
  userAgent?: string;

  /**
   * IP address for analytics
   */
  ipAddress?: string;
}
