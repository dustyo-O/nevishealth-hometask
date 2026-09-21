import type { DevSwitches } from '../model/types';

export const CLIENTS_PATH = '/api/clients';

/** `/api/clients`, plus `?delay=&fail=` when the page carries the dev switches (FR6). */
export const buildClientsUrl = ({ delay, fail }: DevSwitches = {}): string => {
  const params = new URLSearchParams();
  if (delay !== undefined) params.set('delay', delay);
  if (fail !== undefined) params.set('fail', fail);
  const query = params.toString();
  return query === '' ? CLIENTS_PATH : `${CLIENTS_PATH}?${query}`;
};
