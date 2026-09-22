import type { ClientsResponse } from '@nevis/contracts';

/** Where the clients envelope comes from. A live source later is a new provider, not a rewrite. */
export type ClientsRepository = {
  load(): Promise<ClientsResponse>;
};

export const CLIENTS_REPOSITORY = Symbol('CLIENTS_REPOSITORY');
