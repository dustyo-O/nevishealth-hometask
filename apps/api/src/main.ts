import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MONTHS } from '@nevis/contracts';
import { AppModule } from './app.module.js';
import { loadConfig } from './config.js';

const config = loadConfig(process.env);
const app = await NestFactory.create(AppModule);

app.setGlobalPrefix('api');
if (config.corsOrigin !== false) {
  app.enableCors({ origin: config.corsOrigin, methods: ['GET'] });
}

await app.listen(config.port);

// A real use of the source-exported contracts: the boot smoke proves they load under type stripping.
new Logger('Bootstrap').log(
  `Listening on ${await app.getUrl()} — serving ${MONTHS.length} months, ${MONTHS[0]} to ${MONTHS[MONTHS.length - 1]}`,
);
