import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { ClientsResponse } from '@nevis/contracts';
import { CLIENTS_REPOSITORY, type ClientsRepository } from './clients.repository.js';
import { reportDiscrepancies } from './consistency.js';

@Injectable()
export class ClientsService implements OnApplicationBootstrap {
  constructor(@Inject(CLIENTS_REPOSITORY) private readonly repository: ClientsRepository) {}

  /** Pass-through today — the seam where Phase 2's consistency guard will sit. */
  getClients(): Promise<ClientsResponse> {
    return this.repository.load();
  }

  /** Runs after every `onModuleInit`, so the repository has read its file by now. */
  async onApplicationBootstrap(): Promise<void> {
    const { company } = await this.repository.load();
    reportDiscrepancies(company);
  }
}
