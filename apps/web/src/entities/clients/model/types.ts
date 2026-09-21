import type { ClientsResponse, TreeNode } from '@nevis/contracts';

/** The loaded figures as the page consumes them: the wire envelope, already validated. */
export type ClientsData = ClientsResponse;

export type { TreeNode };

/**
 * The development-only address switches the page forwards to the service (spec 001 FR6).
 * Kept as the raw strings from the address; the service parses them. Slice 3 adds
 * `readDevSwitches`; this slice always passes `{}`.
 */
export type DevSwitches = {
  delay?: string;
  fail?: string;
};
