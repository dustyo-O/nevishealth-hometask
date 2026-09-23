import { describe, expect, it } from 'vitest';
import type { MonthlyPoint, MonthlySeries } from '@/entities/clients';
import { NOT_RECORDED, notRecorded, withNotRecorded } from './not-recorded';

const CHANNELS = ['Existing clients', 'New organic', 'New paid'];

/** A month whose company figure is `company` and whose three channels read `parts`. */
const month = (company: number, parts: [number, number, number], i = 0): MonthlyPoint => ({
  month: `2024-${String(i + 2).padStart(2, '0')}`,
  byChannel: Object.fromEntries(CHANNELS.map((name, c) => [name, parts[c] ?? 0])),
  total: parts.reduce((sum, value) => sum + value, 0),
  company,
});

const seriesOf = (...points: [number, [number, number, number]][]): MonthlySeries => ({
  channels: CHANNELS,
  points: points.map(([company, parts], i) => month(company, parts, i)),
});

describe('notRecorded', () => {
  it('is not shown for a series whose channels account for every client (FR6)', () => {
    expect(notRecorded(seriesOf([250, [221, 15, 14]], [300, [280, 10, 10]]))).toEqual({
      values: [0, 0],
      shown: false,
    });
  });

  it('is the company figure less every channel, month by month (FR3-AC3)', () => {
    expect(notRecorded(seriesOf([250, [25, 0, 0]], [301, [30, 1, 0]], [10, [10, 0, 0]]))).toEqual({
      values: [225, 270, 0],
      shown: true,
    });
  });

  it('is 0, never negative, in a month whose channels exceed the company figure (FR3, F1)', () => {
    expect(notRecorded(seriesOf([20, [15, 10, 5]], [40, [10, 0, 0]]))).toEqual({
      values: [0, 30],
      shown: true,
    });
  });

  it('is shown across the whole series when only one month has a remainder (FR4, F2)', () => {
    const { values, shown } = notRecorded(
      seriesOf([10, [10, 0, 0]], [10, [5, 5, 0]], [11, [10, 0, 0]], [10, [0, 0, 10]]),
    );
    expect(values).toEqual([0, 0, 1, 0]);
    expect(shown).toBe(true);
  });

  it('is empty and not shown for a series with no months', () => {
    expect(notRecorded({ channels: CHANNELS, points: [] })).toEqual({ values: [], shown: false });
  });
});

describe('withNotRecorded', () => {
  it('returns the very same series when nothing is unrecorded, so the chart is unchanged (FR6)', () => {
    const series = seriesOf([250, [221, 15, 14]]);
    expect(withNotRecorded(series)).toBe(series);
  });

  it('puts Not recorded first — the base of the stack — and in every month, zero included (FR3, FR4)', () => {
    const { channels, points } = withNotRecorded(seriesOf([250, [25, 0, 0]], [10, [10, 0, 0]]));
    expect(channels).toEqual([NOT_RECORDED, ...CHANNELS]);
    expect(points.map((point) => point.byChannel[NOT_RECORDED])).toEqual([225, 0]);
  });

  it("makes each month's total its company figure, and the parts add up to it (FR3-AC1, FR4-AC3)", () => {
    const { channels, points } = withNotRecorded(seriesOf([250, [25, 0, 0]], [301, [30, 1, 0]]));
    expect(points.map((point) => point.total)).toEqual([250, 301]);
    for (const point of points) {
      const parts = channels.map((name) => point.byChannel[name] ?? NaN);
      expect(parts.reduce((sum, value) => sum + value, 0)).toBe(point.total);
    }
  });

  it('leaves an overshooting month as tall as its channels, above the company figure (FR3)', () => {
    const { points } = withNotRecorded(seriesOf([20, [15, 10, 5]], [40, [10, 0, 0]]));
    expect(points[0]).toMatchObject({ total: 30, company: 20 });
    expect(points[0]?.byChannel[NOT_RECORDED]).toBe(0);
  });

  it('reads February 2024 as supplied: 225 / 25 / 0 / 0 = 250 (FR3-AC3)', () => {
    const [feb] = withNotRecorded(seriesOf([250, [25, 0, 0]])).points;
    expect(feb).toEqual({
      month: '2024-02',
      byChannel: { [NOT_RECORDED]: 225, 'Existing clients': 25, 'New organic': 0, 'New paid': 0 },
      total: 250,
      company: 250,
    });
  });
});
