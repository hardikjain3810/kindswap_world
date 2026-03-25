import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * User Entity - Represents a wallet holder in the system
 * Stores wallet address and user information
 */
@Entity('users')
@Index(['wallet'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Solana wallet address (public key)
   * Format: Base58 encoded string, ~44 characters
   * Example: 7dTp9ZYsmV8Ry4Wkk3XkP3R4mJ5kL6...
   */
  @Column('varchar', { length: 88, unique: true })
  wallet: string;

  /**
   * User's email (optional)
   */
  @Column('varchar', { length: 255, nullable: true })
  email: string;

  /**
   * User's display name (optional)
   */
  @Column('varchar', { length: 100, nullable: true })
  name: string;

  /**
   * Whether the user account is active
   */
  @Column('boolean', { default: true })
  isActive: boolean;

  /**
   * Notes for admin use
   */
  @Column('text', { nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
