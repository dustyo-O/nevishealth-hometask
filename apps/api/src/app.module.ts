import { Module } from '@nestjs/common';
import { API_CONFIG, loadConfig } from './config.js';
import { ClientsModule } from './clients/clients.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [ClientsModule, HealthModule],
  providers: [{ provide: API_CONFIG, useFactory: () => loadConfig(process.env) }],
})
export class AppModule {}
