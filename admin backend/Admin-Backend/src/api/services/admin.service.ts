import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AdminRepository } from '../../database/repositories/admin.repository';
import { Admin } from '../../database/entities/admin.entity';
import { AdminPermission } from '../../admin/enums/admin-permission.enum';
import {
  CreateAdminDto,
  UpdateAdminDto,
  AdminResponseDto,
  AdminListResponseDto,
  SuperAdminCheckDto,
} from '../dto/admin.dto';

/**
 * Admin Service
 *
 * Business logic for admin account management and RBAC.
 */
@Injectable()
export class AdminService {
  private readonly VALID_PERMISSIONS = Object.values(AdminPermission);

  constructor(private readonly adminRepository: AdminRepository) {}

  /**
   * Get all admins (Super Admin only)
   * Note: Excludes Super Admins from the list as they have full access by default
   */
  async getAllAdmins(requestingAdminWallet: string): Promise<AdminListResponseDto> {
    // Verify requesting admin is Super Admin
    await this.verifyIsSuperAdmin(requestingAdminWallet);

    const admins = await this.adminRepository.findAll();

    // Filter out Super Admins - they shouldn't be managed via the admin list
    const regularAdmins = admins.filter(admin => !admin.isSuperAdmin);
    const adminDtos = regularAdmins.map(admin => this.toResponseDto(admin));

    return {
      admins: adminDtos,
      total: adminDtos.length,
    };
  }

  /**
   * Create new admin (Super Admin only)
   */
  async createAdmin(
    requestingAdminWallet: string,
    createAdminDto: CreateAdminDto,
  ): Promise<AdminResponseDto> {
    // Verify requesting admin is Super Admin
    await this.verifyIsSuperAdmin(requestingAdminWallet);

    // Validate permissions
    this.validatePermissions(createAdminDto.permissions);

    const existingAdmin = await this.adminRepository.findByWalletAddressIncludingInactive(
      createAdminDto.walletAddress,
    );

    if (existingAdmin) {
      if (existingAdmin.isActive) {
        throw new ConflictException('Admin with this wallet address already exists');
      }

      const reactivatedAdmin = await this.adminRepository.update(existingAdmin.id, {
        name: createAdminDto.name,
        permissions: createAdminDto.permissions,
        isActive: true,
      });

      if (!reactivatedAdmin) {
        throw new NotFoundException('Failed to reactivate admin');
      }

      console.log(
        `[ADMIN] ${requestingAdminWallet} reactivated admin: ${reactivatedAdmin.walletAddress}`,
      );

      return this.toResponseDto(reactivatedAdmin);
    }

    // Create admin
    const admin = await this.adminRepository.create({
      name: createAdminDto.name,
      walletAddress: createAdminDto.walletAddress,
      permissions: createAdminDto.permissions,
      isSuperAdmin: false,
      isActive: true,
    });

    console.log(`[ADMIN] ${requestingAdminWallet} created new admin: ${admin.walletAddress}`);

    return this.toResponseDto(admin);
  }

  /**
   * Update admin (Super Admin only)
   */
  async updateAdmin(
    requestingAdminWallet: string,
    adminId: string,
    updateAdminDto: UpdateAdminDto,
  ): Promise<AdminResponseDto> {
    // Verify requesting admin is Super Admin
    await this.verifyIsSuperAdmin(requestingAdminWallet);

    // Find admin to update
    const admin = await this.adminRepository.findById(adminId);
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Prevent modifying Super Admin
    if (admin.isSuperAdmin) {
      throw new ForbiddenException('Cannot modify Super Admin account');
    }

    // Validate permissions if provided
    if (updateAdminDto.permissions) {
      this.validatePermissions(updateAdminDto.permissions);
    }

    // Update admin
    const updatedAdmin = await this.adminRepository.update(adminId, {
      ...(updateAdminDto.name && { name: updateAdminDto.name }),
      ...(updateAdminDto.permissions && { permissions: updateAdminDto.permissions }),
    });

    if (!updatedAdmin) {
      throw new NotFoundException('Failed to update admin');
    }

    console.log(`[ADMIN] ${requestingAdminWallet} updated admin: ${updatedAdmin.walletAddress}`);

    return this.toResponseDto(updatedAdmin);
  }

  /**
   * Delete admin (Super Admin only)
   */
  async deleteAdmin(requestingAdminWallet: string, adminId: string): Promise<void> {
    // Verify requesting admin is Super Admin
    await this.verifyIsSuperAdmin(requestingAdminWallet);

    // Find admin to delete
    const admin = await this.adminRepository.findById(adminId);
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Prevent deleting Super Admin
    if (admin.isSuperAdmin) {
      throw new ForbiddenException('Cannot delete Super Admin account');
    }

    // Soft delete admin
    const deleted = await this.adminRepository.delete(adminId);
    if (!deleted) {
      throw new NotFoundException('Failed to delete admin');
    }

    console.log(`[ADMIN] ${requestingAdminWallet} deleted admin: ${admin.walletAddress}`);
  }

  /**
   * Check if wallet is Super Admin
   */
  async checkSuperAdmin(walletAddress: string): Promise<SuperAdminCheckDto> {
    const isSuperAdmin = await this.adminRepository.isSuperAdmin(walletAddress);
    const permissions = await this.adminRepository.getPermissions(walletAddress);

    return {
      isSuperAdmin,
      permissions,
    };
  }

  /**
   * Verify admin is authenticated
   */
  async verifyAdmin(walletAddress: string): Promise<boolean> {
    const admin = await this.adminRepository.findByWalletAddress(walletAddress);
    return !!admin;
  }

  /**
   * Verify admin has specific permission
   */
  async hasPermission(walletAddress: string, permission: string): Promise<boolean> {
    const admin = await this.adminRepository.findByWalletAddress(walletAddress);
    if (!admin) return false;

    // Super Admin has all permissions
    if (admin.isSuperAdmin) return true;

    const typedPermission = permission as AdminPermission;
    if (!this.VALID_PERMISSIONS.includes(typedPermission)) {
      return false;
    }

    // Check if admin has specific permission
    return admin.permissions.includes(typedPermission);
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Verify requesting admin is Super Admin
   */
  private async verifyIsSuperAdmin(walletAddress: string): Promise<void> {
    const isSuperAdmin = await this.adminRepository.isSuperAdmin(walletAddress);
    if (!isSuperAdmin) {
      throw new ForbiddenException('Super Admin access required');
    }
  }

  /**
   * Validate permissions array
   */
  private validatePermissions(permissions: AdminPermission[]): void {
    const invalidPermissions = permissions.filter(
      perm => !this.VALID_PERMISSIONS.includes(perm),
    );

    if (invalidPermissions.length > 0) {
      throw new BadRequestException(
        `Invalid permissions: ${invalidPermissions.join(', ')}. Valid permissions: ${this.VALID_PERMISSIONS.join(', ')}`,
      );
    }
  }

  /**
   * Convert Admin entity to response DTO
   */
  private toResponseDto(admin: Admin): AdminResponseDto {
    return {
      id: admin.id,
      name: admin.name,
      walletAddress: admin.walletAddress,
      isSuperAdmin: admin.isSuperAdmin,
      permissions: admin.permissions,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }
}
