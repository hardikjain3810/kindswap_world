import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  /**
   * Find user by wallet address
   */
  async findByWallet(wallet: string): Promise<User | null> {
    return this.repository.findOne({
      where: { wallet },
    });
  }

  /**
   * Get or create user
   */
  async getOrCreate(wallet: string): Promise<User> {
    let user = await this.findByWallet(wallet);

    if (!user) {
      user = this.repository.create({
        wallet,
        knsBalance: '0',
        optedOut: false,
      });
      await this.repository.save(user);
    }
    return user;
  }

  /**
   * Update user KNS balance
   */
  async updateKNSBalance(wallet: string, knsBalance: string): Promise<User> {
    const user = await this.getOrCreate(wallet);
    user.knsBalance = knsBalance;
    user.lastBalanceCheckAt = new Date();
    return this.repository.save(user);
  }

  /**
   * Update user notes
   */
  async updateNotes(wallet: string, notes: string): Promise<User> {
    const user = await this.getOrCreate(wallet);
    user.notes = notes;
    return this.repository.save(user);
  }

  /**
   * Opt user out of points system
   */
  async optOut(wallet: string): Promise<User> {
    const user = await this.getOrCreate(wallet);
    user.optedOut = true;
    return this.repository.save(user);
  }

  /**
   * Opt user back in
   */
  async optIn(wallet: string): Promise<User> {
    const user = await this.getOrCreate(wallet);
    user.optedOut = false;
    return this.repository.save(user);
  }

  /**
   * Find all users (for batch operations)
   */
  async findAll(): Promise<User[]> {
    return this.repository.find();
  }

  /**
   * Count total users
   */
  async count(): Promise<number> {
    return this.repository.count();
  }
}
