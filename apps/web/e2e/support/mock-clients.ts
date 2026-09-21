import type { Page } from '@playwright/test';

const MONTHS = [
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

type Node = { id: string; name: string; values: number[]; branches?: Node[] };

const node = (id: string, name: string, branches?: Node[]): Node => ({
  id,
  name,
  values: Array.from({ length: 12 }, () => 1),
  ...(branches ? { branches } : {}),
});

/** A valid `GET /api/clients` envelope: Company with three branches. */
export const clientsOk = () => ({
  months: MONTHS,
  company: node('company', 'Company', [
    node('b1', 'Branch 1'),
    node('b2', 'Branch 2'),
    node('b3', 'Branch 3'),
  ]),
});

/** The web gate runs against Vite only (tech doc D-9); the endpoint is stubbed per test. */
export const isClientsEndpoint = (url: URL) => url.pathname === '/api/clients';

/**
 * Stub the endpoint with a good answer. Matched on the pathname, never on a `/api/clients` glob:
 * in dev, Vite serves source modules under `/src/entities/clients/api/…`, whose URLs a loose glob
 * would also intercept.
 */
export const mockClientsOk = (page: Page) =>
  page.route(isClientsEndpoint, (route) => route.fulfill({ json: clientsOk() }));
