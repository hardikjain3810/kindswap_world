import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  Res,
  Req,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { JwtAuthService } from '../services/jwt-auth.service';
import { AdminRepository } from '../../database/repositories/admin.repository';
import {
  GenerateChallengeDto,
  ChallengeResponseDto,
  VerifySignatureDto,
  VerifySignatureResponseDto,
  LoginDto,
  LoginResponseDto,
  RefreshTokenDto,
  RefreshTokenResponseDto,
  LogoutResponseDto,
} from '../dto/auth.dto';

/**
 * AuthController
 *
 * Provides public endpoints for wallet-based authentication.
 * These endpoints do NOT require authentication themselves.
 *
 * Supported Authentication Methods:
 * 1. JWT-based (NEW): Login once with signature → Use tokens for 24h
 * 2. Signature-based (LEGACY): Sign every request (backward compatibility)
 *
 * JWT Flow:
 * 1. POST /api/v1/auth/challenge - Get challenge to sign
 * 2. Client signs challenge with wallet
 * 3. POST /api/v1/auth/login - Exchange signature for JWT tokens
 * 4. Client uses JWT for subsequent requests (stored in HttpOnly cookie)
 * 5. POST /api/v1/auth/refresh - Refresh access token when expired
 * 6. POST /api/v1/auth/logout - Revoke tokens
 *
 * Legacy Flow (still supported):
 * 1. POST /api/v1/auth/challenge - Get challenge to sign
 * 2. Client signs challenge and includes signature in request headers
 * 3. AdminGuard verifies signature automatically
 */
