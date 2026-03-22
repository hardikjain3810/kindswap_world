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
        'KindSwap Admin Authentication',
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
      // Use wallet+nonce as key to allow multiple concurrent challenges per wallet
      const key = `${this.CHALLENGE_PREFIX}${walletAddress}:${nonce}`;
      const challengeData = {
        challenge,
        nonce,
        timestamp,
        expiresAt,
      };

      await this.cacheManager.set(key, JSON.stringify(challengeData), this.CHALLENGE_TTL);

      this.logger.log(`Generated challenge for wallet ${walletAddress.slice(0, 8)}... with nonce ${nonce.slice(0, 8)}...`);

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
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔐 [AUTH SERVICE] Signature verification started');
      console.log('🔐 [AUTH SERVICE] Wallet:', walletAddress);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Extract nonce from message to build correct cache key
      console.log('🔐 [AUTH SERVICE] STEP 1: Extracting nonce from message...');
      const nonceMatch = message.match(/Nonce: ([a-f0-9-]+)/);
      if (!nonceMatch) {
        console.error('🔐 [AUTH SERVICE] ❌ Could not extract nonce from message');
        this.logger.warn(`Invalid message format for wallet ${walletAddress.slice(0, 8)}... - no nonce found`);
        return false;
      }
      const nonce = nonceMatch[1];
      console.log('🔐 [AUTH SERVICE] Extracted nonce:', nonce);

      // Retrieve stored challenge using wallet+nonce as key
      console.log('🔐 [AUTH SERVICE] STEP 2: Retrieving stored challenge from cache...');
      const key = `${this.CHALLENGE_PREFIX}${walletAddress}:${nonce}`;
      console.log('🔐 [AUTH SERVICE] Cache key:', key);
      const stored = await this.cacheManager.get<string>(key);

      if (!stored) {
        console.error('🔐 [AUTH SERVICE] ❌ No challenge found in cache');
        console.error('🔐 [AUTH SERVICE] Possible reasons:');
        console.error('🔐 [AUTH SERVICE]   - Challenge expired (>5 minutes old)');
        console.error('🔐 [AUTH SERVICE]   - Challenge was never generated');
        console.error('🔐 [AUTH SERVICE]   - Challenge was already used (replay attack prevention)');
        console.error('🔐 [AUTH SERVICE]   - Redis connection issue');
        this.logger.warn(`No challenge found for wallet ${walletAddress.slice(0, 8)}... nonce ${nonce.slice(0, 8)}... (expired or never generated)`);
        return false;
      }

      console.log('🔐 [AUTH SERVICE] ✅ Challenge found in cache');
      const { challenge, expiresAt } = JSON.parse(stored);

      // Debug logging
      console.log('🔐 [AUTH SERVICE] STEP 3: Comparing messages...');
      console.log('🔐 [AUTH SERVICE] Stored challenge length:', challenge.length);
      console.log('🔐 [AUTH SERVICE] Received message length:', message.length);
      console.log('🔐 [AUTH SERVICE] Stored challenge preview:', challenge.substring(0, 100));
      console.log('🔐 [AUTH SERVICE] Received message preview:', message.substring(0, 100));

      const messagesMatch = challenge === message;
      console.log('🔐 [AUTH SERVICE] Messages match:', messagesMatch ? '✅ YES' : '❌ NO');

      // Verify message matches challenge
      if (!messagesMatch) {
        console.error('🔐 [AUTH SERVICE] ❌ Message mismatch detected');
        console.error('🔐 [AUTH SERVICE] This means the message received is different from what was generated');
        console.log('🔐 [AUTH SERVICE] Full stored challenge:');
        console.log(challenge);
        console.log('🔐 [AUTH SERVICE] Full received message:');
        console.log(message);
        console.log('🔐 [AUTH SERVICE] Character-by-character comparison:');
        const minLength = Math.min(challenge.length, message.length);
        for (let i = 0; i < minLength; i++) {
          if (challenge[i] !== message[i]) {
            console.log(`🔐 [AUTH SERVICE] First difference at position ${i}:`);
            console.log(`🔐 [AUTH SERVICE]   Stored: "${challenge[i]}" (code: ${challenge.charCodeAt(i)})`);
            console.log(`🔐 [AUTH SERVICE]   Received: "${message[i]}" (code: ${message.charCodeAt(i)})`);
            break;
          }
        }
        this.logger.warn(`Message mismatch for wallet ${walletAddress.slice(0, 8)}...`);
        return false;
      }

      // Check expiration
      console.log('🔐 [AUTH SERVICE] STEP 4: Checking expiration...');
      const now = Date.now();
      const timeRemaining = expiresAt - now;
      console.log('🔐 [AUTH SERVICE] Current time:', new Date(now).toISOString());
      console.log('🔐 [AUTH SERVICE] Expires at:', new Date(expiresAt).toISOString());
      console.log('🔐 [AUTH SERVICE] Time remaining:', timeRemaining, 'ms');

      if (now > expiresAt) {
        console.error('🔐 [AUTH SERVICE] ❌ Challenge expired');
        this.logger.warn(`Challenge expired for wallet ${walletAddress.slice(0, 8)}...`);
        await this.cacheManager.del(key);
        return false;
      }
      console.log('🔐 [AUTH SERVICE] ✅ Challenge not expired');

      // Verify signature cryptographically
      console.log('🔐 [AUTH SERVICE] STEP 5: Cryptographic signature verification...');
      console.log('🔐 [AUTH SERVICE] Signature (base58):', signature.substring(0, 30) + '...');
      console.log('🔐 [AUTH SERVICE] Converting wallet address to PublicKey...');
      const publicKey = new PublicKey(walletAddress);
      console.log('🔐 [AUTH SERVICE] PublicKey bytes:', publicKey.toBytes().length, 'bytes');

      console.log('🔐 [AUTH SERVICE] Encoding message to bytes...');
      const messageBytes = new TextEncoder().encode(message);
      console.log('🔐 [AUTH SERVICE] Message bytes length:', messageBytes.length);

      console.log('🔐 [AUTH SERVICE] Decoding signature from base58...');
      const signatureBytes = bs58.decode(signature);
      console.log('🔐 [AUTH SERVICE] Signature bytes length:', signatureBytes.length);

      console.log('🔐 [AUTH SERVICE] Performing Ed25519 signature verification...');
      const verified = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKey.toBytes(),
      );

      console.log('🔐 [AUTH SERVICE] Ed25519 verification result:', verified ? '✅ VALID' : '❌ INVALID');

      if (verified) {
        // Delete challenge to prevent replay attacks
        console.log('🔐 [AUTH SERVICE] Deleting challenge from cache (replay attack prevention)...');
        await this.cacheManager.del(key);
        console.log('🔐 [AUTH SERVICE] Challenge deleted from cache');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔐 [AUTH SERVICE] ✅ Signature verification SUCCESSFUL');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        this.logger.log(`Successfully verified signature for wallet ${walletAddress.slice(0, 8)}...`);
      } else {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('🔐 [AUTH SERVICE] ❌ Signature verification FAILED');
        console.error('🔐 [AUTH SERVICE] Possible reasons:');
        console.error('🔐 [AUTH SERVICE]   - Wrong wallet signed the message');
        console.error('🔐 [AUTH SERVICE]   - Message was modified after signing');
        console.error('🔐 [AUTH SERVICE]   - Signature encoding/decoding issue');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        this.logger.warn(`Invalid signature for wallet ${walletAddress.slice(0, 8)}...`);
      }

      return verified;
    } catch (error) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('🔐 [AUTH SERVICE] ❌ EXCEPTION during signature verification');
      console.error('🔐 [AUTH SERVICE] Error:', error);
      console.error('🔐 [AUTH SERVICE] Error stack:', error instanceof Error ? error.stack : 'N/A');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.logger.error(`Signature verification failed for ${walletAddress}:`, error);
      return false;
    }
  }

  /**
   * Invalidate all challenges for a wallet
   *
   * NOTE: With multi-challenge support (wallet+nonce keys), this method
   * requires pattern matching in Redis. Use with caution.
   *
   * @param walletAddress - Wallet to invalidate challenges for
   * @deprecated Consider invalidating specific challenges by nonce instead
   */
  async invalidateChallenge(walletAddress: string): Promise<void> {
    // This would require SCAN in Redis to find all keys matching wallet pattern
    // For now, just log a warning that this is deprecated
    this.logger.warn(`invalidateChallenge called for ${walletAddress.slice(0, 8)}... but multi-challenge keys require nonce-specific invalidation`);
  }

  /**
   * Check if a wallet has pending challenges
   *
   * NOTE: With multi-challenge support, this is less useful.
   * Challenges are verified by wallet+nonce combination.
   *
   * @param walletAddress - Wallet to check
   * @returns Always returns false with new multi-challenge architecture
   * @deprecated Challenges are now verified by wallet+nonce, not just wallet
   */
  async hasPendingChallenge(walletAddress: string): Promise<boolean> {
    // With multi-challenge keys, we can't easily check this without SCAN
    return false;
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

    // Step 3: Validate admin is active (repository already filters by isActive)
    if (!admin.isActive) {
      this.logger.warn(`Authentication failed for ${walletAddress.slice(0, 8)}... - admin inactive`);
      throw new UnauthorizedException('Admin account is inactive');
    }

    this.logger.log(`Successfully authenticated admin ${walletAddress.slice(0, 8)}...`);
    return admin;
  }
}
