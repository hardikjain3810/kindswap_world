import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JwtAuthService, JwtPayload } from '../services/jwt-auth.service';
import { AdminPermission } from '../../admin/enums/admin-permission.enum';
import { REQUIRED_PERMISSION_KEY } from '../decorators/require-permission.decorator';

/**
 * JwtAuthGuard
 *
 * Modern JWT-based authentication guard that replaces signature-per-request
 * with stateless JWT validation.
 *
 * Authentication Flow:
 * 1. Extract JWT from Authorization header (Bearer token) or cookie
 * 2. Verify JWT signature and expiration
 * 3. Check token is not blacklisted (logged out)
 * 4. Validate admin permissions (if required)
 * 5. Attach admin info to request object
 *
 * Supported Headers:
 * - Authorization: Bearer <token>
 * - Cookie: access_token=<token>
 *
 * Permission Checking:
 * - Super Admins: Full access, bypass all permission checks
 * - Regular Admins: Must have specific permission from @RequirePermission decorator
 * - Verification endpoints: No permission required (allow all authenticated admins)
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly jwtAuthService: JwtAuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    console.log('🔐 [JWT GUARD] JWT authentication check started');
    console.log('🔐 [JWT GUARD] Endpoint:', request.method, request.url);

    // Extract JWT from Authorization header or cookie
    const token = this.extractToken(request);

    if (!token) {
      console.error('🔐 [JWT GUARD] No JWT token found');
      throw new UnauthorizedException('Authentication required');
    }

    try {
      // Verify JWT signature and decode payload
      const payload = this.jwtService.verify<JwtPayload>(token);
      console.log(
        '🔐 [JWT GUARD] JWT verified:',
        payload.walletAddress.slice(0, 8) + '...',
      );

      // Validate token (check blacklist, active status)
      const validatedPayload =
        await this.jwtAuthService.validateAccessToken(payload);

      // Get required permission from decorator (if specified)
      const requiredPermission =
        this.reflector.getAllAndOverride<AdminPermission>(
          REQUIRED_PERMISSION_KEY,
          [context.getHandler(), context.getClass()],
        );

      // Super admins have full access - bypass all permission checks
      if (validatedPayload.isSuperAdmin) {
        console.log('🔐 [JWT GUARD] Super admin access granted');
        this.attachAdminToRequest(request, validatedPayload);
        return true;
      }

      // Allow verification endpoints without permission requirements
      // These endpoints check admin status but don't require specific permissions
      const isVerificationEndpoint =
        request.url.includes('/verify') ||
        request.url.includes('/check-super');

      if (isVerificationEndpoint) {
        console.log('🔐 [JWT GUARD] Verification endpoint access granted');
        this.attachAdminToRequest(request, validatedPayload);
        return true;
      }

      // Check specific permission if required by endpoint
      if (requiredPermission) {
        if (!validatedPayload.permissions.includes(requiredPermission)) {
          console.warn(
            `🔐 [JWT GUARD] Permission denied: ${requiredPermission} required`,
          );
          throw new ForbiddenException(
            `${requiredPermission} permission required`,
          );
        }
        console.log(
          '🔐 [JWT GUARD] Permission check passed:',
          requiredPermission,
        );
      }

      // Attach admin info to request for use in controllers
      this.attachAdminToRequest(request, validatedPayload);
      console.log('🔐 [JWT GUARD] Authentication successful');
      return true;
    } catch (error) {
      console.error('🔐 [JWT GUARD] JWT validation failed:', error.message);

      // Provide specific error messages
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }

      // Generic JWT errors (expired, invalid signature, etc.)
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Extract JWT from Authorization header or cookie
   *
   * Priority:
   * 1. Authorization header (Bearer token)
   * 2. Cookie (access_token)
   *
   * @param request - Express request object
   * @returns JWT token string or null
   */
  private extractToken(request: Request): string | null {
    // Try Authorization header first (standard Bearer token)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7); // Remove 'Bearer ' prefix
    }

    // Try cookie as fallback (HttpOnly cookie for enhanced security)
    const cookieToken = request.cookies?.access_token;
    if (cookieToken) {
      return cookieToken;
    }

    return null;
  }

  /**
   * Attach admin info to request object
   *
   * Makes admin data available to controllers via request object.
   * Controllers can access:
   * - req.adminWallet - Wallet address
   * - req.admin - Full admin info (id, permissions, etc.)
   * - req.isSuperAdmin - Boolean flag
   * - req.permissions - Array of permissions
   *
   * @param request - Express request object
   * @param payload - Validated JWT payload
   */
  private attachAdminToRequest(
    request: Request,
    payload: JwtPayload,
  ): void {
    // Attach to request object for controller access
    (request as any).adminWallet = payload.walletAddress;
    (request as any).admin = {
      id: payload.adminId,
      walletAddress: payload.walletAddress,
      isSuperAdmin: payload.isSuperAdmin,
      permissions: payload.permissions,
      isActive: payload.isActive,
    };
    (request as any).isSuperAdmin = payload.isSuperAdmin;
    (request as any).permissions = payload.permissions;
  }
}
