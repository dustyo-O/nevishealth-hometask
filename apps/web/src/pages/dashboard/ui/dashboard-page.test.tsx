import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/shared/api';
import { DashboardPage } from './dashboard-page';
import { clientsFixture, makeNode } from '@/test/fixtures/clients';

const PERIOD = '12 months · Feb 2024 – Jan 2025';
const BRANCHES = 'Company · 3 branches';
const MESSAGE = "We couldn't load the clients data.";
const STATUS_500 = 'Request failed with status 500';
const LOADING = 'Loading clients…';
/** FR3: the announcement's own wait, mirroring `LOADING_ANNOUNCE_DELAY_MS` in the page. */
const ANNOUNCE_DELAY_MS = 1000;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.history.replaceState(null, '', '/');
});

const mockClientsOk = () =>
  vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(() => Promise.resolve(Response.json(clientsFixture())));

/** The service failing on purpose — Nest's `?fail=1` answer. Fresh body per call. */
const fail500 = () =>
  Response.json({ statusCode: 500, message: 'Failing on purpose' }, { status: 500 });

const mockClientsFailing = () =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(fail500()));

/** jsdom's `location.reload` is unforgeable; the global itself is not, so the page sees this one. */
const stubReload = () => {
  const reload = vi.fn();
  vi.stubGlobal('location', { search: window.location.search, href: window.location.href, reload });
  return reload;
};

const requestedUrls = (fetchMock: ReturnType<typeof mockClientsFailing>) =>
  fetchMock.mock.calls.map(([url]) => url);

type Deferred = { promise: Promise<Response>; resolve: (response: Response) => void };

/** A fetch that stays pending until the test releases it — the loading state, held open. */
const deferred = (): Deferred => {
  let resolve: Deferred['resolve'] = () => undefined;
  const promise = new Promise<Response>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const placeholderBlocksOf = (region: HTMLElement) =>
  region.querySelectorAll('[aria-hidden="true"]');

/** Real timers, the app's own defaults except an instant retry (tech doc §4). */
const renderPage = () =>
  render(
    <QueryClientProvider client={createQueryClient({ retryDelay: 0 })}>
      <DashboardPage />
    </QueryClientProvider>,
  );

const busyContainerOf = (element: HTMLElement) => element.closest('[aria-busy]');

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));

/**
 * Moves the fake clock inside `act`, flushing whatever the app resolves along the way. The
 * announcement's wait is a real second in the browser; no test here spends one (tech doc §4).
 */
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

/**
 * Every text the live region ever carried, in order. A screen reader speaks whatever appears,
 * however briefly, so "it never announced" has to be watched for, not sampled afterwards.
 */
const recordAnnouncements = (status: HTMLElement): string[] => {
  const spoken: string[] = [];
  new MutationObserver(() => {
    const text = status.textContent ?? '';
    if (text !== '' && text !== spoken.at(-1)) spoken.push(text);
  }).observe(status, { childList: true, characterData: true, subtree: true });
  return spoken;
};

