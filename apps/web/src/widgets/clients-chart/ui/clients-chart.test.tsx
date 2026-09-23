import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clientsQueryOptions } from '@/entities/clients';
import { createQueryClient } from '@/shared/api';
import { ClientsChart } from './clients-chart';
import { shippedClients } from '@/test/fixtures/shipped-clients';

/**
 * jsdom has no `ResizeObserver`, so the responsive container never learns its size and renders
 * no SVG at all — every assertion below would pass against an empty `div` (003 R-5). Settled in
 * slice 1: the widget takes `initialDimension` as a prop and forwards it to the container, and
 * only tests pass it. A global stub was the alternative; a stub that never reports a size still
 * draws nothing, and one that fakes a size would lie to every other test in the suite.
 */
const SIZE = { width: 1000, height: 338 };

const MONTH_LABELS = [
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
];

/**
 * The bars grow in (FR7), and in jsdom that growth never advances: with motion allowed the bar
 * layers stay empty however long the test waits (measured: 0 paths after 1.5 s). The shape of
 * the drawing is this file's subject; the growth is a browser question (slice 5's e2e). So these
 * tests are the viewer who asked for less motion, for whom the bars are simply there (FR7-AC2).
 */
const preferLessMotion = () => {
  const allowMotion = window.matchMedia.bind(window);
  vi.spyOn(window, 'matchMedia').mockImplementation((media) => ({
    ...allowMotion(media),
    matches: media.includes('prefers-reduced-motion: reduce'),
  }));
};

beforeEach(preferLessMotion);

/** The page mounts the chart only once the figures are in the cache; so does this. */
const renderChart = () => {
  const client = createQueryClient();
  client.setQueryData(clientsQueryOptions().queryKey, shippedClients());
  return render(
    <QueryClientProvider client={client}>
      <ClientsChart initialDimension={SIZE} />
    </QueryClientProvider>,
  );
};

const drawingOf = (container: HTMLElement) => {
  const svg = container.querySelector('svg');
  if (svg === null) throw new Error('The chart rendered no SVG');
  return svg;
};

const textsOf = (svg: SVGSVGElement) =>
  [...svg.querySelectorAll('text')].map((text) => text.textContent);

/**
 * The `aria-hidden` wrapper around everything drawn. jsdom lays nothing out, so it is given the
 * size the drawing was given, at the viewport's origin — the pointer's coordinates then mean what
 * they mean in a browser.
 */
const drawingBox = (container: HTMLElement) => {
  const drawing = drawingOf(container).closest<HTMLElement>('[aria-hidden="true"]');
  if (drawing === null) throw new Error('The drawing is not hidden');
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, SIZE.width, SIZE.height),
  );
  return drawing;
};

/** The middle of a month's column: 32 px of y-axis on the left, 16 px of margin on the right. */
const columnOf = (month: number) => ({
  clientX: 32 + (month + 0.5) * ((SIZE.width - 32 - 16) / 12),
  clientY: SIZE.height / 2,
});

const JUN = 4;

const hover = (drawing: HTMLElement, month: number) =>
  fireEvent.pointerMove(drawing, { ...columnOf(month), pointerType: 'mouse' });

/**
 * What the drawing shows about a month — the tint, then the panel — each marked with the month
 * it stands on.
 */
const shownIn = (drawing: HTMLElement) =>
  [...drawing.querySelectorAll<HTMLElement>('[data-month]')].map((node) => ({
    month: node.dataset['month'],
    panel: node.querySelector('dl') !== null,
  }));

const tintIn = (drawing: HTMLElement) =>
  drawing.querySelector<HTMLElement>('[data-month]:not(:has(dl))');

const tap = (
  target: Element,
  at: { clientX: number; clientY: number } = { clientX: 0, clientY: 0 },
) => fireEvent.pointerDown(target, { ...at, pointerType: 'touch' });

const panelIn = (drawing: HTMLElement) => drawing.querySelector('dl')?.parentElement ?? null;

