import type { Locator, Page } from '@playwright/test';

/** The exact strings the spec names (FR3–FR5); the middle dot and the dash are U+00B7 and U+2013. */
export const TEXT = {
  heading: 'Clients',
  loading: 'Loading clients…',
  period: '12 months · Feb 2024 – Jan 2025',
  branches: 'Company · 3 branches',
  message: "We couldn't load the clients data.",
  retry: 'Retry',
  detail: {
    status500: 'Request failed with status 500',
    network: 'Network error',
    timeout: 'Request timed out',
    shape: 'Unexpected data shape',
  },
} as const;

export const VIEWPORT = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 375, height: 812 },
} as const;

export type ClientsPage = {
  heading: Locator;
  /** The live region for assistive technology — reads "Loading clients…" only while loading. */
  status: Locator;
  /** The container of the two cards / the error panel; `aria-busy` while loading. */
  grid: Locator;
  chartCard: Locator;
  tableCard: Locator;
  /** The error panel's text block; announced on arrival. */
  alert: Locator;
  retry: Locator;
};

export const clientsPage = (page: Page): ClientsPage => ({
  heading: page.getByRole('heading', { level: 1, name: TEXT.heading }),
  status: page.getByRole('status'),
  grid: page.locator('[aria-busy]'),
  chartCard: page.getByRole('region', { name: 'Clients chart' }),
  tableCard: page.getByRole('region', { name: 'Monthly detail' }),
  alert: page.getByRole('alert'),
  retry: page.getByRole('button', { name: TEXT.retry }),
});

type MarkedWindow = Window & { __sameDocument?: true };

/** Leaves a mark on the current document; a reload or navigation would lose it. */
export const markDocument = (page: Page) =>
  page.evaluate(() => {
    (window as MarkedWindow).__sameDocument = true;
  });

/** True while the document that was marked is still the one on screen. */
export const isSameDocument = (page: Page) =>
  page.evaluate(() => (window as MarkedWindow).__sameDocument === true);

export type Box = { x: number; y: number; width: number; height: number };

/** Both cards' geometry, for the "replaced in place, nothing shifts" checks (FR3-AC2). */
export const cardBoxes = async ({ chartCard, tableCard }: ClientsPage): Promise<Box[]> => {
  const boxes = await Promise.all([chartCard.boundingBox(), tableCard.boundingBox()]);
  return boxes.map((box) => {
    if (box === null) throw new Error('a card has no box: it is not rendered');
    return box;
  });
};

const withinOnePixel = (a: number, b: number) => Math.abs(a - b) <= 1;

export const sameBoxes = (before: Box[], after: Box[]): boolean =>
  before.length === after.length &&
  before.every((box, i) => {
    const other = after[i]!;
    return (
      withinOnePixel(box.x, other.x) &&
      withinOnePixel(box.y, other.y) &&
      withinOnePixel(box.width, other.width) &&
      withinOnePixel(box.height, other.height)
    );
  });

/** The rightmost pixel any of these elements reaches — must stay inside the viewport (FR7). */
export const rightEdgeOf = async (locators: Locator[]): Promise<number> => {
  const boxes = await Promise.all(locators.map((locator) => locator.boundingBox()));
  return Math.max(...boxes.map((box) => (box === null ? 0 : box.x + box.width)));
};

export const scrollWidthOf = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth);
