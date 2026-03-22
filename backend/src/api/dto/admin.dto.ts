import {
  IsString,
  IsArray,
  IsOptional,
  Length,
  Matches,
  ArrayMinSize,
  IsEnum,
} from 'class-validator';
import { AdminPermission } from '../../admin/enums/admin-permission.enum';

/**
 * DTO for creating a new admin
 */
export class CreateAdminDto {
  @IsString()
  @Length(2, 50, { message: 'Admin name must be between 2 and 50 characters' })
  name: string;

  @IsString()
  @Length(32, 44, { message: 'Invalid Solana wallet address length' })
  @Matches(/^[1-9A-HJ-NP-Za-km-z]+$/, { message: 'Invalid wallet address format (must be base58)' })
  walletAddress: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one permission is required' })
  @IsEnum(AdminPermission, { each: true, message: 'Invalid permission value' })
  permissions: AdminPermission[];
}

/**
 * DTO for updating an existing admin
 */
export class UpdateAdminDto {
  @IsOptional()
  @IsString()
  @Length(2, 50, { message: 'Admin name must be between 2 and 50 characters' })
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one permission is required' })
  @IsEnum(AdminPermission, { each: true, message: 'Invalid permission value' })
  permissions?: AdminPermission[];
}

/**
 * Response DTO for admin data
 */
export class AdminResponseDto {
  id: string;
  name: string;
  walletAddress: string;
  isSuperAdmin: boolean;
  permissions: AdminPermission[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Response DTO for admin list
 */
export class AdminListResponseDto {
  admins: AdminResponseDto[];
  total: number;
}

/**
 * Response DTO for Super Admin check
 */
export class SuperAdminCheckDto {
  isSuperAdmin: boolean;
  permissions: string[];
}
