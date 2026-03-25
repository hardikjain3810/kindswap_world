import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Admin } from '../database/entities/admin.entity';
import { User } from '../database/entities/user.entity';
import { AdminRepository } from '../database/repositories/admin.repository';
import { UserRepository } from '../database/repositories/user.repository';
import { AdminService } from './services/admin.service';
import { AuthService } from './services/auth.service';
import { JwtAuthService } from './services/jwt-auth.service';
import { AdminController } from './controllers/admin.controller';
import { AuthController } from './controllers/auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';

/**
 * Admin Module
 *
 * Provides admin account management, authentication, and RBAC functionality.
 *
 * JWT Authentication Flow:
 * 1. Client requests challenge from AuthController
 * 2. Client signs challenge with wallet
 * 3. Client sends signature to login endpoint
 * 4. Server verifies signature and issues JWT tokens
 * 5. Client uses JWT for subsequent requests
 * 6. JwtAuthGuard validates token on each request
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Admin, User]),
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
    UserRepository,
    AdminService,
    AuthService,
    JwtAuthService,
    JwtAuthGuard,
    SuperAdminGuard,
  ],
  exports: [
    AdminRepository,
    UserRepository,
    AdminService,
    AuthService,
    JwtAuthService,
    JwtAuthGuard,
    SuperAdminGuard,
  ],
})
export class AdminModule {}
