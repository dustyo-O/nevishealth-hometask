import { ClientsResponseSchema } from '@nevis/contracts';
import { UnexpectedShapeError, getJson } from '@/shared/api';
import type { ClientsData, DevSwitches } from '../model/types';
import { buildClientsUrl } from './build-clients-url';

export type FetchClientsOptions = {
  switches?: DevSwitches;
  /** TanStack Query's signal — cancels the request when the last observer unmounts. */
  signal?: AbortSignal;
};

/**
 * Fetches the envelope and validates it against the contract; a document that parses but is not
 * the expected shape is the same failure to the user as a body that is not JSON (FR4).
 */
export const fetchClients = async ({
  switches = {},
  signal,
}: FetchClientsOptions = {}): Promise<ClientsData> => {
  const body = await getJson(buildClientsUrl(switches), { signal });
  const parsed = ClientsResponseSchema.safeParse(body);
  if (!parsed.success) throw new UnexpectedShapeError({ cause: parsed.error });
  return parsed.data;
};
