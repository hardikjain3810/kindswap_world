import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeeConfiguration } from '../database/entities/fee-configuration.entity';
import { FeeTier } from '../database/entities/fee-tier.entity';
import { FeeConfigurationAudit } from '../database/entities/fee-configuration-audit.entity';
import { FeeTierAudit } from '../database/entities/fee-tier-audit.entity';
import { FeeConfigurationRepository } from '../database/repositories/fee-configuration.repository';
import { FeeTierRepository } from '../database/repositories/fee-tier.repository';
import { ConfigService } from './services/config.service';
import { ConfigController } from './controllers/config.controller';
import { AdminConfigController } from './controllers/admin-config.controller';
import { AdminModule } from './admin.module';

/**
 * ConfigModule
 * Feature module for fee configuration management
 *
 * Provides:
 * - Fee tier configuration
 * - Fee configuration
 * - Redis caching integration
 * - Audit trail for all changes
 *
 * Exports:
 * - ConfigService (for use in other modules)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      FeeConfiguration,
      FeeTier,
      FeeConfigurationAudit,
      FeeTierAudit,
    ]),
    AdminModule,
  ],
  controllers: [ConfigController, AdminConfigController],
  providers: [ConfigService, FeeConfigurationRepository, FeeTierRepository],
  exports: [ConfigService],
})
export class ConfigModule {}
