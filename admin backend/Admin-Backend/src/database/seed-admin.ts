import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Admin } from './entities/admin.entity';
import { AdminPermission } from '../admin/enums/admin-permission.enum';

/**
 * Seed Super Admin Script
 *
 * Creates the first Super Admin account in the database.
 * This script should be run once during initial setup.
 *
 * Usage:
 *   npm run seed:admin
 *
 * Environment Variables Required:
 *   SUPER_ADMIN_WALLET - The Solana wallet address for the Super Admin
 *   SUPER_ADMIN_NAME - (Optional) Display name for the Super Admin (default: "Super Admin")
 */

// Load environment variables
config();

async function seedSuperAdmin() {
  console.log('[SEED] Starting Super Admin seed script...');

  // Get Super Admin wallet from environment
  const superAdminWallet = process.env.SUPER_ADMIN_WALLET;
  const superAdminName = process.env.SUPER_ADMIN_NAME || 'Super Admin';

  if (!superAdminWallet) {
    console.error('[SEED] ERROR: SUPER_ADMIN_WALLET environment variable is required');
    console.error('[SEED] Please set SUPER_ADMIN_WALLET in your .env file');
    process.exit(1);
  }

  // Validate wallet format (Solana: 32-44 characters, base58)
  if (superAdminWallet.length < 32 || superAdminWallet.length > 44) {
    console.error('[SEED] ERROR: Invalid wallet address length');
    console.error('[SEED] Solana wallet addresses must be 32-44 characters');
    process.exit(1);
  }

  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (!base58Regex.test(superAdminWallet)) {
    console.error('[SEED] ERROR: Invalid wallet address format');
    console.error('[SEED] Wallet must be in base58 format');
    process.exit(1);
  }

  // Create database connection
  const dbHost = process.env.DB_HOST || 'localhost';
  const isRemoteDb = dbHost !== 'localhost' && dbHost !== '127.0.0.1';

  const dataSource = new DataSource({
    type: 'postgres',
    host: dbHost,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'kindsoul_user',
    password: process.env.DB_PASSWORD || 'kindsoul_secure_password_change_me',
    database: process.env.DB_NAME || 'kindsoul_db',
    entities: [Admin],
    synchronize: false, // Don't auto-sync in seed scripts
    ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
  });

  try {
    // Initialize connection
    await dataSource.initialize();
    console.log('[SEED] Database connection established');

    const adminRepository = dataSource.getRepository(Admin);

    // Check if Super Admin already exists
    const existingSuperAdmin = await adminRepository.findOne({
      where: { walletAddress: superAdminWallet },
    });

    if (existingSuperAdmin) {
      console.log('[SEED] Super Admin already exists:');
      console.log(`[SEED]   Name: ${existingSuperAdmin.name}`);
      console.log(`[SEED]   Wallet: ${existingSuperAdmin.walletAddress}`);
      console.log(`[SEED]   Is Super Admin: ${existingSuperAdmin.isSuperAdmin}`);
      console.log(`[SEED]   Permissions: ${existingSuperAdmin.permissions.join(', ') || 'All'}`);
      console.log('[SEED] No changes made.');
      process.exit(0);
    }

    // Create Super Admin
    const superAdmin = adminRepository.create({
      name: superAdminName,
      walletAddress: superAdminWallet,
      isSuperAdmin: true,
      permissions: Object.values(AdminPermission), // Super Admin gets all permissions
      isActive: true,
    });

    await adminRepository.save(superAdmin);

    console.log('[SEED] ✅ Super Admin created successfully!');
    console.log(`[SEED]   ID: ${superAdmin.id}`);
    console.log(`[SEED]   Name: ${superAdmin.name}`);
    console.log(`[SEED]   Wallet: ${superAdmin.walletAddress}`);
    console.log(`[SEED]   Permissions: All`);
    console.log('[SEED] You can now use this wallet to access Super Admin endpoints.');

  } catch (error) {
    console.error('[SEED] ERROR: Failed to seed Super Admin:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await dataSource.destroy();
    console.log('[SEED] Database connection closed');
  }
}

// Run the seed script
seedSuperAdmin();