describe('DashboardPage — loading state (FR3)', () => {
  it('shows the heading, the busy grid and two placeholder cards at once — and only then announces (FR3-AC1)', async () => {
    vi.useFakeTimers();
    const pending = deferred();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => pending.promise);
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Clients' })).toBeInTheDocument();
    const chart = screen.getByRole('region', { name: 'Clients chart' });
    const table = screen.getByRole('region', { name: 'Monthly detail' });
    expect(screen.getAllByRole('region')).toHaveLength(2);

    // What the eye needs is immediate; only what is spoken waits (FR3, amended 2026-09-22).
    expect(busyContainerOf(chart)).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();

    // Grey blocks in the content's positions, hidden from assistive technology, nothing to read.
    expect(placeholderBlocksOf(chart).length).toBeGreaterThan(0);
    expect(placeholderBlocksOf(table).length).toBeGreaterThan(0);
    expect(chart.textContent).toBe('');
    expect(table.textContent).toBe('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    await advance(ANNOUNCE_DELAY_MS);
    expect(screen.getByRole('status')).toHaveTextContent(LOADING);
  });

  it('replaces the placeholders in place when the figures arrive (FR3-AC2)', async () => {
    const pending = deferred();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => pending.promise);
    renderPage();
    const chart = screen.getByRole('region', { name: 'Clients chart' });
    const table = screen.getByRole('region', { name: 'Monthly detail' });

    pending.resolve(Response.json(clientsFixture()));
    await screen.findByText(PERIOD);

    // The same two card nodes, now holding the summaries and no placeholder blocks.
    expect(screen.getByRole('region', { name: 'Clients chart' })).toBe(chart);
    expect(screen.getByRole('region', { name: 'Monthly detail' })).toBe(table);
    expect(chart).toHaveTextContent(PERIOD);
    expect(table).toHaveTextContent(BRANCHES);
    expect(placeholderBlocksOf(chart)).toHaveLength(0);
    expect(placeholderBlocksOf(table)).toHaveLength(0);
    expect(busyContainerOf(chart)).toHaveAttribute('aria-busy', 'false');
  });

  it('has no accessibility violations while loading, announcement and all', async () => {
    vi.useFakeTimers();
    const pending = deferred();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => pending.promise);
    const { container } = renderPage();
    await advance(ANNOUNCE_DELAY_MS);
    expect(screen.getByRole('status')).toHaveTextContent(LOADING);
    // axe drives its own clock; hand it back before the audit.
    vi.useRealTimers();

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('DashboardPage — loaded state', () => {
  it('renders the Clients heading and the two named card regions', async () => {
    mockClientsOk();
    renderPage();

    expect(await screen.findByText(PERIOD)).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Clients' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Clients chart' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Monthly detail' })).toBeInTheDocument();
    expect(screen.getAllByRole('region')).toHaveLength(2);
  });

  it('fetches once and shows the summaries computed from the loaded data (FR5-AC1)', async () => {
    const fetchMock = mockClientsOk();
    renderPage();

    const chart = screen.getByRole('region', { name: 'Clients chart' });
    const table = screen.getByRole('region', { name: 'Monthly detail' });
    expect(await screen.findByText(PERIOD)).toBeVisible();

    expect(chart).toHaveTextContent(PERIOD);
    expect(table).toHaveTextContent(BRANCHES);
    expect(busyContainerOf(chart)).toHaveAttribute('aria-busy', 'false');
    expect(busyContainerOf(table)).toBe(busyContainerOf(chart));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/clients');
  });

  it('mounts the live region empty, keeps it empty until the wait has passed, fills it while loading, clears it when loaded (FR3-AC1/AC2)', async () => {
    vi.useFakeTimers();
    const pending = deferred();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => pending.promise);
    renderPage();

    // First synchronous render: the node exists, outside the busy container, with no text yet —
    // live regions report changes, so the announcement must be a change to an existing node.
    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();
    expect(busyContainerOf(status)).toBeNull();
    expect(status).toHaveAttribute('aria-atomic', 'true');
    const spoken = recordAnnouncements(status);
    expect(busyContainerOf(screen.getByRole('region', { name: 'Clients chart' }))).toHaveAttribute(
      'aria-busy',
      'true',
    );

    // A millisecond short of the wait the region is still silent: a screen reader is still
    // reading the page it just opened, and anything said underneath it is lost (VoiceOver
    // device check 2026-09-22, FR3 amended).
    await advance(ANNOUNCE_DELAY_MS - 1);
    expect(status).toBeEmptyDOMElement();

    await advance(1);
    expect(status).toHaveTextContent(LOADING);

    // The figures land: the same node, silent again, nothing further announced.
    vi.useRealTimers();
    pending.resolve(Response.json(clientsFixture()));
    await screen.findByText(PERIOD);

    expect(screen.getByRole('status')).toBe(status);
    expect(status).toBeEmptyDOMElement();
    // Spoken once, and nothing further when the figures landed.
    expect(spoken).toEqual([LOADING]);
  });

  it('says nothing at all when the figures are already there (FR3-AC3)', async () => {
    vi.useFakeTimers();
    const pending = deferred();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => pending.promise);
    renderPage();
    const status = screen.getByRole('status');
    const spoken = recordAnnouncements(status);
    expect(status).toBeEmptyDOMElement();

    // A fast service — fifty milliseconds, well inside the wait — so the announcement never
    // falls due. The wait is real time, not a tick: a load this quick still crosses one.
    await advance(50);
    expect(status).toBeEmptyDOMElement();
    pending.resolve(Response.json(clientsFixture()));
    await advance(50);
    expect(screen.getByText(PERIOD)).toBeVisible();

    // And the moment it would have been due passes with the region still silent.
    await advance(ANNOUNCE_DELAY_MS * 2);
    expect(screen.getByRole('status')).toBe(status);
    expect(status).toBeEmptyDOMElement();
    expect(spoken).toEqual([]);
  });

  it('does not fetch again when the window regains focus (FR5-AC4)', async () => {
    const fetchMock = mockClientsOk();
    renderPage();
    await screen.findByText(PERIOD);

    act(() => {
      window.dispatchEvent(new Event('focus'));
      // Browsers fire this on document and it bubbles to window, where TanStack Query listens.
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
    });
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(busyContainerOf(screen.getByRole('region', { name: 'Clients chart' }))).toHaveAttribute(
      'aria-busy',
      'false',
    );
  });

  it('has no accessibility violations once loaded', async () => {
    mockClientsOk();
    const { container } = renderPage();
    await screen.findByText(PERIOD);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('DashboardPage — failed state (FR4)', () => {
  it('shows the error panel with the detail line and Retry after the one automatic second attempt (FR4-AC1)', async () => {
    const fetchMock = mockClientsFailing();
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(MESSAGE);
    expect(alert).toHaveTextContent(STATUS_500);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // The panel replaces both cards; the heading and the (now quiet) live region stay.
    expect(screen.getByRole('heading', { level: 1, name: 'Clients' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Clients chart' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Monthly detail' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: MESSAGE })).toContainElement(alert);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(busyContainerOf(alert)).toHaveAttribute('aria-busy', 'false');
    // The announcement moves no focus (FR4-AC11).
    expect(document.body).toHaveFocus();
  });

  it('Retry with a persisting failure: the placeholders while it retries, then the same panel (FR4-AC4)', async () => {
    const user = userEvent.setup();
    const fetchMock = mockClientsFailing();
    renderPage();
    const retry = await screen.findByRole('button', { name: 'Retry' });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const pending = deferred();
    fetchMock.mockImplementationOnce(() => pending.promise);
    await user.click(retry);

    // What Retry shows is the placeholder frame, at once — the announcement has its own wait
    // and its own test below (FR4-AC4 / FR4-AC5).
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const chart = screen.getByRole('region', { name: 'Clients chart' });
    expect(screen.getByRole('region', { name: 'Monthly detail' })).toBeInTheDocument();
    expect(busyContainerOf(chart)).toHaveAttribute('aria-busy', 'true');
    expect(placeholderBlocksOf(chart).length).toBeGreaterThan(0);

    pending.resolve(fail500());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(STATUS_500);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('Retry announces the same way: silent until the wait has passed, then "Loading clients…" (FR4-AC5)', async () => {
    const fetchMock = mockClientsFailing();
    renderPage();
    const retry = await screen.findByRole('button', { name: 'Retry' });
    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();

    // A service that now answers slowly: the retry stays in flight while the clock is driven
    // by hand. The fake clock goes in before the click, so the wait the click starts is ours —
    // and the click is `fireEvent`, whose own waits are not on that clock.
    const pending = deferred();
    fetchMock.mockImplementation(() => pending.promise);
    vi.useFakeTimers();
    fireEvent.click(retry);
    await advance(0);

    const chart = screen.getByRole('region', { name: 'Clients chart' });
    expect(busyContainerOf(chart)).toHaveAttribute('aria-busy', 'true');
    expect(status).toBeEmptyDOMElement();

    await advance(ANNOUNCE_DELAY_MS - 1);
    expect(status).toBeEmptyDOMElement();

    await advance(1);
    expect(status).toHaveTextContent(LOADING);
    expect(screen.getByRole('status')).toBe(status);
  });

  it('Retry once the service is back: the loaded content, no reload (FR4-AC6)', async () => {
    const user = userEvent.setup();
    const fetchMock = mockClientsFailing();
    const reload = stubReload();
    renderPage();
    const retry = await screen.findByRole('button', { name: 'Retry' });
    const heading = screen.getByRole('heading', { level: 1, name: 'Clients' });

    fetchMock.mockImplementation(() => Promise.resolve(Response.json(clientsFixture())));
    await user.click(retry);

    expect(await screen.findByText(PERIOD)).toBeVisible();
    expect(screen.getByText(BRANCHES)).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Clients' })).toBe(heading);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(reload).not.toHaveBeenCalled();
    expect(busyContainerOf(screen.getByRole('region', { name: 'Clients chart' }))).toHaveAttribute(
      'aria-busy',
      'false',
    );
  });

  it('forwards ?fail=1 from the page address to both attempts and to Retry (FR4-AC7, FR6-AC2)', async () => {
    vi.stubEnv('DEV', true);
    window.history.replaceState(null, '', '/?fail=1');
    const user = userEvent.setup();
    const fetchMock = mockClientsFailing();
    renderPage();

    const retry = await screen.findByRole('button', { name: 'Retry' });
    expect(requestedUrls(fetchMock)).toEqual(['/api/clients?fail=1', '/api/clients?fail=1']);

    await user.click(retry);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));

    expect(requestedUrls(fetchMock)).toEqual(Array<string>(4).fill('/api/clients?fail=1'));
    expect(await screen.findByRole('alert')).toHaveTextContent(STATUS_500);
    expect(window.location.search).toBe('?fail=1');
  });

  it('shows "Unexpected data shape" for an item carrying two kinds of list (FR4-AC10)', async () => {
    const body = clientsFixture();
    body.company.branches = [
      makeNode('b1', 'Branch 1', {
        employees: [makeNode('e1', 'Anna Blackwood')],
        channels: [makeNode('c1', 'Referral')],
      }),
    ];
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(Response.json(body)));
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(MESSAGE);
    expect(alert).toHaveTextContent('Unexpected data shape');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows "Unexpected data shape" for an item defining two kinds of list, one of them empty (FR2, code review F1)', async () => {
    const body = clientsFixture();
    body.company.branches = [
      makeNode('b1', 'Branch 1', { employees: [makeNode('e1', 'Anna Blackwood')], channels: [] }),
    ];
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(Response.json(body)));
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(MESSAGE);
    expect(alert).toHaveTextContent('Unexpected data shape');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('is keyboard operable: Tab reaches Retry, Enter and Space retry, focus lands on the heading (FR4-AC11, D-11)', async () => {
    const user = userEvent.setup();
    const fetchMock = mockClientsFailing();
    renderPage();
    await screen.findByRole('button', { name: 'Retry' });
    const heading = screen.getByRole('heading', { level: 1, name: 'Clients' });

    await user.tab();
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(heading).toHaveFocus();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    await screen.findByRole('button', { name: 'Retry' });
    expect(heading).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveFocus();

    await user.keyboard(' ');
    expect(heading).toHaveFocus();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6));
    expect(await screen.findByRole('alert')).toHaveTextContent(STATUS_500);
  });

  it('has no accessibility violations in the failed state', async () => {
    mockClientsFailing();
    const { container } = renderPage();
    await screen.findByRole('alert');

    expect(await axe(container)).toHaveNoViolations();
  });
});
