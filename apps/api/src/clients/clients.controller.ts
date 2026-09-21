import { Controller, Get } from '@nestjs/common';
import type { ClientsResponse } from '@nevis/contracts';
import { ClientsService } from './clients.service.js';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  getClients(): Promise<ClientsResponse> {
    return this.clients.getClients();
  }
}
