import { Module } from '@nestjs/common';
import { ConfigModule } from './config.module.js';
import { ClientsModule } from './clients/clients.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [ConfigModule, ClientsModule, HealthModule],
})
export class AppModule {}
