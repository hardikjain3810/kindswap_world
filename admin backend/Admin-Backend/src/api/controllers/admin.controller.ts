import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { SuperAdminGuard } from '../guards/super-admin.guard';
import { AdminService } from '../services/admin.service';
import {
  CreateAdminDto,
  UpdateAdminDto,
  AdminListResponseDto,
  AdminResponseDto,
  SuperAdminCheckDto,
} from '../dto/admin.dto';

/**
 * Admin Controller
 *
 * Handles admin account management and RBAC endpoints.
 * All endpoints require admin authentication via JwtAuthGuard.
 * Super Admin specific endpoints require SuperAdminGuard.
 *
 * SECURITY: Rate limited to 10 requests per minute to prevent brute force
 */
@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute for admin operations
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Verify admin authentication and return admin info
   * GET /api/v1/admin/verify
   *
   * Used for session restoration - returns full admin info from JWT token
   */
  @Get('verify')
  @HttpCode(HttpStatus.OK)
  async verifyAdmin(@Request() req): Promise<{ isAdmin: boolean; admin: any }> {
    // Admin info is attached by JwtAuthGuard
    const admin = req.admin;
    return {
      isAdmin: true,
      admin: {
        id: admin.id,
        walletAddress: admin.walletAddress,
        isSuperAdmin: admin.isSuperAdmin,
        permissions: admin.permissions,
        isActive: admin.isActive,
      }
    };
  }

  /**
   * Check if admin is Super Admin
   * GET /api/v1/admin/check-super
   */
  @Get('check-super')
  @HttpCode(HttpStatus.OK)
  async checkSuperAdmin(@Request() req): Promise<SuperAdminCheckDto> {
    const adminWallet = req.adminWallet;
    return this.adminService.checkSuperAdmin(adminWallet);
  }

  /**
   * Get all admins (Super Admin only)
   * GET /api/v1/admin/admins
   */
  @Get('admins')
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.OK)
  async getAllAdmins(@Request() req): Promise<AdminListResponseDto> {
    const adminWallet = req.adminWallet;
    return this.adminService.getAllAdmins(adminWallet);
  }

  /**
   * Create new admin (Super Admin only)
   * POST /api/v1/admin/admins
   */
  @Post('admins')
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.CREATED)
  async createAdmin(
    @Request() req,
    @Body() createAdminDto: CreateAdminDto,
  ): Promise<AdminResponseDto> {
    const adminWallet = req.adminWallet;
    return this.adminService.createAdmin(adminWallet, createAdminDto);
  }

  /**
   * Update admin (Super Admin only)
   * PUT /api/v1/admin/admins/:adminId
   */
  @Put('admins/:adminId')
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.OK)
  async updateAdmin(
    @Request() req,
    @Param('adminId') adminId: string,
    @Body() updateAdminDto: UpdateAdminDto,
  ): Promise<AdminResponseDto> {
    const adminWallet = req.adminWallet;
    return this.adminService.updateAdmin(adminWallet, adminId, updateAdminDto);
  }

  /**
   * Delete admin (Super Admin only)
   * DELETE /api/v1/admin/admins/:adminId
   */
  @Delete('admins/:adminId')
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAdmin(@Request() req, @Param('adminId') adminId: string): Promise<void> {
    const adminWallet = req.adminWallet;
    return this.adminService.deleteAdmin(adminWallet, adminId);
  }
}
