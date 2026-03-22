import {
  Injectable,
  Logger,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { randomUUID } from 'crypto';
import type { Admin } from '../../database/entities/admin.entity';

/**
 * JWT Payload for Access Token
 */
export interface JwtPayload {
  walletAddress: string;
  adminId: string;
  isSuperAdmin: boolean;
  permissions: string[];
  isActive: boolean;
  jti?: string;
  iat?: number;
  exp?: number;
}

/**
 * JWT Payload for Refresh Token
 */
export interface RefreshTokenPayload {
  walletAddress: string;
  adminId: string;
  tokenType: 'refresh';
  jti?: string;
  iat?: number;
  exp?: number;
}

/**
 * JwtAuthService
 *
 * Handles JWT token generation, validation, and revocation logic.
 * Integrates with existing AuthService for signature verification.
 *
 * Features:
 * - Access token generation (24h expiry)
 * - Refresh token generation (7d expiry)
 * - Token validation with blacklist checking
 * - Token revocation on logout
 * - Refresh token rotation for enhanced security
 */
@Injectable()
export class JwtAuthService {
  private readonly logger = new Logger(JwtAuthService.name);
  private readonly REFRESH_TOKEN_PREFIX = 'auth:refresh_token:';
  private readonly BLACKLIST_PREFIX = 'auth:blacklist:';

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Generate access and refresh tokens for an admin
   *
   * @param admin - Admin entity from database
   * @returns Object containing accessToken, refreshToken, and expiresIn (seconds)
   */
  async generateTokens(admin: Admin): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const accessTokenJti = randomUUID();
    const refreshTokenJti = randomUUID();

    // Access token payload (contains all auth data for stateless validation)
    const accessPayload: JwtPayload = {
      walletAddress: admin.walletAddress,
      adminId: admin.id,
      isSuperAdmin: admin.isSuperAdmin,
      permissions: admin.permissions,
      isActive: admin.isActive,
      jti: accessTokenJti,
    };

    // Refresh token payload (minimal data for security)
    const refreshPayload: RefreshTokenPayload = {
      walletAddress: admin.walletAddress,
      adminId: admin.id,
      tokenType: 'refresh',
      jti: refreshTokenJti,
    };

    const accessTokenExpiry = this.configService.get(
      'JWT_ACCESS_TOKEN_EXPIRY',
      '24h',
    );
    const refreshTokenExpiry = this.configService.get(
      'JWT_REFRESH_TOKEN_EXPIRY',
      '7d',
    );

    // Generate JWT tokens
    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: accessTokenExpiry,
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      expiresIn: refreshTokenExpiry,
    });

    // Store refresh token JTI in Redis for validation
    // Allows us to revoke refresh tokens on logout
    const refreshTtl = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
    await this.cacheManager.set(
      `${this.REFRESH_TOKEN_PREFIX}${refreshTokenJti}`,
      JSON.stringify({
        adminId: admin.id,
        walletAddress: admin.walletAddress,
        createdAt: Date.now(),
      }),
      refreshTtl,
    );

    this.logger.log(
      `Generated tokens for admin ${admin.walletAddress.slice(0, 8)}... (JTI: ${accessTokenJti.slice(0, 8)}...)`,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 24 * 60 * 60, // 24 hours in seconds
    };
  }

  /**
   * Validate JWT access token payload
   *
   * Checks:
   * 1. Token is not blacklisted (logged out)
   * 2. Admin account is still active
   *
   * @param payload - Decoded JWT payload
   * @returns Validated payload
   * @throws UnauthorizedException if token is invalid
   */
  async validateAccessToken(payload: JwtPayload): Promise<JwtPayload> {
    // Check if token is blacklisted (user logged out)
    if (payload.jti) {
      const isBlacklisted = await this.cacheManager.get(
        `${this.BLACKLIST_PREFIX}${payload.jti}`,
      );
      if (isBlacklisted) {
        this.logger.warn(
          `Blacklisted token attempted: ${payload.jti.slice(0, 8)}...`,
        );
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    // Check if admin is still active
    // Note: This check uses data from token payload (no DB query)
    // For real-time status, consider querying DB on critical operations
    if (!payload.isActive) {
      this.logger.warn(
        `Inactive admin attempted access: ${payload.walletAddress.slice(0, 8)}...`,
      );
      throw new UnauthorizedException('Admin account is inactive');
    }

    return payload;
  }

  /**
   * Validate and verify refresh token
   *
   * Checks:
   * 1. JWT signature and expiration
   * 2. Token type is 'refresh'
   * 3. JTI exists in Redis (not revoked)
   *
   * @param token - Refresh token string
   * @returns Validated refresh token payload
   * @throws UnauthorizedException if token is invalid
   */
  async validateRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      // Verify JWT signature and decode payload
      const payload =
        this.jwtService.verify<RefreshTokenPayload>(token);

      // Verify token type
      if (payload.tokenType !== 'refresh') {
        this.logger.warn('Invalid token type attempted as refresh token');
        throw new UnauthorizedException('Invalid token type');
      }

      // Check if refresh token JTI exists in Redis (not revoked)
      if (payload.jti) {
        const stored = await this.cacheManager.get(
          `${this.REFRESH_TOKEN_PREFIX}${payload.jti}`,
        );
        if (!stored) {
          this.logger.warn(
            `Revoked or expired refresh token attempted: ${payload.jti.slice(0, 8)}...`,
          );
          throw new UnauthorizedException(
            'Refresh token has been revoked or expired',
          );
        }
      }

      return payload;
    } catch (error) {
      this.logger.warn(`Invalid refresh token: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Revoke refresh token (on logout or token rotation)
   *
   * Removes JTI from Redis whitelist, preventing future use
   *
   * @param jti - Unique token identifier
   */
  async revokeRefreshToken(jti: string): Promise<void> {
    await this.cacheManager.del(`${this.REFRESH_TOKEN_PREFIX}${jti}`);
    this.logger.log(`Revoked refresh token ${jti.slice(0, 8)}...`);
  }

  /**
   * Blacklist access token (on logout)
   *
   * Adds JTI to Redis blacklist with TTL matching token expiry
   * Prevents reuse of token before natural expiration
   *
   * @param jti - Unique token identifier
   * @param expiresIn - Seconds until token naturally expires
   */
  async blacklistAccessToken(jti: string, expiresIn: number): Promise<void> {
    // Store in blacklist until token would naturally expire
    await this.cacheManager.set(
      `${this.BLACKLIST_PREFIX}${jti}`,
      'true',
      expiresIn * 1000, // Convert to milliseconds
    );
    this.logger.log(`Blacklisted access token ${jti.slice(0, 8)}...`);
  }

  /**
   * Decode JWT token without verification
   *
   * Useful for extracting JTI before blacklisting on logout
   *
   * @param token - JWT token string
   * @returns Decoded payload or null if invalid
   */
  decodeToken<T = any>(token: string): T | null {
    try {
      return this.jwtService.decode(token) as T;
    } catch (error) {
      this.logger.warn(`Failed to decode token: ${error.message}`);
      return null;
    }
  }
}
