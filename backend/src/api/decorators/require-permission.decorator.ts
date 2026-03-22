import { SetMetadata } from '@nestjs/common';
import { AdminPermission } from '../../admin/enums/admin-permission.enum';

/**
 * Metadata key for required permission
 */
export const REQUIRED_PERMISSION_KEY = 'requiredPermission';

/**
 * RequirePermission Decorator
 *
 * Specifies which permission is required to access an endpoint.
 * Used in conjunction with AdminGuard to enforce permission-based access control.
 *
 * Usage:
 * @UseGuards(AdminGuard)
 * @RequirePermission(AdminPermission.FEE_CONFIG)
 * @Put('config/fee-config')
 * async updateFeeConfig() { ... }
 */
export const RequirePermission = (permission: AdminPermission) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permission);
