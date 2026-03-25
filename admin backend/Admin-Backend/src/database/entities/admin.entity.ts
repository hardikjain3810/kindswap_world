import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { AdminPermission } from '../../admin/enums/admin-permission.enum';

/**
 * Admin Entity
 *
 * Stores admin account information with role-based permissions.
 * Super Admins have full platform access and cannot be modified/removed.
 * Regular admins have specific permission sets (FEE_CONFIG, CONTRIBUTIONS, etc.).
 */
@Entity('admins')
export class Admin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'wallet_address', length: 44, unique: true })
  @Index()
  walletAddress: string;

  @Column({ name: 'is_super_admin', default: false })
  isSuperAdmin: boolean;

  @Column('text', { array: true, default: () => 'ARRAY[]::text[]' })
  permissions: AdminPermission[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
