import type { ClientsResponse, TreeNode } from '@nevis/contracts';

/** The loaded figures as the page consumes them: the wire envelope, already validated. */
export type ClientsData = ClientsResponse;

export type { TreeNode };

/**
 * The development-only address switches the page forwards to the service (spec 001 FR6).
 * Kept as the raw strings from the address; the service parses them. Read once per page load
 * by `readDevSwitches` and carried in the query key, so Retry reuses them (tech doc D-6).
 */
export type DevSwitches = {
  delay?: string;
  fail?: string;
};
