/** One attempt may take this long before it counts as failed (spec 001 FR4). */
export const REQUEST_TIMEOUT_MS = 10_000;

/** The single automatic second attempt starts this long after the first failure (FR4). */
export const RETRY_DELAY_MS = 500;
