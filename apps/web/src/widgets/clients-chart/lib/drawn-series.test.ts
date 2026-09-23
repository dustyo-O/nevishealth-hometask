import { describe, expect, it } from 'vitest';
import { toMonthlySeries, type MonthlyPoint, type MonthlySeries } from '@/entities/clients';
import { BARS_HEIGHT, floorFor, MIN_PART_PX, toDrawing } from './drawn-series';
import { withExistingClients } from './existing-clients';
import { PLOT_HEIGHT } from './plot-geometry';
import { yScale } from './y-scale';
import { shippedClients } from '@/test/fixtures/shipped-clients';

const CHANNELS = ['Existing clients', 'New organic', 'New paid'];

/** A month as the widget reads it: its three true parts, the total their sum and its company. */
const month = ([existing, organic, paid]: [number, number, number], i = 0): MonthlyPoint => ({
  month: `2024-${String(i + 2).padStart(2, '0')}`,
  byChannel: { 'Existing clients': existing, 'New organic': organic, 'New paid': paid },
  total: existing + organic + paid,
  company: existing + organic + paid,
});

const seriesOf = (...parts: [number, number, number][]): MonthlySeries => ({
  channels: CHANNELS,
  points: parts.map((p, i) => month(p, i)),
});

const sum = (heights: Readonly<Record<string, number>>) =>
  Object.values(heights).reduce((total, value) => total + value, 0);

describe('the floor (004 FR4, §2.4)', () => {
  it('is four pixels', () => {
    expect(MIN_PART_PX).toBe(4);
  });

  // The token is not readable from here (vitest hands CSS back empty); the browser suite catches a
  // drift, since a shorter plot box would draw July's parts under four pixels.
  it('measures the bars against the plot box `--chart-plot-h` draws: 338 less 5 above and 30 of labels', () => {
    expect(PLOT_HEIGHT).toBe(338);
    expect(BARS_HEIGHT).toBe(303);
  });

  it('is a share of the scale, not a number of clients: four pixels whatever the top reads', () => {
    expect(floorFor(400) * (BARS_HEIGHT / 400)).toBeCloseTo(4, 9);
    expect(floorFor(500) * (BARS_HEIGHT / 500)).toBeCloseTo(4, 9);
    expect(floorFor(500)).toBeGreaterThan(floorFor(400));
  });
});

describe('toDrawing', () => {
  const floor = floorFor(400);

  it('lifts every small part with clients in it to the floor, and borrows it from Existing clients', () => {
    const [bar] = toDrawing(seriesOf([331, 2, 1])).bars;
    expect(bar?.heights['New organic']).toBeCloseTo(floor, 9);
    expect(bar?.heights['New paid']).toBeCloseTo(floor, 9);
    expect(bar?.heights['Existing clients']).toBeCloseTo(331 - (floor - 2) - (floor - 1), 9);
  });

  it("keeps each bar's total exactly its figure: borrowed, never added (FR4-AC2)", () => {
    const drawing = toDrawing(seriesOf([331, 2, 1], [248, 1, 1], [250, 0, 0]));
    expect(drawing.bars.map(({ heights }) => sum(heights))).toEqual([
      expect.closeTo(334, 9),
      expect.closeTo(250, 9),
      250,
    ]);
  });

  it('draws a month with no newly acquired clients exactly to its figures (FR4-AC3)', () => {
    const series = seriesOf([250, 0, 0]);
    expect(toDrawing(series).bars[0]?.heights).toEqual(series.points[0]?.byChannel);
  });

  it('leaves zero at zero and a part already taller than the floor at its figure', () => {
    const [bar] = toDrawing(seriesOf([300, 0, 20])).bars;
    expect(bar?.heights).toEqual({ 'Existing clients': 300, 'New organic': 0, 'New paid': 20 });
  });

  it('gives way where Existing clients cannot pay without falling below the floor itself', () => {
    // A 334-client month puts the scale at 400 and the floor at 5.28 clients: 3 existing clients
    // cannot pay 8.56 of them, and none at all cannot pay anything.
    const series = seriesOf([3, 1, 1], [0, 2, 1], [331, 2, 1]);
    expect(
      toDrawing(series)
        .bars.slice(0, 2)
        .map(({ heights }) => heights),
    ).toEqual(series.points.slice(0, 2).map(({ byChannel }) => byChannel));
  });

  it('never draws a part negative, whatever the figures', () => {
    const drawing = toDrawing(seriesOf([3, 1, 1], [0, 2, 1], [6, 1, 0], [331, 2, 1]));
    for (const { heights } of drawing.bars) {
      for (const value of Object.values(heights)) expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('carries the scale the floor was worked out against, from the true totals', () => {
    const series = seriesOf([331, 2, 1]);
    expect(toDrawing(series).scale).toEqual(yScale(series));
  });

  it('keeps the months and the stacking order', () => {
    const drawing = toDrawing(seriesOf([250, 0, 0], [331, 2, 1]));
    expect(drawing.channels).toEqual(CHANNELS);
    expect(drawing.bars.map(({ month: m }) => m)).toEqual(['2024-02', '2024-03']);
  });

  it('leaves the series it was given untouched: the panel, table and announcement read that one', () => {
    const series = withExistingClients(toMonthlySeries(shippedClients()));
    const before = structuredClone(series);
    toDrawing(series);
    expect(series).toEqual(before);
  });

  it('draws the supplied July lifted and February as it is', () => {
    const series = withExistingClients(toMonthlySeries(shippedClients()));
    const { bars } = toDrawing(series);
    expect(bars[0]?.heights).toEqual({ 'Existing clients': 250, 'New organic': 0, 'New paid': 0 });
    const july = bars[5]?.heights ?? {};
    expect(july['New organic']).toBeCloseTo(floor, 9);
    expect(july['New paid']).toBeCloseTo(floor, 9);
    expect(sum(july)).toBeCloseTo(334, 9);
  });
});
