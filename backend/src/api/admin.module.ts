import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Admin } from '../database/entities/admin.entity';
import { AdminRepository } from '../database/repositories/admin.repository';
import { AdminService } from './services/admin.service';
import { AuthService } from './services/auth.service';
import { JwtAuthService } from './services/jwt-auth.service';
import { AdminController } from './controllers/admin.controller';
import { AuthController } from './controllers/auth.controller';
import { AdminGuard } from './guards/admin.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { PriceOracleService } from './services/price-oracle.service';
import { TransactionVerificationService } from './services/transaction-verification.service';

/**
 * Admin Module
 *
 * Provides admin account management, authentication, and RBAC functionality.
 *
 * Authentication Methods:
 * 1. JWT-based (NEW): Login once → use tokens for 24h
 * 2. Signature-based (LEGACY): Sign every request (for backward compatibility)
 *
 * JWT Authentication Flow:
 * 1. Client requests challenge from AuthController
 * 2. Client signs challenge with wallet
 * 3. Client sends signature to login endpoint
 * 4. Server verifies signature and issues JWT tokens
 * 5. Client uses JWT for subsequent requests (no more signatures!)
 * 6. JwtAuthGuard validates token on each request
 *
 * Note: Both auth methods supported during migration period.
 * Signature-based auth will be deprecated after testing.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Admin]),
    // JWT Module configuration (global so all modules can use JwtAuthGuard)
    JwtModule.registerAsync({
      global: true, // Make JwtService available globally
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_ACCESS_TOKEN_EXPIRY', '24h'),
        },
      }),
    }),
  ],
  controllers: [AdminController, AuthController],
  providers: [
    AdminRepository,
    AdminService,
    AuthService,
    JwtAuthService, // New: JWT token management
    PriceOracleService, // New: Token price fetching for swap verification
    TransactionVerificationService, // New: On-chain swap verification
    AdminGuard, // Legacy: Signature-based auth (keep for backward compatibility)
    JwtAuthGuard, // New: JWT-based auth
    SuperAdminGuard,
  ],
  exports: [
    AdminRepository,
    AdminService,
    AuthService,
    JwtAuthService,
    PriceOracleService,
    TransactionVerificationService,
    AdminGuard,
    JwtAuthGuard,
    SuperAdminGuard,
  ],
})
export class AdminModule {}
