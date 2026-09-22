import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';
import { installClientsDouble, MONTHS, type Item } from './clients-double';
import { clientsPage, expectTableLoaded, type ClientsPage } from './clients-page';

/**
 * Spec 002's acceptance criteria name real people and real figures ("Anna Blackwood", "250 and
 * 350", "five adviser rows"), so its browser suite is served the data the API ships — read from
 * the API's own asset, never copied, so the two cannot drift. Still served by the route double:
 * the web gate needs only Vite (architecture §4).
 */
const SHIPPED = new URL('../../../api/src/clients/data/clients.json', import.meta.url);

/** The shipped envelope; a fresh object per call, so a test may edit its copy. */
export const shippedClients = () => ({
  months: [...MONTHS],
  company: JSON.parse(readFileSync(SHIPPED, 'utf8')) as Item,
});

/** Every heading after the blank first one, in order (FR1-AC3). */
export const MONTH_HEADINGS = [
  'Feb 2024',
  'Mar 2024',
  'Apr 2024',
  'May 2024',
  'Jun 2024',
  'Jul 2024',
  'Aug 2024',
  'Sep 2024',
  'Oct 2024',
  'Nov 2024',
  'Dec 2024',
  'Jan 2025',
] as const;

export const BRANCH_1_ADVISERS = [
  'Anna Blackwood',
  'James Walker',
  'Maria Gutierrez',
  'Robert Chen',
  'Sarah Smith',
] as const;

export const ANNA_CHANNELS = ['Existing clients', 'New organic', 'New paid'] as const;

export type ClientsBody = ReturnType<typeof shippedClients>;

/** Opens the page on `body` (the shipped data by default) and waits for the table. */
export const openTable = async (
  page: Page,
  body: ClientsBody = shippedClients(),
): Promise<ClientsPage> => {
  await installClientsDouble(page, { body });
  const ui = clientsPage(page);
  await page.goto('/');
  // Settled on whatever this body's Company and branches are called.
  await expectTableLoaded(ui, [
    body.company.name,
    ...(body.company.branches ?? []).map((branch) => branch.name),
  ]);
  return ui;
};

/** The row whose name is exactly `name` — the first one, since channel names repeat. */
export const rowOf = (ui: ClientsPage, name: string): Locator =>
  ui.table
    .getByRole('row')
    .filter({ has: ui.table.page().getByRole('rowheader', { name, exact: true }) })
    .first();

/**
 * Every visible row's name as a reader hears it, top to bottom. `rowNames` reads text content,
 * which on an adviser row includes the circle's aria-hidden initials ("ABAnna Blackwood").
 */
export const namesAsRead = (ui: ClientsPage): Locator =>
  ui.table.locator('tbody tr:not([inert]) th [title]');

export const nameOf = (ui: ClientsPage, name: string): Locator =>
  rowOf(ui, name).getByRole('rowheader');

/** The row's figure for `month` ("Jun 2024"). */
export const figureOf = (ui: ClientsPage, name: string, month: string): Locator =>
  rowOf(ui, name)
    .getByRole('gridcell')
    .nth(MONTH_HEADINGS.indexOf(month as never));

/** The scroll container the months move in (D-1): the table's own parent, never the card. */
export const scrollerOf = (ui: ClientsPage): Locator => ui.table.locator('xpath=..');

/** Clicks a row's name and waits until the rows beneath it have arrived or left (D-8). */
export const toggleByName = async (ui: ClientsPage, name: string): Promise<void> => {
  const row = rowOf(ui, name);
  const before = await row.getAttribute('aria-expanded');
  await nameOf(ui, name).click();
  await expect(row).toHaveAttribute('aria-expanded', before === 'true' ? 'false' : 'true');
  await settled(ui);
};

/** No row is still sliding out: departing rows linger ~250 ms, `inert` (D-8, D-15a). */
export const settled = async (ui: ClientsPage): Promise<void> => {
  await expect(ui.table.locator('tbody tr[inert]')).toHaveCount(0);
};

/** Opens every row that can open, level by level, until nothing is closed. */
export const expandAll = async (ui: ClientsPage): Promise<void> => {
  const closed = ui.table.locator('tbody tr[aria-expanded="false"]:not([inert])');
  while ((await closed.count()) > 0) {
    await closed.first().locator('th').click();
    await settled(ui);
  }
};

/** Tab from the page heading into the grid: the outline lands on the Company row (FR3-AC1). */
export const tabIntoTable = async (page: Page, ui: ClientsPage): Promise<void> => {
  // A click on the heading moves the sequential-focus starting point there without making it a
  // tab stop, so the next Tab is the one a keyboard user reading down the page would press.
  await ui.heading.click();
  await page.keyboard.press('Tab');
  await expect(rowOf(ui, 'Company')).toBeFocused();
};

/** Presses each key in turn. */
export const press = async (page: Page, ...keys: string[]): Promise<void> => {
  for (const key of keys) await page.keyboard.press(key);
};

type Rect = { left: number; right: number; top: number; bottom: number };

export const rectOf = (locator: Locator): Promise<Rect> =>
  locator.evaluate((el) => {
    const { left, right, top, bottom } = el.getBoundingClientRect();
    return { left, right, top, bottom };
  });

/** Where an element's *text* is painted — a right-aligned figure's digits, not its cell. */
export const textRectOf = (locator: Locator): Promise<Rect> =>
  locator.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const { left, right, top, bottom } = range.getBoundingClientRect();
    return { left, right, top, bottom };
  });

export const pageScroll = (page: Page) =>
  page.evaluate(() => ({
    x: window.scrollX,
    y: window.scrollY,
    width: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    height: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
