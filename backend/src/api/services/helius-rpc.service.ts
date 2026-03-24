import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { captureApiError } from '../../common/sentry.utils';

/**
 * Token holder information from Helius RPC
 */
export interface TokenHolder {
  address: string; // Token account address
  owner: string; // Wallet owner address
  balance: number; // Token balance (UI amount with decimals)
  decimals: number; // Token decimals
  rawBalance: string; // Raw balance (smallest unit)
}

/**
 * Helius RPC Service
 * Fetches token holders using Helius RPC API's getProgramAccounts
 * More reliable than Solscan for fetching all holders at once
 */
@Injectable()
export class HeliusRpcService {
  private readonly logger = new Logger(HeliusRpcService.name);
  private readonly rpcUrl: string;

  // KNS Token configuration
  private readonly KNS_TOKEN_MINT = 'CVfniqNEj2f4Yd8Z4TEtaTU49gWNTwUyCiDDUbsZpump';
  private readonly TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

  // Rate limiting
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY_MS = 1000;

  constructor(private readonly configService: ConfigService) {
    const heliusApiKey = this.configService.get<string>('HELIUS_API_KEY');

    // In development, allow fallback to public RPC if key is not set or is placeholder
    if (!heliusApiKey || heliusApiKey === 'your_helius_free_api_key_here') {
      this.logger.warn('HELIUS_API_KEY not configured - using fallback public RPC (limited rate limits)');
      // Use public endpoint as fallback for development
      this.rpcUrl = 'https://api.mainnet-beta.solana.com/';
    } else {
      this.rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
      this.logger.log('Helius RPC Service initialized with API key');
    }
  }

