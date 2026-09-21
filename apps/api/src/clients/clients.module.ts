import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller.js';
import { CLIENTS_REPOSITORY } from './clients.repository.js';
import { ClientsService } from './clients.service.js';
import { CLIENTS_DATA_PATH, JsonClientsRepository } from './json-clients.repository.js';

@Module({
  controllers: [ClientsController],
  providers: [
    ClientsService,
    // `nest-cli.json` `assets` copies the file next to the built module, so the URL holds in dist/ too.
    { provide: CLIENTS_DATA_PATH, useValue: new URL('./data/clients.json', import.meta.url) },
    { provide: CLIENTS_REPOSITORY, useClass: JsonClientsRepository },
  ],
})
export class ClientsModule {}
