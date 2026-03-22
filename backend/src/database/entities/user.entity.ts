import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserPoints } from './user-points.entity';

/**
 * User Entity - Represents a wallet holder in the KindSwap system
 * Stores wallet address and KNS balance information
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
   * KNS token balance in smallest units (lamports)
   * 1 KNS = 1,000,000 base units
   * Stored as bigint for precision (TypeORM returns as string)
   */
  @Column('bigint', { default: '0' })
  knsBalance: string;

  /**
   * Last time KNS balance was verified on-chain
   * Used to cache balance and avoid constant RPC calls
   */
  @Column('timestamp', { nullable: true })
  lastBalanceCheckAt: Date;

  /**
   * One-to-one relationship with UserPoints
   * Each user has exactly one points record
   */
  @OneToOne(() => UserPoints, (points) => points.user, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  points: UserPoints;

  /**
   * Whether the user has opted out of points system
   * Default: false (participation is optional per spec)
   */
  @Column('boolean', { default: false })
  optedOut: boolean;

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
