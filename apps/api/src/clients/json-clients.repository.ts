import type { PathLike } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { MONTHS, type ClientsResponse, type TreeNode } from '@nevis/contracts';
import type { ClientsRepository } from './clients.repository.js';

/** The file the JSON repository reads at boot — the test seam (`overrideProvider(CLIENTS_DATA_PATH)`). */
export const CLIENTS_DATA_PATH = Symbol('CLIENTS_DATA_PATH');

@Injectable()
export class JsonClientsRepository implements ClientsRepository, OnModuleInit {
  private company: TreeNode | undefined;

  constructor(@Inject(CLIENTS_DATA_PATH) private readonly dataPath: PathLike) {}

  async onModuleInit(): Promise<void> {
    // Served verbatim: the shape rule is the consumer's (FR4) and refusing bad data is Phase 2's.
    this.company = JSON.parse(await readFile(this.dataPath, 'utf8')) as TreeNode;
  }

  load(): Promise<ClientsResponse> {
    if (this.company === undefined) {
      return Promise.reject(new Error('JsonClientsRepository.load() called before onModuleInit'));
    }
    // `months` is the constant window from the contract; a live provider knows its own (tech doc §2.3).
    return Promise.resolve({ months: [...MONTHS], company: this.company });
  }
}
