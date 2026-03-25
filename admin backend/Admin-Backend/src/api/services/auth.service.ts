import { Injectable, Logger, Inject, UnauthorizedException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PublicKey } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';
import { randomUUID } from 'crypto';
import { AdminRepository } from '../../database/repositories/admin.repository';
import type { Admin } from '../../database/entities/admin.entity';

/**
 * AuthService
 *
 * Handles Solana wallet-based authentication using message signing.
 * Uses challenge-response pattern to verify wallet ownership.
 *
 * Flow:
 * 1. Client requests challenge for their wallet
 * 2. Server generates unique challenge and stores in cache
 * 3. Client signs challenge with their private key
 * 4. Server verifies signature matches public key
 * 5. Server grants access if signature is valid
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly CHALLENGE_TTL = 300000; // 5 minutes in milliseconds
  private readonly CHALLENGE_PREFIX = 'auth:challenge:';

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly adminRepository: AdminRepository,
  ) {}

  /**
   * Generate authentication challenge for a wallet
   *
   * Creates a unique, time-limited challenge that the wallet must sign
   * to prove ownership. Challenge is stored in cache with 5-minute expiry.
   *
   * @param walletAddress - Solana wallet public key
   * @returns Challenge message and expiration timestamp
   */
  async generateChallenge(walletAddress: string): Promise<{ challenge: string; expiresAt: number }> {
    try {
      const nonce = randomUUID();
      const timestamp = Date.now();
      const expiresAt = timestamp + this.CHALLENGE_TTL;

      // Create challenge message
      const challenge = [
        'Admin Backend Authentication',
        '',
        `Wallet: ${walletAddress}`,
        `Nonce: ${nonce}`,
        `Timestamp: ${timestamp}`,
        `Expires: ${new Date(expiresAt).toISOString()}`,
        '',
        'Sign this message to prove wallet ownership.',
        'This request will not trigger a blockchain transaction.',
      ].join('\n');

      // Store challenge in cache with expiry
      const key = `${this.CHALLENGE_PREFIX}${walletAddress}:${nonce}`;
      const challengeData = {
        challenge,
        nonce,
        timestamp,
        expiresAt,
      };

      await this.cacheManager.set(key, JSON.stringify(challengeData), this.CHALLENGE_TTL);

      this.logger.log(`Generated challenge for wallet ${walletAddress.slice(0, 8)}...`);

      return { challenge, expiresAt };
    } catch (error) {
      this.logger.error(`Failed to generate challenge for ${walletAddress}:`, error);
      throw error;
    }
  }

  /**
   * Verify signed message from wallet
   *
   * Validates that:
   * 1. Challenge exists and hasn't expired
   * 2. Message matches stored challenge
   * 3. Signature is cryptographically valid
   * 4. Signature was created by the claimed wallet
   *
   * Uses Ed25519 signature verification (Solana's signature scheme).
   * Prevents replay attacks by deleting challenge after successful verification.
   *
   * @param walletAddress - Claimed wallet public key
   * @param signature - Base58-encoded signature
   * @param message - Original challenge message that was signed
   * @returns true if signature is valid, false otherwise
   */
  async verifySignature(
    walletAddress: string,
    signature: string,
    message: string,
  ): Promise<boolean> {
    try {
      this.logger.log(`Verifying signature for wallet ${walletAddress.slice(0, 8)}...`);

      // Extract nonce from message to build correct cache key
      const nonceMatch = message.match(/Nonce: ([a-f0-9-]+)/);
      if (!nonceMatch) {
        this.logger.warn(`Invalid message format for wallet ${walletAddress.slice(0, 8)}... - no nonce found`);
        return false;
      }
      const nonce = nonceMatch[1];

      // Retrieve stored challenge using wallet+nonce as key
      const key = `${this.CHALLENGE_PREFIX}${walletAddress}:${nonce}`;
      const stored = await this.cacheManager.get<string>(key);

      if (!stored) {
        this.logger.warn(`No challenge found for wallet ${walletAddress.slice(0, 8)}... (expired or never generated)`);
        return false;
      }

      const { challenge, expiresAt } = JSON.parse(stored);

      // Verify message matches challenge
      if (challenge !== message) {
        this.logger.warn(`Message mismatch for wallet ${walletAddress.slice(0, 8)}...`);
        return false;
      }

      // Check expiration
      const now = Date.now();
      if (now > expiresAt) {
        this.logger.warn(`Challenge expired for wallet ${walletAddress.slice(0, 8)}...`);
        await this.cacheManager.del(key);
        return false;
      }

      // Verify signature cryptographically
      const publicKey = new PublicKey(walletAddress);
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = bs58.decode(signature);

      const verified = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKey.toBytes(),
      );

      if (verified) {
        // Delete challenge to prevent replay attacks
        await this.cacheManager.del(key);
        this.logger.log(`Successfully verified signature for wallet ${walletAddress.slice(0, 8)}...`);
      } else {
        this.logger.warn(`Invalid signature for wallet ${walletAddress.slice(0, 8)}...`);
      }

      return verified;
    } catch (error) {
      this.logger.error(`Signature verification failed for ${walletAddress}:`, error);
      return false;
    }
  }

  /**
   * Authenticate admin via signature verification
   *
   * This method combines signature verification with admin lookup.
   * Used by JWT login endpoint to exchange signature for tokens.
   *
   * Flow:
   * 1. Verify signature is valid
   * 2. Fetch admin from database
   * 3. Validate admin exists and is active
   * 4. Return admin entity
   *
   * @param walletAddress - Wallet address to authenticate
   * @param signature - Base58-encoded signature
   * @param message - Original challenge message
   * @returns Admin entity if authentication successful
   * @throws UnauthorizedException if signature invalid or admin not found/inactive
   */
  async authenticateAdmin(
    walletAddress: string,
    signature: string,
    message: string,
  ): Promise<Admin> {
    // Step 1: Verify signature
    const signatureValid = await this.verifySignature(
      walletAddress,
      signature,
      message,
    );

    if (!signatureValid) {
      this.logger.warn(`Authentication failed for ${walletAddress.slice(0, 8)}... - invalid signature`);
      throw new UnauthorizedException('Invalid signature');
    }

    // Step 2: Fetch admin from database
    const admin = await this.adminRepository.findByWalletAddress(walletAddress);

    if (!admin) {
      this.logger.warn(`Authentication failed for ${walletAddress.slice(0, 8)}... - admin not found`);
      throw new UnauthorizedException('Admin account not found');
    }

    // Step 3: Validate admin is active
    if (!admin.isActive) {
      this.logger.warn(`Authentication failed for ${walletAddress.slice(0, 8)}... - admin inactive`);
      throw new UnauthorizedException('Admin account is inactive');
    }

    this.logger.log(`Successfully authenticated admin ${walletAddress.slice(0, 8)}...`);
    return admin;
  }
}
