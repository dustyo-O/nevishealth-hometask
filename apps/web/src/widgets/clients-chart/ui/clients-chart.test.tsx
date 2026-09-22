import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
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
    expect(screen.queryByText('Feb 2024', readable)).toBeNull();
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
});
