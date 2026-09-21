import { Controller, Get, UseInterceptors } from '@nestjs/common';
import type { ClientsResponse } from '@nevis/contracts';
import { ClientsService } from './clients.service.js';
import { DevSwitchesInterceptor } from './dev-switches.interceptor.js';

@Controller('clients')
// Dev-only `?delay=` / `?fail=1` live here and nowhere else (tech doc D-5).
@UseInterceptors(DevSwitchesInterceptor)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  getClients(): Promise<ClientsResponse> {
    return this.clients.getClients();
  }
}
