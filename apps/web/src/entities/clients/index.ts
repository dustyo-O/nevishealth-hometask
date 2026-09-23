export { readDevSwitches } from './api/dev-switches';
export { flattenVisibleRows, type ClientRow } from './model/flatten-rows';
export { formatMonth } from './model/format-month';
export { toInitials } from './model/initials';
export { toMonthlySeries, type MonthlyPoint, type MonthlySeries } from './model/monthly-series';
export type { ClientsData, TreeNode } from './model/types';
export { clientsQueryOptions, useClientsQuery } from './queries/clients-query';
