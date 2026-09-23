export { CLIENTS_PATH, buildClientsUrl } from './api/build-clients-url';
export { readDevSwitches } from './api/dev-switches';
export { fetchClients, type FetchClientsOptions } from './api/fetch-clients';
export { flattenVisibleRows, type ClientKind, type ClientRow } from './model/flatten-rows';
export { formatMonth } from './model/format-month';
export { toInitials } from './model/initials';
export { toMonthlySeries, type MonthlyPoint, type MonthlySeries } from './model/monthly-series';
export type { ClientsData, DevSwitches, TreeNode } from './model/types';
export { clientsQueryOptions, useClientsQuery } from './queries/clients-query';
