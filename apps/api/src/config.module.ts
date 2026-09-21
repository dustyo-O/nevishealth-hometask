import { Module } from '@nestjs/common';
import { API_CONFIG, loadConfig } from './config.js';

/**
 * Provides `API_CONFIG` to whichever module imports it. Interceptors bound with `@UseInterceptors`
 * are instantiated in their controller's module, so `ClientsModule` imports this to reach the
 * config that the root module also owns.
 */
@Module({
  providers: [{ provide: API_CONFIG, useFactory: () => loadConfig(process.env) }],
  exports: [API_CONFIG],
})
export class ConfigModule {}
