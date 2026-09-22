import { expect, type Locator, type Page } from '@playwright/test';

/** The exact strings the spec names (FR3–FR5); the middle dot and the dash are U+00B7 and U+2013. */
export const TEXT = {
  heading: 'Clients',
  loading: 'Loading clients…',
  period: '12 months · Feb 2024 – Jan 2025',
  /**
   * The monthly detail table's accessible name. It stands where spec 001's summary line
   * ("Company · 3 branches") stood, until spec 002 FR7 replaced that line with the table itself.
   */
  table: 'Clients by month',
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

/** What the default double serves: the Company row, already open, and its three branches. */
export const COMPANY_AND_BRANCHES = ['Company', 'Branch 1', 'Branch 2', 'Branch 3'] as const;

export type ClientsPage = {
  heading: Locator;
  /** The live region for assistive technology — reads "Loading clients…" only while loading. */
  status: Locator;
  /** The container of the two cards / the error panel; `aria-busy` while loading. */
  grid: Locator;
  chartCard: Locator;
  tableCard: Locator;
  /** The monthly detail table inside the lower card (spec 002 FR1). */
  table: Locator;
  /** Every visible row's name, top to bottom: the Company row and whatever is open beneath it. */
  rowNames: Locator;
  /** The error panel's text block; announced on arrival. */
  alert: Locator;
  retry: Locator;
};

export const clientsPage = (page: Page): ClientsPage => {
  const table = page.getByRole('treegrid', { name: TEXT.table });

  return {
    heading: page.getByRole('heading', { level: 1, name: TEXT.heading }),
    status: page.getByRole('status'),
    grid: page.locator('[aria-busy]'),
    chartCard: page.getByRole('region', { name: 'Clients chart' }),
    tableCard: page.getByRole('region', { name: 'Monthly detail' }),
    table,
    rowNames: table.getByRole('rowheader'),
    alert: page.getByRole('alert'),
    retry: page.getByRole('button', { name: TEXT.retry }),
  };
};

/**
 * "The figures have arrived." Spec 001 settled the loaded state on the table card's summary
 * line; spec 002 FR7 puts the table there instead, so what settles it now is the Company row
 * and the branches open beneath it — the same fact about the same data, read from the rows.
 */
export const expectTableLoaded = async (
  ui: ClientsPage,
  names: readonly string[] = COMPANY_AND_BRANCHES,
): Promise<void> => {
  await expect(ui.table).toBeVisible();
  await expect(ui.rowNames).toHaveText([...names]);
};

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
