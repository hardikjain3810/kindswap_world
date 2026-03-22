/**
 * Wallet Validation Utility
 *
 * Provides consistent validation for Solana wallet addresses across the application.
 * Solana addresses are 32-44 characters long and encoded in base58.
 */

/**
 * Validates a Solana wallet address
 *
 * @param wallet - The wallet address to validate
 * @returns true if the wallet address is valid, false otherwise
 *
 * @example
 * isValidSolanaWallet('N8ewggMiYgYJDSb2ebXz7BABhbVXjuh9saiUEmZYwVg') // true (43 chars)
 * isValidSolanaWallet('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU') // true (44 chars)
 * isValidSolanaWallet('invalid') // false (too short)
 */
export function isValidSolanaWallet(wallet: string): boolean {
  if (!wallet || typeof wallet !== 'string') {
    return false;
  }

  // Check length (Solana addresses are 32-44 characters)
  if (wallet.length < 32 || wallet.length > 44) {
    return false;
  }

  // Validate base58 format (excludes 0, O, I, l to avoid confusion)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return base58Regex.test(wallet);
}

/**
 * Validates a Solana wallet address and throws a descriptive error if invalid
 *
 * @param wallet - The wallet address to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @throws BadRequestException with descriptive message if validation fails
 *
 * @example
 * validateSolanaWalletOrThrow('invalid', 'wallet') // throws "Invalid wallet address"
 */
export function validateSolanaWalletOrThrow(wallet: string, fieldName: string = 'wallet address'): void {
  if (!wallet || typeof wallet !== 'string') {
    throw new Error(`Invalid ${fieldName}`);
  }

  if (wallet.length < 32 || wallet.length > 44) {
    throw new Error(`Invalid ${fieldName}: must be 32-44 characters (got ${wallet.length})`);
  }

  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (!base58Regex.test(wallet)) {
    throw new Error(`Invalid ${fieldName} format: must be base58 encoded`);
  }
}
