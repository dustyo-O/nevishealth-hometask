import { describe, expect, it } from 'vitest';
import { toMonthlySeries, type MonthlyPoint, type MonthlySeries } from '@/entities/clients';
import { BARS_HEIGHT, drawnPx, LIFT_PX, pxPerClientFor, toDrawing } from './drawn-series';
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

describe('the curve (004 FR4, §2.4)', () => {
  it('lifts by four pixels times log2(clients + 1)', () => {
    expect(LIFT_PX).toBe(4);
  });

  // The token is not readable from here (vitest hands CSS back empty); the browser suite catches a
  // drift, since a shorter plot box would draw July's parts under their curve.
  it('measures the bars against the plot box `PLOT_HEIGHT` draws: 338 less 5 above and 30 of labels', () => {
    expect(PLOT_HEIGHT).toBe(338);
    expect(BARS_HEIGHT).toBe(303);
  });

  it('is a share of the scale, not a number of clients: the same pixels whatever the top reads', () => {
    expect(pxPerClientFor(400)).toBeCloseTo(303 / 400, 12);
    expect(pxPerClientFor(500)).toBeLessThan(pxPerClientFor(400));
    for (const top of [400, 500]) expect(drawnPx(1, pxPerClientFor(top))).toBeCloseTo(4, 9);
  });

  it('draws nobody as nothing, one client at 4 px, two at 6.34, three at 8 — tailing off', () => {
    const px = pxPerClientFor(400);
    expect(drawnPx(0, px)).toBe(0);
    expect(drawnPx(1, px)).toBeCloseTo(4, 9);
    expect(drawnPx(2, px)).toBeCloseTo(4 * Math.log2(3), 9);
    expect(drawnPx(2, px)).toBeCloseTo(6.34, 2);
    expect(drawnPx(3, px)).toBeCloseTo(8, 9);
    // Two clients look taller than one — the comparison the flat floor threw away.
    expect(drawnPx(2, px)).toBeGreaterThan(drawnPx(1, px) + 2);
  });

  it('only ever lifts: a part of 30 clients is drawn to its true height, not to the curve', () => {
    const px = pxPerClientFor(400);
    expect(4 * Math.log2(31)).toBeLessThan(30 * px);
    expect(drawnPx(30, px)).toBeCloseTo(30 * px, 9);
    for (const v of [1, 2, 5, 20, 24, 25, 100, 331])
      expect(drawnPx(v, px)).toBeGreaterThanOrEqual(v * px);
  });
});

describe('toDrawing', () => {
  const px = pxPerClientFor(400);
  /** A part's drawn height in clients, at the scale a 334-client month puts the top at. */
  const lifted = (clients: number) => drawnPx(clients, px) / px;

  it('lifts every small part with clients in it onto the curve, and borrows it from Existing clients', () => {
    const [bar] = toDrawing(seriesOf([331, 2, 1])).bars;
    expect(bar?.heights['New organic']).toBeCloseTo(lifted(2), 9);
    expect(bar?.heights['New paid']).toBeCloseTo(lifted(1), 9);
    expect(bar?.heights['Existing clients']).toBeCloseTo(
      331 - (lifted(2) - 2) - (lifted(1) - 1),
      9,
    );
  });

  it('draws two clients visibly taller than one, not the same flat height', () => {
    const [bar] = toDrawing(seriesOf([331, 2, 1])).bars;
    const perPx = (clients: number | undefined) => (clients ?? 0) * px;
    expect(perPx(bar?.heights['New organic'])).toBeCloseTo(6.34, 2);
    expect(perPx(bar?.heights['New paid'])).toBeCloseTo(4, 9);
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

  it('leaves zero at zero and a part already taller than its curve at its figure', () => {
    const [bar] = toDrawing(seriesOf([300, 0, 30])).bars;
    expect(bar?.heights).toEqual({ 'Existing clients': 300, 'New organic': 0, 'New paid': 30 });
  });

  it('gives way where Existing clients cannot pay without falling below its own curve', () => {
    // A 334-client month puts the scale at 400: 3 existing clients would pay 6.65 of them for a
    // one- and a two-client part, and none at all cannot pay anything.
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

  it('carries the scale the curve was worked out against, from the true totals', () => {
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
    expect(july['New organic']).toBeCloseTo(lifted(2), 9);
    expect(july['New paid']).toBeCloseTo(lifted(1), 9);
    expect(sum(july)).toBeCloseTo(334, 9);
  });
});
