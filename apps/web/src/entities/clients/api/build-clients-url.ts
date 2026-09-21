import type { DevSwitches } from '../model/types';

export const CLIENTS_PATH = '/api/clients';

/**
 * `/api/clients`, plus `?delay=&fail=` when the page carries the dev switches (FR6).
 * Deliberately not named `clients-url.ts`: Vite would serve that module at
 * `/src/entities/clients/api/clients-url.ts`, a URL that also contains `/api/clients`, so an e2e
 * route stub for the endpoint (a glob such as `**` + `/api/clients**`) would intercept the module
 * itself and replace it with JSON, breaking the app under test.
 */
export const buildClientsUrl = ({ delay, fail }: DevSwitches = {}): string => {
  const params = new URLSearchParams();
  if (delay !== undefined) params.set('delay', delay);
  if (fail !== undefined) params.set('fail', fail);
  const query = params.toString();
  return query === '' ? CLIENTS_PATH : `${CLIENTS_PATH}?${query}`;
};