describe('ClientsChart', () => {
  it('draws an SVG at the size it is given', () => {
    const svg = drawingOf(renderChart().container);
    expect(svg).toHaveAttribute('width', String(SIZE.width));
    expect(svg).toHaveAttribute('height', String(SIZE.height));
  });

  it('draws twelve bars, each in three parts coloured by channel (FR1-AC1)', () => {
    const svg = drawingOf(renderChart().container);
    for (const key of ['existing', 'organic', 'paid']) {
      expect(svg.querySelectorAll(`path[fill="var(--color-channel-${key})"]`)).toHaveLength(12);
    }
  });

  it("stacks each month's parts to the Company row's figure, bottom-up in channel order (FR1-AC2/AC5)", () => {
    const svg = drawingOf(renderChart().container);
    // The scale, read from the drawing itself: the gridlines at 0 and at the top (400).
    const gridYs = [...svg.querySelectorAll('line')].map((line) => Number(line.getAttribute('y1')));
    const pxPerClient = (Math.max(...gridYs) - Math.min(...gridYs)) / 400;
    const segments = ['existing', 'organic', 'paid'].map((key) =>
      [...svg.querySelectorAll(`path[fill="var(--color-channel-${key})"]`)].map((path) => ({
        top: Number(path.getAttribute('y')),
        height: Number(path.getAttribute('height')),
      })),
    );
    const company = shippedClients().company.values;
    company.forEach((total, month) => {
      const [existing, organic, paid] = segments.map((series) => series[month]!);
      const drawn = (existing!.height + organic!.height + paid!.height) / pxPerClient;
      expect(drawn).toBeCloseTo(total, 1);
      // Each part sits directly on the one below it.
      expect(organic!.top + organic!.height).toBeCloseTo(existing!.top, 3);
      expect(paid!.top + paid!.height).toBeCloseTo(organic!.top, 3);
    });
  });

  it('names the twelve months beneath the bars and labels the scale 0 to 400 in hundreds (FR1-AC1, FR2-AC1/AC2)', () => {
    const texts = textsOf(drawingOf(renderChart().container));
    expect(texts.filter((text) => MONTH_LABELS.includes(text ?? ''))).toEqual(MONTH_LABELS);
    expect(texts.filter((text) => !MONTH_LABELS.includes(text ?? ''))).toEqual([
      '0',
      '100',
      '200',
      '300',
      '400',
    ]);
  });

  it('runs a line across the plot at each labelled step and none between the months (FR2-AC3/AC4)', () => {
    const lines = [...drawingOf(renderChart().container).querySelectorAll('line')];
    expect(lines).toHaveLength(5);
    for (const line of lines) {
      expect(line.getAttribute('y1')).toBe(line.getAttribute('y2'));
      expect(line).toHaveAttribute('stroke-dasharray');
    }
  });

  it('keeps the drawing away from assistive technology: no loose axis text (FR6-AC4)', () => {
    const { container } = renderChart();
    expect(drawingOf(container).closest('[aria-hidden="true"]')).not.toBeNull();
    // Text queries read through `aria-hidden`, so they are told to skip it explicitly.
    const readable = { ignore: '[aria-hidden="true"], [aria-hidden="true"] *' };
    // The hidden table names every month on purpose (FR6-AC2); nothing else may.
    const months = screen.queryAllByText('Feb 2024', readable);
    expect(months.map((node) => node.closest('table') !== null)).toEqual([true]);
    expect(screen.queryByText('400', readable)).toBeNull();
  });

  it('names the three parts in a legend, bottom-up order, each with its swatch (FR3-AC1)', () => {
    renderChart();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Existing clients',
      'New organic',
      'New paid',
    ]);
    for (const item of items) {
      expect(item.querySelector('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('has no accessibility violations', async () => {
    const { container } = renderChart();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is one focus stop, named for what it shows and its period, with a hint for the keys (FR5-AC1, FR6-AC5)', () => {
    renderChart();
    const chart = screen.getByRole('group', {
      name: 'Clients per month by acquisition channel, Feb 2024 to Jan 2025',
    });
    expect(chart).toHaveAttribute('tabindex', '0');
    expect(chart).toHaveAttribute('aria-roledescription', 'chart');
    expect(chart).toHaveAccessibleDescription('Use Left and Right to read each month.');
    // The whole drawing sits inside the focus target and is hidden from assistive technology.
    const drawing = chart.querySelector('svg')?.closest('[aria-hidden="true"]');
    expect(drawing).not.toBeNull();
    expect(chart.contains(drawing ?? null)).toBe(true);
  });

  it('keeps a click from moving focus into the hidden drawing (003 §2.4, consult Q5)', () => {
    const { container } = renderChart();
    const drawing = drawingOf(container).closest('[aria-hidden="true"]');
    if (drawing === null) throw new Error('The drawing is not hidden');
    // `fireEvent` returns false when a handler called `preventDefault`.
    expect(fireEvent.mouseDown(drawing.querySelector('path') ?? drawing)).toBe(false);
  });

  it('reads February on arrival, walks with Left and Right, and stops at both ends (FR5-AC2–AC5, FR6-AC1)', async () => {
    const user = userEvent.setup();
    renderChart();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/^$/);

    await user.tab();
    expect(screen.getByRole('group')).toHaveFocus();
    expect(status).toHaveTextContent(
      'Feb 2024: existing clients 221, new organic 15, new paid 14, total 250',
    );
    await user.keyboard('{ArrowRight}');
    expect(status).toHaveTextContent(/^Mar 2024: .*, total 267$/);
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(status).toHaveTextContent(/^Feb 2024: /);
    await user.keyboard('{ArrowRight>15/}');
    expect(status).toHaveTextContent(/^Jan 2025: .*, total 350$/);
  });

  it('closes on Escape and keeps the outline; the next move opens it again (FR5-AC6)', async () => {
    const user = userEvent.setup();
    renderChart();
    await user.tab();
    await user.keyboard('{ArrowRight}{Escape}');
    expect(screen.getByRole('group')).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent(/^$/);
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('status')).toHaveTextContent(/^Apr 2024: /);
  });

  it('clears on leaving and starts at February again on return (FR4-AC8, FR5-AC7)', async () => {
    const user = userEvent.setup();
    renderChart();
    await user.tab();
    await user.keyboard('{ArrowRight>4/}');
    expect(screen.getByRole('status')).toHaveTextContent(/^Jun 2024: /);
    await user.tab();
    expect(screen.getByRole('group')).not.toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent(/^$/);
    await user.tab({ shift: true });
    expect(screen.getByRole('status')).toHaveTextContent(/^Feb 2024: /);
  });

  it('gives the same figures as a table of twelve months, outside the drawing and the focus stop (FR6-AC2)', () => {
    renderChart();
    const table = screen.getByRole('table', {
      name: 'Clients per month by acquisition channel, Feb 2024 to Jan 2025',
    });
    expect(table.closest('[aria-hidden="true"]')).toBeNull();
    expect(screen.getByRole('group').contains(table)).toBe(false);

    const [header, ...rows] = within(table).getAllByRole('row');
    const columns = within(header!).getAllByRole('columnheader');
    expect(columns.map((th) => th.textContent)).toEqual([
      'Month',
      'Existing clients',
      'New organic',
      'New paid',
      'Total',
    ]);
    for (const th of columns) expect(th).toHaveAttribute('scope', 'col');

    expect(rows).toHaveLength(12);
    const company = shippedClients().company.values;
    rows.forEach((row, month) => {
      const heading = within(row).getByRole('rowheader');
      expect(heading).toHaveTextContent(MONTH_LABELS[month]!);
      expect(heading).toHaveAttribute('scope', 'row');
      const cells = within(row)
        .getAllByRole('cell')
        .map((td) => Number(td.textContent));
      expect(cells).toHaveLength(4);
      expect(cells[0]! + cells[1]! + cells[2]!).toBe(cells[3]);
      expect(cells[3]).toBe(company[month]);
    });
    expect(
      within(rows[0]!)
        .getAllByRole('cell')
        .map((td) => td.textContent),
    ).toEqual(['221', '15', '14', '250']);
  });

  it("shows the pointed month's panel: the month, its three parts bottom-up, then the total (FR4-AC1/AC9)", () => {
    const drawing = drawingBox(renderChart().container);
    expect(panelIn(drawing)).toBeNull();

    hover(drawing, 0);
    const panel = panelIn(drawing);
    expect(panel).toHaveAttribute('data-month', '2024-02');
    expect(panel?.querySelector('p')).toHaveTextContent('Feb 2024');
    const rows = [...(panel?.querySelectorAll('dl > div') ?? [])].map((row) => [
      row.querySelector('dt')?.textContent,
      row.querySelector('dd')?.textContent,
    ]);
    expect(rows).toEqual([
      ['Existing clients', '221'],
      ['New organic', '15'],
      ['New paid', '14'],
      ['Total', '250'],
    ]);
  });

  it('moves the panel with the pointer and hides it when the pointer leaves (FR4-AC3)', () => {
    const drawing = drawingBox(renderChart().container);
    hover(drawing, JUN);
    expect(panelIn(drawing)).toHaveAttribute('data-month', '2024-06');
    hover(drawing, 6);
    expect(panelIn(drawing)).toHaveAttribute('data-month', '2024-08');
    fireEvent.pointerLeave(drawing, { pointerType: 'mouse' });
    expect(panelIn(drawing)).toBeNull();
  });

  it('hides the panel when the pointer moves onto the axes, off every column (FR4-AC3)', () => {
    const drawing = drawingBox(renderChart().container);
    hover(drawing, JUN);
    fireEvent.pointerMove(drawing, { clientX: 10, clientY: SIZE.height / 2, pointerType: 'mouse' });
    expect(panelIn(drawing)).toBeNull();
  });

  it('shows nothing to the pointer that the live region would say: pointing is for the eye (FR6-AC3)', () => {
    const drawing = drawingBox(renderChart().container);
    hover(drawing, JUN);
    expect(screen.getByRole('status')).toHaveTextContent(/^$/);
  });

  it('closes the panel when the outline leaves (FR4-AC8)', async () => {
    const user = userEvent.setup();
    const drawing = drawingBox(renderChart().container);
    await user.tab();
    expect(panelIn(drawing)).toHaveAttribute('data-month', '2024-02');
    await user.tab();
    expect(panelIn(drawing)).toBeNull();
  });

  it('hover June, then Tab: the tint, the panel and the live region all say February (FR5-AC2, tech review F1)', async () => {
    const user = userEvent.setup();
    const drawing = drawingBox(renderChart().container);
    hover(drawing, JUN);
    expect(shownIn(drawing)).toEqual([
      { month: '2024-06', panel: false },
      { month: '2024-06', panel: true },
    ]);

    // The pointer stays on June; the outline arrives.
    await user.tab();
    expect(shownIn(drawing)).toEqual([
      { month: '2024-02', panel: false },
      { month: '2024-02', panel: true },
    ]);
    expect(panelIn(drawing)?.querySelector('p')).toHaveTextContent('Feb 2024');
    expect(screen.getByRole('status')).toHaveTextContent(/^Feb 2024: /);
  });

  it("tints the month being read, in that month's column only, and follows the keys (FR4-AC2, FR5-AC3)", async () => {
    const user = userEvent.setup();
    const drawing = drawingBox(renderChart().container);
    expect(tintIn(drawing)).toBeNull();

    hover(drawing, 6);
    const tint = tintIn(drawing);
    expect(tint).toHaveAttribute('data-month', '2024-08');
    // One column, placed by the widget's own index: the stylesheet turns it into pixels.
    expect(tint?.style.getPropertyValue('--month-index')).toBe('6');
    expect(drawing.querySelectorAll('[data-month]')).toHaveLength(2);

    fireEvent.pointerLeave(drawing, { pointerType: 'mouse' });
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(tintIn(drawing)?.style.getPropertyValue('--month-index')).toBe('1');
  });

  it("draws no tint of the library's own: its cursor follows its index, not ours (tech review F1)", () => {
    const drawing = drawingBox(renderChart().container);
    hover(drawing, JUN);
    expect(drawing.querySelector('.recharts-tooltip-cursor')).toBeNull();
  });

  it('takes the tint away with the panel on Escape, and keeps the outline (FR5-AC6)', async () => {
    const user = userEvent.setup();
    const drawing = drawingBox(renderChart().container);
    await user.tab();
    expect(tintIn(drawing)).not.toBeNull();
    await user.keyboard('{Escape}');
    expect(shownIn(drawing)).toEqual([]);
    expect(screen.getByRole('group')).toHaveFocus();
  });

  it('opens a tapped month, and a tap on another month replaces it (FR4-AC4/AC5)', () => {
    const drawing = drawingBox(renderChart().container);
    tap(drawing, columnOf(0));
    expect(shownIn(drawing).map(({ month }) => month)).toEqual(['2024-02', '2024-02']);
    tap(drawing, columnOf(6));
    expect(shownIn(drawing).map(({ month }) => month)).toEqual(['2024-08', '2024-08']);
  });

  it('selects a month tapped anywhere in its column, above its bar too (FR4)', () => {
    const drawing = drawingBox(renderChart().container);
    // Six pixels below the top of the plot: every bar ends far lower (the tallest is 350 of 400).
    tap(drawing, { clientX: columnOf(JUN).clientX, clientY: 11 });
    expect(panelIn(drawing)).toHaveAttribute('data-month', '2024-06');
  });

  it('keeps a tapped panel when the finger lifts: a touch pointer leaving is not the pointer moving off (FR4-AC4)', () => {
    const drawing = drawingBox(renderChart().container);
    tap(drawing, columnOf(JUN));
    fireEvent.pointerUp(drawing, { ...columnOf(JUN), pointerType: 'touch' });
    fireEvent.pointerLeave(drawing, { pointerType: 'touch' });
    expect(panelIn(drawing)).toHaveAttribute('data-month', '2024-06');
  });

  it('dismisses on a tap on the legend (FR4-AC6)', () => {
    const drawing = drawingBox(renderChart().container);
    tap(drawing, columnOf(JUN));
    tap(within(screen.getByRole('list')).getByText('New organic'));
    expect(shownIn(drawing)).toEqual([]);
  });

  it("dismisses on a tap on the card's padding around the chart (FR4-AC7)", () => {
    const { container } = renderChart();
    const drawing = drawingBox(container);
    tap(drawing, columnOf(JUN));
    // The widget's own root: the padding between the card's edge and the plot.
    tap(container.firstElementChild!);
    expect(shownIn(drawing)).toEqual([]);
  });

  it('dismisses on a tap anywhere else on the page, such as the table card (FR4)', () => {
    const drawing = drawingBox(renderChart().container);
    tap(drawing, columnOf(JUN));
    tap(document.body);
    expect(shownIn(drawing)).toEqual([]);
  });

  it('dismisses on a tap on the axes, inside the plot box but in no month (FR4)', () => {
    const drawing = drawingBox(renderChart().container);
    tap(drawing, columnOf(JUN));
    tap(drawing, { clientX: columnOf(JUN).clientX, clientY: SIZE.height - 10 });
    expect(shownIn(drawing)).toEqual([]);
  });

  it('listens to the document only while a month is open', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const drawing = drawingBox(renderChart().container);
    const pointerdowns = (spy: typeof add) =>
      spy.mock.calls.filter(([type]) => type === 'pointerdown').length;
    expect(pointerdowns(add)).toBe(0);
    tap(drawing, columnOf(JUN));
    expect(pointerdowns(add)).toBe(1);
    tap(document.body);
    expect(pointerdowns(remove)).toBe(1);
  });

  it('has no accessibility violations while a month is being read', async () => {
    const user = userEvent.setup();
    const { container } = renderChart();
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(await axe(container)).toHaveNoViolations();
  });
});