@Controller('api/v1/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly jwtAuthService: JwtAuthService,
    private readonly adminRepository: AdminRepository,
  ) {}

  /**
   * Generate authentication challenge
   * POST /api/v1/auth/challenge
   *
   * Returns a unique message that the wallet must sign to prove ownership.
   * Challenge expires after 5 minutes.
   *
   * @param dto - Contains wallet address
   * @returns Challenge message and expiration time
   */
  @Post('challenge')
  @HttpCode(HttpStatus.OK)
  async generateChallenge(
    @Body() dto: GenerateChallengeDto,
  ): Promise<ChallengeResponseDto> {
    try {
      const { challenge, expiresAt } = await this.authService.generateChallenge(
        dto.walletAddress,
      );

      return {
        challenge,
        expiresAt,
      };
    } catch (error) {
      throw new BadRequestException('Failed to generate authentication challenge');
    }
  }

  /**
   * Verify signature (optional endpoint for testing)
   * POST /api/v1/auth/verify
   *
   * This endpoint is optional and mainly for testing signature verification.
   * In production, signature verification happens automatically in AdminGuard.
   *
   * @param dto - Contains wallet, signature, and message
   * @returns Verification result
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifySignature(
    @Body() dto: VerifySignatureDto,
  ): Promise<VerifySignatureResponseDto> {
    try {
      const verified = await this.authService.verifySignature(
        dto.walletAddress,
        dto.signature,
        dto.message,
      );

      if (verified) {
        return {
          verified: true,
          walletAddress: dto.walletAddress,
        };
      } else {
        return {
          verified: false,
        };
      }
    } catch (error) {
      return {
        verified: false,
      };
    }
  }

  /**
   * JWT Login - Exchange signature for tokens
   * POST /api/v1/auth/login
   *
   * Authenticates admin via signature verification and issues JWT tokens.
   * This is the NEW authentication method that replaces signature-per-request.
   *
   * Flow:
   * 1. Verify signature (proves wallet ownership)
   * 2. Fetch admin from database
   * 3. Generate JWT access + refresh tokens
   * 4. Set HttpOnly cookies for tokens
   * 5. Return tokens + admin info
   *
   * After login, client can make authenticated requests using JWT tokens.
   * No more signature popups for 24 hours!
   *
   * @param dto - Contains wallet, signature, and challenge message
   * @param res - Express response for setting cookies
   * @returns Access token, refresh token, expiry, and admin info
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    try {
      this.logger.log(`Login attempt for wallet ${dto.walletAddress.slice(0, 8)}...`);

      // Authenticate admin (verify signature + fetch from DB)
      const admin = await this.authService.authenticateAdmin(
        dto.walletAddress,
        dto.signature,
        dto.message,
      );

      // Generate JWT tokens
      const { accessToken, refreshToken, expiresIn } =
        await this.jwtAuthService.generateTokens(admin);

      // Set HttpOnly cookies for enhanced security
      const cookieDomain = process.env.COOKIE_DOMAIN || 'localhost';
      const cookieSecure = process.env.COOKIE_SECURE === 'true';

      // Access token cookie (24h)
      res.cookie('access_token', accessToken, {
        httpOnly: true, // Prevents XSS attacks
        secure: cookieSecure, // HTTPS only in production
        sameSite: 'strict', // CSRF protection
        domain: cookieDomain,
        maxAge: expiresIn * 1000, // Convert to milliseconds
        path: '/',
      });

      // Refresh token cookie (7d)
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: cookieSecure,
        sameSite: 'strict',
        domain: cookieDomain,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      this.logger.log(`Login successful for admin ${dto.walletAddress.slice(0, 8)}...`);

      // Return tokens + admin info
      return {
        accessToken,
        refreshToken,
        expiresIn,
        admin: {
          id: admin.id,
          walletAddress: admin.walletAddress,
          isSuperAdmin: admin.isSuperAdmin,
          permissions: admin.permissions,
          isActive: admin.isActive,
          createdAt: admin.createdAt,
        },
      };
    } catch (error) {
      this.logger.error(`Login failed for ${dto.walletAddress.slice(0, 8)}...`, error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Login failed');
    }
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   *
   * Issues a new access token using a valid refresh token.
   * Allows seamless session continuation without re-authentication.
   *
   * Refresh token can come from:
   * 1. HttpOnly cookie (primary, most secure)
   * 2. Request body (fallback for clients that can't use cookies)
   *
   * @param dto - Optional refresh token in body
   * @param req - Express request to read cookies
   * @param res - Express response for setting new access token cookie
   * @returns New access token and expiry
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshTokenResponseDto> {
    try {
      // Extract refresh token from cookie or body
      const refreshToken = req.cookies?.refresh_token || dto.refreshToken;

      if (!refreshToken) {
        throw new UnauthorizedException('Refresh token required');
      }

      // Validate refresh token
      const payload = await this.jwtAuthService.validateRefreshToken(refreshToken);

      // Fetch admin from database to get latest permissions/status
      const admin = await this.adminRepository.findByWalletAddress(payload.walletAddress);

      if (!admin) {
        throw new UnauthorizedException('Admin account not found');
      }

      if (!admin.isActive) {
        throw new UnauthorizedException('Admin account is inactive');
      }

      // Generate new access token (refresh token rotation is optional)
      const { accessToken, expiresIn } =
        await this.jwtAuthService.generateTokens(admin);

      // Set new access token cookie
      const cookieDomain = process.env.COOKIE_DOMAIN || 'localhost';
      const cookieSecure = process.env.COOKIE_SECURE === 'true';

      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: cookieSecure,
        sameSite: 'strict',
        domain: cookieDomain,
        maxAge: expiresIn * 1000,
        path: '/',
      });

      this.logger.log(`Token refreshed for admin ${payload.walletAddress.slice(0, 8)}...`);

      return {
        accessToken,
        expiresIn,
      };
    } catch (error) {
      this.logger.error('Token refresh failed', error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Logout - Revoke tokens
   * POST /api/v1/auth/logout
   *
   * Revokes JWT tokens and clears cookies.
   * Prevents reuse of tokens after logout.
   *
   * Token revocation:
   * 1. Blacklist access token (prevents reuse until natural expiry)
   * 2. Revoke refresh token (remove from Redis whitelist)
   * 3. Clear HttpOnly cookies
   *
   * @param req - Express request to read tokens from cookies
   * @param res - Express response for clearing cookies
   * @returns Logout confirmation
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponseDto> {
    try {
      const accessToken = req.cookies?.access_token;
      const refreshToken = req.cookies?.refresh_token;

      // Revoke access token (blacklist)
      if (accessToken) {
        const payload = this.jwtAuthService.decodeToken<any>(accessToken);
        if (payload?.jti && payload?.exp) {
          const expiresIn = payload.exp - Math.floor(Date.now() / 1000);
          if (expiresIn > 0) {
            await this.jwtAuthService.blacklistAccessToken(payload.jti, expiresIn);
          }
        }
      }

      // Revoke refresh token (remove from whitelist)
      if (refreshToken) {
        const payload = this.jwtAuthService.decodeToken<any>(refreshToken);
        if (payload?.jti) {
          await this.jwtAuthService.revokeRefreshToken(payload.jti);
        }
      }

      // Clear cookies
      const cookieDomain = process.env.COOKIE_DOMAIN || 'localhost';
      res.clearCookie('access_token', { domain: cookieDomain, path: '/' });
      res.clearCookie('refresh_token', { domain: cookieDomain, path: '/' });

      this.logger.log('User logged out successfully');

      return {
        message: 'Logout successful',
        success: true,
      };
    } catch (error) {
      this.logger.error('Logout failed', error);
      // Even if revocation fails, clear cookies
      const cookieDomain = process.env.COOKIE_DOMAIN || 'localhost';
      res.clearCookie('access_token', { domain: cookieDomain, path: '/' });
      res.clearCookie('refresh_token', { domain: cookieDomain, path: '/' });

      return {
        message: 'Logout completed (with errors)',
        success: true,
      };
    }
  }
}
