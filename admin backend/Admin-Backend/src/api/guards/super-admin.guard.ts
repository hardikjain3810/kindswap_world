import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminRepository } from '../../database/repositories/admin.repository';

/**
 * Super Admin Guard
 *
 * Protects Super Admin-only endpoints.
 * Must be used in conjunction with JwtAuthGuard.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, SuperAdminGuard)
 * @Get('super-admin/endpoint')
 * async superAdminEndpoint() { ... }
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(
    @Inject(forwardRef(() => AdminRepository))
    private readonly adminRepository: AdminRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Extract admin wallet (should be set by JwtAuthGuard)
    const adminWallet = (request as any).adminWallet;

    if (!adminWallet) {
      throw new ForbiddenException('Admin authentication required');
    }

    // First, check if JwtAuthGuard already set the isSuperAdmin flag
    // This avoids redundant database queries (N+1 optimization)
    let isSuperAdmin = (request as any).isSuperAdmin;

    // Only query database if flag wasn't set by JwtAuthGuard
    if (isSuperAdmin === undefined) {
      isSuperAdmin = await this.adminRepository.isSuperAdmin(adminWallet);
    }

    if (!isSuperAdmin) {
      console.warn(
        `[SUPER ADMIN] Unauthorized access attempt by ${adminWallet} to ${request.url}`,
      );
      throw new ForbiddenException('Super Admin access required');
    }

    // Log successful Super Admin access
    console.log(`[SUPER ADMIN] ${adminWallet} accessing ${request.method} ${request.url}`);

    return true;
  }
}