  /**
   * Fetch all KNS token holders
   * Uses getProgramAccounts to fetch all token accounts for KNS mint
   */
  async getAllKNSHolders(): Promise<TokenHolder[]> {
    this.logger.log('Fetching all KNS token holders via Helius RPC...');

    return this.retryWithBackoff(async () => {
      try {
        const response = await fetch(this.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getProgramAccounts',
            params: [
              this.TOKEN_2022_PROGRAM, // Token-2022 Program (Token Extensions)
              {
                encoding: 'jsonParsed',
                filters: [
                  // Note: Token-2022 accounts with extensions have variable sizes, so we don't filter by dataSize
                  {
                    memcmp: {
                      offset: 0,
                      bytes: this.KNS_TOKEN_MINT, // Filter by KNS mint address
                    },
                  },
                ],
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(`RPC Error: ${data.error.message}`);
        }

        const holders: TokenHolder[] = data.result
          .map((account: any) => {
            const parsed = account.account.data.parsed.info;
            return {
              address: account.pubkey,
              owner: parsed.owner,
              balance: parseFloat(parsed.tokenAmount.uiAmount || '0'),
              decimals: parsed.tokenAmount.decimals,
              rawBalance: parsed.tokenAmount.amount,
            };
          })
          // Filter out zero balances
          .filter((holder: TokenHolder) => holder.balance > 0);

        this.logger.log(`Found ${holders.length} KNS token holders`);

        return holders;
      } catch (error) {
        this.logger.error(`Failed to fetch KNS holders: ${error}`);
        captureApiError(error, 'Helius RPC', 'getProgramAccounts', {
          mint: this.KNS_TOKEN_MINT,
        });
        throw error;
      }
    });
  }

  /**
   * Get token balance for a specific wallet
   * @param wallet - Wallet address
   */
  async getTokenBalance(wallet: string): Promise<number> {
    return this.retryWithBackoff(async () => {
      try {
        const response = await fetch(this.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getTokenAccountsByOwner',
            params: [
              wallet,
              {
                mint: this.KNS_TOKEN_MINT,
              },
              {
                encoding: 'jsonParsed',
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(`RPC Error: ${data.error.message}`);
        }

        if (!data.result || !data.result.value || data.result.value.length === 0) {
          return 0;
        }

        // Sum all token accounts (user might have multiple accounts)
        let totalBalance = 0;
        for (const account of data.result.value) {
          const balance = parseFloat(
            account.account.data.parsed.info.tokenAmount.uiAmount || '0',
          );
          totalBalance += balance;
        }

        return totalBalance;
      } catch (error) {
        this.logger.error(`Failed to fetch balance for ${wallet}: ${error}`);
        captureApiError(error, 'Helius RPC', 'getTokenAccountsByOwner', { wallet });
        return 0;
      }
    });
  }

  /**
   * Check if wallet has any transactions in the last N hours
   * Uses getSignaturesForAddress with time window
   * This is a cheap RPC call (no transaction data fetched)
   *
   * @param wallet - Wallet address
   * @param hoursBack - Number of hours to look back (default 24)
   * @returns true if wallet has transactions in the time window
   */
  async hasTransactionsInWindow(
    wallet: string,
    hoursBack: number = 24,
  ): Promise<boolean> {
    const cutoffTime = Math.floor(Date.now() / 1000) - hoursBack * 60 * 60;

    return this.retryWithBackoff(async () => {
      try {
        const response = await fetch(this.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getSignaturesForAddress',
            params: [
              wallet,
              {
                limit: 1, // Just check if ANY transaction exists
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(`RPC Error: ${data.error.message}`);
        }

        const signatures = data.result || [];

        // Check if most recent signature is within our window
        if (signatures.length === 0) return false;

        // If blockTime is not available, we conservatively assume there are recent transactions
        if (!signatures[0].blockTime) return true;

        return signatures[0].blockTime >= cutoffTime;
      } catch (error) {
        this.logger.error(`Failed to check transactions for ${wallet}: ${error}`);
        captureApiError(error, 'Helius RPC', 'getSignaturesForAddress', { wallet });
        // On error, conservatively assume there are transactions (will use slow path)
        return true;
      }
    });
  }

  /**
   * Fetch KNS token transfers for a wallet in the last N hours
   * Alternative to Solscan API (which is deprecated/rate-limited)
   * Uses Helius RPC to fetch signatures and parse token transfers
   *
   * @param wallet - Wallet address
   * @param hoursBack - Number of hours to look back (default 24)
   * @param limit - Max number of transactions to fetch (default 100)
   * @returns Array of token transfers compatible with Solscan format
   */
  async getTokenTransfers(
    wallet: string,
    tokenMint: string = this.KNS_TOKEN_MINT,
    hoursBack: number = 24,
    limit: number = 100,
  ): Promise<
    Array<{
      blockTime: number;
      txHash: string;
      amount: string;
      decimals: number;
      changeType: 'inc' | 'dec';
    }>
  > {
    const cutoffTime = Math.floor(Date.now() / 1000) - hoursBack * 60 * 60;

    return this.retryWithBackoff(async () => {
      try {
        // Step 1: Get transaction signatures for the wallet
        this.logger.debug(`Fetching transaction signatures for ${wallet}`);
        const sigResponse = await fetch(this.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getSignaturesForAddress',
            params: [
              wallet,
              {
                limit: limit,
              },
            ],
          }),
        });

        if (!sigResponse.ok) {
          throw new Error(`HTTP ${sigResponse.status}: ${sigResponse.statusText}`);
        }

        const sigData = await sigResponse.json();

        if (sigData.error) {
          throw new Error(`RPC Error: ${sigData.error.message}`);
        }

        const signatures = (sigData.result || []).filter(
          (sig: any) => sig.blockTime && sig.blockTime >= cutoffTime,
        );

        if (signatures.length === 0) {
          this.logger.debug(`No recent transactions found for ${wallet}`);
          return [];
        }

        this.logger.debug(
          `Found ${signatures.length} signatures for ${wallet}, fetching transaction details...`,
        );

        // Step 2: Fetch transaction details for each signature (in batches)
        const transfers: Array<{
          blockTime: number;
          txHash: string;
          amount: string;
          decimals: number;
          changeType: 'inc' | 'dec';
        }> = [];

        // Process signatures in batches of 10 to avoid overwhelming RPC
        const batchSize = 10;
        for (let i = 0; i < signatures.length; i += batchSize) {
          const batch = signatures.slice(i, i + batchSize);

          const txPromises = batch.map(async (sig: any) => {
            try {
              const txResponse = await fetch(this.rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'getTransaction',
                  params: [
                    sig.signature,
                    {
                      encoding: 'jsonParsed',
                      maxSupportedTransactionVersion: 0,
                    },
                  ],
                }),
              });

              if (!txResponse.ok) return null;

              const txData = await txResponse.json();
              if (txData.error || !txData.result) return null;

              const tx = txData.result;

              // Parse token transfers from transaction
              const tokenTransfers = this.parseTokenTransfersFromTransaction(
                tx,
                wallet,
                tokenMint,
              );

              return tokenTransfers;
            } catch (error) {
              this.logger.warn(
                `Failed to fetch transaction ${sig.signature}: ${error}`,
              );
              return null;
            }
          });

          const batchResults = await Promise.all(txPromises);

          // Flatten and add to transfers
          for (const result of batchResults) {
            if (result && result.length > 0) {
              transfers.push(...result);
            }
          }
        }

        this.logger.debug(
          `Found ${transfers.length} KNS token transfers for ${wallet}`,
        );
        return transfers;
      } catch (error) {
        this.logger.error(`Failed to fetch token transfers for ${wallet}: ${error}`);
        captureApiError(error, 'Helius RPC', 'getTokenTransfers', {
          wallet,
          tokenMint,
        });
        return [];
      }
    });
  }

