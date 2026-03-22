import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from '../entities/admin.entity';

/**
 * Admin Repository
 *
 * Handles all database operations for admin accounts.
 */
@Injectable()
export class AdminRepository {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
  ) {}

  /**
   * Find admin by wallet address
   */
  async findByWalletAddress(walletAddress: string): Promise<Admin | null> {
    return this.adminRepository.findOne({
      where: { walletAddress, isActive: true },
    });
  }

  /**
   * Find admin by wallet address (including inactive)
   */
  async findByWalletAddressIncludingInactive(walletAddress: string): Promise<Admin | null> {
    return this.adminRepository.findOne({
      where: { walletAddress },
    });
  }

  /**
   * Find admin by ID
   */
  async findById(id: string): Promise<Admin | null> {
    return this.adminRepository.findOne({
      where: { id, isActive: true },
    });
  }

  /**
   * Get all active admins
   */
  async findAll(): Promise<Admin[]> {
    return this.adminRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Create new admin
   */
  async create(adminData: Partial<Admin>): Promise<Admin> {
    const admin = this.adminRepository.create(adminData);
    return this.adminRepository.save(admin);
  }

  /**
   * Update admin
   */
  async update(id: string, adminData: Partial<Admin>): Promise<Admin | null> {
    await this.adminRepository.update(id, adminData);
    return this.findById(id);
  }

  /**
   * Soft delete admin (set isActive = false)
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.adminRepository.update(id, { isActive: false });
    return result.affected > 0;
  }

  /**
   * Check if wallet already exists as active admin
   */
  async existsByWalletAddress(walletAddress: string): Promise<boolean> {
    const count = await this.adminRepository.count({
      where: { walletAddress, isActive: true },
    });
    return count > 0;
  }

  /**
   * Check if admin is Super Admin
   */
  async isSuperAdmin(walletAddress: string): Promise<boolean> {
    const admin = await this.findByWalletAddress(walletAddress);
    return admin?.isSuperAdmin || false;
  }

  /**
   * Get admin's permissions
   */
  async getPermissions(walletAddress: string): Promise<string[]> {
    const admin = await this.findByWalletAddress(walletAddress);
    if (!admin) return [];
    if (admin.isSuperAdmin) return ['*']; // Super admin has all permissions
    return admin.permissions;
  }
}
