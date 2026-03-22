import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AdminRepository } from '../../database/repositories/admin.repository';
import { AuthService } from '../services/auth.service';
import { REQUIRED_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { AdminPermission } from '../../admin/enums/admin-permission.enum';

/**
 * AdminGuard - Protects admin-only endpoints
 *
 * SECURITY: Implements cryptographic signature verification to prevent authentication bypass.
 *
 * Authentication & Authorization flow:
 * 1. Extracts admin wallet, signature, and message from request
 * 2. Verifies signature using Solana Ed25519 cryptography (CRITICAL SECURITY CHECK)
 * 3. Queries database for admin record
 * 4. Verifies admin is active
 * 5. Super admins get full access
 * 6. Regular admins must have required permissions
 *
 * Required headers:
 * - X-Admin-Wallet: Solana wallet address
 * - X-Admin-Signature: Base58-encoded Ed25519 signature
 * - X-Admin-Message: Challenge message that was signed
 *
 * Usage:
 * @UseGuards(AdminGuard)
 * @Get('admin/endpoint')
 * async adminEndpoint() { ... }
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🛡️  [GUARD] Admin authentication check started');
    console.log('🛡️  [GUARD] Endpoint:', request.method, request.url);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Extract admin wallet from header or body
    const adminWallet = this.extractAdminWallet(request);
    console.log('🛡️  [GUARD] Extracted wallet:', adminWallet || 'NONE');

    if (!adminWallet) {
      console.error('🛡️  [GUARD] ❌ No admin wallet provided');
      throw new ForbiddenException('Admin wallet required');
    }

    // Validate wallet format (Solana addresses are 32-44 chars, typically 43-44)
    if (adminWallet.length < 32 || adminWallet.length > 44) {
      throw new ForbiddenException('Invalid admin wallet format');
    }

    // Validate base58 format
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (!base58Regex.test(adminWallet)) {
      throw new ForbiddenException('Invalid admin wallet format: must be base58 encoded');
    }

    // CRITICAL SECURITY CHECK: Verify cryptographic signature
    // This prevents authentication bypass by proving wallet ownership
    console.log('🛡️  [GUARD] Extracting authentication credentials...');
    const signature = this.extractSignature(request);
    const message = this.extractMessage(request);

    console.log('🛡️  [GUARD] Signature present:', signature ? `YES (${signature.substring(0, 20)}...)` : 'NO');
    console.log('🛡️  [GUARD] Message present:', message ? `YES (${message.length} chars)` : 'NO');

    if (!signature || !message) {
      console.error('🛡️  [GUARD] ❌ Missing signature or message');
      console.warn(`[ADMIN] Authentication attempt without signature from ${adminWallet} to ${request.url}`);
      throw new UnauthorizedException('Signature verification required');
    }

    // Verify signature matches wallet using Ed25519 cryptography
    console.log('🛡️  [GUARD] Calling signature verification...');
    const isValidSignature = await this.authService.verifySignature(
      adminWallet,
      signature,
      message,
    );

    console.log('🛡️  [GUARD] Signature verification result:', isValidSignature ? '✅ VALID' : '❌ INVALID');

    if (!isValidSignature) {
      console.error('🛡️  [GUARD] ❌ Signature verification failed');
      console.warn(`[ADMIN] Invalid signature from ${adminWallet} to ${request.url}`);
      throw new UnauthorizedException('Invalid signature');
    }

    console.log('🛡️  [GUARD] ✅ Signature verified successfully');

    // Signature verified! Now check database for admin account
    const admin = await this.adminRepository.findByWalletAddress(adminWallet);

    if (!admin) {
      console.warn(`[ADMIN] Unauthorized access attempt by ${adminWallet} to ${request.url} - not in database`);
      throw new ForbiddenException('Not Authorised');
    }

    if (!admin.isActive) {
      console.warn(`[ADMIN] Inactive admin ${adminWallet} attempted access to ${request.url}`);
      throw new ForbiddenException('Admin account is inactive');
    }

    // Get required permission from decorator (if specified)
    const requiredPermission = this.reflector.getAllAndOverride<AdminPermission>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Super admins have full access
    if (admin.isSuperAdmin) {
      console.log(`[ADMIN] Super Admin ${adminWallet} accessing ${request.method} ${request.url}`);
      (request as any).adminWallet = adminWallet;
      (request as any).admin = admin;
      (request as any).isSuperAdmin = true;
      return true;
    }

    // Allow verification endpoints without permission requirements
    // These endpoints just verify if user is an admin in the database
    const isVerificationEndpoint = request.url.includes('/verify') || request.url.includes('/check-super');

    if (isVerificationEndpoint) {
      console.log(`[ADMIN] ${adminWallet} accessing verification endpoint ${request.url}`);
      (request as any).adminWallet = adminWallet;
      (request as any).admin = admin;
      (request as any).isSuperAdmin = false;
      (request as any).permissions = admin.permissions || [];
      return true;
    }

    // Regular admins must have at least one permission for protected endpoints
    if (!admin.permissions || admin.permissions.length === 0) {
      console.warn(`[ADMIN] Admin ${adminWallet} has no permissions for ${request.url}`);
      throw new ForbiddenException('No permissions assigned');
    }

    // Check specific permission if required
    if (requiredPermission) {
      if (!admin.permissions.includes(requiredPermission)) {
        console.warn(
          `[ADMIN] Admin ${adminWallet} lacks required permission ${requiredPermission} for ${request.url}`,
        );
        throw new ForbiddenException(
          `Not Authorised - ${requiredPermission} permission required`,
        );
      }
      console.log(
        `[ADMIN] ${adminWallet} accessing ${request.method} ${request.url} with permission ${requiredPermission}`,
      );
    } else {
      // No specific permission required, just needs to be an active admin with any permission
      console.log(
        `[ADMIN] ${adminWallet} (permissions: ${admin.permissions.join(', ')}) accessing ${request.method} ${request.url}`,
      );
    }

    // Attach admin info to request for use in controllers
    (request as any).adminWallet = adminWallet;
    (request as any).admin = admin;
    (request as any).isSuperAdmin = false;
    (request as any).permissions = admin.permissions;

    return true;
  }

  /**
   * Extract admin wallet from request header or body
   */
  private extractAdminWallet(request: Request): string | null {
    // Try header first (X-Admin-Wallet or x-admin-wallet)
    const headerWallet = request.headers['x-admin-wallet'];
    if (headerWallet && typeof headerWallet === 'string') {
      return headerWallet;
    }

    // Try body as fallback
    const bodyWallet = request.body?.adminWallet;
    if (bodyWallet && typeof bodyWallet === 'string') {
      return bodyWallet;
    }

    return null;
  }

  /**
   * Extract signature from request headers
   */
  private extractSignature(request: Request): string | null {
    const signature = request.headers['x-admin-signature'];
    if (signature && typeof signature === 'string') {
      return signature;
    }
    return null;
  }

  /**
   * Extract challenge message from request headers
   * Note: Message is base64-encoded in headers to avoid newline issues
   */
  private extractMessage(request: Request): string | null {
    const encodedMessage = request.headers['x-admin-message'];
    if (encodedMessage && typeof encodedMessage === 'string') {
      try {
        // Decode base64-encoded message
        const decodedMessage = Buffer.from(encodedMessage, 'base64').toString('utf-8');
        console.log('[ADMIN DEBUG] Base64 encoded message:', encodedMessage.substring(0, 50) + '...');
        console.log('[ADMIN DEBUG] Decoded message length:', decodedMessage.length);
        console.log('[ADMIN DEBUG] Decoded message preview:', decodedMessage.substring(0, 100));
        return decodedMessage;
      } catch (error) {
        console.error('[ADMIN] Failed to decode base64 message:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Get list of allowed admin wallets from environment
   * @deprecated No longer used - authentication is signature-based
   */
  private getAllowedAdmins(): string[] {
    const adminWallets = process.env.ADMIN_WALLETS || '';
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    return adminWallets
      .split(',')
      .map(wallet => wallet.trim())
      .filter(wallet => wallet.length >= 32 && wallet.length <= 44 && base58Regex.test(wallet));
  }
}