  /**
   * Parse token transfers from a transaction
   * Looks for SPL Token transfers matching the target mint
   */
  private parseTokenTransfersFromTransaction(
    tx: any,
    walletAddress: string,
    tokenMint: string,
  ): Array<{
    blockTime: number;
    txHash: string;
    amount: string;
    decimals: number;
    changeType: 'inc' | 'dec';
  }> {
    if (!tx || !tx.meta || !tx.meta.postTokenBalances || !tx.meta.preTokenBalances) {
      return [];
    }

    const transfers: Array<{
      blockTime: number;
      txHash: string;
      amount: string;
      decimals: number;
      changeType: 'inc' | 'dec';
    }> = [];

    // Compare pre and post token balances to detect transfers
    for (const postBalance of tx.meta.postTokenBalances) {
      // Only process KNS token
      if (postBalance.mint !== tokenMint) continue;

      // Find corresponding pre-balance
      const preBalance = tx.meta.preTokenBalances.find(
        (pre: any) => pre.accountIndex === postBalance.accountIndex,
      );

      if (!preBalance) continue;

      const preAmount = BigInt(preBalance.uiTokenAmount.amount);
      const postAmount = BigInt(postBalance.uiTokenAmount.amount);
      const change = postAmount - preAmount;

      if (change !== BigInt(0)) {
        transfers.push({
          blockTime: tx.blockTime || Math.floor(Date.now() / 1000),
          txHash: tx.transaction.signatures[0],
          amount: change > BigInt(0) ? change.toString() : (-change).toString(),
          decimals: postBalance.uiTokenAmount.decimals,
          changeType: change > BigInt(0) ? 'inc' : 'dec',
        });
      }
    }

    return transfers;
  }

  /**
   * Get KNS token mint address
   */
  getKnsTokenMint(): string {
    return this.KNS_TOKEN_MINT;
  }

  /**
   * Retry logic with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number = this.MAX_RETRIES,
    delayMs: number = this.INITIAL_RETRY_DELAY_MS,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        this.logger.warn(`Retrying in ${delayMs}ms (${retries} retries left)`);
        await this.delay(delayMs);
        return this.retryWithBackoff(fn, retries - 1, delayMs * 2);
      }
      throw error;
    }
  }

  /**
   * Utility: Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
