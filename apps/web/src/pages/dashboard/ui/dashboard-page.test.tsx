import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/shared/api';
import { DashboardPage } from './dashboard-page';
import { clientsFixture } from '@/test/fixtures/clients';

const PERIOD = '12 months · Feb 2024 – Jan 2025';
const BRANCHES = 'Company · 3 branches';

const mockClientsOk = () =>
  vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(() => Promise.resolve(Response.json(clientsFixture())));

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

describe('DashboardPage — loading state (FR3)', () => {
  it('shows the heading, the status text, the busy grid and two placeholder cards without text', () => {
    const pending = deferred();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => pending.promise);
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Clients' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading clients…');
    const chart = screen.getByRole('region', { name: 'Clients chart' });
    const table = screen.getByRole('region', { name: 'Monthly detail' });
    expect(screen.getAllByRole('region')).toHaveLength(2);
    expect(busyContainerOf(chart)).toHaveAttribute('aria-busy', 'true');

    // Grey blocks in the content's positions, hidden from assistive technology, nothing to read.
    expect(placeholderBlocksOf(chart).length).toBeGreaterThan(0);
    expect(placeholderBlocksOf(table).length).toBeGreaterThan(0);
    expect(chart.textContent).toBe('');
    expect(table.textContent).toBe('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
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

  it('has no accessibility violations while loading', async () => {
    const pending = deferred();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => pending.promise);
    const { container } = renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Loading clients…');

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

  it('announces "Loading clients…" from a live region that exists before the data arrives', async () => {
    mockClientsOk();
    renderPage();

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading clients…');
    expect(busyContainerOf(screen.getByRole('region', { name: 'Clients chart' }))).toHaveAttribute(
      'aria-busy',
      'true',
    );

    await screen.findByText(PERIOD);

    expect(screen.getByRole('status')).toBe(status);
    expect(status).toBeEmptyDOMElement();
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
