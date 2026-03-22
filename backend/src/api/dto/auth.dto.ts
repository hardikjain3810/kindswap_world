import { IsString, IsNotEmpty, Matches, Length } from 'class-validator';

/**
 * Request DTO for generating an authentication challenge
 */
export class GenerateChallengeDto {
  @IsString()
  @IsNotEmpty()
  @Length(32, 44)
  @Matches(/^[1-9A-HJ-NP-Za-km-z]+$/, {
    message: 'Wallet address must be valid base58 format',
  })
  walletAddress: string;
}

/**
 * Response DTO for authentication challenge
 */
export class ChallengeResponseDto {
  challenge: string;
  expiresAt: number;
}

/**
 * Request DTO for verifying a signed message
 */
export class VerifySignatureDto {
  @IsString()
  @IsNotEmpty()
  @Length(32, 44)
  @Matches(/^[1-9A-HJ-NP-Za-km-z]+$/)
  walletAddress: string;

  @IsString()
  @IsNotEmpty()
  signature: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}

/**
 * Response DTO for signature verification
 */
export class VerifySignatureResponseDto {
  verified: boolean;
  walletAddress?: string;
  expiresAt?: number;
}

/**
 * Request DTO for JWT login
 * Exchanges signature verification for JWT tokens
 */
export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @Length(32, 44)
  @Matches(/^[1-9A-HJ-NP-Za-km-z]+$/, {
    message: 'Wallet address must be valid base58 format',
  })
  walletAddress: string;

  @IsString()
  @IsNotEmpty()
  signature: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}

/**
 * Admin info included in login response
 */
export class AdminInfoDto {
  id: string;
  walletAddress: string;
  isSuperAdmin: boolean;
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
}

/**
 * Response DTO for JWT login
 */
export class LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  admin: AdminInfoDto;
}

/**
 * Request DTO for token refresh
 * refreshToken is optional - can come from cookie or body
 */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken?: string;
}

/**
 * Response DTO for token refresh
 */
export class RefreshTokenResponseDto {
  accessToken: string;
  expiresIn: number; // seconds
}

/**
 * Response DTO for logout
 */
export class LogoutResponseDto {
  message: string;
  success: boolean;
}
