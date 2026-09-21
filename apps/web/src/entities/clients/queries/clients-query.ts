import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchClients } from '../api/fetch-clients';
import type { DevSwitches } from '../model/types';

/**
 * The one query behind the page. The switches sit in the key so a Retry (`refetch()`) reuses
 * them and a different address is a different cache entry (tech doc D-6). Retry, timing and
 * refetch policy come from the client defaults, not from here.
 */
export const clientsQueryOptions = (switches: DevSwitches = {}) =>
  queryOptions({
    queryKey: ['clients', switches] as const,
    queryFn: ({ signal }) => fetchClients({ switches, signal }),
  });

export const useClientsQuery = (switches: DevSwitches = {}) =>
  useQuery(clientsQueryOptions(switches));
