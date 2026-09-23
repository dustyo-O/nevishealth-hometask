import type { Page } from '@playwright/test';

/**
 * A stand-in for `GET /api/clients` (the web gate runs against Vite only — tech doc D-9).
 * It behaves like the real service where the page can tell the difference: it honours the
 * documented development switches `?delay=<ms>` and `?fail=1` (spec 001 FR2), so the page's
 * forwarding of its own address switches (FR6) is observable end to end. Everything else is
 * chosen per test through the mutable `mode` and `body`.
 */

export type ClientsMode =
  /** 200 with `body`. */
  | 'ok'
  /** 500 with the service's own `?fail=1` body — "answers with an error". */
  | 'fail'
  /** The connection is refused — "the data service is unreachable". */
  | 'network'
  /** The request is accepted and never answered — "does not answer". */
  | 'hang';

export type ClientsDouble = {
  /** How the *next* request is answered; a test flips it between attempts. */
  mode: ClientsMode;
  /** The document served in `ok` mode. */
  body: unknown;
  /** Every request the page made to the endpoint, in order, with the time it arrived. */
  requests: ClientsRequest[];
};

export type ClientsRequest = { href: string; at: number };

export const MONTHS = [
  '2024-02',
  '2024-03',
  '2024-04',
  '2024-05',
  '2024-06',
  '2024-07',
  '2024-08',
  '2024-09',
  '2024-10',
  '2024-11',
  '2024-12',
  '2025-01',
];

export type Item = {
  id: string;
  name: string;
  values: number[];
  branches?: Item[];
  employees?: Item[];
  channels?: Item[];
};

type Lists = Pick<Item, 'branches' | 'employees' | 'channels'>;

export const twelve = (value = 1): number[] => Array.from({ length: 12 }, () => value);

export const item = (id: string, name: string, lists: Lists = {}): Item => ({
  id,
  name,
  values: twelve(),
  ...lists,
});

/**
 * `n` branches, as unevenly nested as the supplied data (spec 004 FR1): only Branch 1 has
 * advisers, and of its two only Adviser 1 has a channel. Every level is present, and so is a leaf
 * at every level — Adviser 2 and every other branch end their line — so a suite served this double
 * meets rows that do not open, not only rows that do. The channel carries a name the service
 * serves: the chart colours exactly the three channels it knows (spec 003 §2.1).
 */
export const companyWith = (n: number): Item =>
  item('company', 'Company', {
    branches: Array.from({ length: n }, (_, i) =>
      i === 0
        ? item('b1', 'Branch 1', {
            employees: [
              item('e1', 'Adviser 1', { channels: [item('c1', 'Existing clients')] }),
              item('e2', 'Adviser 2'),
            ],
          })
        : item(`b${i + 1}`, `Branch ${i + 1}`),
    ),
  });

/** A valid envelope in the shipped shape: Company with three unevenly nested branches. Fresh per call. */
export const clientsOk = (company: Item = companyWith(3)) => ({ months: MONTHS, company });

/** A company whose `branches` key is absent altogether (FR5-AC3). */
export const noBranches = () => clientsOk(item('company', 'Company'));

/** One branch with no advisers beneath it (FR4-AC9): a missing level is not a wrong shape. */
export const branchWithoutAdvisers = () =>
  clientsOk(
    item('company', 'Company', {
      branches: [
        item('b1', 'Branch 1', { employees: [item('e1', 'Adviser 1')] }),
        item('b2', 'Branch 2'),
        item('b3', 'Branch 3', { employees: [] }),
      ],
    }),
  );

/** One item with eleven figures instead of twelve (FR4-AC8). */
export const elevenFigures = () => {
  const body = clientsOk();
  body.company.branches![1]!.values = twelve().slice(0, 11);
  return body;
};

/** One item carrying two kinds of list beneath it (FR4-AC10). */
export const twoLists = () =>
  clientsOk(
    item('company', 'Company', {
      branches: [
        item('b1', 'Branch 1', {
          employees: [item('e1', 'Adviser 1')],
          channels: [item('c1', 'Referral')],
        }),
      ],
    }),
  );

/** Nest's default error body for the `?fail=1` switch (tech doc §2.3). */
export const FAIL_BODY = {
  message: 'Failing on purpose (?fail=1)',
  error: 'Internal Server Error',
  statusCode: 500,
};

const MAX_DELAY_MS = 30_000;

/** The service's clamp: whole milliseconds in `[0, 30000]`, garbage → 0 (tech doc D-5). */
const clampDelay = (raw: string | null): number => {
  if (raw === null) return 0;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return Math.min(parsed, MAX_DELAY_MS);
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Matched on the pathname, never on a `/api/clients` glob: in dev, Vite serves source modules
 * under `/src/entities/clients/api/…`, whose URLs a loose glob would also intercept.
 */
export const isClientsEndpoint = (url: URL): boolean => url.pathname === '/api/clients';

/**
 * The page may have given up on a request by the time the double answers (its own 10-second
 * limit, or React's development double-mount cancelling the first fetch); nobody is listening,
 * so the failed answer is not an error of the test.
 */
const answer = async (respond: () => Promise<void>): Promise<void> => {
  try {
    await respond();
  } catch {
    // The request is gone; there is nothing to answer.
  }
};

export const installClientsDouble = async (
  page: Page,
  initial: Partial<Pick<ClientsDouble, 'mode' | 'body'>> = {},
): Promise<ClientsDouble> => {
  const double: ClientsDouble = {
    mode: initial.mode ?? 'ok',
    body: initial.body ?? clientsOk(),
    requests: [],
  };

  await page.route(isClientsEndpoint, async (route) => {
    const url = new URL(route.request().url());
    double.requests.push({ href: url.href, at: Date.now() });

    // The service's switches first — in development they apply whatever the mode says.
    const delay = clampDelay(url.searchParams.get('delay'));
    if (delay > 0) await sleep(delay);
    if (url.searchParams.get('fail') === '1') {
      return answer(() => route.fulfill({ status: 500, json: FAIL_BODY }));
    }

    switch (double.mode) {
      case 'ok':
        return answer(() => route.fulfill({ json: double.body }));
      case 'fail':
        return answer(() => route.fulfill({ status: 500, json: FAIL_BODY }));
      case 'network':
        return answer(() => route.abort('connectionrefused'));
      case 'hang':
        // Accepted, never answered: the route stays open until the page or the test lets go.
        return;
    }
  });

  return double;
};

/** The query part of every request the page made, e.g. `['?fail=1', '?fail=1']`. */
export const queriesOf = (double: ClientsDouble): string[] =>
  double.requests.map(({ href }) => new URL(href).search);

/** When the page first asked for the figures — the clock the spec's timings run from. */
export const firstRequestAt = (double: ClientsDouble): number => {
  const first = double.requests[0];
  if (first === undefined) throw new Error('the page has not requested the figures yet');
  return first.at;
};

/** Waits until `ms` have passed since the page first asked for the figures. */
export const waitSinceFirstRequest = async (double: ClientsDouble, ms: number): Promise<void> => {
  const remaining = firstRequestAt(double) + ms - Date.now();
  if (remaining > 0) await sleep(remaining);
};
