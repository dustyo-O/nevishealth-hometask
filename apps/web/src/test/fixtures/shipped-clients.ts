import { MONTHS, type ClientsResponse, type TreeNode } from '@nevis/contracts';
// The data the API ships, read from its own asset and never copied, so the two cannot drift —
// the same rule as the browser suite's `e2e/support/table.ts`. `?raw` keeps it a string: a fresh
// parse per call lets a test edit its copy.
import shipped from '../../../../api/src/clients/data/clients.json?raw';

/** The shipped envelope, a fresh object per call. */
export const shippedClients = (): ClientsResponse => ({
  months: [...MONTHS],
  company: JSON.parse(shipped) as TreeNode,
});
