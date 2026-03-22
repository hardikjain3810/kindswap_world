import { DataSource } from 'typeorm';
import { FeeConfiguration } from './entities/fee-configuration.entity';
import { FeeTier } from './entities/fee-tier.entity';
import * as dotenv from 'dotenv';

dotenv.config();

const dbHost = process.env.DB_HOST || 'localhost';
const isRemoteDb = dbHost !== 'localhost' && dbHost !== '127.0.0.1';

const dataSource = new DataSource({
  type: 'postgres',
  host: dbHost,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'kindsoul_user',
  password: process.env.DB_PASSWORD || 'kindsoul_secure_password_change_me',
  database: process.env.DB_NAME || 'kindsoul_db',
  entities: [FeeConfiguration, FeeTier],
  ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
});

async function seed() {
  try {
    await dataSource.initialize();
    console.log('Database connected');

    const feeConfigRepo = dataSource.getRepository(FeeConfiguration);
    const feeTierRepo = dataSource.getRepository(FeeTier);

    // Check if fee configuration already exists
    const existingConfig = await feeConfigRepo.findOne({ where: { isActive: true } });
    if (existingConfig) {
      console.log('Fee configuration already exists, skipping...');
    } else {
      // Create initial fee configuration
      const feeConfig = feeConfigRepo.create({
        baseFeeBps: 10.0,
        charityPortion: 0.25,
        kindswapPortion: 0.75,
        isActive: true,
        version: 1,
        notes: 'Initial configuration',
      });
      await feeConfigRepo.save(feeConfig);
      console.log('Fee configuration created');
    }

    // Check if fee tiers already exist
    const existingTiers = await feeTierRepo.find({ where: { isActive: true } });
    if (existingTiers.length > 0) {
      console.log('Fee tiers already exist, skipping...');
    } else {
      // Create fee tiers
      const tiers = [
        { name: 'No Tier', knsMin: '0', discountPercent: 0, effectiveFeeBps: 10.0, tierOrder: 0 },
        { name: 'Tier 1', knsMin: '5000', discountPercent: 5, effectiveFeeBps: 9.5, tierOrder: 1 },
        { name: 'Tier 2', knsMin: '25000', discountPercent: 10, effectiveFeeBps: 9.0, tierOrder: 2 },
        { name: 'Tier 3', knsMin: '100000', discountPercent: 15, effectiveFeeBps: 8.5, tierOrder: 3 },
        { name: 'Tier 4', knsMin: '500000', discountPercent: 20, effectiveFeeBps: 8.0, tierOrder: 4 },
      ];

      for (const tierData of tiers) {
        const tier = feeTierRepo.create({
          ...tierData,
          isActive: true,
          version: 1,
          notes: 'Initial tier',
        });
        await feeTierRepo.save(tier);
        console.log(`Fee tier "${tierData.name}" created`);
      }
    }

    console.log('Seed completed successfully');
    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
