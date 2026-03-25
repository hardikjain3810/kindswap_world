import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

/**
 * User Repository
 *
 * Handles all database operations for user accounts.
 */
@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Find user by wallet address
   */
  async findByWallet(wallet: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { wallet, isActive: true },
    });
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id, isActive: true },
    });
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email, isActive: true },
    });
  }

  /**
   * Get all active users
   */
  async findAll(skip: number = 0, take: number = 100): Promise<[User[], number]> {
    return this.userRepository.findAndCount({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
  }

  /**
   * Create new user
   */
  async create(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }

  /**
   * Update user
   */
  async update(id: string, userData: Partial<User>): Promise<User | null> {
    await this.userRepository.update(id, userData);
    return this.findById(id);
  }

  /**
   * Soft delete user (set isActive = false)
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.userRepository.update(id, { isActive: false });
    return result.affected > 0;
  }

  /**
   * Check if wallet already exists
   */
  async existsByWallet(wallet: string): Promise<boolean> {
    const count = await this.userRepository.count({
      where: { wallet, isActive: true },
    });
    return count > 0;
  }
}
